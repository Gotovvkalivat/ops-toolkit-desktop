(function () {
  'use strict';

  const DESKTOP_STORAGE_KEY = 'opsToolkitDesktop.chromeStorage.v1';

  function readStorageState() {
    try {
      return JSON.parse(localStorage.getItem(DESKTOP_STORAGE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function writeStorageState(value) {
    localStorage.setItem(DESKTOP_STORAGE_KEY, JSON.stringify(value || {}));
  }

  function ensureStorageShim() {
    const existingChrome = globalThis.chrome || {};
    if (existingChrome.storage?.local) return;
    const listeners = new Set();
    globalThis.chrome = {
      ...existingChrome,
      storage: {
        local: {
          get(keys, callback) {
            const state = readStorageState();
            let result = {};
            if (keys === null || keys === undefined) {
              result = { ...state };
            } else if (Array.isArray(keys)) {
              keys.forEach(key => { if (Object.prototype.hasOwnProperty.call(state, key)) result[key] = state[key]; });
            } else if (typeof keys === 'string') {
              if (Object.prototype.hasOwnProperty.call(state, keys)) result[keys] = state[keys];
            } else if (typeof keys === 'object') {
              result = { ...keys };
              Object.keys(keys).forEach(key => { if (Object.prototype.hasOwnProperty.call(state, key)) result[key] = state[key]; });
            }
            queueMicrotask(() => callback?.(result));
          },
          set(items, callback) {
            const state = readStorageState();
            const changes = {};
            Object.entries(items || {}).forEach(([key, newValue]) => {
              changes[key] = { oldValue: state[key], newValue };
              state[key] = newValue;
            });
            writeStorageState(state);
            queueMicrotask(() => {
              listeners.forEach(listener => listener(changes, 'local'));
              callback?.();
            });
          },
          remove(keys, callback) {
            const state = readStorageState();
            const list = Array.isArray(keys) ? keys : [keys];
            const changes = {};
            list.filter(Boolean).forEach(key => {
              changes[key] = { oldValue: state[key], newValue: undefined };
              delete state[key];
            });
            writeStorageState(state);
            queueMicrotask(() => {
              listeners.forEach(listener => listener(changes, 'local'));
              callback?.();
            });
          }
        },
        onChanged: {
          addListener(listener) {
            listeners.add(listener);
          },
          removeListener(listener) {
            listeners.delete(listener);
          }
        }
      }
    };
  }

  ensureStorageShim();

  const isExtension = Boolean(globalThis.chrome && chrome.runtime && chrome.runtime.id);

  async function extensionRpc(action, payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, payload }, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message || 'Не удалось связаться с фоновым процессом расширения'));
          return;
        }
        if (!response) {
          reject(new Error('Фоновый процесс не вернул ответ'));
          return;
        }
        if (response.ok === false) {
          const error = new Error(response.error || 'Ошибка запроса');
          error.code = response.code;
          error.status = response.status;
          reject(error);
          return;
        }
        resolve(response.data);
      });
    });
  }

  async function localRpc(action, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 360000);
    try {
      const response = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        const error = new Error(body.error || `Ошибка локального сервера: ${response.status}`);
        error.code = body.code;
        error.status = response.status;
        throw error;
      }
      return body.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Локальный сервер не ответил за 6 минут');
      if (error instanceof TypeError) {
        throw new Error('Локальный сервер недоступен. Запустите start.cmd или команду npm start.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  globalThis.KDBridge = {
    mode: isExtension ? 'extension' : 'local',
    rpc(action, payload = {}) {
      return isExtension ? extensionRpc(action, payload) : localRpc(action, payload);
    },
    async ping() {
      return this.rpc('ping');
    }
  };
})();
