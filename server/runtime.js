'use strict';

const path = require('node:path');

function createRuntime(options = {}) {
  const version = options.version || '0.1.0';
  const listeners = [];

  globalThis.chrome = {
    runtime: {
      id: 'ops-toolkit-desktop-server',
      lastError: null,
      getManifest() {
        return { version };
      },
      onMessage: {
        addListener(listener) {
          listeners.push(listener);
        }
      }
    },
    action: {
      onClicked: {
        addListener() {
          // Desktop mode does not use the browser action.
        }
      }
    }
  };

  require(path.join(__dirname, 'background-runtime-source.js'));

  if (!listeners.length) {
    throw new Error('API runtime did not register a message listener');
  }

  const listener = listeners[0];

  function rpc(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Local API runtime timeout')), 370000);
      try {
        listener({ action, payload }, { desktop: true }, response => {
          clearTimeout(timer);
          if (!response) {
            reject(new Error('Local API runtime returned an empty response'));
            return;
          }
          if (response.ok === false) {
            const error = new Error(response.error || 'Local API runtime error');
            error.code = response.code;
            error.status = response.status;
            reject(error);
            return;
          }
          const data = response.data;
          if (action === 'ping' && data && typeof data === 'object') {
            data.mode = 'desktop';
            data.server = true;
          }
          resolve(data);
        });
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  return { rpc };
}

module.exports = { createRuntime };
