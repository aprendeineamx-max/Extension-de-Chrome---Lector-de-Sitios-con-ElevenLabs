const state = {
  config: null,
  voices: [],
  selectedVoiceId: null,
  lastAudio: null,
  conversation: [],
  audioHistory: [],
  groqProfiles: [],
  activeGroqProfileId: null,
  usageStatus: null
};

const MAX_AUDIO_HISTORY_ITEMS = 12;

const ENGLISH_LANGUAGE_KEYS = ["english", "en", "inglÈs", "ingles"];
const MEXICAN_KEYWORDS = ["mexico", "mÈxico", "mexican", "latam", "latino", "latina"];

const elements = {};
let mediaRecorder = null;
let recordedChunks = [];

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  await loadConfig();
  await loadVoices();
  await loadAudioHistory();
  await loadUsageStatus();
});

function cacheElements() {
  elements.voiceSelect = document.getElementById("voiceSelect");
  elements.refreshVoices = document.getElementById("refreshVoices");
  elements.formatSelect = document.getElementById("formatSelect");
  elements.toneSelect = document.getElementById("toneSelect");
  elements.speedRange = document.getElementById("speedRange");
  elements.speedValue = document.getElementById("speedValue");
  elements.skipCodeToggle = document.getElementById("skipCodeToggle");
  elements.skipUrlsToggle = document.getElementById("skipUrlsToggle");
  elements.readPage = document.getElementById("readPage");
  elements.readSelection = document.getElementById("readSelection");
  elements.readCustom = document.getElementById("readCustom");
  elements.customText = document.getElementById("customText");
  elements.audioResult = document.getElementById("audioResult");
  elements.audioPlayer = document.getElementById("audioPlayer");
  elements.downloadAudio = document.getElementById("downloadAudio");
  elements.voiceList = document.getElementById("voiceList");
  elements.generatedAudios = document.getElementById("generatedAudios");
  elements.openCreateVoice = document.getElementById("openCreateVoice");
  elements.openCloneVoice = document.getElementById("openCloneVoice");
  elements.createVoiceDialog = document.getElementById("createVoiceDialog");
  elements.cloneVoiceDialog = document.getElementById("cloneVoiceDialog");
  elements.loadingDialog = document.getElementById("loadingDialog");
  elements.loadingMessage = document.getElementById("loadingMessage");
  elements.createVoiceName = document.getElementById("createVoiceName");
  elements.createVoiceDescription = document.getElementById("createVoiceDescription");
  elements.cloneVoiceName = document.getElementById("cloneVoiceName");
  elements.cloneVoiceDescription = document.getElementById("cloneVoiceDescription");
  elements.cloneVoiceFiles = document.getElementById("cloneVoiceFiles");
  elements.confirmCreateVoice = document.getElementById("confirmCreateVoice");
  elements.confirmCloneVoice = document.getElementById("confirmCloneVoice");
  elements.toast = document.getElementById("toast");
  elements.summarizePage = document.getElementById("summarizePage");
  elements.summarizeSelection = document.getElementById("summarizeSelection");
  elements.summaryOutput = document.getElementById("summaryOutput");
  elements.playSummary = document.getElementById("playSummary");
  elements.copySummary = document.getElementById("copySummary");
  elements.groqProfileSelect = document.getElementById("groqProfileSelect");
  elements.applyGroqProfile = document.getElementById("applyGroqProfile");
  elements.groqProfileHint = document.getElementById("groqProfileHint");
  elements.usageElevenCard = document.getElementById("usageElevenCard");
  elements.usageGroqCard = document.getElementById("usageGroqCard");
  elements.usageElevenValue = document.getElementById("usageElevenValue");
  elements.usageGroqValue = document.getElementById("usageGroqValue");
  elements.usageElevenMeta = document.getElementById("usageElevenMeta");
  elements.usageGroqMeta = document.getElementById("usageGroqMeta");
  elements.usageElevenStatus = document.getElementById("usageElevenStatus");
  elements.usageGroqStatus = document.getElementById("usageGroqStatus");
  elements.refreshUsage = document.getElementById("refreshUsage");
  elements.usageUpdatedAt = document.getElementById("usageUpdatedAt");
  elements.conversationHistory = document.getElementById("conversationHistory");
  elements.conversationInput = document.getElementById("conversationInput");
  elements.sendMessage = document.getElementById("sendMessage");
  elements.micToggle = document.getElementById("micToggle");
  elements.resetConversation = document.getElementById("resetConversation");
}

