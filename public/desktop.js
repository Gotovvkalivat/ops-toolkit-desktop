'use strict';

const STORAGE_KEY = 'opsToolkitDesktop.chromeStorage.v1';
const CREDENTIALS_KEY = 'opsToolkitCredentials';
const SHELL_KEY = 'opsToolkitDesktop.shell.v3';
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
      ['template', 'Шаблон XLSX', 'file', 'secondary', true], ['example', 'Добавить пример', 'sparkles', 'secondary', true],
      ['import', 'Загрузить', 'upload', 'secondary'], ['calculate', 'Рассчитать всё', 'calculator', 'primary']
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
  emailInput: $('#emailInput'), passwordInput: $('#passwordInput'), dadataInput: $('#dadataInput'), passwordToggle: $('#passwordToggle'),
  authStatus: $('#authStatus'), saveSettingsButton: $('#saveSettingsButton'), debugModeInput: $('#debugModeInput'),
  frameLoading: $('#frameLoading'), toastRegion: $('#toastRegion')
};
const state = loadShellState();
let authBusy = false;
let clientSearchTimer = 0;
let clientSearchGeneration = 0;

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
function ensureFrame(tool) { const frame = frameFor(tool); if (!frame.src && frame.dataset.src) { els.frameLoading.hidden = false; frame.src = frame.dataset.src; } return frame; }
function projectCredentials(credentials = readCredentials()) { credentials.projects ||= {}; credentials.projects[state.project] ||= {}; return credentials.projects[state.project]; }
function activeClient(credentials = readCredentials()) { return projectCredentials(credentials)[TOOLS[state.tool].clientKey] || {}; }
function projectReady(projectId, credentials = readCredentials()) { const project = credentials.projects?.[projectId] || {}; return Boolean(project.authChecked && project.email && project.password && credentials.tokenDaData); }

function setActiveTool(tool, options = {}) {
  if (!TOOLS[tool]) return;
  state.tool = tool; saveShellState(); ensureFrame(tool);
  document.querySelectorAll('.tool-frame').forEach(frame => frame.classList.toggle('active', frame.id === TOOLS[tool].frame));
  els.toolTabs.forEach(button => { const active = button.dataset.tool === tool; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  const definition = TOOLS[tool];
  els.activeToolTitle.textContent = definition.title; els.activeToolHint.textContent = definition.hint;
  els.settingsTitle.textContent = `Настройки · ${definition.settingsTitle}`; els.settingsSubtitle.textContent = `Проект ${PROJECTS[state.project].short} · доступ и параметры раздела`;
  els.sectionSettingsTitle.textContent = definition.settingsTitle; els.sectionSettingsHint.textContent = definition.settingsHint;
  renderToolActions(); renderClient();
  if (!els.settingsDrawer.hidden) renderSettingsForm();
  if (!options.skipHash) history.replaceState(null, '', `#${tool}`);
}

function setProject(projectId, options = {}) {
  if (!PROJECTS[projectId]) return;
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
    button.classList.toggle('ready', ready); button.title = ready ? `${PROJECTS[button.dataset.project].label}: доступ проверен` : `${PROJECTS[button.dataset.project].label}: требуется настройка`;
  });
}
function renderToolActions() {
  const moduleSettings = moduleApi()?.getSettings?.() || {};
  els.toolActions.innerHTML = TOOLS[state.tool].actions.map(([action,label,icon,tone,compact]) => {
    const active = action === 'toggle-auto' && moduleSettings.autoCalculate;
    return `<button class="button ${tone} ${compact ? 'compact-action' : ''} ${active ? 'active' : ''}" type="button" data-tool-action="${action}" title="${label}${active ? ': включён' : ''}" aria-label="${label}">${svg(icon)}${compact ? '' : `<span class="action-label">${label}</span>`}</button>`;
  }).join('');
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
      <label class="field"><span>Плотность интерфейса</span><select data-module-setting="density">${settingsOptions([['comfortable','Удобная'],['compact','Компактная'],['dense','Максимально плотная']], settings.density)}</select></label>
    </div>
    <div class="switch-list">
      <label class="switch-field"><input type="checkbox" data-module-setting="autoCalculate" ${checked(settings.autoCalculate)}><span>Автоматически рассчитывать готовые строки</span></label>
      <label class="switch-field"><input type="checkbox" data-module-setting="showOnboarding" ${checked(settings.showOnboarding)}><span>Показывать пошаговую панель</span></label>
      <label class="switch-field"><input type="checkbox" data-module-setting="performanceMode" ${checked(settings.performanceMode)}><span>Режим слабого компьютера</span></label>
    </div>`;
  const companies = Array.isArray(settings.companies) ? settings.companies : [];
  const best = new Set(settings.bestExclusions || []), hidden = new Set(settings.exclusions || []);
  const companyChecks = (set, kind) => companies.length ? companies.map(company => `<label class="choice-check"><input type="checkbox" data-module-list="${kind}" value="${escapeHtml(company)}" ${checked(set.has(company))}><span>${escapeHtml(company)}</span></label>`).join('') : '<span class="empty-note">Список появится после авторизации или первого расчёта.</span>';
  return `
    <div class="module-settings-grid">
      <label class="field"><span>Лучший тариф</span><select data-module-setting="bestMethodMode">${settingsOptions([['door','Только дверь-дверь'],['all','Любой метод доставки']], settings.bestMethodMode)}</select></label>
      <label class="field"><span>Параллельных расчётов</span><select data-module-setting="concurrency">${settingsOptions([[1,'1 — бережно'],[2,'2'],[3,'3 — рекомендуется'],[4,'4'],[5,'5'],[6,'6']], settings.concurrency)}</select></label>
      <label class="field"><span>Задержка автопоиска</span><select data-module-setting="debounceMs">${settingsOptions([[400,'0,4 сек.'],[650,'0,65 сек.'],[900,'0,9 сек.'],[1200,'1,2 сек.']], settings.debounceMs)}</select></label>
      <label class="field"><span>Ожидание ответа</span><select data-module-setting="calcTimeoutMs">${settingsOptions([[60000,'60 сек.'],[90000,'90 сек.'],[120000,'120 сек.'],[180000,'180 сек.']], settings.calcTimeoutMs)}</select></label>
      <label class="field"><span>Повторов после ошибки</span><select data-module-setting="calcRetries">${settingsOptions([[0,'Не повторять'],[1,'1 повтор'],[2,'2 повтора'],[3,'3 повтора']], settings.calcRetries)}</select></label>
      <label class="field"><span>Плотность интерфейса</span><select data-module-setting="density">${settingsOptions([['micro','Очень компактная'],['compact','Компактная'],['medium','Обычная'],['spacious','Свободная']], settings.density)}</select></label>
    </div>
    <div class="settings-choice-group"><h4>Не выбирать как самый дешёвый</h4><p>ТК останется в результатах, но не станет рекомендацией строки.</p><div class="choice-grid">${companyChecks(best,'bestExclusions')}</div></div>
    <details class="settings-choice-group"><summary>Скрыть ТК из расчёта</summary><p>Эти ТК полностью исчезнут из результатов и аналитики.</p><div class="choice-grid">${companyChecks(hidden,'exclusions')}</div></details>
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
  els.moduleSettingsHost.querySelectorAll('[data-module-list]').forEach(input => { const key = input.dataset.moduleList; result[key] ||= []; if (input.checked) result[key].push(input.value); });
  return result;
}

