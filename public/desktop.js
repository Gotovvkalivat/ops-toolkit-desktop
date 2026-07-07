'use strict';

const statusEl = document.getElementById('serverStatus');

async function checkServer() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error('not ready');
    statusEl.textContent = `Сервер запущен · v${data.version}`;
    statusEl.className = 'status-pill ready';
  } catch {
    statusEl.textContent = 'Сервер недоступен';
    statusEl.className = 'status-pill error';
  }
}

void checkServer();
