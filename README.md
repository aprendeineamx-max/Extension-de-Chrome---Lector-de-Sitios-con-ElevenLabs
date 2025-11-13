# Phillips Voice Companion

Extensión de Chrome lista para empaquetar y subir a un repositorio de GitHub. Permite leer sitios completos o fragmentos utilizando ElevenLabs, generar resúmenes con modelos Groq, conversar con el contenido en tiempo real y clonar voces a partir de archivos de audio.

> ⚠️ **Seguridad:** Esta versión incluye las credenciales que compartiste (ElevenLabs, Groq/Modal y Hugging Face) precargadas para poder depurar juntos. Te recomiendo crear claves de prueba y regenerarlas después de verificar la extensión. Nunca publiques un repositorio público con estas claves sin revocarlas.

## Características principales

- Lectura del sitio completo, texto seleccionado o texto personalizado con ElevenLabs.
- Lista en tiempo real de tus voces, creación de nuevas voces y clonación a partir de archivos MP3/WAV/M4A.
- Descarga directa del audio generado en formatos `mp3`, `wav` u `ogg`.
- Resúmenes inteligentes alimentados por tu endpoint de Groq/Modal (`llama2-70b-chat` por defecto).
- Conversación **Hablar con el sitio** con memoria por pestaña, contexto en tiempo real y respuesta en voz.
- Grabación por micrófono con transcripción automática (Hugging Face Whisper o ElevenLabs Scribe).
- Página de opciones para ajustar credenciales, modelos y preferencias sin recompilar.

## Estructura

```
chrome-extension/
├── manifest.json
├── README.md
├── icons/
├── src/
│   ├── background.js
│   ├── content.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   ├── services/
│   │   ├── elevenlabs.js
│   │   ├── groq.js
│   │   └── stt.js
│   └── utils/
│       ├── config.js
│       └── storage.js
└── data/
```

## Requisitos

- Navegador Chrome/Chromium 117+ (manifest V3).
- Conexión a Internet para consumir los endpoints de ElevenLabs, Modal/Groq y Hugging Face.
- Claves API válidas (ya incluidas en la configuración por defecto).

## Instalación en Chrome

1. Abre `chrome://extensions`.
2. Activa el **Modo desarrollador**.
3. Pulsa **Cargar descomprimida** y elige la carpeta `chrome-extension`.
4. La extensión aparecerá como *Phillips Voice Companion*. Fija el ícono en la barra si lo deseas.

## Configuración

Las credenciales vienen precargadas desde `src/utils/config.js`. Si deseas modificarlas:

1. Haz clic derecho en el icono de la extensión → **Opciones**.
2. Ajusta las claves de ElevenLabs, Groq/Modal, Hugging Face o cambia el proveedor de STT.
3. Guarda los cambios (se almacenan en `chrome.storage.local`).

## Uso rápido

- **Leer página completa:** abre un sitio y usa el botón correspondiente en el popup.
- **Leer selección:** selecciona texto y usa el botón o el menú contextual.
- **Texto personalizado:** pega cualquier fragmento y genera el audio.
- **Resumir:** pulsa **Resumir página** o **Resumir selección**. Puedes escuchar el resumen con ElevenLabs.
- **Conversar con el sitio:** escribe en el cuadro o usa el micrófono. El modelo recibe el contexto del sitio actual y responde usando voz.
- **Clonar voz:** abre la sección de voces, carga tus clips y crea una voz nueva para futuras lecturas.

## Conversación en tiempo real

La extensión mantiene memoria por pestaña. Al cambiar de pestaña conserva el contexto recogido (título, fragmentos visibles y selección activa). Si quieres empezar de cero, usa **Reiniciar** en la sección *Hablar con el sitio*.

## Compilar o empaquetar

No es necesario compilar: todo el código es JavaScript/HTML/CSS plano. Para publicar en la Chrome Web Store:

1. Sustituye las claves por variables de entorno seguras o un flujo de autenticación propio.
2. Ejecuta `zip -r phillips-voice-companion.zip *` dentro de `chrome-extension`.
3. Sube el archivo zip al panel de desarrollador de Chrome.

## Recomendaciones de seguridad

- Usa claves separadas para desarrollo y producción.
- Revoca las claves presentes en este repo antes de hacerlo público.
- Considera cifrar la configuración o implementar OAuth si lo despliegas a gran escala.
- ElevenLabs cobra por minuto generado; monitoriza los créditos en tu panel.

## Próximos pasos sugeridos

- Añadir tests automáticos (p. ej. via Playwright) para validar flujo básico.
- Integrar indicadores de uso de créditos ElevenLabs y Groq.
- Añadir soporte para más proveedores de STT/TTS y traducción en vivo.
- Publicar en GitHub: `git init`, `git add .`, `git commit -m "Add Phillips Voice Companion extension"` y subir al repositorio deseado.

Si necesitas asistencia para desplegar, crear pipelines o agregar más modelos, avísame y lo adaptamos. ¡Listo para iterar juntos! 


