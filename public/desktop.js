'use strict';

const STORAGE_KEY = 'opsToolkitDesktop.chromeStorage.v1';
const CREDENTIALS_KEY = 'opsToolkitCredentials';
const SHELL_KEY = 'opsToolkitDesktop.shell.v3';
const DENSITY_MIGRATION_KEY = 'opsToolkitDesktop.density.v1';
const PROJECTS = {
  kd: { label: 'Курьер Дисконт', short: 'КД' },
  me: { label: 'ME Express', short: 'ME' },
  ops: { label: 'OPSPost', short: 'OPS' }
};
const TOOLS = {
  calculator: {
    title: 'Массовый расчёт доставки', hint: 'Тарифы, сравнение ТК и аналитика', frame: 'calculatorFrame', clientKey: 'calculatorClient',
    settingsTitle: 'Массовый расчёт', settingsHint: 'Лучший тариф, нагрузка, выгрузка и отображение.',
    actions: [
      ['add-row', 'Добавить строку', 'plus', 'secondary', true], ['paste', 'Вставить из буфера', 'clipboard', 'secondary', true],
      ['template', 'Шаблон XLSX', 'file', 'secondary', true], ['example', 'Добавить пример', 'sparkles', 'secondary', true],
      ['import', 'Загрузить файл', 'upload', 'secondary'], ['toggle-auto', 'Авторасчёт', 'auto', 'secondary', true],
      ['calculate', 'Рассчитать всё', 'calculator', 'primary']
    ]
  },
  orders: {
    title: 'Массовое оформление заказов', hint: 'Импорт, расчёт и создание заказов', frame: 'ordersFrame', clientKey: 'ordersClient',
    settingsTitle: 'Массовое оформление', settingsHint: 'Нагрузка, авторасчёт, производительность и интерфейс.',
    actions: [
      ['toggle-view', 'Сменить вид', 'table', 'secondary', true], ['template', 'Шаблон XLSX', 'file', 'secondary', true],
      ['toggle-auto', 'Авторасчёт', 'auto', 'secondary', true], ['calculate', 'Рассчитать', 'calculator', 'secondary'],
      ['create', 'Создать', 'check', 'primary'], ['import', 'Загрузить', 'upload', 'primary']
    ]
  }
};
const ICONS = {
  upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2m4 0h2M8 14h2m4 0h2M8 18h2m4 0h2"/>',
  check: '<path d="m5 12 4 4L19 6"/>', file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  sparkles: '<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
  auto: '<path d="M20 7h-5V2M4 17h5v5"/><path d="M5.6 8A8 8 0 0 1 18 5l2 2M18.4 16A8 8 0 0 1 6 19l-2-2"/>'
  ,plus: '<path d="M12 5v14M5 12h14"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>'
};
const LOCAL_ENDPOINTS = {
  auth: '/api/auth/login', deliveryCompanies: '/api/reference/delivery-companies', searchUser: '/api/clients/search',
  clearCache: '/api/cache/clear', calculationCacheStatus: '/api/cache/status'
};

const $ = selector => document.querySelector(selector);
const els = {
  serverStatus: $('#serverStatus'), projectTabs: $('#projectTabs'), toolTabs: [...document.querySelectorAll('[data-tool]')],
  activeToolTitle: $('#activeToolTitle'), activeToolHint: $('#activeToolHint'), toolActions: $('#toolActions'),
  clientInnInput: $('#clientInnInput'), clientResult: $('#clientResult'), findClientButton: $('#findClientButton'),
  settingsButton: $('#settingsButton'), helpButton: $('#helpButton'), themeButton: $('#themeButton'),
  settingsDrawer: $('#settingsDrawer'), settingsTitle: $('#settingsTitle'), settingsSubtitle: $('#settingsSubtitle'), settingsProjectLabel: $('#settingsProjectLabel'),
  sectionSettingsTitle: $('#sectionSettingsTitle'), sectionSettingsHint: $('#sectionSettingsHint'), moduleSettingsHost: $('#moduleSettingsHost'),
  emailInput: $('#emailInput'), passwordInput: $('#passwordInput'), dadataInput: $('#dadataInput'), passwordToggle: $('#passwordToggle'), dadataToggle: $('#dadataToggle'),
  authStatus: $('#authStatus'), checkCredentialsButton: $('#checkCredentialsButton'), saveSettingsButton: $('#saveSettingsButton'), debugModeInput: $('#debugModeInput'),
  frameLoading: $('#frameLoading'), toastRegion: $('#toastRegion'), appTooltip: $('#appTooltip'),
  ordersNavbarSummary: $('#ordersNavbarSummary'), ordersSelectedCount: $('#ordersSelectedCount'), ordersSelectedTotal: $('#ordersSelectedTotal'),
  refreshCacheButton: $('#refreshCacheButton'), clearCacheButton: $('#clearCacheButton'), cacheStatus: $('#cacheStatus')
};
els.confirmDialog = $('#confirmDialog'); els.confirmTitle = $('#confirmTitle'); els.confirmMessage = $('#confirmMessage'); els.confirmAcceptButton = $('#confirmAcceptButton');
const state = loadShellState();
let authBusy = false;
let clientSearchTimer = 0;
let clientSearchGeneration = 0;
const moduleState = { calculator: { busy: false }, orders: { busy: false, summary: {} } };
let activeAction = '';

