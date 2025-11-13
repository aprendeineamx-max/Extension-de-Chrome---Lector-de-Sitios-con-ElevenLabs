# Phillips Voice Companion

Extensión de Chrome lista para usarse como lector inteligente de sitios: lee páginas completas o fragmentos, genera resúmenes con Groq, mantiene conversaciones contextuales y puede clonar voces con ElevenLabs y Hugging Face.

> ⚠️ **Seguridad:** Las llaves API ya no se almacenan en el repositorio. Coloca tus claves reales en un archivo `.env` local (no versionado) y ejecuta `npm run build:env` para generar `data/env-config.json` antes de compartir la carpeta con tus amigos o familia.

## Características principales

- Lectura del sitio completo, texto seleccionado o texto personalizado usando ElevenLabs.
- Lista/creación de voces y clonación desde archivos MP3/WAV/M4A.
- Resúmenes con tu endpoint Groq/Modal y conversación “Hablar con el sitio” con memoria por pestaña.
- Descarga automática del audio generado y guardado en subcarpetas personalizadas.
- Transcripción por micrófono con Whisper (Hugging Face) u otros proveedores configurables.
- Página de opciones para ajustar credenciales, modelos y preferencias sin recompilar.

## Estructura del proyecto

```
chrome-extension/
├── assets/
├── data/
│   ├── .gitkeep
│   └── env-config.json   # generado tras ejecutar npm run build:env
├── icons/
├── scripts/
│   └── build-env-config.js
├── src/
│   ├── background.js
│   ├── content.js
│   ├── options/
│   ├── popup/
│   ├── services/
│   └── utils/
├── .env.example
├── .gitignore
├── manifest.json
└── README.md
```

## Requisitos

- Chrome/Chromium 117+ (manifest v3).
- Node.js 18+ si quieres generar el archivo `env-config` desde `.env`.
- Claves API válidas de ElevenLabs, Groq/Modal y Hugging Face (solo en tu entorno local).

## Configuración rápida de credenciales

1. Copia `.env.example` a `.env` y rellena tus claves (`ELEVENLABS_API_KEY`, `GROQ_API_KEYS`, etc.).
2. Ejecuta `npm install` (solo la primera vez, no hay dependencias pero habilita los scripts).
3. Corre `npm run build:env`. Este comando leerá `.env` y generará `data/env-config.json` con los valores necesarios.
4. Carga la extensión como siempre. Al iniciar por primera vez, `src/utils/config.js` leerá `data/env-config.json` y precargará las credenciales en `chrome.storage.local` para que el popup y las opciones ya tengan todo listo.

El archivo `.env` y `data/env-config.json` están ignorados por Git, así que cada persona puede mantener sus propias claves sin riesgo de subirlas.

## Instalación en Chrome

1. Abre `chrome://extensions`.
2. Activa **Modo Desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `chrome-extension`.
4. La extensión aparecerá como *Phillips Voice Companion*; fija el icono si deseas acceso rápido.

## Configuración dentro de la extensión

- Haz clic derecho en el icono → **Opciones** para ajustar voces, proveedores o llaves sin tocar los archivos.
- Desde el popup puedes cambiar voz, velocidad y preferencia de lectura al vuelo.
- Los cambios se guardan en `chrome.storage.local`, por lo que permanecen aunque cierres el navegador.

## Uso rápido

- **Leer página completa:** botón principal del popup.
- **Leer selección:** selecciona texto y usa el botón dedicado o el menú contextual.
- **Resumir:** botones *Resumir página* / *Resumir selección* generan texto y lo leen en voz.
- **Conversar con el sitio:** escribe o habla; el modelo recibe contexto de la pestaña activa.
- **Clonar voz:** desde la sección de voces carga tus clips y genera una voz nueva.

## Seguridad y buenas prácticas

- Usa claves de prueba y revócalas si compartes la carpeta de forma pública.
- Ejecuta `npm run build:env` cada vez que actualices `.env` para regenerar `env-config`.
- Si no deseas empaquetar credenciales, simplemente omite el archivo `.env` y la extensión pedirá los datos mediante la página de opciones.

## Próximos pasos sugeridos

1. Automatizar pruebas de popup/opciones (Playwright).
2. Añadir métricas de consumo (créditos ElevenLabs/Groq).
3. Publicar en Chrome Web Store tras revisar permisos y contenido.

¿Necesitas ayuda para seguir iterando o desplegar la extensión? Escríbeme y lo vemos. ¡Listo para compartirla con tu círculo! 
