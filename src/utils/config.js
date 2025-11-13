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
let resolvedDefaultsPromise = null;
let envOverridesPromise = null;

export async function ensureConfig() {
  const [defaults, existing] = await Promise.all([getResolvedDefaults(), storage.get(CONFIG_KEY, null)]);
  if (!existing) {
    await storage.set(CONFIG_KEY, defaults);
    return defaults;
  }
  return mergeDeep(defaults, existing);
}

export async function getConfig() {
  const existing = await storage.get(CONFIG_KEY, null);
  if (!existing) {
    return ensureConfig();
  }
  const defaults = await getResolvedDefaults();
  return mergeDeep(defaults, existing);
}

export async function setConfig(config) {
  await storage.set(CONFIG_KEY, config);
  return config;
}

export async function updateConfig(patch) {
  const current = await getConfig();
  const next = mergeDeep(current, patch);
  await setConfig(next);
  return next;
}

async function getResolvedDefaults() {
  if (!resolvedDefaultsPromise) {
    resolvedDefaultsPromise = (async () => {
      const overrides = await loadEnvOverrides();
      return mergeDeep(DEFAULT_CONFIG, overrides);
    })();
  }
  return resolvedDefaultsPromise;
}

async function loadEnvOverrides() {
  if (envOverridesPromise) return envOverridesPromise;

  envOverridesPromise = (async () => {
    const canUseChromeApi = typeof chrome !== "undefined" && chrome?.runtime?.getURL;
    if (!canUseChromeApi) return {};
    try {
      const url = chrome.runtime.getURL("data/env-config.json");
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        return {};
      }
      return await response.json();
    } catch {
      return {};
    }
  })();

  return envOverridesPromise;
}

function mergeDeep(base, override) {
  if (override === undefined) {
    return cloneValue(base);
  }

  if (Array.isArray(override)) {
    return override.slice();
  }

  if (isPlainObject(override) || isPlainObject(base)) {
    const result = {};
    const baseObject = isPlainObject(base) ? base : {};
    const overrideObject = isPlainObject(override) ? override : {};
    const keys = new Set([...Object.keys(baseObject), ...Object.keys(overrideObject)]);

    for (const key of keys) {
      result[key] = mergeDeep(baseObject[key], overrideObject[key]);
    }

    return result;
  }

  return override;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }
  if (isPlainObject(value)) {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = cloneValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