function renderSettingsForm() {
  const credentials = readCredentials(), project = projectCredentials(credentials);
  els.emailInput.value = project.email || ''; els.passwordInput.value = project.password || ''; els.dadataInput.value = credentials.tokenDaData || '';
  const ready = projectReady(state.project, credentials);
  els.authStatus.className = `inline-status ${ready ? 'ready' : 'neutral'}`; els.authStatus.lastChild.textContent = ready ? 'Доступ проверен и готов к работе' : 'Заполните поля и сохраните настройки';
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
  moduleApi()?.updateSettings?.(collectModuleSettings());
  if (authBusy || !validateSettings()) { if (!authBusy) toast('Заполните email, пароль и токен DaData', 'error'); return; }
  authBusy = true; els.saveSettingsButton.disabled = true; els.saveSettingsButton.querySelector('.button-spinner').hidden = false; els.authStatus.lastChild.textContent = 'Проверяю доступ…';
  try {
    const payload = { projectId:state.project, email:els.emailInput.value.trim(), password:els.passwordInput.value, force:true };
    const result = await rpc('auth', payload); if (!result?.token) throw new Error('ЛК не вернул токен авторизации');
    const credentials = readCredentials(); credentials.activeProject = state.project; credentials.tokenDaData = els.dadataInput.value.trim();
    const project = projectCredentials(credentials); project.email = payload.email; project.password = payload.password; project.authChecked = true; writeCredentials(credentials);
    notifyModulesCredentialsChanged(); renderSettingsForm(); renderClient(); renderToolActions(); toast('Настройки сохранены, доступ проверен', 'success');
  } catch (error) {
    const credentials = readCredentials(), project = projectCredentials(credentials); project.authChecked = false; writeCredentials(credentials);
    els.authStatus.className = 'inline-status error'; els.authStatus.lastChild.textContent = error.message; toast('Не удалось проверить доступ', 'error', error.message);
  } finally { authBusy = false; els.saveSettingsButton.disabled = false; els.saveSettingsButton.querySelector('.button-spinner').hidden = true; renderProjectReadiness(); }
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
function runToolAction(action) { const api = moduleApi(); if (!api?.runAction) return toast('Раздел ещё загружается','error'); Promise.resolve(api.runAction(action)).then(result => { if (action === 'toggle-auto') toast(result ? 'Авторасчёт включён' : 'Авторасчёт выключен','success'); renderToolActions(); }).catch(error => toast('Не удалось выполнить действие','error',error.message)); }
function openSettings() { renderSettingsForm(); els.settingsDrawer.hidden = false; document.body.classList.add('settings-open'); requestAnimationFrame(() => els.emailInput.focus()); }
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
      ? `.topbar{display:none!important}.shell{padding-top:0!important;min-height:100vh!important}.settings-panel{display:none!important}`
      : `.app-header{display:none!important}.app-shell{height:100vh!important;min-height:100vh!important;padding-top:0!important}.workspace-top{top:0!important}.side-panel>.panel-section:first-child,.settings-modal-panel{display:none!important}.action-modal{z-index:460!important}.confirm-modal{z-index:520!important}`;
    doc.head.append(style); frame.contentWindow?.postMessage({type:'ops-toolkit-shell',projectId:state.project,theme:state.theme},location.origin);
  } catch { /* frame is still initializing */ }
}
async function checkServer() { try { const response=await fetch('/api/health',{cache:'no-store'}), data=await response.json(); if(!response.ok||!data.ok)throw new Error(); els.serverStatus.textContent='Готов к работе'; els.serverStatus.className='ready'; } catch { els.serverStatus.textContent='Нет связи'; els.serverStatus.className='error'; } }