function bindEvents() {
  elements.voiceSelect.addEventListener("change", (event) => {
    state.selectedVoiceId = event.target.value;
  });
  elements.refreshVoices.addEventListener("click", () => loadVoices(true));
  elements.speedRange.addEventListener("input", (e) => {
    elements.speedValue.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
  });
  elements.readPage.addEventListener("click", () => readPage());
  elements.readSelection.addEventListener("click", () => readSelection());
  elements.readCustom.addEventListener("click", () => readCustom());
  elements.downloadAudio.addEventListener("click", () => downloadLastAudio());
  elements.openCreateVoice.addEventListener("click", () => elements.createVoiceDialog.showModal());
  elements.openCloneVoice.addEventListener("click", () => elements.cloneVoiceDialog.showModal());
  elements.confirmCreateVoice.addEventListener("click", () => handleCreateVoice());
  elements.confirmCloneVoice.addEventListener("click", () => handleCloneVoice());
  elements.summarizePage.addEventListener("click", () => summarize({ useSelection: false }));
  elements.summarizeSelection.addEventListener("click", () => summarize({ useSelection: true }));
  elements.playSummary.addEventListener("click", () => playSummary());
  elements.copySummary.addEventListener("click", () => copyText(elements.summaryOutput.value));
  elements.groqProfileSelect?.addEventListener("change", () => updateGroqProfileHint());
  elements.applyGroqProfile?.addEventListener("click", () => applyGroqProfile());
  elements.refreshUsage?.addEventListener("click", () => loadUsageStatus({ force: true }));
  elements.sendMessage.addEventListener("click", () => sendConversationMessage());
  elements.conversationInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendConversationMessage();
    }
  });
  elements.micToggle.addEventListener("click", () => toggleRecording());
  elements.resetConversation.addEventListener("click", () => resetConversation());
}

async function loadConfig() {
  const response = await sendMessage("GET_CONFIG");
  if (!response.success) {
    showToast(`No se pudo cargar la configuraci√≥n: ${response.error}`);
    return;
  }
  state.config = response.data;
  refreshGroqProfiles();
  if (state.config?.textToSpeech?.format) {
    elements.formatSelect.value = state.config.textToSpeech.format;
  }
}

function refreshGroqProfiles() {
  state.groqProfiles = normalizeGroqProfiles(state.config);
  const activeFromConfig = state.config?.groq?.activeProfileId;
  const fallback = state.groqProfiles[0]?.id ?? null;
  state.activeGroqProfileId = activeFromConfig ?? fallback;
  renderGroqProfileSelector();
}

function normalizeGroqProfiles(config) {
  const groq = config?.groq ?? {};
  const rawProfiles = Array.isArray(groq.profiles) && groq.profiles.length ? groq.profiles : buildFallbackGroqProfiles(groq);
  return rawProfiles.map((profile, index) => normalizeGroqProfileEntry(profile, index));
}

function buildFallbackGroqProfiles(groq = {}) {
  const endpoint = groq?.defaultEndpoint?.trim() ?? '';
  const apiKeys = Array.isArray(groq?.apiKeys) ? groq.apiKeys.map((key) => key?.trim()).filter(Boolean) : [];
  if (endpoint && apiKeys.length) {
    return apiKeys.map((key, index) => ({
      id: `groq-key-${index + 1}`,
      label: `API Key #${index + 1}`,
      endpoint,
      apiKey: key,
      model: groq.defaultModel ?? ''
    }));
  }
  if (endpoint) {
    return [
      {
        id: 'groq-default',
        label: 'Configuracion principal',
        endpoint,
        apiKey: '',
        proxyAuthToken: groq.proxyAuthToken ?? '',
        model: groq.defaultModel ?? ''
      }
    ];
  }
  return [];
}

function normalizeGroqProfileEntry(profile = {}, index = 0) {
  const id = profile.id?.toString().trim() || `groq-profile-${index + 1}`;
  const label = profile.label?.toString().trim() || `Perfil ${index + 1}`;
  return {
    id,
    label,
    endpoint: profile.endpoint?.trim() ?? '',
    model: profile.model?.trim() ?? '',
    apiKey: profile.apiKey?.trim() ?? '',
    proxyAuthToken: profile.proxyAuthToken?.trim() ?? '',
    temperature: profile.temperature,
    maxTokens: profile.maxTokens
  };
}

function renderGroqProfileSelector() {
  if (!elements.groqProfileSelect) return;
  const select = elements.groqProfileSelect;
  select.innerHTML = '';
  if (!state.groqProfiles.length) {
    select.disabled = true;
    if (elements.applyGroqProfile) {
      elements.applyGroqProfile.disabled = true;
    }
    if (elements.groqProfileHint) {
      elements.groqProfileHint.textContent = 'Configura tus credenciales de Groq en la pagina de opciones.';
    }
    return;
  }
  select.disabled = false;
  if (elements.applyGroqProfile) {
    elements.applyGroqProfile.disabled = false;
  }
  state.groqProfiles.forEach((profile) => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = formatGroqProfileLabel(profile);
    select.appendChild(option);
  });
  const activeId = state.activeGroqProfileId ?? state.groqProfiles[0].id;
  if (activeId && state.groqProfiles.some((profile) => profile.id === activeId)) {
    select.value = activeId;
  }
  updateGroqProfileHint();
}