function readStorageState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; } }
function writeStorageState(value) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value || {})); window.dispatchEvent(new CustomEvent('ops-toolkit-storage-change')); }
function readCredentials() { return readStorageState()[CREDENTIALS_KEY] || { activeProject: 'kd', tokenDaData: '', projects: {} }; }
function writeCredentials(credentials) { const storage = readStorageState(); storage[CREDENTIALS_KEY] = credentials; writeStorageState(storage); }
function loadShellState() {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(SHELL_KEY) || '{}') || {}; } catch { /* ignore */ }
  const credentials = readCredentials();
  return { tool: TOOLS[saved.tool] ? saved.tool : 'calculator', project: PROJECTS[credentials.activeProject] ? credentials.activeProject : 'kd', theme: ['light','dark'].includes(saved.theme) ? saved.theme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), debug: Boolean(saved.debug) };
}
function saveShellState() { localStorage.setItem(SHELL_KEY, JSON.stringify({ tool: state.tool, theme: state.theme, debug: state.debug })); }
function svg(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }
function frameFor(tool = state.tool) { return document.getElementById(TOOLS[tool].frame); }
function moduleApi(tool = state.tool) { try { return frameFor(tool)?.contentWindow?.OPS_TOOLKIT_MODULE || null; } catch { return null; } }
function ensureDefaultDensity(tool) {
  let migrated = {};
  try { migrated = JSON.parse(localStorage.getItem(DENSITY_MIGRATION_KEY) || '{}') || {}; } catch { /* ignore */ }
  if (migrated[tool]) return;
  const api = moduleApi(tool);
  if (!api?.updateSettings) return;
  api.updateSettings({ density: tool === 'orders' ? 'comfortable' : 'medium' });
  migrated[tool] = true;
  localStorage.setItem(DENSITY_MIGRATION_KEY, JSON.stringify(migrated));
}
function ensureFrame(tool) { const frame = frameFor(tool); if (!frame.src && frame.dataset.src) { els.frameLoading.hidden = false; frame.src = frame.dataset.src; } return frame; }
function projectCredentials(credentials = readCredentials()) { credentials.projects ||= {}; credentials.projects[state.project] ||= {}; return credentials.projects[state.project]; }
function activeClient(credentials = readCredentials()) { return projectCredentials(credentials)[TOOLS[state.tool].clientKey] || {}; }
function projectReady(projectId, credentials = readCredentials()) { const project = credentials.projects?.[projectId] || {}; return Boolean(project.authChecked && project.email && project.password && credentials.tokenDaData); }
function toolBusy(tool = state.tool) { return Boolean(moduleState[tool]?.busy || moduleApi(tool)?.isBusy?.()); }
function anyModuleBusy() { return Object.keys(TOOLS).some(tool => toolBusy(tool)); }
function guardBusy(message = 'Сначала остановите текущую операцию') { if (!anyModuleBusy()) return false; toast(message, 'error'); return true; }

