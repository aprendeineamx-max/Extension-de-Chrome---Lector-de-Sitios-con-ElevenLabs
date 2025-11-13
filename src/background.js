import { ensureConfig, getConfig, setConfig } from "./utils/config.js";
import { listVoices, synthesizeSpeech, createVoice, cloneVoice } from "./services/elevenlabs.js";
import { summarizeContent, conversationalReply } from "./services/groq.js";
import { transcribeAudio } from "./services/stt.js";
import { addAudioHistoryEntry, getAudioHistory } from "./utils/history.js";

const CONTEXT_MENU_READ_SELECTION = "phillips-read-selection";
const sessionMemory = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  await ensureConfig();
  createContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_READ_SELECTION && info.selectionText?.trim()) {
    try {
      const config = await getConfig();
      const voiceId = config.elevenLabs.defaultVoiceId;
      const audio = await synthesizeSpeech({
        text: info.selectionText.trim(),
        voiceId,
        format: config.textToSpeech.format
      });
      const base64 = await blobToBase64(audio.blob);
      if (tab?.id != null) {
        chrome.tabs.sendMessage(tab.id, {
          type: "PLAY_AUDIO",
          payload: {
            base64,
            format: audio.format,
            fileName: audio.fileName,
            source: "selection"
          }
        });
      }
      await registerAudioHistory({
        base64,
        format: audio.format,
        fileName: audio.fileName,
        sourceLabel: "Selección",
        voiceId,
        tone: config.voicePreferences?.tone,
        speed: config.voicePreferences?.speed
      });
      await autoDownloadAudio({
        base64,
        format: audio.format,
        fileName: audio.fileName,
        config
      });
    } catch (error) {
      console.error("Error al leer selección", error);
      if (tab?.id != null) {
        chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_ERROR",
          message: `No se pudo generar audio: ${error.message}`
        });
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message ?? {};
  if (!type) {
    return false;
  }
  switch (type) {
    case "GET_CONFIG":
      getConfig().then((config) => sendResponse({ success: true, data: config }));
      return true;
    case "SET_CONFIG":
      setConfig(payload).then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case "GET_VOICES":
      listVoices()
        .then((voices) => sendResponse({ success: true, data: voices }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "SYNTHESIZE_TEXT":
      handleSynthesizeText(payload)
        .then((audio) => sendResponse({ success: true, data: audio }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "CREATE_VOICE":
      createVoice(payload)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "CLONE_VOICE":
      handleCloneVoice(payload)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "REQUEST_PAGE_CONTENT":
      handleRequestPageContent(payload?.tabId, payload?.options, sendResponse);
      return true;
    case "SUMMARIZE_CONTENT":
      handleSummarize(payload)
        .then((summary) => sendResponse({ success: true, data: summary }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "CONVERSATION_REPLY":
      handleConversation(payload)
        .then((reply) => sendResponse({ success: true, data: reply }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "TRANSCRIBE_AUDIO":
      handleTranscription(payload)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "GET_AUDIO_HISTORY":
      getAudioHistory()
        .then((history) => sendResponse({ success: true, data: history }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "SAVE_AUDIO_HISTORY":
      handleSaveAudioHistory(payload)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case "RESET_MEMORY":
      if (payload?.tabId != null) {
        sessionMemory.delete(payload.tabId);
      }
      sendResponse({ success: true });
      return false;
    default:
      return false;
  }
});

async function handleSynthesizeText({ text, voiceId, format, voiceSettings, tone, speed, sourceLabel, voiceName }) {
  const cleanText = (text ?? "").trim();
  if (!cleanText) {
    throw new Error("No hay texto para sintetizar.");
  }
  const config = await getConfig();
  const audio = await synthesizeSpeech({
    text: cleanText,
    voiceId,
    format,
    voiceSettings,
    tone,
    speed
  });
  const base64 = await blobToBase64(audio.blob);
  const historyEntry = await registerAudioHistory({
    base64,
    format: audio.format,
    fileName: audio.fileName,
    sourceLabel,
    voiceId,
    voiceName,
    tone: tone ?? config.voicePreferences?.tone,
    speed: speed ?? config.voicePreferences?.speed
  });
  await autoDownloadAudio({
    base64,
    format: audio.format,
    fileName: audio.fileName,
    config
  });
  return {
    base64,
    format: audio.format,
    fileName: audio.fileName,
    historyEntry
  };
}

async function handleCloneVoice({ name, files = [], labels, description }) {
  const blobs = files.map((file) => {
    const byteCharacters = atob(file.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: file.type || "audio/mpeg" });
    return { blob, name: file.name };
  });
  return cloneVoice({ name, files: blobs, labels, description });
}

function handleRequestPageContent(tabId, options, sendResponse) {
  getActiveTab(tabId).then(async (tab) => {
    if (!tab?.id) {
      sendResponse({ success: false, error: "No se pudo identificar la pestaña activa." });
      return;
    }
    const config = await getConfig();
    chrome.tabs.sendMessage(
      tab.id,
      {
        type: "COLLECT_PAGE_CONTENT",
        payload: buildContentOptions(options, config)
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error al recopilar contenido", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({ success: true, data: response });
      }
    );
  });
}

async function handleSummarize(payload) {
  const { title, text, language } = payload;
  if (!text?.trim()) {
    throw new Error("No se proporcionó texto para resumir.");
  }
  return summarizeContent({ title, text, language });
}

async function handleConversation({ tabId, conversation = [] }) {
  const tab = await getActiveTab(tabId);
  if (!tab?.id) {
    throw new Error("No se pudo resolver la pestaña para la conversación.");
  }
  const config = await getConfig();
  const context = await requestSiteContext(tab.id, config);
  const memoryKey = tab.id;
  const previous = sessionMemory.get(memoryKey) ?? [];
  const combined = [...previous, ...conversation];
  const reply = await conversationalReply({
    conversation: combined,
    siteContext: context?.text ?? ""
  });
  sessionMemory.set(memoryKey, [...combined, { role: "assistant", content: reply }]);
  return reply;
}

async function handleTranscription({ audioBase64, provider, language }) {
  if (!audioBase64) {
    throw new Error("No se recibió audio para transcribir.");
  }
  const blob = base64ToBlob(audioBase64, "audio/webm");
  const result = await transcribeAudio({ blob, provider, language });
  return result;
}

async function requestSiteContext(tabId, config) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "GET_SITE_CONTEXT",
        payload: buildContentOptions(undefined, config)
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Error al obtener contexto del sitio", chrome.runtime.lastError);
          resolve({ title: "", text: "" });
          return;
        }
        resolve(response ?? { title: "", text: "" });
      }
    );
  });
}

function createContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: CONTEXT_MENU_READ_SELECTION,
        title: "Leer selección con ElevenLabs",
        contexts: ["selection"]
      });
    });
  } catch (error) {
    console.warn("No se pudieron recrear los menús de contexto", error);
  }
}