function formatGroqProfileLabel(profile) {
  const host = extractHost(profile.endpoint);
  return host ? `${profile.label} (${host})` : profile.label;
}

function updateGroqProfileHint() {
  if (!elements.groqProfileHint || !elements.groqProfileSelect) return;
  const selectedId = elements.groqProfileSelect.value;
  const profile = getGroqProfileById(selectedId) ?? getGroqProfileById(state.activeGroqProfileId);
  if (!profile) {
    elements.groqProfileHint.textContent = 'No hay perfiles disponibles. Revisa la configuracion.';
    return;
  }
  const host = extractHost(profile.endpoint) || 'endpoint sin definir';
  const credentialLabel = profile.proxyAuthToken
    ? 'token de proxy'
    : profile.apiKey
      ? `API Key ${maskCredential(profile.apiKey)}`
      : 'credencial guardada';
  const modelInfo = profile.model ? ` Modelo: ${profile.model}.` : '';
  elements.groqProfileHint.textContent = `Se usara ${credentialLabel} en ${host}.${modelInfo}`;
}

async function applyGroqProfile() {
  if (!elements.groqProfileSelect || !state.config) {
    return;
  }
  const selectedId = elements.groqProfileSelect.value;
  if (!selectedId) {
    showToast('Selecciona un perfil de Groq.');
    return;
  }
  if (state.config?.groq?.activeProfileId === selectedId) {
    showToast('Ese perfil ya esta activo.');
    return;
  }
  const nextConfig = {
    ...state.config,
    groq: {
      ...(state.config.groq ?? {}),
      activeProfileId: selectedId
    }
  };
  const response = await sendMessage('SET_CONFIG', nextConfig);
  if (!response?.success) {
    showToast(`No se pudo guardar: ${response?.error ?? 'Error desconocido'}`);
    return;
  }
  state.config = nextConfig;
  state.activeGroqProfileId = selectedId;
  showToast('Perfil de Groq actualizado.');
  updateGroqProfileHint();
}

function getGroqProfileById(id) {
  if (!id) return null;
  return state.groqProfiles.find((profile) => profile.id === id) ?? null;
}

function extractHost(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (_error) {
    return '';
  }
}

function maskCredential(value) {
  if (!value) return '';
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}
async function loadVoices(force = false) {
  if (!force && state.voices.length > 0) return;
  showLoading("Cargando voces...");
  const response = await sendMessage("GET_VOICES");
  hideLoading();
  if (!response.success) {
    showToast(`Error al cargar voces: ${response.error}`);
    return;
  }
  state.voices = response.data.map(decorateVoice);
  await renderVoices();
}

async function renderVoices() {
  elements.voiceSelect.innerHTML = "";
  elements.voiceList.innerHTML = "";

  if (!state.voices.length) {
    return;
  }

  const voiceMap = new Map();
  state.voices.forEach((voice) => {
    const langKey = voice.languageKey ?? "unknown";
    if (!voiceMap.has(langKey)) {
      voiceMap.set(langKey, { female: [], male: [], unknown: [] });
    }
    const langGroup = voiceMap.get(langKey);
    const bucket =
      voice.genderKey === "female"
        ? langGroup.female
        : voice.genderKey === "male"
          ? langGroup.male
          : langGroup.unknown;
    bucket.push(voice);
  });

  const sortedLanguages = Array.from(voiceMap.entries()).sort(([a], [b]) => {
    const aSpanish = isSpanishLanguage(a);
    const bSpanish = isSpanishLanguage(b);
    if (aSpanish && !bSpanish) return -1;
    if (bSpanish && !aSpanish) return 1;
    return a.localeCompare(b);
  });

  sortedLanguages.forEach(([langKey, groups]) => {
    if (isEnglishLanguage(langKey)) {
      groups.female = prioritizeMexicanVoices(groups.female);
      groups.male = prioritizeMexicanVoices(groups.male);
      groups.unknown = prioritizeMexicanVoices(groups.unknown);
    }

    const optgroup = document.createElement("optgroup");
    const displayName =
      groups.female[0]?.displayLanguage ||
      groups.male[0]?.displayLanguage ||
      groups.unknown[0]?.displayLanguage ||
      formatLanguageLabel(langKey);
    optgroup.label = displayName;

    [...groups.female, ...groups.male, ...groups.unknown].forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.voice_id;
      const countryStr = voice.displayCountry ? ` (${voice.displayCountry})` : "";
      const genderStr = voice.displayGender && voice.displayGender !== "unknown" ? ` - ${voice.displayGender}` : "";
      const badge = voice.isMexican ? " [MX]" : "";
      option.textContent = `${voice.name}${countryStr}${genderStr}${badge}`;
      optgroup.appendChild(option);
    });
    elements.voiceSelect.appendChild(optgroup);

    const section = document.createElement("div");
    section.className = "voice-section";
    const header = document.createElement("h4");
    header.textContent = displayName;
    section.appendChild(header);

    if (groups.female.length > 0) {
      const femaleHeader = document.createElement("h5");
      femaleHeader.textContent = "Femenino";
      section.appendChild(femaleHeader);
      groups.female.forEach((voice) => {
        section.appendChild(createVoiceItem(voice));
      });
    }
    if (groups.male.length > 0) {
      const maleHeader = document.createElement("h5");
      maleHeader.textContent = "Masculino";
      section.appendChild(maleHeader);
      groups.male.forEach((voice) => {
        section.appendChild(createVoiceItem(voice));
      });
    }
    if (groups.unknown.length > 0) {
      groups.unknown.forEach((voice) => {
        section.appendChild(createVoiceItem(voice));
      });
    }
    elements.voiceList.appendChild(section);
  });

  await applyPreferredVoiceSelection();
}