function setActiveTool(tool, options = {}) {
  if (!TOOLS[tool]) return;
  if (tool !== state.tool && guardBusy('Раздел нельзя переключить во время расчёта или создания заказов')) return;
  state.tool = tool; saveShellState(); ensureFrame(tool);
  document.querySelectorAll('.tool-frame').forEach(frame => frame.classList.toggle('active', frame.id === TOOLS[tool].frame));
  els.toolTabs.forEach(button => { const active = button.dataset.tool === tool; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  const definition = TOOLS[tool];
  els.activeToolTitle.textContent = definition.title; els.activeToolHint.textContent = definition.hint;
  els.settingsTitle.textContent = `Настройки · ${definition.settingsTitle}`; els.settingsSubtitle.textContent = `Проект ${PROJECTS[state.project].short} · доступ и параметры раздела`;
  els.sectionSettingsTitle.textContent = definition.settingsTitle; els.sectionSettingsHint.textContent = definition.settingsHint;
  renderToolActions(); renderClient();
  renderOrdersSummary();
  if (!els.settingsDrawer.hidden) renderSettingsForm();
  if (!options.skipHash) history.replaceState(null, '', `#${tool}`);
}

function setProject(projectId, options = {}) {
  if (!PROJECTS[projectId]) return;
  if (projectId !== state.project && guardBusy('Проект нельзя переключить во время расчёта или создания заказов')) return;
  state.project = projectId; document.documentElement.dataset.project = projectId;
  const credentials = readCredentials(); credentials.activeProject = projectId; credentials.projects ||= {}; writeCredentials(credentials);
  [...els.projectTabs.querySelectorAll('[data-project]')].forEach(button => button.classList.toggle('active', button.dataset.project === projectId));
  els.settingsProjectLabel.textContent = PROJECTS[projectId].label;
  for (const tool of Object.keys(TOOLS)) moduleApi(tool)?.switchProject?.(projectId);
  renderProjectReadiness(); renderSettingsForm(); renderClient();
  if (!options.silent) toast(`${PROJECTS[projectId].short}: проект выбран`, 'success');
}

function renderProjectReadiness() {
  const credentials = readCredentials();
  [...els.projectTabs.querySelectorAll('[data-project]')].forEach(button => {
    const ready = projectReady(button.dataset.project, credentials);
    button.classList.toggle('ready', ready); button.dataset.tooltip = ready ? `${PROJECTS[button.dataset.project].label}: доступ проверен` : `${PROJECTS[button.dataset.project].label}: требуется настройка`;
  });
}
function renderToolActions() {
  const moduleSettings = moduleApi()?.getSettings?.() || {};
  const busy = toolBusy();
  const stopLabel = activeAction === 'create' ? 'Остановить создание' : activeAction === 'resolve' ? 'Остановить распознавание' : 'Остановить расчёт';
  const actions = busy ? [['stop', stopLabel, 'stop', 'danger']] : TOOLS[state.tool].actions;
  els.toolActions.innerHTML = actions.map(([action,label,icon,tone,compact]) => {
    const active = action === 'toggle-auto' && moduleSettings.autoCalculate;
    const disabled = activeAction && action !== 'stop';
    return `<button class="button ${tone} ${compact ? 'compact-action' : ''} ${active ? 'active' : ''}" type="button" data-tool-action="${action}" data-tooltip="${label}${active ? ': включён' : ''}" aria-label="${label}" ${disabled ? 'disabled' : ''}>${svg(icon)}${compact ? '' : `<span class="action-label">${label}</span>`}</button>`;
  }).join('');
}
function renderOrdersSummary() {
  const visible = state.tool === 'orders';
  els.ordersNavbarSummary.hidden = !visible;
  if (!visible) return;
  const summary = moduleState.orders.summary || {};
  els.ordersSelectedCount.textContent = String(summary.selected || 0);
  els.ordersSelectedTotal.textContent = summary.selectedTotalText || '0 ₽';
}
function renderClient() {
  const client = activeClient();
  if (document.activeElement !== els.clientInnInput) els.clientInnInput.value = String(client.inn || '').replace(/\D/g, '').slice(0,12);
  const valid = Boolean(client.userId), pending = Boolean(client.inn) && !valid;
  els.clientResult.className = `client-result ${valid ? 'ready' : pending ? 'pending' : ''}`;
  els.clientResult.textContent = valid ? (client.userDisplay || 'Клиент выбран') : pending ? 'Поиск клиента…' : 'Клиент не выбран';
  els.clientInnInput.closest('.client-control')?.classList.toggle('required', !valid);
}

function settingsOptions(values, current) { return values.map(([value,label]) => `<option value="${value}" ${String(value) === String(current) ? 'selected' : ''}>${label}</option>`).join(''); }
function checked(value) { return value ? 'checked' : ''; }
function moduleSettingsMarkup(settings) {
  if (!settings) return '<div class="module-settings-loading"><span class="spinner"></span><span>Загружаю настройки раздела…</span></div>';
  if (state.tool === 'orders') return `
    <div class="module-settings-grid">
      <label class="field"><span>Параллельных запросов</span><select data-module-setting="concurrency">${settingsOptions([[1,'1 — бережно'],[2,'2'],[3,'3 — рекомендуется'],[4,'4'],[5,'5'],[6,'6']], settings.concurrency)}</select></label>
      <label class="field"><span>Ожидание ответа</span><select data-module-setting="timeoutMs">${settingsOptions([[60000,'60 сек.'],[90000,'90 сек.'],[120000,'120 сек.'],[180000,'180 сек.']], settings.timeoutMs)}</select></label>
      <label class="field"><span>Повторов после ошибки</span><select data-module-setting="retries">${settingsOptions([[0,'Не повторять'],[1,'1 повтор'],[2,'2 повтора'],[3,'3 повтора']], settings.retries)}</select></label>
    </div>
    <div class="switch-list">
      <label class="switch-field"><input type="checkbox" data-module-setting="autoCalculate" ${checked(settings.autoCalculate)}><span>Автоматически рассчитывать готовые строки</span></label>
      <label class="switch-field"><input type="checkbox" data-module-setting="showOnboarding" ${checked(settings.showOnboarding)}><span>Показывать пошаговую панель</span></label>
      <label class="switch-field"><input type="checkbox" data-module-setting="performanceMode" ${checked(settings.performanceMode)}><span>Режим слабого компьютера</span></label>
    </div>`;
  const companies = Array.isArray(settings.companies) ? settings.companies : [];
  const best = new Set(settings.bestExclusions || []), hidden = new Set(settings.exclusions || []);
  const companyChecks = (set, kind) => companies.length ? companies.map(company => `<label class="choice-check"><input type="checkbox" data-module-list="${kind}" value="${escapeHtml(company)}" ${checked(set.has(company))}><span>${escapeHtml(company)}</span></label>`).join('') : '<span class="empty-note">Список появится после авторизации или первого расчёта.</span>';
  const definitions = settings.definitions || {};
  const exportChecks = (kind, fields, selected) => {
    const picked = new Set(selected || []);
    return (fields || []).map(field => `<label class="choice-check"><input type="checkbox" data-module-list="${kind}" value="${escapeHtml(field.key)}" ${checked(picked.has(field.key))}><span>${escapeHtml(field.label)}</span></label>`).join('');
  };
  return `
    <div class="module-settings-grid">
      <label class="field"><span>Лучший тариф</span><select data-module-setting="bestMethodMode">${settingsOptions([['door','Только дверь-дверь'],['all','Любой метод доставки']], settings.bestMethodMode)}</select></label>
      <label class="field"><span>Параллельных расчётов</span><select data-module-setting="concurrency">${settingsOptions([[1,'1 — бережно'],[2,'2'],[3,'3 — рекомендуется'],[4,'4'],[5,'5'],[6,'6']], settings.concurrency)}</select></label>
      <label class="field"><span>Задержка автопоиска</span><select data-module-setting="debounceMs">${settingsOptions([[400,'0,4 сек.'],[650,'0,65 сек.'],[900,'0,9 сек.'],[1200,'1,2 сек.']], settings.debounceMs)}</select></label>
      <label class="field"><span>Ожидание ответа</span><select data-module-setting="calcTimeoutMs">${settingsOptions([[60000,'60 сек.'],[90000,'90 сек.'],[120000,'120 сек.'],[180000,'180 сек.']], settings.calcTimeoutMs)}</select></label>
      <label class="field"><span>Повторов после ошибки</span><select data-module-setting="calcRetries">${settingsOptions([[0,'Не повторять'],[1,'1 повтор'],[2,'2 повтора'],[3,'3 повтора']], settings.calcRetries)}</select></label>
    </div>
    <div class="settings-choice-group"><h4>Не включать ТК в расчёты</h4><p>Список обновляется из справочника текущего проекта.</p><div class="choice-toolbar"><button class="button secondary" type="button" data-settings-action="refresh-companies">Обновить список ТК</button><button class="button ghost" type="button" data-settings-action="company-defaults">По умолчанию</button><button class="button ghost" type="button" data-settings-action="company-none">Включить все</button></div><div class="choice-grid">${companyChecks(hidden,'exclusions')}</div></div>
    <div class="settings-choice-group"><h4>Не выбирать как самый дешёвый</h4><p>ТК останется в результатах, но не станет рекомендацией строки.</p><div class="choice-toolbar"><button class="button ghost" type="button" data-settings-action="best-none">Снять все</button></div><div class="choice-grid">${companyChecks(best,'bestExclusions')}</div></div>
    <div class="settings-subsection"><h4>Основной лист выгрузки</h4><div class="module-settings-grid"><label class="field"><span>Набор полей</span><select data-export-preset="main">${settingsOptions([['compact','Краткая'],['finance','Финансы'],['full','Полная'],['custom','Своя']], settings.mainExportPreset)}</select></label><label class="field"><span>Порядок таблицы обзора</span><select data-module-setting="overviewColumnOrder">${settingsOptions([['logistics','Логистика'],['sales','Продажи'],['finance','Финансы']], settings.overviewColumnOrder)}</select></label></div><details><summary>Поля основного листа</summary><div class="choice-toolbar"><button class="button ghost" type="button" data-settings-action="main-all">Выбрать все</button><button class="button ghost" type="button" data-settings-action="main-none">Снять</button></div><div class="field-selector">${exportChecks('mainExportFields',definitions.mainFields,settings.mainExportFields)}</div></details><label class="switch-field"><input type="checkbox" data-module-setting="exportMainCompanyColumns" ${checked(settings.exportMainCompanyColumns)}><span>Добавлять лучшие тарифы каждой ТК на основной лист</span></label></div>
    <div class="settings-subsection"><h4>Тарифные листы</h4><div class="module-settings-grid"><label class="field"><span>Набор полей</span><select data-export-preset="tariff">${settingsOptions([['compact','Краткая'],['finance','Финансы'],['logistics','Логистика'],['full','Полная'],['custom','Своя']], settings.tariffExportPreset)}</select></label><label class="field"><span>Формат строк</span><select data-module-setting="companySheetLayout">${settingsOptions([['wide','Запрос в строке'],['long','Тариф в строке']], settings.companySheetLayout)}</select></label></div><details><summary>Поля тарифов</summary><div class="choice-toolbar"><button class="button ghost" type="button" data-settings-action="tariff-all">Выбрать все</button><button class="button ghost" type="button" data-settings-action="tariff-none">Снять</button></div><div class="field-selector">${exportChecks('tariffExportFields',definitions.tariffFields,settings.tariffExportFields)}</div></details></div>
    <div class="switch-list">
      <label class="switch-field"><input type="checkbox" data-module-setting="showServiceInfo" ${checked(settings.showServiceInfo)}><span>Показывать подробности услуг</span></label>
      <label class="switch-field"><input type="checkbox" data-module-setting="exportCompanySheets" ${checked(settings.exportCompanySheets)}><span>Отдельный лист каждой ТК в XLSX</span></label>
      <label class="switch-field"><input type="checkbox" data-module-setting="exportAnalyticsSheet" ${checked(settings.exportAnalyticsSheet)}><span>Добавлять лист аналитики</span></label>
    </div>`;
}
function renderModuleSettings() {
  const api = moduleApi();
  const settings = api?.getSettings?.();
  els.moduleSettingsHost.innerHTML = moduleSettingsMarkup(settings);
  if (!settings) setTimeout(() => { if (!els.settingsDrawer.hidden) renderModuleSettings(); }, 180);
}
function collectModuleSettings() {
  const result = {};
  els.moduleSettingsHost.querySelectorAll('[data-module-setting]').forEach(input => { result[input.dataset.moduleSetting] = input.type === 'checkbox' ? input.checked : input.value; });
  els.moduleSettingsHost.querySelectorAll('[data-export-preset]').forEach(input => { result[`${input.dataset.exportPreset}ExportPreset`] = input.value; });
  els.moduleSettingsHost.querySelectorAll('[data-module-list]').forEach(input => { const key = input.dataset.moduleList; result[key] ||= []; if (input.checked) result[key].push(input.value); });
  return result;
}

function setModuleChecks(kind, values) {
  const selected = new Set(values || []);
  els.moduleSettingsHost.querySelectorAll(`[data-module-list="${kind}"]`).forEach(input => { input.checked = selected.has(input.value); });
}
async function handleSettingsAction(action, button) {
  const settings = moduleApi()?.getSettings?.();
  if (!settings) return;
  if (action === 'refresh-companies') {
    button.disabled = true;
    try { await moduleApi()?.refreshCompanies?.(true); renderModuleSettings(); toast('Список ТК обновлён', 'success'); }
    catch (error) { toast('Не удалось обновить список ТК', 'error', error.message); }
    finally { button.disabled = false; }
    return;
  }
  if (action === 'company-defaults') setModuleChecks('exclusions', settings.definitions?.defaultExclusions || []);
  if (action === 'company-none') setModuleChecks('exclusions', []);
  if (action === 'best-none') setModuleChecks('bestExclusions', []);
  if (action === 'main-all') { setModuleChecks('mainExportFields', (settings.definitions?.mainFields || []).map(field => field.key)); const select=els.moduleSettingsHost.querySelector('[data-export-preset="main"]'); if(select)select.value='full'; }
  if (action === 'main-none') { setModuleChecks('mainExportFields', []); const select=els.moduleSettingsHost.querySelector('[data-export-preset="main"]'); if(select)select.value='custom'; }
  if (action === 'tariff-all') { setModuleChecks('tariffExportFields', (settings.definitions?.tariffFields || []).map(field => field.key)); const select=els.moduleSettingsHost.querySelector('[data-export-preset="tariff"]'); if(select)select.value='full'; }
  if (action === 'tariff-none') { setModuleChecks('tariffExportFields', []); const select=els.moduleSettingsHost.querySelector('[data-export-preset="tariff"]'); if(select)select.value='custom'; }
}
function applyExportPreset(kind, value) {
  const settings = moduleApi()?.getSettings?.();
  const values = settings?.definitions?.[`${kind}Presets`]?.[value];
  if (Array.isArray(values)) setModuleChecks(`${kind}ExportFields`, values);
}

function renderSettingsForm() {
  const credentials = readCredentials(), project = projectCredentials(credentials);
  els.emailInput.value = project.email || ''; els.passwordInput.value = project.password || ''; els.dadataInput.value = credentials.tokenDaData || '';
  const ready = projectReady(state.project, credentials);
  els.authStatus.className = `inline-status ${ready ? 'ready' : 'neutral'}`; els.authStatus.lastChild.textContent = ready ? 'Доступ проверен и готов к работе' : 'Заполните поля и проверьте доступ';
  els.settingsProjectLabel.textContent = PROJECTS[state.project].label; els.debugModeInput.checked = state.debug;
  renderProjectReadiness(); renderModuleSettings();
}
function validateSettings() { const fields = [els.emailInput,els.passwordInput,els.dadataInput]; fields.forEach(input => input.closest('.field')?.classList.toggle('invalid', !input.value.trim())); return fields.every(input => input.value.trim()); }
function persistCredentialsDraft() {
  const credentials = readCredentials(), project = projectCredentials(credentials), email = els.emailInput.value.trim(), password = els.passwordInput.value, token = els.dadataInput.value.trim();
  if (project.email !== email || project.password !== password) project.authChecked = false;
  project.email = email; project.password = password; credentials.tokenDaData = token; credentials.activeProject = state.project; writeCredentials(credentials);
  els.authStatus.className = `inline-status ${projectReady(state.project, credentials) ? 'ready' : 'neutral'}`; els.authStatus.lastChild.textContent = projectReady(state.project, credentials) ? 'Доступ проверен и готов к работе' : 'Черновик сохранён, нажмите «Сохранить и проверить»';
  renderProjectReadiness();
}

async function rpc(action, payload = {}) {
  const endpoint = LOCAL_ENDPOINTS[action];
  const response = await fetch(endpoint || '/api/rpc', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(endpoint ? payload : { action,payload }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) { const suffix = state.debug && body.traceId ? ` · traceId: ${body.traceId}` : ''; throw new Error(`${body.error || `Ошибка сервера ${response.status}`}${suffix}`); }
  return body.data;
}
async function saveAndCheckCredentials() {
  if (authBusy || !validateSettings()) { if (!authBusy) toast('Заполните email, пароль и токен DaData', 'error'); return; }
  authBusy = true; els.checkCredentialsButton.disabled = true; els.checkCredentialsButton.querySelector('.button-spinner').hidden = false; els.authStatus.lastChild.textContent = 'Проверяю доступ…';
  try {
    const payload = { projectId:state.project, email:els.emailInput.value.trim(), password:els.passwordInput.value, force:true };
    const result = await rpc('auth', payload); if (!result?.token) throw new Error('ЛК не вернул токен авторизации');
    const credentials = readCredentials(); credentials.activeProject = state.project; credentials.tokenDaData = els.dadataInput.value.trim();
    const project = projectCredentials(credentials); project.email = payload.email; project.password = payload.password; project.authChecked = true; writeCredentials(credentials);
    notifyModulesCredentialsChanged();
    await moduleApi('calculator')?.refreshCompanies?.(true).catch(() => {});
    renderSettingsForm(); renderClient(); renderToolActions(); toast('Доступ сохранён и проверен', 'success');
  } catch (error) {
    const credentials = readCredentials(), project = projectCredentials(credentials); project.authChecked = false; writeCredentials(credentials);
    els.authStatus.className = 'inline-status error'; els.authStatus.lastChild.textContent = error.message; toast('Не удалось проверить доступ', 'error', error.message);
  } finally { authBusy = false; els.checkCredentialsButton.disabled = false; els.checkCredentialsButton.querySelector('.button-spinner').hidden = true; renderProjectReadiness(); }
}
function saveModuleSettings() {
  const api = moduleApi();
  if (!api?.updateSettings) return toast('Раздел ещё загружается', 'error');
  api.updateSettings(collectModuleSettings());
  toast('Настройки раздела сохранены', 'success');
}

async function findClient(options = {}) {
  const generation = ++clientSearchGeneration, inn = els.clientInnInput.value.replace(/\D/g,'').slice(0,12); els.clientInnInput.value = inn;
  if (!/^\d{10}$|^\d{12}$/.test(inn)) { if (!options.silent) toast('ИНН должен содержать 10 или 12 цифр','error'); return; }
  const credentials = readCredentials(), project = projectCredentials(credentials);
  if (!projectReady(state.project, credentials)) { if (!options.silent) { openSettings(); toast('Сначала настройте доступ к проекту','error'); } return; }
  els.findClientButton.disabled = true; els.clientResult.className = 'client-result pending'; els.clientResult.textContent = 'Ищу клиента…';
  try {
    const result = await rpc('searchUser',{projectId:state.project,email:project.email,password:project.password,inn}); if (generation !== clientSearchGeneration) return;
    const key = TOOLS[state.tool].clientKey, previousId = project[key]?.userId || ''; project[key] = {inn,userId:result.id,userDisplay:result.display}; writeCredentials(credentials); renderClient(); notifyModulesCredentialsChanged();
    if (previousId && String(previousId) !== String(result.id)) moduleApi()?.invalidateClientResults?.(result.id);
    if (!options.silent) toast('Клиент выбран','success',result.display);
  } catch (error) {
    if (generation !== clientSearchGeneration) return; project[TOOLS[state.tool].clientKey] = {inn,userId:'',userDisplay:''}; writeCredentials(credentials); renderClient(); toast('Клиент не найден','error',error.message);
  } finally { if (generation === clientSearchGeneration) els.findClientButton.disabled = false; }
}
function scheduleClientSearch() { clearTimeout(clientSearchTimer); const inn = els.clientInnInput.value; if (/^\d{10}$|^\d{12}$/.test(inn)) clientSearchTimer = setTimeout(() => void findClient({silent:true}), 550); }
function notifyModulesCredentialsChanged() { for (const tool of Object.keys(TOOLS)) moduleApi(tool)?.refreshCredentials?.(); }
async function runToolAction(action) {
  const api = moduleApi();
  if (!api?.runAction) return toast('Раздел ещё загружается','error');
  if (activeAction && action !== 'stop') return;
  if (action === 'stop') {
    api.runAction('stop'); moduleState[state.tool].busy = false; activeAction = ''; renderToolActions(); return;
  }
  const operation = ['calculate','create','resolve'].includes(action);
  if (operation) { activeAction = action; moduleState[state.tool].busy = true; renderToolActions(); renderBusyLocks(); }
  try {
    const result = await Promise.resolve(api.runAction(action));
    if (action === 'toggle-auto') toast(result ? 'Авторасчёт включён' : 'Авторасчёт выключен','success');
  } catch (error) { toast('Не удалось выполнить действие','error',error.message); }
  finally { if (operation) { activeAction = ''; moduleState[state.tool].busy = Boolean(api.isBusy?.()); renderBusyLocks(); } renderToolActions(); }
}
function renderBusyLocks() {
  const busy = anyModuleBusy();
  els.toolTabs.forEach(button => { button.disabled = busy && button.dataset.tool !== state.tool; });
  [...els.projectTabs.querySelectorAll('[data-project]')].forEach(button => { button.disabled = busy && button.dataset.project !== state.project; });
  els.clientInnInput.disabled = busy; els.findClientButton.disabled = busy;
}
function openSettings() { renderSettingsForm(); els.settingsDrawer.hidden = false; document.body.classList.add('settings-open'); requestAnimationFrame(() => els.emailInput.focus()); void moduleApi('calculator')?.refreshCompanies?.(false).then(() => { if (!els.settingsDrawer.hidden && state.tool === 'calculator') renderModuleSettings(); }); }
function closeSettings() { els.settingsDrawer.hidden = true; document.body.classList.remove('settings-open'); }
function showHelp() { const api = moduleApi(); if (api?.openHelp) api.openHelp(); else toast('Раздел ещё загружается','error'); }
function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = state.theme; saveShellState(); for (const tool of Object.keys(TOOLS)) moduleApi(tool)?.setTheme?.(state.theme); }
function toast(title,type='success',detail='') { const element=document.createElement('div'); element.className=`toast ${type}`; element.innerHTML=`<b>${escapeHtml(title)}</b>${detail?`<span>${escapeHtml(detail)}</span>`:''}`; els.toastRegion.append(element); setTimeout(()=>element.remove(),5200); }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[character]); }

