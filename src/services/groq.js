import { getConfig } from "../utils/config.js";

export async function summarizeContent({ title, text, language = "es" }) {
  const prompt = [
    {
      role: "user",
      content: "Genera un resumen detallado del siguiente contenido web en " + language + ". Incluye puntos clave, acciones recomendadas y preguntas abiertas si aplica. Contenido:\n\nTitulo: " + title + "\n\n" + text
    }
  ];
  const result = await callGroq({
    messages: prompt,
    system: "Eres un analista experto que resume contenido web de forma clara y accionable.",
    maxTokens: 800
  });
  return result.text.trim();
}

export async function translateText({ text, targetLanguage = "es" }) {
  const prompt = [
    {
      role: "user",
      content: `Traduce el siguiente texto al idioma ${targetLanguage}. Mantener el formato original si hay listas o parrafos. Texto:
${text}`
    }
  ];
  const result = await callGroq({
    messages: prompt,
    system: "Eres un experto traductor. Devuelves unicamente la traduccion natural al idioma solicitado sin comentarios adicionales.",
    maxTokens: 400
  });
  return result.text.trim();
}

export async function conversationalReply({ conversation, siteContext }) {
  const messages = conversation.map((entry) => ({
    role: entry.role,
    content: entry.content
  }));

  const system =
    "Eres un asistente que ayuda al usuario a interactuar con el contenido del sitio web en tiempo real. Observa siempre el contexto actual del sitio:\n" +
    siteContext +
    "\n\nResponde de forma conversacional, breve y en espanol salvo que el usuario indique lo contrario.";

  const result = await callGroq({
    messages,
    system,
    maxTokens: 600
  });

  return result.text.trim();
}

async function callGroq({
  messages,
  system,
  model,
  temperature,
  maxTokens,
  endpoint,
  apiKey,
  profileId,
  proxyAuthToken
}) {
  const config = await getConfig();
  const settings = resolveGroqSettings(config, {
    model,
    temperature,
    maxTokens,
    endpoint,
    apiKey,
    profileId,
    proxyAuthToken
  });

  if (!settings.endpoint) {
    throw new Error("Endpoint de Groq no configurado.");
  }

  const endpointAttempts = buildEndpointAttempts(settings.endpoint);
  const hasProxyToken = Boolean(settings.proxyAuthToken);
  const authValue = hasProxyToken ? settings.proxyAuthToken : settings.apiKey;
  const profileTag = settings.profileLabel ? " (" + settings.profileLabel + ")" : "";

  if (settings.requiresProxyToken && !hasProxyToken) {
    throw new Error("Tu endpoint de Modal requiere un Proxy Auth Token" + profileTag + ". Configuralo en las opciones.");
  }

  if (!settings.requiresProxyToken && !authValue) {
    throw new Error("No hay API Key de Groq configurada" + profileTag + ".");
  }

  const body = {
    model: settings.model,
    messages: (system ? [{ role: "system", content: system }] : []).concat(messages),
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    stream: false
  };

  let lastError = null;

  for (let attemptIndex = 0; attemptIndex < endpointAttempts.length; attemptIndex += 1) {
    const targetEndpoint = endpointAttempts[attemptIndex];
    const isLastAttempt = attemptIndex === endpointAttempts.length - 1;

    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + authValue,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const json = await response.json();
      const choice = json && json.choices ? json.choices[0] : null;
      return {
        text: choice && choice.message ? choice.message.content || "" : "",
        raw: json
      };
    }

    const detail = await safeJson(response);
    lastError = formatGroqError(response, detail, targetEndpoint);

    if (response.status === 404 && !isLastAttempt) {
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError || "Error desconocido al comunicarse con Groq. Intentos: " + endpointAttempts.join(", "));
}

const OPENAI_SUFFIXES = ["/chat/completions", "/completions"];

function resolveGroqSettings(config, overrides) {
  const groq = config && config.groq ? config.groq : {};
  const profile = selectGroqProfile(groq, overrides && overrides.profileId);

  const endpoint = pickString([
    overrides && overrides.endpoint,
    profile && profile.endpoint,
    groq.defaultEndpoint
  ]);

  const model = pickString([
    overrides && overrides.model,
    profile && profile.model,
    groq.defaultModel,
    "llama-3.3-70b-versatile"
  ]);

  const temperature = pickNumber([
    overrides && overrides.temperature,
    profile && profile.temperature,
    groq.temperature,
    0.6
  ]);

  const maxTokens = pickNumber([
    overrides && overrides.maxTokens,
    profile && profile.maxTokens,
    groq.maxTokens,
    1024
  ]);

  const apiKey = pickString([
    overrides && overrides.apiKey,
    profile && profile.apiKey,
    getFirstValidKey(groq.apiKeys)
  ]);

  const proxyAuth = pickString([
    overrides && overrides.proxyAuthToken,
    profile && profile.proxyAuthToken,
    groq.proxyAuthToken
  ]);

  return {
    endpoint,
    model,
    temperature,
    maxTokens,
    apiKey,
    proxyAuthToken: proxyAuth,
    profileLabel: profile && profile.label ? profile.label.trim() : "",
    requiresProxyToken: isModalProxyEndpoint(endpoint)
  };
}

