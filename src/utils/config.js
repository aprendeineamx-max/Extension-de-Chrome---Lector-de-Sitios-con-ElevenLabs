import { storage } from "./storage.js";

export const DEFAULT_CONFIG = {
  profileName: "Cuenta de servicio de Phillips",
  elevenLabs: {
    apiKey: "",
    defaultVoiceId: "JYyJjNPfmNJdaby8LdZs",
    voiceSettings: {
      stability: 0.4,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true
    },
    enableVoiceCloning: true
  },
  groq: {
    defaultEndpoint: "https://aprende-workspace-4--llama2-modal-endpoint-fastapi-app.modal.run/v1",
    apiKeys: ["", ""],
    defaultModel: "llama2-70b-chat",
    temperature: 0.6,
    maxTokens: 1024
  },
  huggingFace: {
    apiKey: "",
    voiceId: "JYyJjNPfmNJdaby8LdZs"
  },
  speechToText: {
    provider: "huggingface",
    model: "openai/whisper-large-v2",
    language: "es"
  },
  textToSpeech: {
    format: "mp3",
    sampleRate: 44100
  },
  voicePreferences: {
    tone: "informativo",
    speed: 1,
    skipCodeBlocks: true,
    skipUrls: true,
    prioritizeSpanish: true
  },
  readingPreferences: {
    focusMainContent: true,
    skipNavigation: true,
    skipSidebars: true,
    skipFooter: true,
    skipCodeBlocks: true,
    skipUrls: true,
    maxCharacters: 14000
  },
  downloadPreferences: {
    autoDownload: true,
    subFolder: "Audios Generados por Extension"
  },
  autoDownload: {
    enabled: true,
    path: "Audios Generados por Extension"
  },
  experimental: {
    enableOpenRouter: false,
    enableN8NWebhook: false
  }
};

const CONFIG_KEY = "phillips_voice_companion_config";

export async function ensureConfig() {
  const existing = await storage.get(CONFIG_KEY, null);
  if (!existing) {
    await storage.set(CONFIG_KEY, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  return { ...DEFAULT_CONFIG, ...existing };
}

export async function getConfig() {
  const config = await storage.get(CONFIG_KEY, null);
  return config ? { ...DEFAULT_CONFIG, ...config } : await ensureConfig();
}

export async function setConfig(config) {
  await storage.set(CONFIG_KEY, config);
  return config;
}

export async function updateConfig(patch) {
  const current = await getConfig();
  const next = { ...current, ...patch };
  await setConfig(next);
  return next;
}