function configureEmbeddedFrame(frame, tool) {
  try {
    const doc = frame.contentDocument; if (!doc) return; doc.documentElement.dataset.desktopEmbedded = 'true';
    doc.querySelector('style[data-desktop-shell]')?.remove(); const style = doc.createElement('style'); style.dataset.desktopShell = 'true';
    style.textContent = tool === 'calculator'
      ? `.topbar,.primary-toolbar{display:none!important}.shell{padding-top:0!important;min-height:100vh!important}.settings-panel{display:none!important}`
      : `html,body{height:100%!important;overflow:hidden!important}.app-header{display:none!important}.app-shell{height:100%!important;min-height:0!important;padding-top:0!important;align-items:stretch!important}.workspace-top{top:0!important}.side-panel,.workspace,.sidebar-resizer{height:100%!important;min-height:0!important}.side-panel{position:relative!important;top:0!important;max-height:none!important;overflow:auto!important}.side-panel>.panel-section:first-child,.settings-modal-panel{display:none!important}.action-modal{z-index:460!important}.confirm-modal{z-index:520!important}`;
    doc.head.append(style); frame.contentWindow?.postMessage({type:'ops-toolkit-shell',projectId:state.project,theme:state.theme},location.origin);
  } catch { /* frame is still initializing */ }
}
async function checkServer() { try { const response=await fetch('/api/health',{cache:'no-store'}), data=await response.json(); if(!response.ok||!data.ok)throw new Error(); els.serverStatus.textContent='Готов к работе'; els.serverStatus.className='ready'; } catch { els.serverStatus.textContent='Нет связи'; els.serverStatus.className='error'; } }

