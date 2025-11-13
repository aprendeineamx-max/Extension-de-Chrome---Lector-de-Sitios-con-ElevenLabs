import { getConfig } from "../utils/config.js";

async function callGroq({ messages, system, model, temperature, maxTokens, endpoint, apiKey }) {
  const config = await getConfig();
  const baseEndpoint = endpoint ?? config.groq.defaultEndpoint;
  const resolvedEndpoint = normalizeEndpoint(baseEndpoint);
  const resolvedKey = apiKey ?? config.groq.apiKeys[0];
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

  const response = await fetch(resolvedEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(`Error en Groq: ${response.status} ${response.statusText} ${detail?.error ?? ""}`);
  }
  const json = await response.json();
  const choice = json?.choices?.[0];
  return {
    text: choice?.message?.content ?? "",
    raw: json
  };
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

function normalizeEndpoint(endpoint) {
  const trimmed = (endpoint ?? "").trim();
  if (!trimmed) {
    throw new Error("Endpoint de Groq no configurado.");
  }
  const lower = trimmed.toLowerCase();
  if (lower.endsWith("/chat/completions") || lower.endsWith("/completions")) {
    return trimmed;
  }
  return `${trimmed.replace(/\/$/, "")}/chat/completions`;
}

