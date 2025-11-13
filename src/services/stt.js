import { getConfig } from "../utils/config.js";

const HUGGING_FACE_BASE = "https://api-inference.huggingface.co/models";
const ELEVEN_STT_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

export async function transcribeAudio({ blob, provider, language }) {
  const config = await getConfig();
  const selectedProvider = provider ?? config.speechToText.provider;
  if (selectedProvider === "elevenlabs") {
    return transcribeElevenLabs({ blob, language, config });
  }
  return transcribeHuggingFace({ blob, language, config });
}

async function transcribeHuggingFace({ blob, language, config }) {
  const model = config.speechToText.model ?? "openai/whisper-large-v2";
  const url = `${HUGGING_FACE_BASE}/${model}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.huggingFace.apiKey}`,
      "Content-Type": "audio/wav",
      "x-wav-sample-rate": "16000",
      "x-language": language ?? config.speechToText.language ?? "es"
    },
    body: await blob.arrayBuffer()
  });
  if (response.status === 503) {
    return { text: "El modelo de Hugging Face está inicializándose, inténtalo en unos segundos." };
  }
  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(`Error al transcribir en Hugging Face: ${response.status} ${response.statusText} ${detail?.error ?? ""}`);
  }
  const data = await response.json();
  if (Array.isArray(data.text)) {
    return { text: data.text.join(" ") };
  }
  return { text: data.text ?? data?.[0]?.generated_text ?? "" };
}

async function transcribeElevenLabs({ blob, language, config }) {
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  form.append("model_id", config.speechToText.elevenModel ?? "scribe_v1");
  if (language) form.append("language_code", language);

  const response = await fetch(ELEVEN_STT_ENDPOINT, {
    method: "POST",
    headers: {
      "xi-api-key": config.elevenLabs.apiKey
    },
    body: form
  });

  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(`Error al transcribir en ElevenLabs: ${response.status} ${response.statusText} ${detail?.detail ?? ""}`);
  }
  const json = await response.json();
  return { text: json.text ?? json?.transcript ?? "" };
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch (_err) {
    return null;
  }
}