function prioritizeMexicanVoices(list = []) {
  const mexican = list.filter((voice) => voice.isMexican);
  const others = list.filter((voice) => !voice.isMexican);
  return [...mexican, ...others];
}

function isEnglishLanguage(langKey = "") {
  const normalized = normalizeForComparison(langKey);
const ENGLISH_LANGUAGE_KEYS = ["english", "en", "inglÈs", "ingles"];
}

function isSpanishLanguage(langKey = "") {
  const normalized = normalizeForComparison(langKey);
  return (
    normalized.includes("spanish") ||
    normalized.includes("espanol") ||
    normalized === "es"
  );
}

function formatLanguageLabel(langKey = "") {
  if (!langKey) return "Desconocido";
  return langKey.charAt(0).toUpperCase() + langKey.slice(1);
}

async function applyPreferredVoiceSelection() {
  const preferred = findPreferredMexicanVoice();
  const storedDefault = state.config?.elevenLabs?.defaultVoiceId;
  const fallbackStored = storedDefault && voiceExists(storedDefault) ? storedDefault : null;
  const fallbackVoice = state.voices[0]?.voice_id ?? "";
  const nextVoiceId = preferred?.voice_id || fallbackStored || fallbackVoice;
  if (!nextVoiceId) return;
  elements.voiceSelect.value = nextVoiceId;
  state.selectedVoiceId = nextVoiceId;
  await syncDefaultVoiceSelection(nextVoiceId);
}

function voiceExists(voiceId) {
  if (!voiceId) return false;
  return state.voices.some((voice) => voice.voice_id === voiceId);
}

function findPreferredMexicanVoice() {
  const priority = ["female", "male", "unknown"];
  for (const gender of priority) {
    const voice = state.voices.find((item) => item.isMexican && item.genderKey === gender);
    if (voice) {
      return voice;
    }
  }
  return null;
}

async function syncDefaultVoiceSelection(voiceId) {
  if (!state.config?.elevenLabs || state.config.elevenLabs.defaultVoiceId === voiceId) {
    return;
  }
  const nextConfig = {
    ...state.config,
    elevenLabs: {
      ...state.config.elevenLabs,
      defaultVoiceId: voiceId
    }
  };
  const response = await sendMessage("SET_CONFIG", nextConfig);
  if (response?.success) {
    state.config = nextConfig;
  }
}

function createVoiceItem(voice) {
  const item = document.createElement("div");
  item.className = "voice-item";
  const span = document.createElement("span");
  const countryStr = voice.displayCountry ? ` (${voice.displayCountry})` : "";
  const badge = voice.isMexican ? " [MX]" : "";
  span.textContent = `${voice.name}${countryStr}${badge}`;
  const useButton = document.createElement("button");
  useButton.textContent = "Usar";
  useButton.addEventListener("click", () => {
    elements.voiceSelect.value = voice.voice_id;
    showToast(`Voz seleccionada: ${voice.name}`);
  });
  item.appendChild(span);
  item.appendChild(useButton);
  return item;
}

async function readPage() {
  const content = await requestPageContent({
    skipCode: elements.skipCodeToggle.checked,
    skipUrls: elements.skipUrlsToggle.checked
  });
  if (!content) return;
  await synthesizeText(content.text, "Lectura de p√°gina completa");
}

