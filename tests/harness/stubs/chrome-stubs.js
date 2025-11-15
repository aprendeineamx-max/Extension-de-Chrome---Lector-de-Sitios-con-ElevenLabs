(function () {
  if (window.chrome?.runtime) {
    return;
  }

  const defaultConfig = {
    profileName: "Harness Profile",
    elevenLabs: {
      apiKey: "fake",
      defaultVoiceId: "voice-mx-demo",
      voiceSettings: {
        stability: 0.4,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true
      }
    },
    groq: {
      defaultEndpoint: "https://fake-groq-endpoint",
      apiKeys: ["gsk_fake"],
      defaultModel: "llama-3.3-70b-versatile",
      temperature: 0.6,
      maxTokens: 512
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
      skipUrls: true
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

  const harnessState = {
    config: structuredClone(defaultConfig),
    voices: [
      {
        voice_id: "voice-mx-demo",
        name: "Laura MX",
        labels: {
          language: "Español",
          accent: "Mexican",
          gender: "female",
          country: "México"
        }
      }
    ],
    audioHistory: [],
    failNextSynthesisMessage: null,
    pageContent: {
      title: "Documento de prueba",
      text: "Este es un documento de prueba para el popup.",
      selection: "Texto seleccionado de prueba."
    }
  };

  function structuredClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createHistoryEntry({ contextLabel, format }) {
    const entry = {
      id: `history-${Date.now()}`,
      base64: btoa("audio"),
      format: format || "mp3",
      fileName: `lectura-${Date.now()}.mp3`,
      contextLabel,
      timestamp: Date.now()
    };
    harnessState.audioHistory.unshift(entry);
    harnessState.audioHistory = harnessState.audioHistory.slice(0, 5);
    return entry;
  }

  window.__popupTestHooks = {
    reset() {
      harnessState.audioHistory = [];
      harnessState.failNextSynthesisMessage = null;
    },
    failNextSynthesis(message = "Error simulado") {
      harnessState.failNextSynthesisMessage = message;
    }
  };

  const storageData = {};

  window.chrome = {
    runtime: {
      sendMessage(message, callback) {
        handleMessage(message).then(callback).catch((error) => callback({ success: false, error: error.message }));
      },
      lastError: null
    },
    storage: {
      local: {
        get(keys, callback) {
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach((key) => {
              result[key] = storageData[key];
            });
            callback(result);
            return;
          }
          callback({ [keys]: storageData[keys] });
        },
        set(values, callback) {
          Object.assign(storageData, values);
          callback?.();
        },
        remove(keys, callback) {
          (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete storageData[key]);
          callback?.();
        }
      }
    },
    tabs: {
      query(queryInfo, callback) {
        callback([{ id: 1, active: true }]);
      },
      sendMessage(tabId, payload, callback) {
        callback?.();
      }
    },
    downloads: {
      download(options, callback) {
        callback?.(Date.now());
      }
    },
    contextMenus: {
      create() {},
      removeAll() {}
    }
  };

  async function handleMessage({ type, payload }) {
    switch (type) {
      case "GET_CONFIG":
        return { success: true, data: structuredClone(harnessState.config) };
      case "SET_CONFIG":
        harnessState.config = structuredClone(payload);
        return { success: true };
      case "GET_VOICES":
        return { success: true, data: structuredClone(harnessState.voices) };
      case "SYNTHESIZE_TEXT":
        if (!payload?.text?.trim()) {
          return { success: false, error: "Texto vacío" };
        }
        if (harnessState.failNextSynthesisMessage) {
          const message = harnessState.failNextSynthesisMessage;
          harnessState.failNextSynthesisMessage = null;
          return { success: false, error: message };
        }
        const entry = createHistoryEntry({ contextLabel: payload.sourceLabel, format: harnessState.config.textToSpeech.format });
        return {
          success: true,
          data: {
            base64: entry.base64,
            format: entry.format,
            fileName: entry.fileName,
            historyEntry: entry
          }
        };
      case "GET_AUDIO_HISTORY":
        return { success: true, data: structuredClone(harnessState.audioHistory) };
      case "REQUEST_PAGE_CONTENT":
        return { success: true, data: structuredClone(harnessState.pageContent) };
      case "SUMMARIZE_CONTENT":
        return { success: true, data: "Resumen simulado para el contenido proporcionado." };
      case "RESET_MEMORY":
        return { success: true };
      default:
        console.warn("Mensaje no manejado en harness:", type);
        return { success: true };
    }
  }
})();
