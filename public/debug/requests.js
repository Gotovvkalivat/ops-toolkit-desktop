(() => {
  'use strict';

  const els = {
    autoRefresh: document.getElementById('autoRefreshInput'),
    refresh: document.getElementById('refreshButton'),
    clear: document.getElementById('clearButton'),
    search: document.getElementById('searchInput'),
    outcome: document.getElementById('outcomeSelect'),
    method: document.getElementById('methodSelect'),
    entriesCount: document.getElementById('entriesCount'),
    fileSize: document.getElementById('fileSize'),
    fileLimit: document.getElementById('fileLimit'),
    filePath: document.getElementById('filePath'),
    updatedAt: document.getElementById('updatedAt'),
    list: document.getElementById('requestList'),
    toast: document.getElementById('toast')
  };
  let entries = [];
  let clearArmed = false;
  let toastTimer = 0;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
  }

  function timeText(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function outcomeMeta(entry) {
    if (entry.outcome === 'success') return { className: '', text: String(entry.status || 'OK') };
    if (entry.outcome === 'retry') return { className: 'retry', text: `${entry.status || '—'} · повтор` };
    if (entry.outcome === 'timeout') return { className: 'error', text: 'Таймаут' };
    if (entry.outcome === 'cancelled') return { className: 'retry', text: 'Остановлен' };
    if (entry.outcome === 'network-error') return { className: 'error', text: 'Ошибка сети' };
    return { className: 'error', text: String(entry.status || 'Ошибка') };
  }

  function filteredEntries() {
    const search = els.search.value.trim().toLowerCase();
    const outcome = els.outcome.value;
    const method = els.method.value;
    return entries.filter(entry => {
      if (outcome && entry.outcome !== outcome) return false;
      if (method && entry.method !== method) return false;
      if (!search) return true;
      return [entry.method, entry.url, entry.status, entry.outcome, entry.error, entry.requestBody, entry.responseBody]
        .some(value => String(value ?? '').toLowerCase().includes(search));
    });
  }

  function render() {
    const visible = filteredEntries();
    els.entriesCount.textContent = String(visible.length);
    if (!visible.length) {
      els.list.innerHTML = '<div class="empty-state">Подходящих запросов нет. Попадания в кеш здесь не отображаются.</div>';
      return;
    }
    els.list.innerHTML = visible.map(entry => {
      const status = outcomeMeta(entry);
      return `<details class="request-row">
        <summary>
          <span class="request-time">${escapeHtml(timeText(entry.at))}</span>
          <span class="method">${escapeHtml(entry.method)}</span>
          <span class="request-url" title="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}</span>
          <span class="status ${status.className}">${escapeHtml(status.text)}</span>
          <span class="duration">${escapeHtml(entry.durationMs)} мс</span>
          <span class="attempt">${escapeHtml(entry.attempt)} / ${escapeHtml(entry.totalAttempts)}</span>
        </summary>
        <div class="request-details">
          <div class="wide"><span>Адрес запроса</span><code>${escapeHtml(entry.url)}</code></div>
          <div><span>Размер запроса</span><code>${escapeHtml(formatBytes(entry.requestBytes))}</code></div>
          <div><span>Размер ответа</span><code>${escapeHtml(formatBytes(entry.responseBytes))}</code></div>
          ${entry.requestBody ? `<div class="wide"><span>Тело запроса (секреты скрыты)</span><code>${escapeHtml(entry.requestBody)}</code></div>` : ''}
          ${entry.responseBody ? `<div class="wide"><span>Ответ API (секреты скрыты)</span><code>${escapeHtml(entry.responseBody)}</code></div>` : ''}
          ${entry.error ? `<div class="wide"><span>Ошибка</span><code>${escapeHtml(entry.error)}</code></div>` : ''}
        </div>
      </details>`;
    }).join('');
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    toastTimer = window.setTimeout(() => { els.toast.hidden = true; }, 2600);
  }

  async function load() {
    els.refresh.disabled = true;
    try {
      const response = await fetch('/api/debug/outbound?limit=1000', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      entries = Array.isArray(data.entries) ? data.entries : [];
      els.fileSize.textContent = formatBytes(data.sizeBytes);
      els.fileLimit.textContent = formatBytes(data.maxBytes);
      els.filePath.textContent = data.filePath || '—';
      els.filePath.title = data.filePath || '';
      els.updatedAt.textContent = `Обновлено ${new Date().toLocaleTimeString('ru-RU')}`;
      render();
    } catch (error) {
      els.updatedAt.textContent = 'Не удалось загрузить журнал';
      showToast(`Ошибка загрузки: ${error.message}`);
    } finally {
      els.refresh.disabled = false;
    }
  }

  async function clearLog() {
    if (!clearArmed) {
      clearArmed = true;
      els.clear.textContent = 'Нажмите ещё раз';
      window.setTimeout(() => {
        clearArmed = false;
        els.clear.textContent = 'Очистить журнал';
      }, 3500);
      return;
    }
    clearArmed = false;
    els.clear.disabled = true;
    try {
      const response = await fetch('/api/debug/outbound', { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      entries = [];
      els.clear.textContent = 'Очистить журнал';
      showToast('Журнал исходящих запросов очищен');
      await load();
    } catch (error) {
      showToast(`Не удалось очистить журнал: ${error.message}`);
    } finally {
      els.clear.disabled = false;
    }
  }

  els.refresh.addEventListener('click', load);
  els.clear.addEventListener('click', clearLog);
  [els.search, els.outcome, els.method].forEach(control => control.addEventListener('input', render));
  window.setInterval(() => {
    if (els.autoRefresh.checked && !document.hidden) void load();
  }, 3000);
  void load();
})();