async function getActiveTab(tabId) {
  if (tabId != null) {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(tab);
      });
    });
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(tabs?.[0]);
    });
  });
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function registerAudioHistory({ base64, format, fileName, sourceLabel, voiceId, voiceName, tone, speed }) {
  return addAudioHistoryEntry({
    base64,
    format,
    fileName,
    source: sourceLabel ?? "Generado",
    voiceId,
    voiceName,
    tone,
    speed
  });
}


async function autoDownloadAudio({ base64, format, fileName, config }) {
  try {
    const preferences = resolveAutoDownloadPreferences(config);
    if (!preferences.enabled) {
      return;
    }
    const folder = preferences.folder ?? "Audios Generados por Extension";
    const dataUrl = `data:audio/${format};base64,${base64}`;
    await new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url: dataUrl,
          filename: `${folder}/${fileName}`,
          saveAs: false
        },
        () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        }
      );
    });
  } catch (error) {
    console.warn("No se pudo descargar automáticamente el audio", error);
  }
}


function sanitizeFolder(folderName) {
  return folderName?.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Audios Generados por Extension";
}

function resolveAutoDownloadPreferences(config) {
  const direct = config?.autoDownload ?? {};
  const legacy = config?.downloadPreferences ?? {};
  const enabled =
    typeof direct.enabled === "boolean"
      ? direct.enabled
      : legacy.autoDownload ?? false;
  const folder =
    direct.path ??
    legacy.subFolder ??
    "Audios Generados por Extension";
  return {
    enabled: Boolean(enabled),
    folder: sanitizeFolder(folder)
  };
}

function buildContentOptions(overrides = {}, config) {
  const base = config?.readingPreferences ?? {};
  return {
    focusMainContent: overrides.focusMainContent ?? base.focusMainContent ?? true,
    skipNavigation: overrides.skipNavigation ?? base.skipNavigation ?? true,
    skipSidebars: overrides.skipSidebars ?? base.skipSidebars ?? true,
    skipFooter: overrides.skipFooter ?? base.skipFooter ?? true,
    skipCodeBlocks: overrides.skipCode ?? overrides.skipCodeBlocks ?? base.skipCodeBlocks ?? false,
    skipUrls: overrides.skipUrls ?? base.skipUrls ?? false,
    maxCharacters: overrides.maxCharacters ?? base.maxCharacters ?? 14000
  };
}

async function handleSaveAudioHistory(payload) {
  const { history } = payload;
  if (!Array.isArray(history)) {
    throw new Error("El historial debe ser un array.");
  }
  const { saveAudioHistory } = await import("./utils/history.js");
  await saveAudioHistory(history);
}

