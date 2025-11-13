const MAX_CONTEXT_CHARS = 12000;
let overlayContainer = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message ?? {};
  switch (type) {
    case "COLLECT_PAGE_CONTENT":
      sendResponse(collectPageContent(payload));
      return true;
    case "GET_SITE_CONTEXT":
      sendResponse(collectLightweightContext(payload));
      return true;
    case "PLAY_AUDIO":
      playAudioOverlay(payload);
      return false;
    case "SHOW_ERROR":
      showToast(payload?.message ?? "Se produjo un error en la extensión.");
      return false;
    default:
      return false;
  }
});

function collectPageContent(payload) {
  const options = normalizeOptions(payload?.payload ?? payload);
  const selection = sanitizeText(window.getSelection()?.toString() ?? "", options);
  const text = extractReadableText(options);
  const truncated = truncateText(text, options.maxCharacters ?? MAX_CONTEXT_CHARS);
  return {
    title: document.title,
    url: document.location.href,
    text: truncated,
    selection
  };
}

function collectLightweightContext(payload) {
  const options = normalizeOptions(payload?.payload ?? payload);
  const selection = sanitizeText(window.getSelection()?.toString() ?? "", options);
  const text = truncateText(extractReadableText({ ...options, maxCharacters: options.maxCharacters ?? 8000 }), options.maxCharacters ?? MAX_CONTEXT_CHARS);
  return {
    title: document.title,
    url: document.location.href,
    text: selection ? `${selection}\n\n${text}` : text
  };
}

function normalizeOptions(options = {}) {
  return {
    focusMainContent: options.focusMainContent !== false,
    skipNavigation: options.skipNavigation !== false,
    skipSidebars: options.skipSidebars !== false,
    skipFooter: options.skipFooter !== false,
    skipCodeBlocks: Boolean(options.skipCodeBlocks),
    skipUrls: Boolean(options.skipUrls),
    maxCharacters: Number(options.maxCharacters) || MAX_CONTEXT_CHARS
  };
}

function extractReadableText(options) {
  const root = selectMainContainer(options);
  if (!root) {
    return sanitizeText(document.body?.innerText ?? "", options);
  }
  const clone = root.cloneNode(true);
  pruneNode(clone, options);
  let content = clone.innerText ?? "";
  content = sanitizeText(content, options);
  return normalizeWhitespace(content);
}

function selectMainContainer(options) {
  if (!options.focusMainContent) {
    return document.body;
  }
  const candidates = [
    "main",
    "[role=main]",
    "article",
    ".main",
    ".main-content",
    ".content",
    ".article",
    ".article-content",
    ".post",
    ".docs-content",
    "#main",
    "#content"
  ];
  for (const selector of candidates) {
    const element = document.querySelector(selector);
    if (element && element.innerText && element.innerText.trim().length > 200) {
      return element;
    }
  }
  return document.body;
}

function pruneNode(root, options) {
  const removalSelectors = [
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "canvas",
    "form",
    "input",
    "button"
  ];
  if (options.skipNavigation) {
    removalSelectors.push("nav", "header", "[role=navigation]", ".navbar", ".menu", ".topbar");
  }
  if (options.skipSidebars) {
    removalSelectors.push("aside", "[role=complementary]", ".sidebar", ".sidenav", ".toc", ".table-of-contents");
  }
  if (options.skipFooter) {
    removalSelectors.push("footer", "[role=contentinfo]", ".footer");
  }
  if (options.skipCodeBlocks) {
    removalSelectors.push("pre", "code", "samp", "kbd", ".code", ".highlight", ".code-block");
  }
  removalSelectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((node) => node.remove());
  });
  if (options.skipUrls) {
    root.querySelectorAll("a").forEach((anchor) => {
      const text = anchor.innerText ?? "";
      if (!text.trim() || isLikelyUrl(text)) {
        anchor.remove();
      } else {
        anchor.replaceWith(anchor.innerText);
      }
    });
  }
}

function sanitizeText(text, options) {
  let result = text ?? "";
  if (!result) return "";
  result = result.replace(/\r\n/g, "\n");
  if (options?.skipUrls) {
    result = result
      .split("\n")
      .filter((line) => !isLikelyUrl(line.trim()))
      .join("\n");
  }
  if (options?.skipCodeBlocks) {
    result = result
      .split("\n")
      .filter((line) => !isLikelyCode(line))
      .join("\n");
  }
  return normalizeWhitespace(result);
}

function normalizeWhitespace(text) {
  return text.replace(/\u00A0/g, " ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function truncateText(text, max) {
  if (!text) return "";
  if (!max || text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}...`;
}

function isLikelyUrl(value) {
  return /^https?:\/\/[\w.-]/i.test(value) || /^www\./i.test(value) || /^[a-z]+:\/\/\S+/i.test(value);
}

function isLikelyCode(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^[\{\}\[\];<>]|^(function|const|let|var|import|export|class|if|else|for|while|switch|case|def|return)\b/.test(trimmed) || trimmed.includes("://");
}

function playAudioOverlay({ base64, format, fileName, source }) {
  if (!base64) {
    showToast("No se recibió audio para reproducir.");
    return;
  }
  ensureOverlay();
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = `data:audio/${format ?? "mp3"};base64,${base64}`;
  audio.autoplay = true;

  const item = document.createElement("div");
  item.className = "phillips-audio-item";

  const info = document.createElement("div");
  info.className = "phillips-audio-info";
  info.textContent = source === "selection" ? "Lectura de selección" : "Lectura generada";

  const download = document.createElement("a");
  download.className = "phillips-download";
  download.href = audio.src;
  download.download = fileName ?? `lectura.${format ?? "mp3"}`;
  download.textContent = "Descargar audio";

  const closeBtn = document.createElement("button");
  closeBtn.className = "phillips-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => {
    item.remove();
    if (overlayContainer && overlayContainer.childElementCount === 0) {
      overlayContainer.remove();
      overlayContainer = null;
    }
  });

  item.appendChild(info);
  item.appendChild(audio);
  item.appendChild(download);
  item.appendChild(closeBtn);
  overlayContainer.appendChild(item);
}

function ensureOverlay() {
  if (overlayContainer) return;
  overlayContainer = document.createElement("div");
  overlayContainer.id = "phillips-voice-overlay";
  overlayContainer.innerHTML = `
    <style>
      #phillips-voice-overlay {
        position: fixed;
        bottom: 16px;
        right: 16px;
        width: 320px;
        max-height: 70vh;
        overflow-y: auto;
        background: rgba(24, 24, 24, 0.95);
        color: #fff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
        padding: 12px;
        z-index: 999999;
      }
      #phillips-voice-overlay .phillips-audio-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 10px;
      }
      #phillips-voice-overlay audio {
        width: 100%;
      }
      #phillips-voice-overlay .phillips-download {
        color: #7dd3fc;
        font-size: 12px;
        text-decoration: none;
      }
      #phillips-voice-overlay .phillips-download:hover {
        text-decoration: underline;
      }
      #phillips-voice-overlay .phillips-close {
        align-self: flex-end;
        background: transparent;
        border: none;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
      }
      #phillips-voice-toast {
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000000;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
      }
      #phillips-voice-toast.visible {
        opacity: 1;
        transform: translateY(0);
      }
    </style>
  `;
  document.body.appendChild(overlayContainer);
}

function showToast(message) {
  let toast = document.getElementById("phillips-voice-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "phillips-voice-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 3000);
}