async function readSelection() {
  const content = await requestPageContent({
    skipCode: elements.skipCodeToggle.checked,
    skipUrls: elements.skipUrlsToggle.checked
  });
  if (!content) return;
  const text = content.selection?.trim();
  if (!text) {
    showToast("No hay texto seleccionado en la pesta√±a.");
    return;
  }
  await synthesizeText(text, "Lectura de selecci√≥n");
}

async function readCustom() {
  const text = elements.customText.value.trim();
  if (!text) {
    showToast("Introduce texto para poder leerlo.");
    return;
  }
  await synthesizeText(text, "Lectura personalizada");
}

async function synthesizeText(text, contextLabel) {
  showLoading(`Generando audio (${contextLabel})...`);
  const speed = parseFloat(elements.speedRange.value);
  const tone = elements.toneSelect.value;

  const voiceSettings = getVoiceSettingsForTone(tone);

  const response = await sendMessage("SYNTHESIZE_TEXT", {
    text,
    voiceId: elements.voiceSelect.value,
    format: elements.formatSelect.value,
    voiceSettings,
    speed
  });
  hideLoading();
  if (!response.success) {
    showToast(`Error al generar audio: ${response.error}`);
    return;
  }
  const { base64, format, fileName, historyEntry } = response.data;
  const src = `data:audio/${format};base64,${base64}`;
  elements.audioPlayer.src = src;
  elements.audioPlayer.playbackRate = speed;
  elements.audioResult.classList.remove("hidden");
  try {
    elements.audioPlayer.currentTime = 0;
    await elements.audioPlayer.play();
  } catch (error) {
    console.warn("No se pudo reproducir autom·ticamente el audio", error);
  }
  state.lastAudio = { src, fileName, format, speed, tone, contextLabel };

  addAudioHistoryEntry(
    historyEntry ?? {
      base64,
      format,
      fileName,
      contextLabel,
      createdAt: new Date().toISOString()
    }
  );

  showToast("Audio generado y reproduciÈndose.");
}

function getVoiceSettingsForTone(tone) {
  const base = state.config?.elevenLabs?.voiceSettings || {};
  const toneMap = {
    informativo: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
    alegre: { stability: 0.4, similarity_boost: 0.8, style: 0.7 },
    narrativo: { stability: 0.6, similarity_boost: 0.7, style: 0.5 },
    podcast: { stability: 0.5, similarity_boost: 0.75, style: 0.4 },
    dramatico: { stability: 0.7, similarity_boost: 0.6, style: 0.8 },
    relajado: { stability: 0.6, similarity_boost: 0.7, style: 0.2 }
  };
  return { ...base, ...(toneMap[tone] || {}) };
}

function downloadLastAudio() {
  if (!state.lastAudio) {
    showToast("No hay audio disponible para descargar.");
    return;
  }
  const link = document.createElement("a");
  link.href = state.lastAudio.src;
  link.download = state.lastAudio.fileName ?? "lectura.mp3";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function handleCreateVoice() {
  const name = elements.createVoiceName.value.trim();
  const description = elements.createVoiceDescription.value.trim();
  if (!name) {
    showToast("Indica un nombre para la nueva voz.");
    return;
  }
  showLoading("Creando voz...");
  const response = await sendMessage("CREATE_VOICE", { name, description });
  hideLoading();
  if (!response.success) {
    showToast(`No se pudo crear la voz: ${response.error}`);
    return;
  }
  elements.createVoiceDialog.close();
  elements.createVoiceName.value = "";
  elements.createVoiceDescription.value = "";
  showToast("Voz creada correctamente. Actualizando listado...");
  await loadVoices(true);
}

async function handleCloneVoice() {
  const name = elements.cloneVoiceName.value.trim();
  if (!name) {
    showToast("Necesitas un nombre para la voz clonada.");
    return;
  }
  const files = Array.from(elements.cloneVoiceFiles.files ?? []);
  if (files.length === 0) {
    showToast("Adjunta al menos un archivo de audio.");
    return;
  }
  showLoading("Enviando archivos para clonaci√≥n...");
  const serialized = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      data: await blobToBase64(file)
    }))
  );
  const response = await sendMessage("CLONE_VOICE", {
    name,
    description: elements.cloneVoiceDescription.value.trim(),
    files: serialized
  });
  hideLoading();
  if (!response.success) {
    showToast(`Fallo en la clonaci√≥n: ${response.error}`);
    return;
  }
  elements.cloneVoiceDialog.close();
  elements.cloneVoiceName.value = "";
  elements.cloneVoiceDescription.value = "";
  elements.cloneVoiceFiles.value = "";
  showToast("Voz clonada exitosamente. Actualizando listado...");
  await loadVoices(true);
}