function selectGroqProfile(groq, explicitId) {
  const list = Array.isArray(groq && groq.profiles) ? groq.profiles : [];
  if (!list.length) {
    return null;
  }
  if (explicitId) {
    const match = list.find((entry) => entry && entry.id === explicitId);
    if (match) {
      return match;
    }
  }
  if (groq && groq.activeProfileId) {
    const active = list.find((entry) => entry && entry.id === groq.activeProfileId);
    if (active) {
      return active;
    }
  }
  return list[0];
}

function pickString(candidates) {
  for (let i = 0; i < candidates.length; i += 1) {
    const value = typeof candidates[i] === "string" ? candidates[i].trim() : "";
    if (value) {
      return value;
    }
  }
  return "";
}

function pickNumber(candidates) {
  for (let i = 0; i < candidates.length; i += 1) {
    const value = candidates[i];
    if (value === undefined || value === null) {
      continue;
    }
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch (error) {
    return null;
  }
}

function buildEndpointAttempts(endpoint) {
  const trimmed = (endpoint || "").trim();
  if (!trimmed) {
    throw new Error("Endpoint de Groq no configurado.");
  }

  const base = trimmed.replace(/\/+$/, "");
  const baseWithoutV1 = base.replace(/\/v1$/i, "");
  const attemptsSet = new Set();

  attemptsSet.add(base);

  if (base.slice(-3).toLowerCase() !== "/v1") {
    attemptsSet.add(base + "/v1");
  }
  attemptsSet.add(base + "/chat/completions");
  attemptsSet.add(base + "/v1/chat/completions");
  attemptsSet.add(base + "/completions");

  if (base !== baseWithoutV1) {
    attemptsSet.add(baseWithoutV1 + "/chat/completions");
    attemptsSet.add(baseWithoutV1 + "/v1/chat/completions");
    attemptsSet.add(baseWithoutV1 + "/v1");
  }

  attemptsSet.add(normalizeEndpoint(base));

  if (isGroqHost(base)) {
    attemptsSet.add("https://api.groq.com/openai/v1/chat/completions");
  }

  const attempts = Array.from(attemptsSet);
  return attempts
    .map((url) => url.replace(/\/+$/, ""))
    .filter((value, index, self) => value && self.indexOf(value) === index);
}

function normalizeEndpoint(endpoint) {
  const trimmed = (endpoint || "").trim();
  if (!trimmed) {
    throw new Error("Endpoint de Groq no configurado.");
  }
  const cleaned = trimmed.replace(/\/+$/, "");
  const lower = cleaned.toLowerCase();
  for (let i = 0; i < OPENAI_SUFFIXES.length; i += 1) {
    if (lower.endsWith(OPENAI_SUFFIXES[i])) {
      return cleaned;
    }
  }
  return cleaned + "/chat/completions";
}

function formatGroqError(response, detail, endpoint) {
  const status = (response.status + " " + response.statusText).trim();
  const detailMessage = extractDetail(detail);
  const endpointInfo = endpoint ? " (Endpoint: " + endpoint + ")" : "";
  return detailMessage ? "Error en Groq: " + status + endpointInfo + " - " + detailMessage : "Error en Groq: " + status + endpointInfo;
}

function extractDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (detail.error) {
    if (typeof detail.error === "string") return detail.error;
    if (detail.error && typeof detail.error.message === "string") return detail.error.message;
    return JSON.stringify(detail.error);
  }
  return JSON.stringify(detail);
}

function getFirstValidKey(keys) {
  if (!keys) return "";
  if (typeof keys === "string") {
    return keys.trim();
  }
  if (Array.isArray(keys)) {
    for (let i = 0; i < keys.length; i += 1) {
      if (keys[i] && typeof keys[i] === "string" && keys[i].trim()) {
        return keys[i].trim();
      }
    }
  }
  return "";
}

function isGroqHost(endpoint) {
  try {
    const parsed = endpoint.startsWith("http") ? new URL(endpoint) : new URL("https://" + endpoint);
    return parsed.hostname.toLowerCase().indexOf("groq.com") !== -1;
  } catch (error) {
    return false;
  }
}

function isModalProxyEndpoint(endpoint) {
  try {
    const parsed = endpoint.startsWith("http") ? new URL(endpoint) : new URL("https://" + endpoint);
    return parsed.hostname.toLowerCase().endsWith(".modal.run");
  } catch (error) {
    return false;
  }
}
