import { getConfig } from "../utils/config.js";

async function callGroq({ messages, system, model, temperature, maxTokens, endpoint, apiKey }) {
  const config = await getConfig();
  const baseEndpoint = endpoint ?? config.groq.defaultEndpoint;
  const endpointAttempts = buildEndpointAttempts(baseEndpoint);
  const resolvedKey = apiKey ?? getFirstValidKey(config.groq.apiKeys);
  if (!resolvedKey) {
    throw new Error("No hay API Key de Groq configurada.");
  }
  const body = {
    model: model ?? config.groq.defaultModel,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages
    ],
    temperature: temperature ?? config.groq.temperature,
    max_tokens: maxTokens ?? config.groq.maxTokens,
    stream: false
  };

  let lastError = null;

  for (let attemptIndex = 0; attemptIndex < endpointAttempts.length; attemptIndex++) {
    const targetEndpoint = endpointAttempts[attemptIndex];
    const isLastAttempt = attemptIndex === endpointAttempts.length - 1;

    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolvedKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const json = await response.json();
      const choice = json?.choices?.[0];
      return {
        text: choice?.message?.content ?? "",
        raw: json
      };
    }

    const detail = await safeJson(response);
    lastError = formatGroqError(response, detail);

    if (response.status === 404 && !isLastAttempt) {
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError ?? "Error desconocido al comunicarse con Groq.");
}

export async function summarizeContent({ title, text, language = "es" }) {
  const prompt = [
    {
      role: "user",
      content: `Genera un resumen detallado del siguiente contenido web en ${language}. Incluye puntos clave, acciones recomendadas y preguntas abiertas si aplica. Contenido:\n\nTítulo: ${title}\n\n${text}`
    }
  ];
  const result = await callGroq({
    messages: prompt,
    system: "Eres un analista experto que resume contenido web de forma clara y accionable.",
    maxTokens: 800
  });
  return result.text.trim();
}

export async function conversationalReply({ conversation, siteContext }) {
  const messages = conversation.map((entry) => ({
    role: entry.role,
    content: entry.content
  }));

  const system = `Eres un asistente que ayuda al usuario a interactuar con el contenido del sitio web en tiempo real. Observa siempre el contexto actual del sitio:\n${siteContext}\n\nResponde de forma conversacional, breve y en español salvo que el usuario indique lo contrario.`;

  const result = await callGroq({
    messages,
    system,
    maxTokens: 600
  });

  return result.text.trim();
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch (_err) {
    return null;
  }
}

const OPENAI_SUFFIXES = ["/chat/completions", "/completions"];

function buildEndpointAttempts(endpoint) {
  const trimmed = (endpoint ?? "").trim();
  if (!trimmed) {
    throw new Error("Endpoint de Groq no configurado.");
  }

  const baseWithoutSlash = trimmed.replace(/\/+$/, "");
  if (!shouldUseOpenAIStyle(baseWithoutSlash)) {
    return [baseWithoutSlash];
  }

  const baseVariants = new Set([baseWithoutSlash]);
  if (!/\/v1$/i.test(baseWithoutSlash)) {
    baseVariants.add(`${baseWithoutSlash}/v1`);
  }

  const attempts = [];
  baseVariants.forEach((base) => {
    const cleanedBase = base.replace(/\/+$/, "");
    const lower = cleanedBase.toLowerCase();
    if (OPENAI_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
      attempts.push(cleanedBase);
    } else {
      OPENAI_SUFFIXES.forEach((suffix) => attempts.push(`${cleanedBase}${suffix}`));
    }
    attempts.push(cleanedBase);
  });

  const normalized = normalizeEndpoint(baseWithoutSlash);
  attempts.unshift(normalized);

  return attempts
    .map((url) => url.replace(/\/+$/, ""))
    .filter((value, index, self) => value && self.indexOf(value) === index);
}

function normalizeEndpoint(endpoint) {
  const trimmed = (endpoint ?? "").trim();
  if (!trimmed) {
    throw new Error("Endpoint de Groq no configurado.");
  }
  const cleaned = trimmed.replace(/\/+$/, "");
  const lower = cleaned.toLowerCase();
  if (OPENAI_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return cleaned;
  }
  return `${cleaned}/chat/completions`;
}

function shouldUseOpenAIStyle(endpoint) {
  try {
    const parsed = endpoint.startsWith("http") ? new URL(endpoint) : new URL(`https://${endpoint}`);
    const host = parsed.hostname.toLowerCase();
    return host.includes("groq") || host.includes("openrouter") || host.includes("openai");
  } catch (_err) {
    return true;
  }
}

function formatGroqError(response, detail) {
  const status = `${response.status} ${response.statusText}`.trim();
  const detailMessage = extractDetail(detail);
  return detailMessage ? `Error en Groq: ${status} - ${detailMessage}` : `Error en Groq: ${status}`;
}

function extractDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (detail.error) {
    if (typeof detail.error === "string") return detail.error;
    if (typeof detail.error.message === "string") return detail.error.message;
    return JSON.stringify(detail.error);
  }
  return JSON.stringify(detail);
}

function getFirstValidKey(keys = []) {
  if (typeof keys === "string") {
    return keys.trim();
  }
  if (Array.isArray(keys)) {
    return keys.map((key) => key?.trim()).find(Boolean) ?? "";
  }
  return "";
}

