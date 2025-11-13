export const storage = {
  async get(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error("Error al leer de storage", chrome.runtime.lastError);
          resolve(defaultValue);
          return;
        }
        resolve(result[key] ?? defaultValue);
      });
    });
  },

  async set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error al escribir en storage", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  },

  async update(key, updater) {
    const current = await storage.get(key, {});
    const next = { ...current, ...(await updater(current)) };
    await storage.set(key, next);
    return next;
  },

  async remove(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  }
};

