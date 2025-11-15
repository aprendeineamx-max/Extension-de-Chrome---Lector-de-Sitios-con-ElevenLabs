import { DEFAULT_CONFIG, getConfig, setConfig } from "../utils/config.js";

const state = {
  config: null
};

const elements = {};

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  const config = await getConfig();
  state.config = config;
  populate(config);
});

function cacheElements() {
  elements.elevenApiKey = document.getElementById("elevenApiKey");
  elements.elevenVoiceId = document.getElementById("elevenVoiceId");
  elements.elevenStability = document.getElementById("elevenStability");
  elements.elevenSimilarity = document.getElementById("elevenSimilarity");
  elements.elevenStyle = document.getElementById("elevenStyle");
  elements.elevenSpeakerBoost = document.getElementById("elevenSpeakerBoost");
  elements.groqEndpoint = document.getElementById("groqEndpoint");
  elements.groqModel = document.getElementById("groqModel");
  elements.groqTemperature = document.getElementById("groqTemperature");
  elements.groqMaxTokens = document.getElementById("groqMaxTokens");
  elements.groqApiKeys = document.getElementById("groqApiKeys");
  elements.groqProxyToken = document.getElementById("groqProxyToken");
  elements.groqProxyToken = document.getElementById("groqProxyToken");
  elements.usageElevenThreshold = document.getElementById("usageElevenThreshold");
  elements.usageGroqThreshold = document.getElementById("usageGroqThreshold");
  elements.sttProvider = document.getElementById("sttProvider");
  elements.sttModel = document.getElementById("sttModel");
  elements.sttLanguage = document.getElementById("sttLanguage");
  elements.huggingFaceKey = document.getElementById("huggingFaceKey");
  elements.ttsFormat = document.getElementById("ttsFormat");
  elements.ttsSampleRate = document.getElementById("ttsSampleRate");
  elements.enableAutoDownload = document.getElementById("enableAutoDownload");
  elements.downloadPath = document.getElementById("downloadPath");
  elements.enableOpenRouter = document.getElementById("enableOpenRouter");
  elements.enableN8N = document.getElementById("enableN8N");
  elements.restoreDefaults = document.getElementById("restoreDefaults");
  elements.saveConfig = document.getElementById("saveConfig");
  elements.toast = document.getElementById("toast");
}

function bindEvents() {
  elements.restoreDefaults.addEventListener("click", () => {
    populate(DEFAULT_CONFIG);
    showToast("Valores por defecto restaurados (no olvides guardar).");
  });
  elements.saveConfig.addEventListener("click", async () => {
    const config = collectConfig();
    await setConfig(config);
    showToast("Configuración guardada correctamente.");
  });
}

function populate(config) {
  state.config = config;
  elements.elevenApiKey.value = config.elevenLabs.apiKey ?? "";
  elements.elevenVoiceId.value = config.elevenLabs.defaultVoiceId ?? "";
  elements.elevenStability.value = config.elevenLabs.voiceSettings?.stability ?? 0.4;
  elements.elevenSimilarity.value = config.elevenLabs.voiceSettings?.similarity_boost ?? 0.75;
  elements.elevenStyle.value = config.elevenLabs.voiceSettings?.style ?? 0.5;
  elements.elevenSpeakerBoost.checked = Boolean(config.elevenLabs.voiceSettings?.use_speaker_boost);

  elements.groqEndpoint.value = config.groq.defaultEndpoint ?? "";
  elements.groqModel.value = config.groq.defaultModel ?? "";
  elements.groqTemperature.value = config.groq.temperature ?? 0.6;
  elements.groqMaxTokens.value = config.groq.maxTokens ?? 1024;
  elements.groqApiKeys.value = (config.groq.apiKeys ?? []).join("\n");
  elements.groqProxyToken.value = config.groq.proxyAuthToken ?? "";
  elements.groqProxyToken.value = config.groq.proxyAuthToken ?? "";

  elements.sttProvider.value = config.speechToText.provider ?? "huggingface";
  elements.sttModel.value = config.speechToText.model ?? "";
  elements.sttLanguage.value = config.speechToText.language ?? "es";
  elements.huggingFaceKey.value = config.huggingFace.apiKey ?? "";

  elements.ttsFormat.value = config.textToSpeech.format ?? "mp3";
  elements.ttsSampleRate.value = config.textToSpeech.sampleRate ?? 44100;

  elements.enableAutoDownload.checked = Boolean(config.autoDownload?.enabled);
  elements.downloadPath.value = config.autoDownload?.path ?? "Audios Generados por Extension";

  const alerts = config.usageAlerts ?? DEFAULT_CONFIG.usageAlerts;
  elements.usageElevenThreshold.value = Math.round((alerts?.elevenLabs?.warningRatio ?? 0.2) * 100);
  elements.usageGroqThreshold.value = Math.round((alerts?.groq?.warningRatio ?? 0.2) * 100);

  elements.enableOpenRouter.checked = Boolean(config.experimental?.enableOpenRouter);
  elements.enableN8N.checked = Boolean(config.experimental?.enableN8NWebhook);
}

function collectConfig() {
  const base = state.config ? JSON.parse(JSON.stringify(state.config)) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  return {
    ...base,
    profileName: DEFAULT_CONFIG.profileName,
    elevenLabs: {
      apiKey: elements.elevenApiKey.value.trim(),
      defaultVoiceId: elements.elevenVoiceId.value.trim(),
      voiceSettings: {
        stability: Number(elements.elevenStability.value) || 0,
        similarity_boost: Number(elements.elevenSimilarity.value) || 0,
        style: Number(elements.elevenStyle.value) || 0,
        use_speaker_boost: elements.elevenSpeakerBoost.checked
      }
    },
    groq: {
      ...(base.groq ?? {}),
      defaultEndpoint: elements.groqEndpoint.value.trim(),
      defaultModel: elements.groqModel.value.trim(),
      temperature: Number(elements.groqTemperature.value) || 0.6,
      maxTokens: Number(elements.groqMaxTokens.value) || 1024,
      apiKeys: elements.groqApiKeys.value
        .split("\n")
        .map((key) => key.trim())
        .filter(Boolean),
      proxyAuthToken: elements.groqProxyToken.value.trim()
    },
    speechToText: {
      provider: elements.sttProvider.value,
      model: elements.sttModel.value.trim(),
      language: elements.sttLanguage.value.trim() || "es"
    },
    huggingFace: {
      ...DEFAULT_CONFIG.huggingFace,
      apiKey: elements.huggingFaceKey.value.trim()
    },
    textToSpeech: {
      format: elements.ttsFormat.value.trim() || "mp3",
      sampleRate: Number(elements.ttsSampleRate.value) || 44100
    },
    autoDownload: {
      enabled: elements.enableAutoDownload.checked,
      path: elements.downloadPath.value.trim() || "Audios Generados por Extension"
    },
    usageAlerts: {
      elevenLabs: {
        warningRatio: percentToRatio(elements.usageElevenThreshold.value)
      },
      groq: {
        warningRatio: percentToRatio(elements.usageGroqThreshold.value)
      }
    },
    experimental: {
      enableOpenRouter: elements.enableOpenRouter.checked,
      enableN8NWebhook: elements.enableN8N.checked
    }
  };
}

function percentToRatio(value) {
  const number = Math.max(1, Math.min(100, Number(value) || 0));
  return number / 100;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  elements.toast.classList.add("visible");
  setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 2200);
}