async function refreshCacheStatus() {
  els.refreshCacheButton.disabled = true;
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error('Сервер не ответил');
    els.cacheStatus.textContent = `Серверный кеш: ${data.cache?.entries || 0} записей, расчётов: ${data.cache?.calculations || 0}, клиентов: ${data.cache?.clients || 0}.`;
  } catch (error) { els.cacheStatus.textContent = error.message; }
  finally { els.refreshCacheButton.disabled = false; }
}
async function clearUnifiedCache() {
  if (!(await askConfirmation('Очистить кеш?', 'Будет очищен кеш локального сервера и обоих разделов. Сохранённые строки останутся на месте.', 'Очистить'))) return;
  els.clearCacheButton.disabled = true;
  try {
    await Promise.all([rpc('clearCache', { category: 'all', projectId: '' }), ...Object.keys(TOOLS).map(tool => Promise.resolve(moduleApi(tool)?.clearLocalCache?.('all')))]);
    toast('Кеш приложения очищен', 'success'); await refreshCacheStatus();
  } catch (error) { toast('Не удалось очистить кеш', 'error', error.message); }
  finally { els.clearCacheButton.disabled = false; }
}
function askConfirmation(title, message, acceptText = 'Продолжить') {
  els.confirmTitle.textContent = title; els.confirmMessage.textContent = message; els.confirmAcceptButton.textContent = acceptText; els.confirmDialog.hidden = false;
  return new Promise(resolve => {
    const finish = value => { els.confirmDialog.hidden = true; els.confirmDialog.removeEventListener('click', onClick); resolve(value); };
    const onClick = event => { const button = event.target.closest('[data-confirm-value]'); if (button) finish(button.dataset.confirmValue === 'true'); };
    els.confirmDialog.addEventListener('click', onClick);
  });
}