async function requestPageContent(options = {}) {
  let activeTab = null;
  try {
    activeTab = await getActiveTab();
  } catch (error) {
    showToast(`No se pudo acceder a la pesta√±a activa: ${error.message}`);
    return null;
  }
  const tabId = activeTab?.id ?? null;
  const response = await sendMessage("REQUEST_PAGE_CONTENT", { tabId, ...options });
  if (!response.success) {
    showToast(`No se pudo obtener el contenido: ${response.error}`);
    return null;
  }
  return response.data;
}

async function summarize({ useSelection }) {
  const content = await requestPageContent();
  if (!content) return;
  const text = useSelection ? content.selection?.trim() : content.text;
  if (!text) {
    showToast("No hay texto disponible para resumir.");
    return;
  }
  showLoading("Generando resumen con Groq...");
  const response = await sendMessage("SUMMARIZE_CONTENT", {
    title: content.title,
    text,
    language: "es"
  });
  hideLoading();
  if (!response.success) {
    showToast(`Error al resumir: ${response.error}`);
    return;
  }
  elements.summaryOutput.value = response.data;
  showToast("Resumen listo.");
}

async function playSummary() {
  const summary = elements.summaryOutput.value.trim();
  if (!summary) {
    showToast("No hay resumen para reproducir.");
    return;
  }
  await synthesizeText(summary, "Resumen");
}

async function sendConversationMessage() {
  const text = elements.conversationInput.value.trim();
  if (!text) {
    showToast("Escribe un mensaje para continuar la conversaci√≥n.");
    return;
  }
  appendConversationEntry("user", text);
  elements.conversationInput.value = "";
  await requestConversationReply();
}

async function requestConversationReply() {
  showLoading("Consultando al modelo...");
  let activeTab = null;
  try {
    activeTab = await getActiveTab();
  } catch (error) {
    hideLoading();
    showToast(`Error al obtener pesta√±a activa: ${error.message}`);
    return;
  }
  const response = await sendMessage("CONVERSATION_REPLY", {
    tabId: activeTab?.id,
    conversation: state.conversation
  });
  hideLoading();
  if (!response.success) {
    showToast(`Error en la conversaci√≥n: ${response.error}`);
    return;
  }
  appendConversationEntry("assistant", response.data);
  await synthesizeText(response.data, "Respuesta conversacional");
}

function appendConversationEntry(role, content) {
  state.conversation.push({ role, content });
  const entry = document.createElement("div");
  entry.className = "conversation-entry";
  entry.innerHTML = `<strong>${role === "user" ? "T√∫" : "Asistente"}:</strong> ${content}`;
  elements.conversationHistory.appendChild(entry);
  elements.conversationHistory.scrollTop = elements.conversationHistory.scrollHeight;
}

async function toggleRecording() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    elements.micToggle.textContent = "üé§ Grabar";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      const base64 = await blobToBase64(blob);
      showLoading("Transcribiendo audio...");
      const response = await sendMessage("TRANSCRIBE_AUDIO", {
        audioBase64: base64,
        provider: state.config?.speechToText?.provider,
        language: state.config?.speechToText?.language ?? "es"
      });
      hideLoading();
      if (!response.success) {
        showToast(`No se pudo transcribir el audio: ${response.error}`);
        return;
      }
      const transcription = response.data.text?.trim();
      if (transcription) {

        elements.conversationInput.value = transcription;

        showToast("TranscripciÛn lista, revisa el campo de mensaje.");

        if (shouldRunLiveTranslation()) {

          await runLiveTranslationPipeline(transcription);

        }

      } else {
        showToast("No se obtuvo texto del audio grabado.");
      }
    };
    mediaRecorder.start();
    elements.micToggle.textContent = "‚èπÔ∏è Detener";
    showToast("Grabando... pulsa de nuevo para detener.");
  } catch (error) {
    showToast(`No se pudo iniciar la grabaci√≥n: ${error.message}`);
  }
}

async function resetConversation() {
  state.conversation = [];
  elements.conversationHistory.innerHTML = "";
  let activeTab = null;
  try {
    activeTab = await getActiveTab();
  } catch (error) {
    showToast(`No se pudo limpiar la memoria: ${error.message}`);
    return;
  }
  await sendMessage("RESET_MEMORY", { tabId: activeTab?.id });
  showToast("Conversaci√≥n reiniciada.");
}

function showLoading(message) {
  if (!elements.loadingDialog.open) {
    elements.loadingDialog.showModal();
  }
  elements.loadingMessage.textContent = message ?? "Procesando...";
}

function hideLoading() {
  if (elements.loadingDialog.open) {
    elements.loadingDialog.close();
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  elements.toast.classList.add("visible");
  setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 2200);
}

