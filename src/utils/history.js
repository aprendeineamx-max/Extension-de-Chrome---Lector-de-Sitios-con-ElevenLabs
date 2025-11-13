import { storage } from "./storage.js";

const AUDIO_HISTORY_KEY = "phillips_voice_companion_audio_history";
const MAX_HISTORY_ITEMS = 12;

export async function getAudioHistory() {
  const history = await storage.get(AUDIO_HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}

export async function addAudioHistoryEntry(entry) {
  const history = await getAudioHistory();
  const newEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ...entry,
    createdAt: entry.createdAt ?? new Date().toISOString()
  };
  const nextHistory = [newEntry, ...history].slice(0, MAX_HISTORY_ITEMS);
  await storage.set(AUDIO_HISTORY_KEY, nextHistory);
  return newEntry;
}

export async function saveAudioHistory(history) {
  if (!Array.isArray(history)) {
    throw new Error("El historial debe ser un array.");
  }
  const limited = history.slice(0, 50);
  await storage.set(AUDIO_HISTORY_KEY, limited);
}

export async function clearAudioHistory() {
  await storage.set(AUDIO_HISTORY_KEY, []);
}

