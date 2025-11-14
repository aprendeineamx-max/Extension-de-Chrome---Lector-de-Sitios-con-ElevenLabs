#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const OUTPUT_PATH = path.join(ROOT, "data", "env-config.json");

if (!fs.existsSync(ENV_PATH)) {
  console.warn("No se encontró un archivo .env. Crea uno a partir de .env.example.");
  process.exit(0);
}

const rawEnv = fs.readFileSync(ENV_PATH, "utf8");
const envValues = parseEnv(rawEnv);
const payload = buildConfig(envValues);

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
console.log(`Archivo de configuración generado en ${path.relative(ROOT, OUTPUT_PATH)}.`);

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key) continue;
    result[key.trim()] = rest.join("=").trim();
  }
  return result;
}

function buildConfig(env) {
  const config = {};

  if (env.PROFILE_NAME) {
    config.profileName = env.PROFILE_NAME;
  }

  const elevenLabs = {};
  if (env.ELEVENLABS_API_KEY) elevenLabs.apiKey = env.ELEVENLABS_API_KEY;
  if (env.ELEVENLABS_VOICE_ID) elevenLabs.defaultVoiceId = env.ELEVENLABS_VOICE_ID;
  if (Object.keys(elevenLabs).length) {
    config.elevenLabs = elevenLabs;
  }

  const groq = {};
  const groqKeys = splitList(env.GROQ_API_KEYS);
  if (groqKeys.length) groq.apiKeys = groqKeys;
  if (env.GROQ_ENDPOINT) groq.defaultEndpoint = env.GROQ_ENDPOINT;
  if (env.GROQ_MODEL) groq.defaultModel = env.GROQ_MODEL;
  if (env.PROXY_AUTH_TOKEN) groq.proxyAuthToken = env.PROXY_AUTH_TOKEN;
  if (env.GROQ_ACTIVE_PROFILE) groq.activeProfileId = env.GROQ_ACTIVE_PROFILE;
  const profileOverrides = parseGroqProfiles(env.GROQ_PROFILES_JSON);
  if (profileOverrides.length) {
    groq.profiles = profileOverrides;
  }
  if (Object.keys(groq).length) {
    config.groq = groq;
  }

  const huggingFace = {};
  if (env.HUGGINGFACE_API_KEY) huggingFace.apiKey = env.HUGGINGFACE_API_KEY;
  if (env.HUGGINGFACE_VOICE_ID) huggingFace.voiceId = env.HUGGINGFACE_VOICE_ID;
  if (Object.keys(huggingFace).length) {
    config.huggingFace = huggingFace;
  }

  return config;
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseGroqProfiles(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry) => entry && typeof entry === "object");
    }
  } catch (error) {
    console.warn("No se pudo interpretar GROQ_PROFILES_JSON. Usa JSON valido.");
  }
  return [];
}