function bindEvents() {
  els.toolTabs.forEach(button=>button.addEventListener('click',()=>setActiveTool(button.dataset.tool)));
  els.projectTabs.addEventListener('click',event=>{const button=event.target.closest('[data-project]');if(button)setProject(button.dataset.project);});
  els.toolActions.addEventListener('click',event=>{const button=event.target.closest('[data-tool-action]');if(button)runToolAction(button.dataset.toolAction);});
  els.findClientButton.addEventListener('click',()=>void findClient());
  els.clientInnInput.addEventListener('beforeinput',event=>{if(anyModuleBusy()){event.preventDefault();toast('Дождитесь завершения текущей операции','error');}});
  els.clientInnInput.addEventListener('input',()=>{
    els.clientInnInput.value=els.clientInnInput.value.replace(/\D/g,'').slice(0,12); const credentials=readCredentials(), project=projectCredentials(credentials);
    project[TOOLS[state.tool].clientKey]={inn:els.clientInnInput.value,userId:'',userDisplay:''};writeCredentials(credentials);renderClient();scheduleClientSearch();
  });
  els.clientInnInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void findClient();}});
  els.settingsButton.addEventListener('click',openSettings); els.helpButton.addEventListener('click',showHelp); els.themeButton.addEventListener('click',toggleTheme);
  els.passwordToggle.addEventListener('click',()=>{const visible=els.passwordInput.type==='text';els.passwordInput.type=visible?'password':'text';els.passwordToggle.textContent=visible?'Показать':'Скрыть';});
  els.dadataToggle.addEventListener('click',()=>{const visible=els.dadataInput.type==='text';els.dadataInput.type=visible?'password':'text';els.dadataToggle.textContent=visible?'Показать':'Скрыть';});
  [els.emailInput,els.passwordInput,els.dadataInput].forEach(input=>input.addEventListener('input',persistCredentialsDraft));
  els.moduleSettingsHost.addEventListener('click',event=>{const button=event.target.closest('[data-settings-action]');if(button)void handleSettingsAction(button.dataset.settingsAction,button);});
  els.moduleSettingsHost.addEventListener('change',event=>{
    const preset=event.target.closest('[data-export-preset]');
    if(preset)applyExportPreset(preset.dataset.exportPreset,preset.value);
    const field=event.target.closest('[data-module-list="mainExportFields"],[data-module-list="tariffExportFields"]');
    if(field){const kind=field.dataset.moduleList.startsWith('main')?'main':'tariff';const select=els.moduleSettingsHost.querySelector(`[data-export-preset="${kind}"]`);if(select)select.value='custom';}
  });
  els.checkCredentialsButton.addEventListener('click',saveAndCheckCredentials); els.saveSettingsButton.addEventListener('click',saveModuleSettings); els.debugModeInput.addEventListener('change',()=>{state.debug=els.debugModeInput.checked;saveShellState();});
  els.refreshCacheButton.addEventListener('click',()=>void refreshCacheStatus()); els.clearCacheButton.addEventListener('click',()=>void clearUnifiedCache());
  document.querySelectorAll('[data-close-settings]').forEach(button=>button.addEventListener('click',closeSettings));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!els.settingsDrawer.hidden)closeSettings();});
  window.addEventListener('hashchange',()=>{const tool=location.hash.slice(1);if(TOOLS[tool])setActiveTool(tool,{skipHash:true});});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='ops-toolkit-ready'){els.frameLoading.hidden=true;configureEmbeddedFrame(frameFor(event.data.tool),event.data.tool);ensureDefaultDensity(event.data.tool);setProject(state.project,{silent:true});if(event.data.tool===state.tool)renderToolActions();}
    if(event.data?.type==='ops-toolkit-client-cleared'){void Promise.resolve(moduleApi(event.data.tool)?.refreshCredentials?.()).then(()=>renderClient());}
    if(event.data?.type==='ops-toolkit-module-state'&&TOOLS[event.data.tool]){moduleState[event.data.tool]={...moduleState[event.data.tool],busy:Boolean(event.data.busy),summary:event.data.summary||moduleState[event.data.tool].summary};if(!event.data.busy&&event.data.tool===state.tool)activeAction='';renderBusyLocks();renderOrdersSummary();renderToolActions();}
  });
  for(const [tool,definition] of Object.entries(TOOLS)){const frame=document.getElementById(definition.frame);frame.addEventListener('load',()=>{configureEmbeddedFrame(frame,tool);els.frameLoading.hidden=true;});}
}
function initTooltips() {
  let target = null;
  const hide = () => { target = null; els.appTooltip.hidden = true; };
  const show = element => {
    const message = element?.dataset.tooltip || element?.getAttribute('title') || element?.dataset.nativeTitle || element?.getAttribute('aria-label');
    if (!message) return;
    if (element.hasAttribute('title')) { element.dataset.nativeTitle = element.title; element.removeAttribute('title'); }
    target = element; els.appTooltip.textContent = message; els.appTooltip.hidden = false;
    const rect = element.getBoundingClientRect(), tip = els.appTooltip.getBoundingClientRect();
    const left = Math.min(innerWidth - tip.width - 8, Math.max(8, rect.left + rect.width / 2 - tip.width / 2));
    const top = rect.bottom + tip.height + 8 < innerHeight ? rect.bottom + 7 : rect.top - tip.height - 7;
    els.appTooltip.style.left = `${left}px`; els.appTooltip.style.top = `${Math.max(8,top)}px`;
  };
  document.addEventListener('pointerover',event=>{const element=event.target.closest('[data-tooltip],[title],[aria-label]');if(element&&element!==target)show(element);});
  document.addEventListener('pointerout',event=>{if(target&&!target.contains(event.relatedTarget))hide();});
  document.addEventListener('focusin',event=>show(event.target.closest('[data-tooltip],[title],[aria-label]')));
  document.addEventListener('focusout',hide); window.addEventListener('scroll',hide,true);
}
function init() { document.documentElement.dataset.theme=state.theme;document.documentElement.dataset.project=state.project;bindEvents();initTooltips();const hashTool=location.hash.slice(1);setActiveTool(TOOLS[hashTool]?hashTool:state.tool,{skipHash:false});setProject(state.project,{silent:true});renderSettingsForm();renderBusyLocks();void checkServer(); }
init();