function decorateVoice(voice) {
  const labels = voice.labels || {};
  const rawLanguage = labels.language || labels.accent || voice.language || "unknown";
  const rawGender = labels.gender || labels.voice_gender || voice.gender || "";
  const country = labels.country || labels.accent_country || "";
  const accent = labels.accent || "";
  const description = labels.description || voice.description || "";
  const languageKey = normalizeForComparison(rawLanguage || "unknown");
  const normalizedGender = normalizeForComparison(rawGender);
  const genderKey =
    normalizedGender.includes("female") || normalizedGender.includes("femenin")
      ? "female"
      : normalizedGender.includes("male") || normalizedGender.includes("masculin")
        ? "male"
        : "unknown";

  const enriched = {
    ...voice,
    displayLanguage: rawLanguage || formatLanguageLabel(languageKey),
    displayCountry: country,
    displayGender: rawGender || "unknown",
    languageKey,
    genderKey
  };
  enriched.isMexican = detectMexicanVoice(enriched, { accent, description });
  return enriched;
}

function detectMexicanVoice(voice, extra = {}) {
  const haystack = [
    voice.displayCountry,
    voice.displayLanguage,
    extra.accent,
    extra.description,
    voice.name,
    voice.labels?.description,
    voice.labels?.accent
  ]
    .filter(Boolean)
    .map((value) => normalizeForComparison(value))
    .join(" ");

  return MEXICAN_KEYWORDS.some((keyword) =>
    haystack.includes(normalizeForComparison(keyword))
  );
}


function normalizeForComparison(value = "") {
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response ?? { success: false, error: "Sin respuesta del background." });
    });
  });
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text);
  showToast("Resumen copiado al portapapeles.");
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getUsageWarningRatio(provider) {
  const value = provider === "groq" ? state.config?.usageAlerts?.groq?.warningRatio : state.config?.usageAlerts?.elevenLabs?.warningRatio;
  if (typeof value === "number") {
    return Math.min(Math.max(value, 0), 1);
  }
  return 0.2;
}

async function loadUsageStatus({ force = false } = {}) {
  const response = await sendMessage(force ? "REFRESH_USAGE_STATUS" : "GET_USAGE_STATUS");
  if (!response?.success) {
    showToast(`No se pudo obtener los crÈditos: ${response?.error ?? "Error desconocido"}`);
    return;
  }
  state.usageStatus = response.data;
  renderUsageStatus();
}

function renderUsageStatus() {
  const usage = state.usageStatus;
  if (!usage) {
    return;
  }
  updateUsageCard(
    {
      card: elements.usageElevenCard,
      value: elements.usageElevenValue,
      meta: elements.usageElevenMeta,
      status: elements.usageElevenStatus
    },
    usage.elevenLabs,
    getUsageWarningRatio("elevenLabs")
  );
  updateUsageCard(
    {
      card: elements.usageGroqCard,
      value: elements.usageGroqValue,
      meta: elements.usageGroqMeta,
      status: elements.usageGroqStatus
    },
    usage.groq,
    getUsageWarningRatio("groq")
  );
  if (elements.usageUpdatedAt) {
    elements.usageUpdatedAt.textContent = usage.fetchedAt ? `Actualizado ${formatRelativeDate(usage.fetchedAt)}` : "";
  }
}

function updateUsageCard(targets, data, warningRatio) {
  const { card, value, meta, status } = targets;
  if (!card || !value || !meta || !status) {
    return;
  }
  card.classList.remove("usage-warning", "usage-error");
  if (!data) {
    value.textContent = "Sin datos";
    meta.textContent = "";
    status.textContent = "";
    return;
  }
  if (!data.success) {
    card.classList.add("usage-error");
    value.textContent = "Sin datos";
    meta.textContent = data.error ?? "";
    status.textContent = "";
    return;
  }
  const limit = typeof data.limit === "number" && data.limit > 0 ? data.limit : null;
  const used = typeof data.used === "number" ? data.used : 0;
  const remaining = limit != null ? Math.max(data.remaining ?? limit - used, 0) : null;
  const ratio = limit != null && limit > 0 ? remaining / limit : null;
  if (ratio != null && ratio <= warningRatio) {
    card.classList.add("usage-warning");
  }
  status.textContent = ratio != null ? `${formatPercentage(1 - ratio)} usado` : "Uso actual";
  if (limit != null) {
    value.textContent = `Restan ${formatPercentage(ratio ?? 0)} (${formatNumber(remaining)} / ${formatNumber(limit)})`;
    meta.textContent = `Utilizado: ${formatNumber(used)}` + (data.renewsAt ? ` ∑ Renueva ${formatRelativeDate(data.renewsAt)}` : "");
  } else {
    value.textContent = `${formatNumber(used)} unidades usadas`;
    meta.textContent = data.renewsAt ? `Renueva ${formatRelativeDate(data.renewsAt)}` : "";
  }
}

