import { getConfig } from "../utils/config.js";

const ELEVEN_API_BASE = "https://api.elevenlabs.io/v1";

const TONE_PRESETS = {
  alegre: {
    label: "Alegre",
    style: 0.8,
    stability: 0.35,
    similarity_boost: 0.7,
    style_preset: "cheerful"
  },
  informativo: {
    label: "Informativo",
    style: 0.4,
    stability: 0.55,
    similarity_boost: 0.75,
    style_preset: "newscaster"
  },
  narrativo: {
    label: "Narrativo",
    style: 0.55,
    stability: 0.6,
    similarity_boost: 0.72,
    style_preset: "narration"
  },
  podcast: {
    label: "Podcast",
    style: 0.65,
    stability: 0.5,
    similarity_boost: 0.68,
    style_preset: "podcast"
  },
  dramatico: {
    label: "Dramático",
    style: 0.75,
    stability: 0.35,
    similarity_boost: 0.8,
    style_preset: "dramatic"
  },
  relajado: {
    label: "Relajado",
    style: 0.3,
    stability: 0.65,
    similarity_boost: 0.7,
    style_preset: "calm"
  }
};

function buildHeaders(apiKey, extra = {}) {
  return {
    "xi-api-key": apiKey,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra
  };
}

export async function listVoices() {
  const config = await getConfig();
  const apiKey = config.elevenLabs.apiKey;
  const response = await fetch(`${ELEVEN_API_BASE}/voices`, {
    method: "GET",
    headers: buildHeaders(apiKey)
  });
  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(`No se pudieron obtener las voces: ${response.status} ${response.statusText} ${error?.detail ?? ""}`);
  }
  const json = await response.json();
  return json?.voices ?? [];
}

export async function getVoiceSettings(voiceId) {
  const config = await getConfig();
  const apiKey = config.elevenLabs.apiKey;
  const response = await fetch(`${ELEVEN_API_BASE}/voices/${voiceId}/settings`, {
    method: "GET",
    headers: buildHeaders(apiKey)
  });
  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(`Error al obtener la configuración de voz: ${detail?.detail ?? response.statusText}`);
  }
  return response.json();
}

export async function synthesizeSpeech({ text, voiceId, format, voiceSettings, tone, speed }) {
  const config = await getConfig();
  const apiKey = config.elevenLabs.apiKey;
  const toneConfig = resolveToneConfig(tone, config);
  const payload = {
    text,
    voice_settings: {
      stability: voiceSettings?.stability ?? toneConfig.stability ?? config.elevenLabs.voiceSettings.stability,
      similarity_boost: voiceSettings?.similarity_boost ?? toneConfig.similarity_boost ?? config.elevenLabs.voiceSettings.similarity_boost,
      style: voiceSettings?.style ?? toneConfig.style ?? config.elevenLabs.voiceSettings.style,
      use_speaker_boost: voiceSettings?.use_speaker_boost ?? config.elevenLabs.voiceSettings.use_speaker_boost
    },
    model_id: voiceSettings?.model_id ?? undefined
  };
  if (toneConfig?.style_preset) {
    payload.style_preset = toneConfig.style_preset;
  }
  const parsedSpeed = Number(speed ?? config.voicePreferences?.speed ?? 1);
  if (!Number.isNaN(parsedSpeed) && parsedSpeed > 0 && Math.abs(parsedSpeed - 1) >= 0.05) {
    payload.generation_config = {
      ...(payload.generation_config ?? {}),
      speed: Math.min(Math.max(parsedSpeed, 0.5), 2)
    };
  }

  const response = await fetch(`${ELEVEN_API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      Accept: audioAccept(format),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(`Error al generar audio: ${response.status} ${response.statusText} ${error?.detail ?? ""}`);
  }

  const blob = await response.blob();
  return {
    blob,
    format: resolveFormat(format),
    fileName: buildFileName(format)
  };
}

export async function createVoice({ name, description, labels, voiceSettings }) {
  const config = await getConfig();
  const apiKey = config.elevenLabs.apiKey;
  const payload = {
    name,
    voice_settings: voiceSettings ?? config.elevenLabs.voiceSettings
  };
  if (description) payload.description = description;
  if (labels) payload.labels = labels;
  const response = await fetch(`${ELEVEN_API_BASE}/voices/add`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(`No se pudo crear la voz: ${detail?.detail ?? response.statusText}`);
  }
  return response.json();
}

export async function cloneVoice({ name, files, labels, description }) {
  const config = await getConfig();
  const apiKey = config.elevenLabs.apiKey;

  const form = new FormData();
  form.append("name", name);
  if (description) {
    form.append("description", description);
  }
  if (labels) {
    form.append("labels", JSON.stringify(labels));
  }
  files.forEach((item, index) => {
    const payload = item?.blob ?? item;
    const filename = item?.name ?? `sample_${index}.mp3`;
    form.append("files", payload, filename);
  });

  const response = await fetch(`${ELEVEN_API_BASE}/voices/add`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey
    },
    body: form
  });

  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(`Fallo la clonación de voz: ${detail?.detail ?? response.statusText}`);
  }
  return response.json();
}

function audioAccept(format = "mp3") {
  switch (resolveFormat(format)) {
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "mp3":
    default:
      return "audio/mpeg";
  }
}

function resolveFormat(format = "mp3") {
  const lower = (format ?? "mp3").toLowerCase();
  if (["mp3", "wav", "ogg"].includes(lower)) {
    return lower;
  }
  return "mp3";
}

function buildFileName(format = "mp3") {
  const date = new Date().toISOString().replace(/[:.]/g, "-");
  return `lectura-${date}.${resolveFormat(format)}`;
}

function resolveToneConfig(tone, config) {
  const preferred = (tone ?? config?.voicePreferences?.tone ?? "informativo").toLowerCase();
  return TONE_PRESETS[preferred] ?? TONE_PRESETS.informativo;
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch (_err) {
    return null;
  }
}

