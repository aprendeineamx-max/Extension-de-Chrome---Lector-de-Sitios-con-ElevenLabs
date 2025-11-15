import { getConfig } from "../utils/config.js";
import { storage } from "../utils/storage.js";

const CACHE_KEY = "phillips_usage_cache_v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getUsageStatus(force = false) {
  if (!force) {
    const cached = await storage.get(CACHE_KEY, null);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const config = await getConfig();
  const result = await fetchUsageData(config);
  await storage.set(CACHE_KEY, { timestamp: Date.now(), data: result });
  return result;
}

async function fetchUsageData(config) {
  const [elevenLabs, groq] = await Promise.allSettled([
    fetchElevenLabsUsage(config),
    fetchGroqUsage(config)
  ]);

  return {
    fetchedAt: Date.now(),
    elevenLabs: elevenLabs.status === "fulfilled" ? elevenLabs.value : buildErrorUsage(elevenLabs.reason),
    groq: groq.status === "fulfilled" ? groq.value : buildErrorUsage(groq.reason)
  };
}

function buildErrorUsage(error) {
  return {
    success: false,
    error: error?.message ?? "No se pudo obtener el uso"
  };
}

async function fetchElevenLabsUsage(config) {
  const apiKey = config?.elevenLabs?.apiKey?.trim();
  if (!apiKey) {
    return buildErrorUsage(new Error("API Key de ElevenLabs no configurada"));
  }
  const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: {
      "xi-api-key": apiKey
    }
  });
  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(detail?.detail ?? `HTTP ${response.status}`);
  }
  const data = await response.json();
  const used = Number(data?.character_count ?? 0);
  const limit = Number(data?.character_limit ?? 0) || null;
  const remaining = limit != null ? Math.max(limit - used, 0) : null;
  return {
    success: true,
    provider: "elevenlabs",
    used,
    limit,
    remaining,
    renewsAt: data?.next_character_count_reset_unix ? data.next_character_count_reset_unix * 1000 : null,
    raw: data
  };
}

async function fetchGroqUsage(config) {
  const groq = config?.groq ?? {};
  const credentials = resolveGroqCredentials(groq);
  if (!credentials.endpoint) {
    return buildErrorUsage(new Error("Endpoint de Groq no configurado"));
  }
  if (!credentials.authToken) {
    return buildErrorUsage(new Error("Configura un API Key o Proxy Token para Groq"));
  }
  const usageUrl = buildUsageEndpoint(credentials.endpoint);
  const response = await fetch(usageUrl, {
    headers: {
      Authorization: `Bearer ${credentials.authToken}`
    }
  });
  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(detail?.detail ?? `HTTP ${response.status}`);
  }
  const data = await response.json();
  const parsed = normalizeGroqUsage(data);
  return {
    success: true,
    provider: "groq",
    ...parsed,
    raw: data
  };
}

function normalizeGroqUsage(data) {
  const usage = data?.usage ?? data;
  const used =
    Number(
      usage?.used ??
        usage?.total_tokens ??
        usage?.tokens_used ??
        usage?.characters_used ??
        usage?.consumed
    ) || 0;
  const limit =
    Number(
      usage?.limit ??
        usage?.total_limit ??
        usage?.character_limit ??
        usage?.tokens_limit ??
        data?.limit
    ) || null;
  const remaining = limit != null ? Math.max(limit - used, 0) : null;
  const periodEnds =
    usage?.period_end ??
    usage?.period_ends ??
    usage?.next_reset ??
    data?.period_end ??
    null;
  return {
    used,
    limit,
    remaining,
    renewsAt: typeof periodEnds === "number" ? periodEnds * 1000 : null
  };
}

function resolveGroqCredentials(groq) {
  const profile = selectGroqProfile(groq, groq.activeProfileId);
  const endpoint = profile?.endpoint?.trim() || groq.defaultEndpoint?.trim() || "";
  const proxyToken = profile?.proxyAuthToken?.trim() || groq.proxyAuthToken?.trim() || "";
  const apiKey = profile?.apiKey?.trim() || getFirstKey(groq.apiKeys);
  const useProxy = endpoint.includes(".modal.run");
  return {
    endpoint,
    authToken: useProxy ? proxyToken || apiKey : apiKey || proxyToken
  };
}

function getFirstKey(keys) {
  if (!keys) return "";
  if (Array.isArray(keys)) {
    return keys.map((key) => key?.trim()).find(Boolean) ?? "";
  }
  if (typeof keys === "string") {
    return keys.trim();
  }
  return "";
}

function selectGroqProfile(groq = {}, explicitId) {
  const list = Array.isArray(groq.profiles) ? groq.profiles : [];
  if (!list.length) return null;
  if (explicitId) {
    const found = list.find((item) => item?.id === explicitId);
    if (found) return found;
  }
  return list[0];
}

function buildUsageEndpoint(endpoint) {
  const cleaned = endpoint.replace(/\/+$/, "");
  if (cleaned.toLowerCase().endsWith("/usage")) {
    return cleaned;
  }
  return `${cleaned}/usage`;
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch (_err) {
    return null;
  }
}