function formatNumber(value) {
  try {
    return new Intl.NumberFormat("es-MX").format(Math.round(value || 0));
  } catch (_err) {
    return String(value ?? 0);
  }
}

function formatPercentage(value) {
  if (value == null) {
    return "--%";
  }
  const pct = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)));
  return `${pct}%`;
}

function formatRelativeDate(timestamp) {
  if (!timestamp) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
  } catch (_err) {
    return new Date(timestamp).toLocaleString();
  }
}

async function loadAudioHistory() {
  const response = await sendMessage("GET_AUDIO_HISTORY");
  if (response.success && response.data) {
    state.audioHistory = response.data.map(normalizeHistoryEntry).slice(0, MAX_AUDIO_HISTORY_ITEMS);
    renderAudioHistory();
  }
}

function addAudioHistoryEntry(entry) {
  const normalized = normalizeHistoryEntry(entry);
  state.audioHistory.unshift(normalized);
  state.audioHistory = state.audioHistory.slice(0, MAX_AUDIO_HISTORY_ITEMS);
  renderAudioHistory();
}

function renderAudioHistory() {
  elements.generatedAudios.innerHTML = "";
  if (state.audioHistory.length === 0) {
    elements.generatedAudios.innerHTML = "<p style='padding: 12px; color: #999;'>No hay audios generados a˙n.</p>";
    return;
  }
  state.audioHistory.forEach((audio, index) => {
    const item = document.createElement("div");
    item.className = "audio-history-item";
    const date = formatHistoryTimestamp(audio.timestamp);
    const source = audio.src || buildAudioSrc(audio.base64, audio.format);
    item.innerHTML = `
      <div class="audio-history-info">
        <strong>${audio.contextLabel || "Audio"}</strong>
        <span class="audio-history-meta">${date} ï ${audio.format?.toUpperCase() || "MP3"}</span>
      </div>
      <div class="audio-history-actions">
        <audio controls src="${source ?? ""}" style="width: 200px; height: 32px;"></audio>
        <button class="download-btn" data-index="${index}">Descargar</button>
      </div>
    `;
    const downloadBtn = item.querySelector(".download-btn");
    downloadBtn.addEventListener("click", () => {
      downloadAudioFromHistory(index);
    });
    elements.generatedAudios.appendChild(item);
  });
}

function downloadAudioFromHistory(index) {
  const audio = state.audioHistory[index];
  if (!audio) return;
  const source = audio.src || buildAudioSrc(audio.base64, audio.format);
  if (!source) {
    showToast("No se encontrÛ el audio en el historial.");
    return;
  }
  const link = document.createElement("a");
  link.href = source;
  link.download = audio.fileName || "lectura.mp3";
  document.body.appendChild(link);
  link.click();
  link.remove();
}


function normalizeHistoryEntry(entry = {}) {
  const format = entry.format || "mp3";
  const base64 = entry.base64 || "";
  const src = entry.src || (base64 ? buildAudioSrc(base64, format) : "");
  return {
    id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    fileName: entry.fileName || `lectura.${format}`,
    format,
    base64,
    src,
    contextLabel: entry.contextLabel || entry.sourceLabel || "Audio",
    timestamp: entry.createdAt || entry.timestamp || Date.now()
  };
}

function buildAudioSrc(base64, format = "mp3") {
  if (!base64) return "";
  return `data:audio/${format};base64,${base64}`;
}

function formatHistoryTimestamp(timestamp) {
  if (!timestamp) return "Sin fecha";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }
  return date.toLocaleString("es-ES");
}
function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(tabs?.[0] ?? null);
    });
  });
}
















function shouldRunLiveTranslation() {
  return Boolean(state.config?.liveTranslation?.enabled && state.config?.liveTranslation?.targetLanguage);
}

async function runLiveTranslationPipeline(originalText) {
  const target = state.config?.liveTranslation?.targetLanguage?.trim() || "es";
  try {
    showLoading(`Traduciendo a ${target}...`);
    const response = await sendMessage("TRANSLATE_TEXT", { text: originalText, targetLanguage: target });
    hideLoading();
    if (!response?.success) {
      showToast(`No se pudo traducir: ${response?.error ?? "Error desconocido"}`);
      return;
    }
    const translation = typeof response.data === "string" ? response.data : response.data?.text;
    if (!translation) {
      showToast("La traduccion no devolvio contenido.");
      return;
    }
    showToast(`Traduccion generada (${target}).`);
    if (state.config?.liveTranslation?.autoPlayAudio !== false) {
      await synthesizeText(translation, `Traduccion (${target})`);
    }
  } catch (error) {
    hideLoading();
    showToast(`No se pudo traducir: ${error.message}`);
  }
}