function bindEvents() {
  els.toolTabs.forEach(button=>button.addEventListener('click',()=>setActiveTool(button.dataset.tool)));
  els.projectTabs.addEventListener('click',event=>{const button=event.target.closest('[data-project]');if(button)setProject(button.dataset.project);});
  els.toolActions.addEventListener('click',event=>{const button=event.target.closest('[data-tool-action]');if(button)runToolAction(button.dataset.toolAction);});
  els.findClientButton.addEventListener('click',()=>void findClient());
  els.clientInnInput.addEventListener('beforeinput',event=>{if(moduleApi()?.isBusy?.()){event.preventDefault();toast('Дождитесь завершения текущей операции','error');}});
  els.clientInnInput.addEventListener('input',()=>{
    els.clientInnInput.value=els.clientInnInput.value.replace(/\D/g,'').slice(0,12); const credentials=readCredentials(), project=projectCredentials(credentials);
    project[TOOLS[state.tool].clientKey]={inn:els.clientInnInput.value,userId:'',userDisplay:''};writeCredentials(credentials);renderClient();scheduleClientSearch();
  });
  els.clientInnInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void findClient();}});
  els.settingsButton.addEventListener('click',openSettings); els.helpButton.addEventListener('click',showHelp); els.themeButton.addEventListener('click',toggleTheme);
  els.passwordToggle.addEventListener('click',()=>{const visible=els.passwordInput.type==='text';els.passwordInput.type=visible?'password':'text';els.passwordToggle.textContent=visible?'Показать':'Скрыть';});
  [els.emailInput,els.passwordInput,els.dadataInput].forEach(input=>input.addEventListener('input',persistCredentialsDraft));
  els.saveSettingsButton.addEventListener('click',saveAndCheckCredentials); els.debugModeInput.addEventListener('change',()=>{state.debug=els.debugModeInput.checked;saveShellState();});
  document.querySelectorAll('[data-close-settings]').forEach(button=>button.addEventListener('click',closeSettings));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!els.settingsDrawer.hidden)closeSettings();});
  window.addEventListener('hashchange',()=>{const tool=location.hash.slice(1);if(TOOLS[tool])setActiveTool(tool,{skipHash:true});});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='ops-toolkit-ready'){els.frameLoading.hidden=true;configureEmbeddedFrame(frameFor(event.data.tool),event.data.tool);setProject(state.project,{silent:true});if(event.data.tool===state.tool)renderToolActions();}
    if(event.data?.type==='ops-toolkit-client-cleared'){void Promise.resolve(moduleApi(event.data.tool)?.refreshCredentials?.()).then(()=>renderClient());}
  });
  for(const [tool,definition] of Object.entries(TOOLS)){const frame=document.getElementById(definition.frame);frame.addEventListener('load',()=>{configureEmbeddedFrame(frame,tool);els.frameLoading.hidden=true;});}
}
function init() { document.documentElement.dataset.theme=state.theme;document.documentElement.dataset.project=state.project;bindEvents();const hashTool=location.hash.slice(1);setActiveTool(TOOLS[hashTool]?hashTool:state.tool,{skipHash:false});setProject(state.project,{silent:true});renderSettingsForm();void checkServer(); }
init();
