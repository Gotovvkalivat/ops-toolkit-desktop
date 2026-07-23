(function () {
  'use strict';

  const STORAGE_KEY = 'kd.orderCreator.v1';
  const ORDER_WORKSPACE_PREFIX = `${STORAGE_KEY}.workspace.`;
  const TOOLKIT_CREDENTIALS_KEY = 'opsToolkitCredentials';
  const DEFAULT_PAGE_SIZE = 25;
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const CREATE_CHUNK_SIZE = 20;
  const MAX_CONCURRENCY = 6;
  const MAX_CANCEL_CONCURRENCY = 5;
  const DEFAULT_CALCULATION_TIMEOUT_MS = 90000;
  const DEFAULT_CALCULATION_RETRIES = 1;
  const VIRTUAL_ROW_BUFFER = 8;
  const CARD_VIRTUAL_ROW_HEIGHT = 138;
  const TABLE_VIRTUAL_ROW_HEIGHT = 64;
  const TABLE_DETAIL_ROW_HEIGHT = 520;
  const SERVICE_RENDER_CHUNK = 36;
  const SERVICE_RENDER_CHUNK_LOW = 18;
  const RETURN_SERVICE_KEY = '__return_service__';
  const CARGO_TYPES = {
    documents: { id: '81dd8a13-8235-494f-84fd-9c04c51d50ec', label: 'Документы' },
    cargo: { id: '4aab1fc6-fc2b-473a-8728-58bcd4ff79ba', label: 'Груз' }
  };
  const DEFAULT_PROJECTS = [
    { id: 'kd', label: 'Курьер Дисконт', shortLabel: 'КД', color: '#a2407b' },
    { id: 'ops', label: 'OPSPost', shortLabel: 'OPS', color: '#af6400' },
    { id: 'me', label: 'ME Express', shortLabel: 'ME', color: '#555b66' }
  ];
  const TEMPLATE_HEADERS = [
    'Отправитель: организация', 'Отправитель: контакт', 'Отправитель: телефон', 'Отправитель: город', 'Отправитель: адрес',
    'Отправитель: индекс', 'Отправитель: email', 'Отправитель: доп. инфо', 'Отправитель: ИНН', 'Отправитель: паспорт серия',
    'Отправитель: паспорт номер', 'Отправитель: паспорт дата выдачи',
    'Получатель: организация', 'Получатель: контакт', 'Получатель: телефон', 'Получатель: город', 'Получатель: адрес',
    'Получатель: индекс', 'Получатель: email', 'Получатель: доп. инфо', 'Получатель: ИНН', 'Получатель: паспорт серия',
    'Получатель: паспорт номер', 'Получатель: паспорт дата выдачи',
    'Тип груза', 'Содержимое', 'Вес, кг', 'Мест', 'Длина, см', 'Ширина, см', 'Высота, см',
      'Объявленная стоимость', 'Страхование', 'ТК', 'Дата забора', 'Сбор с', 'Сбор до'
  ];
  const TEMPLATE_REQUIRED_HEADERS = new Set([
    'Отправитель: организация', 'Отправитель: контакт', 'Отправитель: телефон', 'Отправитель: город', 'Отправитель: адрес',
    'Получатель: организация', 'Получатель: контакт', 'Получатель: телефон', 'Получатель: город', 'Получатель: адрес',
    'Содержимое', 'Вес, кг', 'Мест', 'Длина, см', 'Ширина, см', 'Высота, см'
  ]);
  const TEMPLATE_CONDITIONAL_HEADERS = new Set([
    'Отправитель: ИНН', 'Отправитель: паспорт серия', 'Отправитель: паспорт номер', 'Отправитель: паспорт дата выдачи',
    'Получатель: ИНН', 'Получатель: паспорт серия', 'Получатель: паспорт номер', 'Получатель: паспорт дата выдачи'
  ]);

  const state = {
    projects: DEFAULT_PROJECTS,
    settings: {
      projectId: 'kd', email: '', password: '', tokenDaData: '', userInn: '', userId: '', userDisplay: '',
      concurrency: 3, timeoutMs: DEFAULT_CALCULATION_TIMEOUT_MS, retries: DEFAULT_CALCULATION_RETRIES,
      takeDate: '', takeTimeFrom: '', takeTimeTo: '', theme: 'light', density: 'comfortable', autoCalculate: false,
      authChecked: false, showOnboarding: true, performanceMode: false
    },
    bulk: { mode: 'preferred-cheapest', company: '', preferredCompanies: [], preferredCompaniesTouched: false, tariffSignature: '', tariffSearch: '', servicesSearch: '', servicesOnlyAssigned: false, servicesOpenCompanies: [], services: {}, companyServices: {} },
    filter: { status: 'all', sort: 'index' },
    viewMode: 'cards',
    reviewMode: false,
    sidebarCollapsed: false,
    sidebarWidth: 360,
    pageSize: DEFAULT_PAGE_SIZE,
    activeRowId: '',
    expandedRowId: '',
    rows: [],
    created: [],
    cancelResults: [],
    cancelTotal: 0,
    page: 0,
    running: false,
    uiBusy: false,
    uiBusyText: '',
    operation: '',
    createProgress: { active: false, total: 0, done: 0, success: 0, errors: 0 },
    cache: null
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const els = {};
  const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  let autoResolveTimer = null;
  let autoCalculateTimer = null;
  let autoClientSearchTimer = null;
  let saveStateTimer = null;
  let toolkitSyncTimer = null;
  let statsRenderTimer = null;
  let progressRenderFrame = 0;
  let lastRowToggleAt = 0;
  let lastRowToggleId = '';
  let rowIndexRowsRef = null;
  let rowIndex = new Map();
  let lastRowsHtml = '';
  let lastRowsLocked = null;
  let activeIssueCache = null;
  let activeDuplicateSets = null;
  let duplicateRowsKey = '';
  let duplicateRowsCache = { duplicateIds: new Set(), removableIds: new Set() };
  let bulkServiceCatalogKey = '';
  let bulkServiceCatalogCache = [];
  const bulkServiceVisibleLimits = new Map();
  const tariffServicesCache = new WeakMap();
  const selectedTariffCache = new WeakMap();
  const rowPriceCache = new WeakMap();
  const rowIssuesCache = new WeakMap();
  let bulkServicesRenderFrame = 0;
  let bulkControlsRenderFrame = 0;
  let virtualCardScrollTop = 0;
  let virtualTableScrollTop = 0;
  let virtualRowsFrame = 0;
  let virtualRowsKey = '';
  let lastVisibleRowsKey = '';
  let lastCreatedRenderKey = '';
  let pendingVirtualScrollTop = null;
  const tableDetailScrollTopByRow = new Map();
  let toastTimer = null;
  let workspaceProjectId = 'kd';
  let tooltipAnchor = null;
  let createdDrawerOpen = false;

  function rowById(id) {
    if (!id) return null;
    if (rowIndexRowsRef !== state.rows || rowIndex.size !== state.rows.length) {
      rowIndexRowsRef = state.rows;
      rowIndex = new Map(state.rows.map(row => [row.id, row]));
    }
    return rowIndex.get(id) || null;
  }
  function invalidateRowsRenderCache() {
    lastRowsHtml = '';
    rowIndexRowsRef = null;
    duplicateRowsKey = '';
    bulkServiceCatalogKey = '';
    bulkServiceCatalogCache = [];
    resetVirtualScroll();
  }
  function markupCacheKey(value) {
    const text = String(value || '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return `${text.length}:${hash >>> 0}`;
  }
  function resetVirtualScroll() {
    virtualCardScrollTop = 0;
    virtualTableScrollTop = 0;
    tableDetailScrollTopByRow.clear();
    pendingVirtualScrollTop = null;
    virtualRowsKey = '';
    lastVisibleRowsKey = '';
  }
  function withIssueCache(worker) {
    const previous = activeIssueCache;
    activeIssueCache = new WeakMap();
    try {
      return worker();
    } finally {
      activeIssueCache = previous;
    }
  }
  function withRowRenderCaches(worker) {
    const previous = activeDuplicateSets;
    activeDuplicateSets = duplicateRowIdSets();
    try {
      return withIssueCache(worker);
    } finally {
      activeDuplicateSets = previous;
    }
  }
  function rowIsDuplicate(row) {
    if (!row || row.status === 'created') return false;
    return Boolean((activeDuplicateSets || duplicateRowIdSets()).duplicateIds.has(row.id));
  }
  function cachedRowIssues(row) {
    if (!row || typeof row !== 'object') return rowIssues(row);
    if (activeIssueCache?.has(row)) return activeIssueCache.get(row);
    const signature = rowIssueSignature(row);
    const cached = rowIssuesCache.get(row);
    if (cached?.signature === signature) {
      if (activeIssueCache) activeIssueCache.set(row, cached.value);
      return cached.value;
    }
    const value = rowIssues(row);
    rowIssuesCache.set(row, { signature, value });
    if (activeIssueCache) activeIssueCache.set(row, value);
    return value;
  }
  function servicesRenderChunk() {
    return state.settings.performanceMode ? SERVICE_RENDER_CHUNK_LOW : SERVICE_RENDER_CHUNK;
  }
  function tariffServicesSignature(item) {
    if (!item) return '';
    return [
      tariffKey(item),
      item.returnServiceAllowed ? 1 : 0,
      item.returnServicePrice ?? '',
      Array.isArray(item.services) ? item.services.length : 0,
      (item.services || []).map(service => [service?.key, service?.caption, service?.price, service?.required, Array.isArray(service?.params) ? service.params.length : 0].join(':')).join('|')
    ].join('~');
  }
  function rowTariffSignature(row) {
    return [
      row?.tariffKey || '',
      row?.deliveryCompanyHint || '',
      row?.result?.calculatedAt || '',
      row?.result?.projectId || '',
      row?.result?.allTariffs?.length || 0,
      (row?.result?.allTariffs || []).map(item => `${tariffKey(item)}:${item.userPrice}:${item.maxPeriod}`).join('|')
    ].join('~');
  }
  function rowServicesStateSignature(row) {
    return Object.entries(row?.services || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value?.enabled ? 1 : 0}:${JSON.stringify(value?.params || {})}`)
      .join('|');
  }
  function rowPriceSignature(row, item = selectedTariff(row)) {
    return [
      rowTariffSignature(row),
      item ? `${tariffKey(item)}:${item.userPrice}:${tariffServicesSignature(item)}` : '',
      rowServicesStateSignature(row)
    ].join('~');
  }
  function rowIssueSignature(row) {
    const sender = row?.sender || {};
    const recipient = row?.recipient || {};
    const cargo = row?.cargo || {};
    const schedule = row?.schedule || {};
    return [
      row?.status || '',
      row?.error || '',
      row?.tariffKey || '',
      row?.result?.calculatedAt || '',
      sender.name, sender.contact, sender.phone, sender.city, sender.address, sender.inn, sender.personType,
      recipient.name, recipient.contact, recipient.phone, recipient.city, recipient.address, recipient.inn, recipient.personType,
      cargo.type, cargo.name, cargo.weight, cargo.seats, cargo.length, cargo.width, cargo.height, cargo.valueMode, cargo.insuranceValue,
      schedule.takeDate, schedule.takeTimeFrom, schedule.takeTimeTo,
      JSON.stringify(row?.fieldErrors || {}),
      rowServicesStateSignature(row)
    ].join('~');
  }

  function cacheElements() {
    Object.assign(els, {
      appShell: $('.app-shell'), sidePanel: $('.side-panel'), workspaceTop: $('.workspace-top'), sidebarToggleBtn: $('#sidebarToggleBtn'), sidebarResizer: $('#sidebarResizer'),
      viewModeBtn: $('#viewModeBtn'), openSettingsModalBtn: $('#openSettingsModalBtn'), openHelpModalBtn: $('#openHelpModalBtn'), settingsProjectTabs: $('#settingsProjectTabs'), projectSelect: $('#projectSelect'), emailInput: $('#emailInput'), passwordInput: $('#passwordInput'),
      dadataInput: $('#dadataInput'), innInput: $('#innInput'), findClientBtn: $('#findClientBtn'), clientResult: $('#clientResult'),
      concurrencySelect: $('#concurrencySelect'), timeoutInput: $('#timeoutInput'), retriesSelect: $('#retriesSelect'),
      densitySelect: $('#densitySelect'), showOnboardingInput: $('#showOnboardingInput'), performanceModeInput: $('#performanceModeInput'),
      defaultTakeDate: $('#defaultTakeDate'), defaultTimeFrom: $('#defaultTimeFrom'), defaultTimeTo: $('#defaultTimeTo'),
      applyScheduleBtn: $('#applyScheduleBtn'), bulkTariffMode: $('#bulkTariffMode'), bulkCompanySelect: $('#bulkCompanySelect'), bulkPreferredCompanies: $('#bulkPreferredCompanies'),
      bulkTariffCombo: $('#bulkTariffCombo'),
      applyTariffBtn: $('#applyTariffBtn'), downloadTemplateBtn: $('#downloadTemplateBtn'), importFileInput: $('#importFileInput'), fileButton: $('.file-button'),
      bulkServicesPanel: $('#bulkServicesPanel'),
      headerSelectionSummary: $('#headerSelectionSummary'), headerSelectedCount: $('#headerSelectedCount'), headerSelectedTotal: $('#headerSelectedTotal'),
      rowsCount: $('#rowsCount'), calculatedCount: $('#calculatedCount'), selectedCount: $('#selectedCount'), totalPrice: $('#totalPrice'),
      resolveBtn: $('#resolveBtn'), calculateBtn: $('#calculateBtn'), stopBtn: $('#stopBtn'), createOrdersBtn: $('#createOrdersBtn'), autoCalculateInput: $('#autoCalculateInput'),
      pageControlsTop: $('#pageControlsTop'), pageControlsBottom: $('#pageControlsBottom'),
      addRowBtn: $('#addRowBtn'), selectAllBtn: $('#selectAllBtn'), clearRowsBtn: $('#clearRowsBtn'), clearDuplicateRowsBtn: $('#clearDuplicateRowsBtn'), clearCreatedRowsBtn: $('#clearCreatedRowsBtn'), resetSessionBtn: $('#resetSessionBtn'), openCancelModalBtn: $('#openCancelModalBtn'), statusFilter: $('#statusFilter'), sortSelect: $('#sortSelect'),
      workflowSteps: $('#workflowSteps'), workStatus: $('#workStatus'), attentionPanel: $('#attentionPanel'), createProgressPanel: $('#createProgressPanel'), statusBars: $('#statusBars'), orderRows: $('#orderRows'),
      exportCreatedBtn: $('#exportCreatedBtn'), copyCreatedIdsBtn: $('#copyCreatedIdsBtn'), retryErrorRowsBtn: $('#retryErrorRowsBtn'), clearCreatedBtn: $('#clearCreatedBtn'), createdList: $('#createdList'), createdSummaryMeta: $('#createdSummaryMeta'), createdOrdersPanel: $('#createdOrdersPanel'), createdDrawerButton: $('#createdDrawerButton'), createdDrawerBadge: $('#createdDrawerBadge'), closeCreatedDrawerBtn: $('#closeCreatedDrawerBtn'),
      headerMore: $('.header-more'),
      cancelModal: $('#cancelModal'), settingsModal: $('#settingsModal'), helpModal: $('#helpModal'), cancelOrderIdsInput: $('#cancelOrderIdsInput'), cancelOrdersBtn: $('#cancelOrdersBtn'), cancelResults: $('#cancelResults'),
      themeToggleBtn: $('#themeToggleBtn'), clearCacheBtn: $('#clearCacheBtn'), clearDraftsBtn: $('#clearDraftsBtn'), bulkPreferredList: $('#bulkPreferredList'),
      selectAllPreferredBtn: $('#selectAllPreferredBtn'), clearPreferredBtn: $('#clearPreferredBtn'), toastHost: $('#toastHost'),
      togglePasswordBtn: $('#togglePasswordBtn'), checkCredentialsBtn: $('#checkCredentialsBtn'), settingsAuthStatus: $('#settingsAuthStatus'), appTooltip: $('#appTooltip')
    });
  }

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .57 1.7 1.7 0 0 0-.39 1.12V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-.57-1 1.7 1.7 0 0 0-1.12-.39H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.63c.39-.16.72-.35 1-.57.25-.33.39-.72.39-1.12V3a2 2 0 1 1 4 0v.09c0 .4.14.79.39 1.12.28.22.61.41 1 .57a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.37 9c.16.39.35.72.57 1 .33.25.72.39 1.12.39H21a2 2 0 1 1 0 4h-.09c-.4 0-.79.14-1.12.39-.22.28-.41.61-.57 1Z"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    'more-vertical': '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    cards: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    calculator: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    'check-square': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/><path d="M10 11v6M14 11v6"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="m3 3 18 18"/><path d="M10.6 10.6A3 3 0 0 0 14 14"/><path d="M6.6 6.6C3.8 8.3 2 12 2 12s3.5 6 10 6c1.7 0 3.2-.4 4.5-1.1"/><path d="M10.2 6.1A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a14.6 14.6 0 0 1-2.1 2.8"/>',
    key: '<circle cx="7.5" cy="14.5" r="3.5"/><path d="M10 12 21 1M14 8l2 2M17 5l2 2"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'alert-triangle': '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
    'refresh': '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h-4M6 22v-4h4"/>',
    'panel-left-close': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 9l-3 3 3 3"/>',
    'panel-left-open': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M12 9l3 3-3 3"/>',
    'help-circle': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 4.9 2.3c-.9.6-1.5 1.1-1.5 2.2"/><path d="M12 17h.01"/>'
  };
  function icon(name) {
    return `<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.plus}</svg>`;
  }
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(node => {
      node.innerHTML = icon(node.dataset.icon);
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function escapeCssIdent(value) {
    if (window.CSS?.escape) return CSS.escape(String(value));
    return String(value ?? '').replace(/["\\]/g, '\\$&');
  }
  function normalize(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }
  function defaultBulkState() {
    return { mode: 'preferred-cheapest', company: '', preferredCompanies: [], preferredCompaniesTouched: false, tariffSignature: '', tariffSearch: '', servicesSearch: '', servicesOnlyAssigned: false, servicesOpenCompanies: [], services: {}, companyServices: {} };
  }
  function defaultWorkspaceState() {
    return {
      bulk: defaultBulkState(),
      filter: { status: 'all', sort: 'index' },
      viewMode: 'cards',
      reviewMode: false,
      sidebarCollapsed: false,
      sidebarWidth: 360,
      pageSize: DEFAULT_PAGE_SIZE,
      activeRowId: '',
      expandedRowId: '',
      rows: [],
      created: [],
      cancelResults: [],
      cancelTotal: 0,
      page: 0,
      createProgress: { active: false, total: 0, done: 0, success: 0, errors: 0 }
    };
  }
  function projectWorkspaceKey(projectId = workspaceProjectId || state.settings.projectId || 'kd') {
    return `${ORDER_WORKSPACE_PREFIX}${projectId || 'kd'}`;
  }
  function currentPageSize() {
    const value = Number(state.pageSize);
    return PAGE_SIZE_OPTIONS.includes(value) ? value : DEFAULT_PAGE_SIZE;
  }
  function pagesForRows(rows = filteredRows()) {
    return Math.max(1, Math.ceil(rows.length / currentPageSize()));
  }
  function normalizeHeader(value) {
    return normalize(value).replace(/[.:;№#]/g, '').replace(/\s+/g, ' ');
  }
  function fieldAffectsAddress(field) {
    return ['sender.city', 'sender.address', 'recipient.city', 'recipient.address'].includes(field);
  }
  function fieldAffectsCalculation(field) {
    return fieldAffectsAddress(field) || ['cargo.weight', 'cargo.seats', 'cargo.length', 'cargo.width', 'cargo.height', 'cargo.type'].includes(field);
  }
  function sanitizeInn(value) {
    return String(value ?? '').replace(/\D/g, '').slice(0, 12);
  }
  function validInn(value) {
    const inn = sanitizeInn(value);
    return inn.length === 10 || inn.length === 12;
  }
  function parseNumber(value, fallback = 0) {
    const number = Number(String(value ?? '').replace(/\s+/g, '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    return Number.isFinite(number) ? number : fallback;
  }
  function positiveNumber(value, fallback = 0) {
    const number = parseNumber(value, fallback);
    return number > 0 ? number : fallback;
  }
  function moneyText(value) {
    const number = parseNumber(value, 0);
    return `${money.format(number)} ₽`;
  }
  function rowId() {
    return `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function todayInputDate() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }
  function dateInputValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const ru = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (ru) {
      const year = ru[3].length === 2 ? `20${ru[3]}` : ru[3];
      return `${year}-${ru[2].padStart(2, '0')}-${ru[1].padStart(2, '0')}`;
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setMinutes(parsed.getMinutes() - parsed.getTimezoneOffset());
      return parsed.toISOString().slice(0, 10);
    }
    return '';
  }
  function dateForApi(value) {
    const input = dateInputValue(value);
    if (!input) return '';
    const [year, month, day] = input.split('-');
    return `${day}.${month}.${year}`;
  }
  function clampDateNotPast(value) {
    const input = dateInputValue(value);
    const today = todayInputDate();
    return !input || input < today ? today : input;
  }
  function scheduleDateValue(value) {
    const input = dateInputValue(value);
    if (!input) return '';
    const today = todayInputDate();
    return input < today ? today : input;
  }
  function timeInputValue(value) {
    const text = String(value ?? '').trim();
    const match = text.match(/^(\d{1,2})(?::|\.|-)?(\d{2})?$/);
    if (!match) return '';
    const hour = Math.min(23, Math.max(0, Number(match[1])));
    const minute = Number(match[2] || 0) >= 30 ? 30 : 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  function scheduleDisplay(row) {
    const date = dateForApi(row.schedule?.takeDate);
    const from = timeInputValue(row.schedule?.takeTimeFrom);
    const to = timeInputValue(row.schedule?.takeTimeTo);
    const time = from && to ? `${from}–${to}` : from || to || '';
    return {
      date: date || '—',
      time,
      full: [date, time].filter(Boolean).join(' · ') || '—'
    };
  }
  function timeParts(value) {
    const time = timeInputValue(value);
    if (!time) return null;
    const [hour, minute] = time.split(':').map(Number);
    return { hour, minute: minute === 30 ? 30 : 0 };
  }
  function getPath(object, path) {
    return path.split('.').reduce((target, key) => target?.[key], object);
  }
  function setPath(object, path, value) {
    const parts = path.split('.');
    let target = object;
    parts.slice(0, -1).forEach(key => {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key];
    });
    target[parts.at(-1)] = value;
  }

  function normalizeRowServices(value) {
    if (!value) return {};
    if (!Array.isArray(value) && typeof value === 'object') return value;
    const result = {};
    (Array.isArray(value) ? value : []).forEach(item => {
      const key = String(item?.key || '').trim();
      if (!key) return;
      result[key] = { enabled: Boolean(item.enabled), params: item.params && typeof item.params === 'object' && !Array.isArray(item.params) ? item.params : {} };
    });
    return result;
  }
  function normalizeCompanyServices(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).map(([company, services]) => [company, normalizeRowServices(services)]));
  }
  function rowServiceState(row, key) {
    row.services = normalizeRowServices(row.services);
    const serviceKey = String(key || '').trim();
    if (!serviceKey) return { enabled: false, params: {} };
    if (!row.services[serviceKey]) row.services[serviceKey] = { enabled: false, params: {} };
    if (!row.services[serviceKey].params || typeof row.services[serviceKey].params !== 'object' || Array.isArray(row.services[serviceKey].params)) row.services[serviceKey].params = {};
    return row.services[serviceKey];
  }
  function bulkServiceKey(service) {
    const label = service?.caption || service?.title || service?.name || service?.key || '';
    const normalized = normalize(label);
    return normalized || String(service?.key || '').trim();
  }
  function serviceIdentityKeys(service) {
    const keys = new Set([String(service?.key || '').trim()].filter(Boolean));
    (service?.sourceKeys instanceof Set ? [...service.sourceKeys] : (Array.isArray(service?.sourceKeys) ? service.sourceKeys : [])).forEach(key => {
      const value = String(key || '').trim();
      if (value) keys.add(value);
    });
    return keys;
  }
  function bulkCompanyServiceState(company, key) {
    state.bulk.companyServices = normalizeCompanyServices(state.bulk.companyServices);
    if (!state.bulk.companyServices[company]) state.bulk.companyServices[company] = {};
    return rowServiceState({ services: state.bulk.companyServices[company] }, key);
  }
  function serviceParamRules(param) {
    return Array.isArray(param?.rules) ? param.rules.flatMap(rule => Array.isArray(rule) ? rule : [rule]) : [];
  }
  function serviceParamRequired(param) {
    return serviceParamRules(param).some(rule => rule === 'required');
  }
  function serviceParamIsBoolean(param) {
    return typeof param?.value === 'boolean' || serviceParamRules(param).some(rule => rule === 'boolean');
  }
  function serviceParamIsNumeric(param) {
    return serviceParamRules(param).some(rule => typeof rule === 'object' && rule && (rule.numeric || rule.integerOnly || rule.min !== undefined || rule.max !== undefined));
  }
  function serviceParamIsRadio(param) {
    return String(param?.type || '').toLowerCase() === 'radio';
  }
  function normalizeServiceParamOptions(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      return Object.entries(value).map(([key, option]) => {
        if (option && typeof option === 'object') return { key, ...option };
        return { key, value: key, caption: option };
      });
    }
    return [];
  }
  function serviceParamOptions(param) {
    const options = normalizeServiceParamOptions(param?.options).length
      ? normalizeServiceParamOptions(param?.options)
      : normalizeServiceParamOptions(param?.values);
    if (options.length) {
      return options.map(option => ({
        value: String(option?.key ?? option?.value ?? option?.id ?? option?.caption ?? ''),
        label: String(option?.caption ?? option?.label ?? option?.name ?? option?.key ?? option?.value ?? '')
      })).filter(option => option.value || option.label);
    }
    if (serviceParamIsBoolean(param)) {
      return [
        { value: 'true', label: 'Да' },
        { value: 'false', label: 'Нет' }
      ];
    }
    return [];
  }
  function serviceParamDefaultValue(param) {
    if (param?.value !== undefined && param?.value !== null) return param.value;
    if (serviceParamIsBoolean(param)) return false;
    return '';
  }
  function serviceParamValue(row, service, param) {
    const stateItem = rowServiceState(row, service.key);
    if (!(param.key in stateItem.params)) stateItem.params[param.key] = serviceParamDefaultValue(param);
    return stateItem.params[param.key];
  }
  function serviceParamRadioMarkup({ value, label, common, name, checked }) {
    return `<label class="radio-line service-param-radio"><input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${common} ${checked ? 'checked' : ''}><span>${escapeHtml(label || value)}</span></label>`;
  }
  function selectedTariffServices(item) {
    if (!item || typeof item !== 'object') return [];
    const signature = tariffServicesSignature(item);
    const cached = tariffServicesCache.get(item);
    if (cached?.signature === signature) return cached.value;
    const services = Array.isArray(item?.services) ? item.services.filter(service => service && service.key) : [];
    if (item?.returnServiceAllowed) {
      services.push({
        key: RETURN_SERVICE_KEY,
        caption: 'Доставка с возвратом',
        description: 'Возврат документов или груза по этому же направлению.',
        price: item.returnServicePrice ?? '',
        required: false,
        params: [],
        incompatibleServices: [],
        virtualReturn: true
      });
    }
    tariffServicesCache.set(item, { signature, value: services });
    return services;
  }
  function serviceEnabled(row, service) {
    return Boolean(service.required || rowServiceState(row, service.key).enabled);
  }
  function serviceIncompatibleKeys(service, services = []) {
    const ownKeys = serviceIdentityKeys(service);
    const directKeys = new Set((Array.isArray(service?.incompatibleServices) ? service.incompatibleServices : []).map(key => String(key)));
    const keys = new Set();
    services.forEach(candidate => {
      const candidateKeys = serviceIdentityKeys(candidate);
      const candidateIncompatibleKeys = new Set((Array.isArray(candidate?.incompatibleServices) ? candidate.incompatibleServices : []).map(key => String(key)));
      const directConflict = [...candidateKeys].some(key => directKeys.has(key));
      const reverseConflict = [...ownKeys].some(key => candidateIncompatibleKeys.has(key));
      if (directConflict || reverseConflict) keys.add(String(candidate.key));
    });
    keys.delete(String(service?.key));
    return keys;
  }
  function serviceIncompatibleNames(service, services = []) {
    return [...serviceIncompatibleKeys(service, services)]
      .map(key => services.find(candidate => String(candidate.key) === String(key)))
      .filter(Boolean)
      .map(candidate => candidate.caption || candidate.title || candidate.name || candidate.key)
      .filter(Boolean);
  }
  function serviceConflictSource(row, service, services = []) {
    return services.find(candidate => (
      String(candidate.key) !== String(service.key)
      && serviceEnabled(row, candidate)
      && serviceIncompatibleKeys(candidate, services).has(String(service.key))
    ));
  }

  function normalizeLoadedWorkspace() {
    state.settings.autoCalculate = Boolean(state.settings.autoCalculate);
    if (state.settings.density === 'medium' || state.settings.density === 'spacious') state.settings.density = 'comfortable';
    if (state.settings.density === 'micro') state.settings.density = 'dense';
    if (!['comfortable', 'compact', 'dense'].includes(state.settings.density)) state.settings.density = 'comfortable';
    state.settings.userInn = sanitizeInn(state.settings.userInn);
    state.settings.timeoutMs = calculationTimeoutMs(state.settings.timeoutMs);
    state.settings.retries = calculationRetries(state.settings.retries);
    state.settings.authChecked = Boolean(state.settings.authChecked);
    state.settings.showOnboarding = state.settings.showOnboarding !== false;
    state.settings.performanceMode = Boolean(state.settings.performanceMode);
    state.bulk = { ...defaultBulkState(), ...(state.bulk || {}) };
    state.bulk.tariffSearch = String(state.bulk.tariffSearch || '');
    state.bulk.servicesSearch = String(state.bulk.servicesSearch || '');
    if (state.bulk.mode === 'preferred-fast-cheapest') state.bulk.mode = 'preferred-fastest';
    state.bulk.servicesOnlyAssigned = Boolean(state.bulk.servicesOnlyAssigned);
    state.bulk.servicesOpenCompanies = Array.isArray(state.bulk.servicesOpenCompanies) ? state.bulk.servicesOpenCompanies : [];
    state.bulk.preferredCompaniesTouched = Boolean(state.bulk.preferredCompaniesTouched);
    state.bulk.services = normalizeRowServices(state.bulk.services);
    state.bulk.companyServices = normalizeCompanyServices(state.bulk.companyServices);
    if (state.bulk.mode === 'company-cheapest' || state.bulk.mode === 'cheapest') state.bulk.mode = 'preferred-cheapest';
    if (state.bulk.mode === 'company-fastest' || state.bulk.mode === 'fastest') state.bulk.mode = 'preferred-fastest';
    if (!['preferred-cheapest', 'preferred-fastest', 'preferred-fast-cheapest', 'manual'].includes(state.bulk.mode)) state.bulk.mode = 'preferred-cheapest';
    if (!['index', 'status', 'price-asc', 'price-desc'].includes(state.filter.sort)) state.filter.sort = 'index';
    if (state.viewMode !== 'table' && state.viewMode !== 'cards') state.viewMode = 'cards';
    state.reviewMode = Boolean(state.reviewMode && state.filter.status === 'problem');
    state.sidebarCollapsed = false;
    state.sidebarWidth = Math.min(520, Math.max(320, Number(state.sidebarWidth) || 360));
    state.pageSize = currentPageSize();
    state.rows = Array.isArray(state.rows) ? state.rows : [];
    state.created = Array.isArray(state.created) ? state.created : [];
    state.cancelResults = Array.isArray(state.cancelResults) ? state.cancelResults : [];
    state.rows.forEach(row => {
      if (row.status === 'created') row.selected = false;
      row.sender.inn = sanitizeInn(row.sender.inn);
      row.recipient.inn = sanitizeInn(row.recipient.inn);
      row.cargo.type = normalizeCargoType(row.cargo?.type);
      row.services = normalizeRowServices(row.services);
      if (row.result?.allTariffs) row.result = compactOrderCalculationResult(row.result);
      row.uiTab = row.uiTab || 'cargo';
      row.tariffSearch = String(row.tariffSearch || '');
      row.schedule ||= {};
      row.schedule.takeDate = row.schedule.takeDate ? clampDateNotPast(row.schedule.takeDate) : '';
      row.schedule.takeTimeFrom = timeInputValue(row.schedule.takeTimeFrom);
      row.schedule.takeTimeTo = timeInputValue(row.schedule.takeTimeTo);
      row.fieldErrors = normalizeFieldErrors(row.fieldErrors);
      if (row.cargo.declaredValue && !row.cargo.insuranceValue) row.cargo.insuranceValue = String(row.cargo.declaredValue);
      syncCargoNameWithType(row);
    });
    if (!state.rows.some(row => row.id === state.activeRowId)) state.activeRowId = state.rows[0]?.id || '';
    if (!state.rows.some(row => row.id === state.expandedRowId)) state.expandedRowId = '';
  }
  function workspaceSnapshot() {
    return {
      bulk: state.bulk,
      filter: state.filter,
      viewMode: state.viewMode,
      reviewMode: state.reviewMode,
      sidebarCollapsed: state.sidebarCollapsed,
      sidebarWidth: state.sidebarWidth,
      pageSize: state.pageSize,
      activeRowId: state.activeRowId,
      expandedRowId: state.expandedRowId,
      rows: state.rows,
      created: state.created,
      cancelResults: state.cancelResults,
      cancelTotal: state.cancelTotal,
      page: state.page,
      createProgress: state.createProgress
    };
  }
  function isOrderCreatorStorageKey(key) {
    return key === STORAGE_KEY || String(key || '').startsWith(ORDER_WORKSPACE_PREFIX);
  }
  function readLocalStorageJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function writeLocalStorageJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function storageLastError() {
    try {
      return globalThis.chrome?.runtime?.lastError?.message || '';
    } catch {
      return '';
    }
  }
  function readExtensionStorage(keys) {
    const storage = toolkitStorage();
    if (!storage) return Promise.resolve(null);
    return new Promise(resolve => {
      try {
        storage.get(keys, result => resolve(storageLastError() ? null : (result || {})));
      } catch {
        resolve(null);
      }
    });
  }
  function writeExtensionStorage(items) {
    const storage = toolkitStorage();
    if (!storage) return Promise.resolve(false);
    return new Promise(resolve => {
      try {
        storage.set(items, () => resolve(!storageLastError()));
      } catch {
        resolve(false);
      }
    });
  }
  function removeExtensionStorage(keys) {
    const storage = toolkitStorage();
    if (!storage) return Promise.resolve(false);
    return new Promise(resolve => {
      try {
        storage.remove(keys, () => resolve(!storageLastError()));
      } catch {
        resolve(false);
      }
    });
  }
  function openDraftDb() {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    return new Promise(resolve => {
      try {
        const request = indexedDB.open('ops-toolkit-order-drafts', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  const draftDbPromise = openDraftDb();
  async function readIndexedDraftValue(key) {
    const db = await draftDbPromise;
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const request = db.transaction('items', 'readonly').objectStore('items').get(key);
        request.onsuccess = () => resolve(request.result?.value ?? null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  async function writeIndexedDraftValue(key, value) {
    const db = await draftDbPromise;
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction('items', 'readwrite');
        tx.objectStore('items').put({ key, value, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
  async function removeIndexedDraftValues(keys) {
    const db = await draftDbPromise;
    if (!db) return false;
    const list = Array.isArray(keys) ? keys : [keys];
    return new Promise(resolve => {
      try {
        const tx = db.transaction('items', 'readwrite');
        const store = tx.objectStore('items');
        list.filter(Boolean).forEach(key => store.delete(key));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
  async function indexedDraftKeys() {
    const db = await draftDbPromise;
    if (!db) return [];
    return new Promise(resolve => {
      try {
        const request = db.transaction('items', 'readonly').objectStore('items').getAllKeys();
        request.onsuccess = () => resolve((request.result || []).map(String));
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }
  async function readOrderStorageValue(key) {
    const stored = await readExtensionStorage([key]);
    if (stored && Object.prototype.hasOwnProperty.call(stored, key)) return stored[key];
    const indexed = await readIndexedDraftValue(key);
    if (indexed) return indexed;
    const local = readLocalStorageJson(key);
    if (local) void writeOrderStorageValue(key, local);
    return local;
  }
  async function writeOrderStorageValue(key, value) {
    const isWorkspace = String(key || '').startsWith(ORDER_WORKSPACE_PREFIX);
    if (isWorkspace) {
      const indexedOk = await writeIndexedDraftValue(key, value);
      if (indexedOk) {
        await removeExtensionStorage([key]);
        try { localStorage.removeItem(key); } catch { /* noop */ }
        return true;
      }
    }
    if (toolkitStorage()) {
      const ok = await writeExtensionStorage({ [key]: value });
      if (ok) {
        await removeIndexedDraftValues([key]);
        try { localStorage.removeItem(key); } catch { /* noop */ }
        return true;
      }
    }
    const indexedOk = await writeIndexedDraftValue(key, value);
    if (indexedOk) {
      try { localStorage.removeItem(key); } catch { /* noop */ }
      return true;
    }
    return writeLocalStorageJson(key, value);
  }
  async function removeOrderStorageValues(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    await removeExtensionStorage(list);
    await removeIndexedDraftValues(list);
    list.forEach(key => {
      try { localStorage.removeItem(key); } catch { /* noop */ }
    });
  }
  class IndexedCache {
    constructor() {
      this.dbPromise = this.open();
    }
    open() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('kd-mass-calculator', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async get(key) {
      try {
        const db = await this.dbPromise;
        return await new Promise(resolve => {
          const tx = db.transaction('cache', 'readwrite');
          const store = tx.objectStore('cache');
          const request = store.get(key);
          request.onsuccess = () => {
            const item = request.result;
            if (!item) return resolve(null);
            if (item.expiresAt <= Date.now()) {
              store.delete(key);
              resolve(null);
              return;
            }
            resolve(item.value);
          };
          request.onerror = () => resolve(null);
        });
      } catch { return null; }
    }
    async set(key, value, ttlMs) {
      try {
        const db = await this.dbPromise;
        await new Promise(resolve => {
          const tx = db.transaction('cache', 'readwrite');
          tx.objectStore('cache').put({ key, value, expiresAt: Date.now() + ttlMs });
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        });
      } catch { /* cache is optional */ }
    }
  }
  function applyWorkspace(saved = {}) {
    const defaults = defaultWorkspaceState();
    state.bulk = { ...defaults.bulk, ...(saved.bulk || {}) };
    state.filter = { ...defaults.filter, ...(saved.filter || {}) };
    state.viewMode = saved.viewMode || defaults.viewMode;
    state.reviewMode = Boolean(saved.reviewMode);
    state.sidebarCollapsed = Boolean(saved.sidebarCollapsed);
    state.sidebarWidth = saved.sidebarWidth || defaults.sidebarWidth;
    state.pageSize = saved.pageSize || defaults.pageSize;
    state.activeRowId = saved.activeRowId || '';
    state.expandedRowId = saved.expandedRowId || '';
    state.rows = Array.isArray(saved.rows) ? saved.rows : [];
    state.created = Array.isArray(saved.created) ? saved.created : [];
    state.cancelResults = Array.isArray(saved.cancelResults) ? saved.cancelResults : [];
    state.cancelTotal = Number(saved.cancelTotal) || 0;
    state.page = Number(saved.page) || 0;
    state.createProgress = { ...defaults.createProgress, ...(saved.createProgress || {}) };
    normalizeLoadedWorkspace();
    invalidateRowsRenderCache();
  }
  async function loadProjectWorkspace(projectId, fallback = null) {
    workspaceProjectId = DEFAULT_PROJECTS.some(project => project.id === projectId) ? projectId : 'kd';
    const saved = await readOrderStorageValue(projectWorkspaceKey(workspaceProjectId));
    applyWorkspace(saved || fallback || defaultWorkspaceState());
  }
  async function loadState() {
    try {
      const saved = await readOrderStorageValue(STORAGE_KEY) || {};
      if (saved.settings) {
        state.settings = { ...state.settings, ...saved.settings };
        if (!saved.settings.concurrencyDefaultVersion && Number(saved.settings.concurrency) === 6) state.settings.concurrency = 3;
      }
      state.settings.concurrencyDefaultVersion = 2;
      if (!DEFAULT_PROJECTS.some(project => project.id === state.settings.projectId)) state.settings.projectId = 'kd';
      const legacyWorkspace = saved.rows || saved.bulk || saved.created ? saved : null;
      await loadProjectWorkspace(state.settings.projectId, legacyWorkspace);
    } catch {
      await loadProjectWorkspace(state.settings.projectId);
    }
  }
  function saveState() {
    if (saveStateTimer) {
      clearTimeout(saveStateTimer);
      saveStateTimer = null;
    }
    const settingsPayload = { settings: { ...state.settings } };
    const workspacePayload = workspaceSnapshot();
    void Promise.all([
      writeOrderStorageValue(STORAGE_KEY, settingsPayload),
      writeOrderStorageValue(projectWorkspaceKey(), workspacePayload)
    ]).then(([settingsOk, workspaceOk]) => {
      if (!settingsOk || !workspaceOk) {
        setStatus('Не удалось сохранить черновик: хранилище расширения переполнено или недоступно. Откройте настройки и очистите черновики.', 'error');
      }
    });
  }
  function saveStateSoon(delay = 450) {
    clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => {
      saveStateTimer = null;
      saveState();
    }, delay);
  }
  function renderStatsSoon(delay = 160) {
    clearTimeout(statsRenderTimer);
    statsRenderTimer = setTimeout(() => {
      statsRenderTimer = null;
      renderStats();
    }, delay);
  }
  function renderCreationUiSoon() {
    if (progressRenderFrame) return;
    progressRenderFrame = requestAnimationFrame(() => {
      progressRenderFrame = 0;
      renderCreateProgress();
      renderCreated();
      if (!state.createProgress?.active) renderStats();
    });
  }
  async function orderCreatorStorageKeys() {
    const keys = new Set();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (isOrderCreatorStorageKey(key)) keys.add(key);
    }
    (await indexedDraftKeys()).filter(isOrderCreatorStorageKey).forEach(key => keys.add(key));
    const stored = await readExtensionStorage(null);
    if (stored) Object.keys(stored).filter(isOrderCreatorStorageKey).forEach(key => keys.add(key));
    return [...keys];
  }
  async function clearLocalDrafts() {
    const keys = await orderCreatorStorageKeys();
    const ok = await confirmAction({
      title: 'Очистить черновики?',
      message: 'Будут удалены сохранённые списки заказов и созданные ID по всем проектам оформления. Доступы и токены останутся.',
      detailsHtml: `<div class="create-preview-summary"><span>Будет очищено</span><b>${escapeHtml(keys.length || 0)} записей</b><span>Текущий список заказов тоже станет пустым.</span></div>`,
      confirmText: 'Очистить черновики'
    });
    if (!ok) return;
    const settings = { ...state.settings };
    await removeOrderStorageValues(keys);
    state.settings = settings;
    applyWorkspace(defaultWorkspaceState());
    workspaceProjectId = state.settings.projectId || 'kd';
    saveState();
    render();
    showToast('Черновики оформления очищены.', 'ready');
  }
  function toolkitStorage() {
    return globalThis.chrome?.storage?.local || null;
  }
  function readToolkitCredentials() {
    const storage = toolkitStorage();
    if (!storage) return Promise.resolve(null);
    return new Promise(resolve => {
      storage.get([TOOLKIT_CREDENTIALS_KEY], result => resolve(result?.[TOOLKIT_CREDENTIALS_KEY] || null));
    });
  }
  function writeToolkitCredentials(value) {
    const storage = toolkitStorage();
    if (!storage) return Promise.resolve();
    return new Promise(resolve => storage.set({ [TOOLKIT_CREDENTIALS_KEY]: value }, resolve));
  }
  function toolkitProjectCredentials(shared, projectId) {
    return shared?.projects?.[projectId] || {};
  }
  function projectClientKey() {
    return 'ordersClient';
  }
  function projectLegacyClient(credentials = {}) {
    return {
      inn: sanitizeInn(credentials.inn || ''),
      userId: credentials.userId || '',
      userDisplay: credentials.userDisplay || ''
    };
  }
  function projectSectionClient(credentials = {}, section = projectClientKey()) {
    const legacy = projectLegacyClient(credentials);
    const client = credentials?.[section] && typeof credentials[section] === 'object' ? credentials[section] : {};
    return {
      inn: sanitizeInn(client.inn || legacy.inn),
      userId: client.userId || legacy.userId,
      userDisplay: client.userDisplay || legacy.userDisplay
    };
  }
  async function hydrateToolkitCredentials(projectId = state.settings.projectId) {
    const shared = await readToolkitCredentials();
    if (!shared) return false;
    const safeProjectId = DEFAULT_PROJECTS.some(project => project.id === projectId) ? projectId : (shared.activeProject || 'kd');
    const credentials = toolkitProjectCredentials(shared, safeProjectId);
    const client = projectSectionClient(credentials, projectClientKey());
    state.settings.projectId = safeProjectId;
    state.settings.email = credentials.email || '';
    state.settings.password = credentials.password || '';
    state.settings.userInn = client.inn;
    state.settings.userId = client.userId;
    state.settings.userDisplay = client.userDisplay;
    state.settings.authChecked = Boolean(credentials.authChecked && state.settings.email && state.settings.password);
    if (Object.prototype.hasOwnProperty.call(shared, 'tokenDaData')) state.settings.tokenDaData = shared.tokenDaData || '';
    saveStateSoon(250);
    return true;
  }
  async function selectToolkitProject(projectId) {
    const shared = await readToolkitCredentials() || {};
    shared.activeProject = DEFAULT_PROJECTS.some(project => project.id === projectId) ? projectId : 'kd';
    shared.projects = shared.projects || {};
    await writeToolkitCredentials(shared);
    await hydrateToolkitCredentials(shared.activeProject);
  }
  async function switchActiveProject(projectId) {
    const safeProjectId = DEFAULT_PROJECTS.some(project => project.id === projectId) ? projectId : 'kd';
    if (safeProjectId === state.settings.projectId && safeProjectId === workspaceProjectId) return;
    saveState();
    await selectToolkitProject(safeProjectId);
    await loadProjectWorkspace(state.settings.projectId);
    saveState();
    render();
  }
  async function syncToolkitCredentials() {
    clearTimeout(toolkitSyncTimer);
    toolkitSyncTimer = null;
    const shared = await readToolkitCredentials() || {};
    const projectId = state.settings.projectId || 'kd';
    shared.activeProject = projectId;
    shared.tokenDaData = state.settings.tokenDaData || '';
    shared.projects = shared.projects || {};
    shared.projects[projectId] = {
      ...(shared.projects[projectId] || {}),
      email: state.settings.email || '',
      password: state.settings.password || '',
      ordersClient: {
        inn: sanitizeInn(state.settings.userInn || ''),
        userId: state.settings.userId || '',
        userDisplay: state.settings.userDisplay || ''
      },
      authChecked: Boolean(state.settings.authChecked)
    };
    await writeToolkitCredentials(shared);
  }
  function syncToolkitCredentialsSoon(delay = 500) {
    clearTimeout(toolkitSyncTimer);
    toolkitSyncTimer = setTimeout(() => {
      toolkitSyncTimer = null;
      void syncToolkitCredentials();
    }, delay);
  }
  async function refreshToolkitCredentialsFromStorage() {
    if (state.running) return;
    const activeBefore = state.settings.projectId;
    const clientBefore = String(state.settings.userId || '');
    const changed = await hydrateToolkitCredentials(activeBefore);
    if (!changed) return;
    if (state.settings.projectId !== activeBefore) state.settings.projectId = activeBefore;
    const clientAfter = String(state.settings.userId || '');
    if (clientBefore !== clientAfter) invalidateClientResults(clientAfter);
    renderSettings();
    renderClient();
    renderStats();
    renderButtons();
  }
  function initToolkitStorageSync() {
    const storage = toolkitStorage();
    if (!storage || !globalThis.chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[TOOLKIT_CREDENTIALS_KEY]) return;
      void refreshToolkitCredentialsFromStorage();
    });
    window.addEventListener('focus', () => { void refreshToolkitCredentialsFromStorage(); });
  }
  function setStatus(message, type = '') {
    if (!els.workStatus) return;
    if (type === 'running') {
      if (/отмен/i.test(message)) state.operation = 'cancel';
      else if (/созда|создан/i.test(message)) state.operation = 'create';
      else if (/расч[ёе]т/i.test(message)) state.operation = 'calculate';
      else if (/распозна|адрес/i.test(message)) state.operation = 'resolve';
    } else {
      state.operation = '';
    }
    const hideForCreateProgress = type === 'running' && state.createProgress?.active && (state.operation === 'create' || /созда|создан/i.test(message));
    els.workStatus.hidden = !message || type === 'ready' || hideForCreateProgress;
    els.workStatus.className = `work-status ${type}`.trim();
    els.workStatus.innerHTML = type === 'running'
      ? `<span class="loading-spinner" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`
      : escapeHtml(message);
    renderStatusBars();
  }
  function showToast(message, type = 'ready') {
    const host = els.toastHost || document.getElementById('toastHost');
    if (!host) return;
    clearTimeout(toastTimer);
    host.innerHTML = `<div class="toast ${escapeHtml(type)}">${escapeHtml(message)}</div>`;
    toastTimer = setTimeout(() => {
      host.innerHTML = '';
    }, 2800);
  }
  function announceAction(message, type = 'ready') {
    setStatus(message, type);
    showToast(message, type);
  }
  async function withUiBusy(label, worker) {
    if (state.running || state.uiBusy) return;
    state.uiBusy = true;
    state.uiBusyText = label;
    setStatus(label, 'running');
    renderButtons();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      await worker();
    } finally {
      state.uiBusy = false;
      state.uiBusyText = '';
      renderButtons();
    }
  }
  async function processInUiChunks(items, worker, chunkSize = 50) {
    const list = Array.isArray(items) ? items : [];
    for (let index = 0; index < list.length; index += 1) {
      worker(list[index], index);
      if ((index + 1) % chunkSize === 0 && index + 1 < list.length) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }
  }
  function tooltipCandidate(target) {
    return target?.closest?.('[data-tooltip], [title], .icon-button[aria-label], .table-row-tool[aria-label]');
  }
  function tooltipText(anchor) {
    if (!anchor || anchor.disabled || anchor.getAttribute('aria-disabled') === 'true') return '';
    if (anchor.hasAttribute('title')) {
      anchor.dataset.tooltip = anchor.getAttribute('title') || '';
      anchor.removeAttribute('title');
    }
    return String(anchor.dataset.tooltip || anchor.getAttribute('aria-label') || '').trim();
  }
  function positionTooltip(anchor = tooltipAnchor) {
    if (!els.appTooltip || !anchor || els.appTooltip.hidden) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 10;
    const width = els.appTooltip.offsetWidth;
    const height = els.appTooltip.offsetHeight;
    const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - margin));
    const above = rect.top >= height + margin + 4;
    const top = above ? rect.top - height - margin : rect.bottom + margin;
    els.appTooltip.style.left = `${left}px`;
    els.appTooltip.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
    els.appTooltip.dataset.placement = above ? 'top' : 'bottom';
  }
  function showTooltip(anchor) {
    const text = tooltipText(anchor);
    if (!els.appTooltip || !text) return;
    tooltipAnchor = anchor;
    els.appTooltip.textContent = text;
    els.appTooltip.hidden = false;
    els.appTooltip.dataset.visible = 'true';
    requestAnimationFrame(() => positionTooltip(anchor));
  }
  function hideTooltip(anchor = null) {
    if (!els.appTooltip || (anchor && tooltipAnchor !== anchor)) return;
    els.appTooltip.hidden = true;
    els.appTooltip.dataset.visible = 'false';
    tooltipAnchor = null;
  }
  function initTooltips() {
    document.addEventListener('pointerover', event => {
      const anchor = tooltipCandidate(event.target);
      if (anchor) showTooltip(anchor);
    });
    document.addEventListener('pointerout', event => {
      const anchor = tooltipCandidate(event.target);
      if (!anchor || anchor.contains(event.relatedTarget)) return;
      hideTooltip(anchor);
    });
    document.addEventListener('focusin', event => {
      const anchor = tooltipCandidate(event.target);
      if (anchor) showTooltip(anchor);
    });
    document.addEventListener('focusout', event => {
      const anchor = tooltipCandidate(event.target);
      if (anchor) hideTooltip(anchor);
    });
    document.addEventListener('scroll', () => positionTooltip(), true);
    window.addEventListener('resize', () => positionTooltip());
  }
  function currentProject() {
    return state.projects.find(project => project.id === state.settings.projectId) || state.projects[0] || DEFAULT_PROJECTS[0];
  }
  function credentials() {
    return {
      projectId: state.settings.projectId,
      email: state.settings.email.trim(),
      password: state.settings.password,
      tokenDaData: state.settings.tokenDaData.trim(),
      userId: String(state.settings.userId || '').trim()
    };
  }
  function accessReady() {
    return Boolean(state.settings.email && state.settings.password && state.settings.tokenDaData && state.settings.authChecked);
  }
  function clientReady() {
    return Boolean(accessReady() && state.settings.userId);
  }
  function flashClientPanel(message) {
    const panel = els.clientResult?.closest('.panel-section');
    if (panel) {
      panel.classList.remove('attention-flash');
      void panel.offsetWidth;
      panel.classList.add('attention-flash');
      panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (message) setStatus(message, 'error');
  }
  function requireAccessAndClient(actionLabel = 'продолжить') {
    if (!accessReady()) {
      if (els.settingsModal?.hidden) openSettingsModal();
      setStatus(`Сначала сохраните и проверьте доступ проекта, чтобы ${actionLabel}.`, 'error');
      return false;
    }
    if (!state.settings.userId) {
      flashClientPanel(`Сначала выберите клиента: введите ИНН в блоке «Клиент» и нажмите «Найти», чтобы ${actionLabel}.`);
      return false;
    }
    return true;
  }
  function concurrency() {
    return Math.min(MAX_CONCURRENCY, Math.max(1, Number(state.settings.concurrency) || 3));
  }
  function calculationTimeoutMs(value = state.settings.timeoutMs) {
    const seconds = Math.round(Number(value) / 1000);
    const normalized = Number.isFinite(seconds) && seconds > 0 ? seconds : Number(value);
    const finalSeconds = Math.min(300, Math.max(30, Number(normalized) || 90));
    return finalSeconds * 1000;
  }
  function calculationTimeoutSeconds() {
    return Math.round(calculationTimeoutMs() / 1000);
  }
  function calculationRetries(value = state.settings.retries) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.min(3, Math.max(0, number)) : DEFAULT_CALCULATION_RETRIES;
  }
  function orderCalculationCacheKey(row, settings = credentials()) {
    const exclusions = ['Достависта', 'Пешкарики', 'Яндекс Доставка', 'Yandex'].sort();
    return [
      'calc:v15',
      settings.projectId,
      settings.userId,
      row.sender?.resolved?.placeId || row.sender?.resolved?.kdId || '',
      row.recipient?.resolved?.placeId || row.recipient?.resolved?.kdId || '',
      cargoTypeId(row),
      Math.max(1, Math.round(positiveNumber(row.cargo.seats, 1))),
      positiveNumber(row.cargo.weight, 0.1),
      positiveNumber(row.cargo.length, 10),
      positiveNumber(row.cargo.width, 10),
      positiveNumber(row.cargo.height, 10),
      'door',
      exclusions.join(',')
    ].join('|');
  }
  function normalizeFieldErrors(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function defaultPerson() {
    return { name: '', contact: '', phone: '', city: '', address: '', fullAddress: '', postIndex: '', email: '', info: '', personType: 'legal', inn: '', passportSeries: '', passportNumber: '', passportIssueDate: '', resolved: null, error: '' };
  }
  function defaultRow(data = {}) {
    const sender = { ...defaultPerson(), ...(data.sender || {}) };
    const recipient = { ...defaultPerson(), ...(data.recipient || {}) };
    return {
      id: data.id || rowId(),
      selected: data.selected !== false,
      index: data.index || state.rows.length + 1,
      sender,
      recipient,
      cargo: {
        type: normalizeCargoType(data.cargo?.type || data.cargoType || 'cargo'),
        name: data.cargo?.name || data.cargoName || CARGO_TYPES[normalizeCargoType(data.cargo?.type || data.cargoType || 'cargo')].label,
        weight: String(data.cargo?.weight || data.weight || '0.1'),
        seats: String(data.cargo?.seats || data.seats || '1'),
        length: String(data.cargo?.length || data.length || '10'),
        width: String(data.cargo?.width || data.width || '10'),
        height: String(data.cargo?.height || data.height || '10'),
        valueMode: data.cargo?.valueMode || data.valueMode || 'none',
        declaredValue: String(data.cargo?.declaredValue || data.declaredValue || ''),
        insuranceValue: String(data.cargo?.insuranceValue || data.insuranceValue || ''),
        comment: data.cargo?.comment || data.comment || ''
      },
      schedule: {
        takeDate: dateInputValue(data.schedule?.takeDate || data.takeDate || state.settings.takeDate),
        takeTimeFrom: timeInputValue(data.schedule?.takeTimeFrom || data.takeTimeFrom || state.settings.takeTimeFrom),
        takeTimeTo: timeInputValue(data.schedule?.takeTimeTo || data.takeTimeTo || state.settings.takeTimeTo)
      },
      deliveryCompanyHint: data.deliveryCompanyHint || '',
      transportType: data.transportType || '1',
      result: data.result || null,
      tariffKey: data.tariffKey || '',
      tariffSearch: data.tariffSearch || '',
      status: data.status || 'imported',
      error: data.error || '',
      fieldErrors: normalizeFieldErrors(data.fieldErrors),
      orderId: data.orderId || '',
      services: normalizeRowServices(data.services),
      uiTab: data.uiTab || 'cargo'
    };
  }
  function personAddress(person) {
    return [person.city, person.address].map(item => String(item || '').trim()).filter(Boolean).join(' ') || person.fullAddress || '';
  }
  function personApiAddress(person) {
    const city = String(person.city || '').trim();
    const address = String(person.address || person.fullAddress || '').trim();
    if (!city) return address;
    if (!address) return city;
    return normalize(address).includes(normalize(city)) ? address : `${city} ${address}`;
  }
  function personHasCityAndAddress(person) {
    return Boolean(String(person.city || '').trim() && String(person.address || person.fullAddress || '').trim());
  }
  function addressResolveFailed(person) {
    return Boolean(personHasCityAndAddress(person) && person.error && !person.resolved);
  }
  function addressNeedsAttention(row, side) {
    const person = row?.[side];
    return Boolean(row?.status === 'error' && row?.error && person && !person.resolved);
  }
  function personMissingAddressFields(person) {
    const missing = [];
    if (!String(person.city || '').trim()) missing.push('город');
    if (!String(person.address || person.fullAddress || '').trim()) missing.push('адрес');
    return missing;
  }
  function personMissingRequiredFields(person) {
    const missing = personMissingAddressFields(person);
    if (!String(person.name || '').trim()) missing.unshift('организация');
    if (!String(person.contact || '').trim()) missing.unshift('контакт');
    if (!String(person.phone || '').trim()) missing.unshift('телефон');
    return missing;
  }
  function cargoMissingRequiredFields(row) {
    const missing = [];
    if (!String(row.cargo.name || '').trim()) missing.push('содержимое');
    [
      ['вес', row.cargo.weight],
      ['мест', row.cargo.seats],
      ['длина', row.cargo.length],
      ['ширина', row.cargo.width],
      ['высота', row.cargo.height]
    ].forEach(([label, value]) => {
      if (!(positiveNumber(value, 0) > 0)) missing.push(label);
    });
    return missing;
  }
  function hasPassport(person) {
    return Boolean(String(person.passportSeries || '').trim() && String(person.passportNumber || '').trim());
  }
  function hasIdentity(person) {
    return Boolean(validInn(person.inn) || hasPassport(person));
  }
  function companyIsBusinessLine(company) {
    const name = normalize(company);
    return name.includes('делов');
  }
  function isBusinessLinePhysicalWithoutDocs(row, item) {
    if (!companyIsBusinessLine(item?.deliveryCompanyLabel || '')) return false;
    const personType = normalize(row.recipient?.personType || row.recipient?.type || row.recipient?.clientType || '');
    const text = normalize([row.recipient?.name, row.recipient?.contact].filter(Boolean).join(' '));
    return row.recipient?.personType === 'physical' || personType === 'physical' || personType.includes('физ') || text.includes('физ. лицо') || text.includes('физ лицо') || text.includes('физлицо');
  }
  function fieldInvalid(row, path) {
    const value = getPath(row, path);
    if (row?.fieldErrors?.[path]) return true;
    if (path === 'sender.city') return !String(row.sender.city || '').trim() || addressResolveFailed(row.sender) || addressNeedsAttention(row, 'sender');
    if (path === 'recipient.city') return !String(row.recipient.city || '').trim() || addressResolveFailed(row.recipient) || addressNeedsAttention(row, 'recipient');
    if (path === 'sender.address') return !personAddress(row.sender) || addressResolveFailed(row.sender) || addressNeedsAttention(row, 'sender');
    if (path === 'recipient.address') return !personAddress(row.recipient) || addressResolveFailed(row.recipient) || addressNeedsAttention(row, 'recipient');
    if (path.startsWith('cargo.')) return cargoMissingRequiredFields(row).includes({ 'cargo.name': 'содержимое', 'cargo.weight': 'вес', 'cargo.seats': 'мест', 'cargo.length': 'длина', 'cargo.width': 'ширина', 'cargo.height': 'высота' }[path]);
    return !String(value || '').trim();
  }
  function fieldErrorHint(row, path) {
    const text = String(row?.fieldErrors?.[path] || '').trim();
    return text ? `<span class="field-error-hint">${escapeHtml(text)}</span>` : '';
  }
  function inputErrorAttrs(row, path) {
    return fieldInvalid(row, path) ? 'class="field-error" aria-invalid="true"' : '';
  }
  function optionalInputErrorAttrs(row, path) {
    return row?.fieldErrors?.[path] ? 'class="field-error" aria-invalid="true"' : '';
  }
  function requiredInputAttrs(row, path) {
    return `required aria-required="true" ${inputErrorAttrs(row, path)}`;
  }
  function applyTheme() {
    const isDark = state.settings.theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.dataset.project = state.settings.projectId || 'kd';
    document.documentElement.dataset.density = ['comfortable', 'compact', 'dense'].includes(state.settings.density) ? state.settings.density : 'comfortable';
    document.documentElement.dataset.performance = state.settings.performanceMode ? 'low' : 'normal';
    if (els.themeToggleBtn) {
      els.themeToggleBtn.innerHTML = icon(isDark ? 'sun' : 'moon');
      els.themeToggleBtn.title = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';
      els.themeToggleBtn.setAttribute('aria-label', els.themeToggleBtn.title);
    }
  }
  function syncScrolledHeader() {
    document.body.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  function renderSidebarState() {
    if (!els.appShell || !els.sidebarToggleBtn) return;
    const collapsed = Boolean(state.sidebarCollapsed);
    els.appShell.classList.toggle('sidebar-collapsed', collapsed);
    els.appShell.style.setProperty('--sidebar-width', `${Math.min(520, Math.max(320, Number(state.sidebarWidth) || 360))}px`);
    els.sidebarToggleBtn.innerHTML = icon(collapsed ? 'panel-left-open' : 'panel-left-close');
    els.sidebarToggleBtn.title = collapsed ? 'Открыть боковое меню' : 'Скрыть панель управления';
    els.sidebarToggleBtn.setAttribute('aria-label', els.sidebarToggleBtn.title);
    els.sidebarToggleBtn.setAttribute('aria-expanded', String(!collapsed));
  }
  function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    saveState();
    renderSidebarState();
  }
  function startSidebarResize(event) {
    if (!els.appShell || state.sidebarCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = Number(state.sidebarWidth) || 360;
    els.appShell.classList.add('sidebar-resizing');
    const move = moveEvent => {
      state.sidebarWidth = Math.min(520, Math.max(320, startWidth + moveEvent.clientX - startX));
      renderSidebarState();
    };
    const stop = () => {
      els.appShell.classList.remove('sidebar-resizing');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      saveState();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
  }
  function normalizeCargoType(value) {
    const text = normalize(value);
    if ([
      'documents', 'document', 'docs', 'doc', 'документы', 'документ', CARGO_TYPES.documents.id
    ].includes(text) || text.includes('док')) return 'documents';
    if ([
      'cargo', 'goods', 'freight', 'груз', CARGO_TYPES.cargo.id
    ].includes(text) || text.includes('груз')) return 'cargo';
    return 'cargo';
  }
  function syncCargoNameWithType(row, previousType) {
    if (!row?.cargo) return;
    const nextType = normalizeCargoType(row.cargo.type);
    const defaultNames = new Set([
      '',
      CARGO_TYPES.cargo.label,
      CARGO_TYPES.documents.label,
      CARGO_TYPES[previousType]?.label || ''
    ].filter(Boolean));
    if (defaultNames.has(String(row.cargo.name || '').trim())) {
      row.cargo.name = CARGO_TYPES[nextType].label;
    }
  }
  function cargoTypeId(row) {
    return CARGO_TYPES[normalizeCargoType(row.cargo.type)]?.id || CARGO_TYPES.cargo.id;
  }

  function parseTextTable(text) {
    const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
    return text.split(/\r?\n/).filter(Boolean).map(line => line.split(delimiter).map(cell => cell.trim()));
  }
  function detectColumns(header) {
    const normalized = header.map(normalizeHeader);
    const find = aliases => {
      const names = aliases.map(normalizeHeader);
      const index = normalized.findIndex(name => names.some(alias => name === alias || name.includes(alias)));
      return index >= 0 ? index : undefined;
    };
    return {
      senderName: find(['отправитель организация', 'организация отправителя', 'отправитель', 'sender name']),
      senderContact: find(['отправитель контакт', 'контакт отправителя', 'фио отправителя', 'sender contact']),
      senderPhone: find(['отправитель телефон', 'телефон отправителя', 'sender phone']),
      senderCity: find(['отправитель город', 'город отправителя', 'откуда', 'sender city']),
      senderAddress: find(['отправитель адрес', 'адрес отправителя', 'sender address']),
      senderPostIndex: find(['отправитель индекс', 'индекс отправителя', 'sender index']),
      senderEmail: find(['отправитель email', 'email отправителя', 'sender email']),
      senderInfo: find(['отправитель доп инфо', 'доп инфо отправителя', 'sender info']),
      senderInn: find(['отправитель инн', 'инн отправителя', 'sender inn']),
      senderPassportSeries: find(['отправитель паспорт серия', 'серия паспорта отправителя']),
      senderPassportNumber: find(['отправитель паспорт номер', 'номер паспорта отправителя']),
      senderPassportIssueDate: find(['отправитель паспорт дата выдачи', 'дата выдачи паспорта отправителя']),
      recipientName: find(['получатель организация', 'организация получателя', 'получатель', 'recipient name']),
      recipientContact: find(['получатель контакт', 'контакт получателя', 'фио получателя', 'recipient contact']),
      recipientPhone: find(['получатель телефон', 'телефон получателя', 'recipient phone']),
      recipientCity: find(['получатель город', 'город получателя', 'куда', 'recipient city']),
      recipientAddress: find(['получатель адрес', 'адрес получателя', 'recipient address']),
      recipientPostIndex: find(['получатель индекс', 'индекс получателя', 'recipient index']),
      recipientEmail: find(['получатель email', 'email получателя', 'recipient email']),
      recipientInfo: find(['получатель доп инфо', 'доп инфо получателя', 'recipient info']),
      recipientInn: find(['получатель инн', 'инн получателя', 'recipient inn']),
      recipientPassportSeries: find(['получатель паспорт серия', 'серия паспорта получателя']),
      recipientPassportNumber: find(['получатель паспорт номер', 'номер паспорта получателя']),
      recipientPassportIssueDate: find(['получатель паспорт дата выдачи', 'дата выдачи паспорта получателя']),
      cargoType: find(['тип груза', 'вид груза', 'cargo type']),
      cargoName: find(['содержимое', 'описание груза', 'cargo name', 'cargo description']),
      weight: find(['вес', 'weight']),
      seats: find(['мест', 'seats']),
      length: find(['длина', 'length']),
      width: find(['ширина', 'width']),
      height: find(['высота', 'height']),
      declaredValue: find(['объявленная стоимость', 'ос', 'declared']),
      insuranceValue: find(['страхование', 'страховка', 'insurance']),
      deliveryCompanyHint: find(['тк', 'транспортная компания', 'delivery company']),
      takeDate: find(['дата забора', 'дата сбора', 'take date', 'pickup date']),
      takeTimeFrom: find(['сбор с', 'забор с', 'take time from', 'pickup from']),
      takeTimeTo: find(['сбор до', 'забор до', 'take time to', 'pickup to'])
    };
  }
  function value(row, columns, key) {
    const index = columns[key];
    return index === undefined ? '' : String(row[index] ?? '').trim();
  }
  function inferPersonTypeFromImport(person) {
    const inn = sanitizeInn(person?.inn || '');
    const hasPassportData = Boolean(
      String(person?.passportSeries || '').trim()
      || String(person?.passportNumber || '').trim()
      || String(person?.passportIssueDate || '').trim()
    );
    return !inn && hasPassportData ? 'physical' : 'legal';
  }
  function looksLikeHeader(row) {
    const columns = detectColumns(row);
    return columns.senderName !== undefined || columns.recipientName !== undefined || columns.senderAddress !== undefined || columns.recipientAddress !== undefined;
  }
  function rowFromImport(values, columns, index) {
    const cargoType = normalizeCargoType(value(values, columns, 'cargoType'));
    const declaredValue = value(values, columns, 'declaredValue');
    const insuranceValue = value(values, columns, 'insuranceValue');
    const sender = {
      name: value(values, columns, 'senderName'),
      contact: value(values, columns, 'senderContact'),
      phone: value(values, columns, 'senderPhone'),
      city: value(values, columns, 'senderCity'),
      address: value(values, columns, 'senderAddress'),
      postIndex: value(values, columns, 'senderPostIndex'),
      email: value(values, columns, 'senderEmail'),
      info: value(values, columns, 'senderInfo'),
      inn: sanitizeInn(value(values, columns, 'senderInn')),
      passportSeries: value(values, columns, 'senderPassportSeries'),
      passportNumber: value(values, columns, 'senderPassportNumber'),
      passportIssueDate: dateInputValue(value(values, columns, 'senderPassportIssueDate'))
    };
    sender.personType = inferPersonTypeFromImport(sender);
    const recipient = {
      name: value(values, columns, 'recipientName'),
      contact: value(values, columns, 'recipientContact'),
      phone: value(values, columns, 'recipientPhone'),
      city: value(values, columns, 'recipientCity'),
      address: value(values, columns, 'recipientAddress'),
      postIndex: value(values, columns, 'recipientPostIndex'),
      email: value(values, columns, 'recipientEmail'),
      info: value(values, columns, 'recipientInfo'),
      inn: sanitizeInn(value(values, columns, 'recipientInn')),
      passportSeries: value(values, columns, 'recipientPassportSeries'),
      passportNumber: value(values, columns, 'recipientPassportNumber'),
      passportIssueDate: dateInputValue(value(values, columns, 'recipientPassportIssueDate'))
    };
    recipient.personType = inferPersonTypeFromImport(recipient);
    return defaultRow({
      index,
      sender,
      recipient,
      cargo: {
        type: cargoType,
        name: value(values, columns, 'cargoName') || CARGO_TYPES[cargoType].label,
        weight: value(values, columns, 'weight') || '0.1',
        seats: value(values, columns, 'seats') || '1',
        length: value(values, columns, 'length') || '10',
        width: value(values, columns, 'width') || '10',
        height: value(values, columns, 'height') || '10',
        declaredValue,
        insuranceValue,
        valueMode: declaredValue ? 'declared' : insuranceValue ? 'insurance' : 'none',
        comment: ''
      },
      deliveryCompanyHint: value(values, columns, 'deliveryCompanyHint'),
      takeDate: value(values, columns, 'takeDate'),
      takeTimeFrom: value(values, columns, 'takeTimeFrom'),
      takeTimeTo: value(values, columns, 'takeTimeTo')
    });
  }
  function rowsFromMatrix(matrix) {
    const headerIndex = matrix.findIndex(looksLikeHeader);
    const hasHeader = headerIndex >= 0;
    const columns = hasHeader ? detectColumns(matrix[headerIndex]) : {
      senderAddress: 0, recipientAddress: 1, weight: 2, seats: 3, length: 4, width: 5, height: 6,
      senderName: 7, senderPhone: 8, recipientName: 9, recipientPhone: 10, comment: 11
    };
    const start = hasHeader ? headerIndex + 1 : 0;
    return matrix.slice(start)
      .filter(item => item.some(cell => String(cell ?? '').trim()))
      .map((item, index) => rowFromImport(item, columns, state.rows.length + index + 1))
      .filter(row => personAddress(row.sender) || personAddress(row.recipient));
  }

  function templateHeaderLabel(header) {
    if (TEMPLATE_REQUIRED_HEADERS.has(header)) return `${header} *`;
    return header;
  }
  function markTemplateHeaderComments(sheet, headers) {
    headers.forEach((label, index) => {
      const source = TEMPLATE_HEADERS[index];
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: index })];
      if (!cell) return;
      if (TEMPLATE_REQUIRED_HEADERS.has(source)) {
        cell.c = [{ a: 'KD', t: 'Обязательное поле для распознавания, расчёта и создания заказа.' }];
      } else if (TEMPLATE_CONDITIONAL_HEADERS.has(source)) {
        cell.c = [{ a: 'KD', t: 'Заполните ИНН или паспорт, если заказ создаётся через Деловые линии, Байкал Сервис или ПЭК.' }];
      }
    });
  }
  function downloadTemplate() {
    const headers = TEMPLATE_HEADERS.map(templateHeaderLabel);
    const sample = [
      'ООО Отправитель', 'Иван Иванов', '74951234567', 'Москва', 'ул. Мира, д. 22', '129090', 'sender@example.ru', 'Вход со двора', '7701234567', '4510', '123456', '01.02.2020',
      'ООО Получатель', 'Пётр Петров', '78121234567', 'Санкт-Петербург', 'Невский проспект, д. 55', '191025', 'recipient@example.ru', 'Позвонить за час', '7801234567', '4012', '654321', '05.03.2019',
      'Груз', 'Оборудование', '2.5', '1', '30', '20', '15', '', '10000', 'CSE', dateForApi(todayInputDate()), '09:00', '18:00'
    ];
    const docs = [
      'ООО Отправитель', 'Иван Иванов', '74951234567', 'Москва', 'ул. Мира, д. 22', '129090', 'sender@example.ru', '', '', '', '', '',
      'ООО Получатель', 'Пётр Петров', '78121234567', 'Санкт-Петербург', 'Невский проспект, д. 55', '191025', 'recipient@example.ru', '', '', '', '', '',
      'Документы', 'Документы', '0.1', '1', '10', '10', '10', '5000', '', 'OPS', dateForApi(todayInputDate()), '09:00', '18:00'
    ];
    const sheet = XLSX.utils.aoa_to_sheet([headers, sample, docs]);
    sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 2, c: headers.length - 1 } }) };
    sheet['!cols'] = headers.map(header => ({ wch: Math.min(38, Math.max(12, String(header).length + 2)) }));
    const help = XLSX.utils.aoa_to_sheet([
      ['Поле', 'Когда заполнять', 'Что указать'],
      ['Поля со *', 'Обязательно', 'Без этих данных строка не пройдёт распознавание, расчёт или создание заказа.'],
      ['Организация, контакт, телефон', 'Обязательно для отправителя и получателя', 'Название компании или ФИО, имя контактного лица и телефон без лишних символов.'],
      ['Город и адрес', 'Обязательно для отправителя и получателя', 'Город укажите отдельно от адреса. Индекс можно заполнить рядом, если он известен.'],
      ['ИНН', 'Для юр. лиц и для ТК, где это требуется', 'Если заполнен ИНН, строка будет считаться юридическим лицом.'],
      ['Паспорт', 'Для физ. лиц, если ТК требует паспортные данные', 'Заполните серию, номер и дату выдачи. Если заполнен паспорт и нет ИНН, строка будет считаться физическим лицом.'],
      ['Тип груза', 'Обязательно', 'Укажите «Груз» или «Документы».'],
      ['Вес, места, габариты', 'Обязательно', 'Вес в кг, габариты в см. Если вес указан 0, он будет заменён на 0,1 кг.'],
      ['Объявленная стоимость', 'Для документов OPS/CSE', 'Заполняйте, если нужна объявленная стоимость документов.'],
      ['Страхование', 'Для груза, если требуется страховка', 'Заполняйте сумму страховки. Для ПЭК страхование выбирается как дополнительная услуга.'],
      ['Предпочтительная ТК', 'Необязательно', 'Можно указать ТК для ориентира. Тариф всё равно выбирается после расчёта.'],
      ['Дата и время забора', 'Необязательно в файле', 'Можно оставить пустым и применить общую дату в интерфейсе.']
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Заказы');
    XLSX.utils.book_append_sheet(book, help, 'Поля');
    XLSX.writeFile(book, 'Шаблон_создания_заказов.xlsx', { compression: true });
  }
  async function importFileObject(file) {
    if (state.running) {
      setStatus('Дождитесь завершения текущей обработки перед загрузкой файла.', 'error');
      return;
    }
    if (!file) return;
    try {
      let matrix;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        matrix = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: '', raw: false });
      } else {
        matrix = parseTextTable(await file.text());
      }
      const imported = rowsFromMatrix(matrix);
      if (!imported.length) throw new Error('В файле не найдено строк заказов');
      if (state.settings.takeDate) {
        const takeDate = scheduleDateValue(state.settings.takeDate);
        const takeTimeFrom = timeInputValue(state.settings.takeTimeFrom);
        const takeTimeTo = timeInputValue(state.settings.takeTimeTo);
        imported.forEach(row => {
          row.schedule.takeDate = takeDate;
          if (takeTimeFrom) row.schedule.takeTimeFrom = takeTimeFrom;
          if (takeTimeTo) row.schedule.takeTimeTo = takeTimeTo;
        });
      }
      state.rows.push(...imported);
      if (!state.activeRowId && imported[0]) state.activeRowId = imported[0].id;
      state.page = Math.max(0, Math.ceil(state.rows.length / currentPageSize()) - 1);
      invalidateRowsRenderCache();
      saveStateSoon(120);
      render();
      setStatus(`Импортировано строк: ${imported.length}. Адреса будут распознаны автоматически при наличии DaData token.`, 'ready');
      setTimeout(() => {
        scheduleAutoResolveForRows(imported);
        scheduleAutoCalculateForReadyRows(imported);
      }, 0);
    } catch (error) {
      setStatus(`Ошибка импорта: ${error.message || error}`, 'error');
    }
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    await importFileObject(file);
  }
  function isFileDrag(event) {
    return [...(event.dataTransfer?.types || [])].includes('Files');
  }
  function firstDroppedFile(event) {
    return [...(event.dataTransfer?.files || [])].find(file => /\.(xlsx|xls|csv|tsv|txt)$/i.test(file.name || '')) || event.dataTransfer?.files?.[0] || null;
  }
  function initImportDropZone() {
    const zone = els.fileButton || els.importFileInput?.closest('label');
    if (!zone) return;
    const setActive = active => zone.classList.toggle('drag-over', active && !state.running);
    ['dragenter', 'dragover'].forEach(type => {
      zone.addEventListener(type, event => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = state.running ? 'none' : 'copy';
        setActive(true);
      });
    });
    ['dragleave', 'dragend'].forEach(type => zone.addEventListener(type, () => setActive(false)));
    zone.addEventListener('drop', event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setActive(false);
      const file = firstDroppedFile(event);
      if (!file) {
        setStatus('Перетащите файл XLSX, XLS, CSV, TSV или TXT.', 'error');
        return;
      }
      void importFileObject(file);
    });
    document.addEventListener('dragover', event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      if (!state.rows.length && !state.running && !state.uiBusy) document.body.classList.add('empty-drag-active');
    });
    document.addEventListener('drop', event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      document.body.classList.remove('empty-drag-active');
      if (state.rows.length || state.running || state.uiBusy || zone.contains(event.target)) return;
      const file = firstDroppedFile(event);
      if (file) void importFileObject(file);
    });
    document.addEventListener('dragleave', event => { if (!event.relatedTarget) document.body.classList.remove('empty-drag-active'); });
  }

  function tariffDisplayName(item) {
    return String(item?.tariffCaption || item?.tariffName || item?.urgencyLabel || '').trim() || '—';
  }
  function formatTerm(item) {
    const max = Number(item?.maxPeriod);
    return Number.isFinite(max) && max > 0 ? `${max} дн.` : 'По запросу';
  }
  function tariffKey(item) {
    return [
      item?.deliveryCompany ?? '', item?.deliveryCompanyLabel ?? '', item?.urgencyId ?? '', item?.urgencyLabel ?? '',
      item?.tariffId ?? '', tariffDisplayName(item), item?.deliveryMethod ?? '', item?.deliveryType ?? '', item?.userPrice ?? ''
    ].join('|');
  }
  function tariffSignature(item) {
    return [
      normalize(item?.deliveryCompanyLabel), normalize(tariffDisplayName(item)), normalize(item?.urgencyLabel),
      String(item?.deliveryMethod ?? ''), String(item?.deliveryType ?? '')
    ].join('|');
  }
  function sameNormalizedText(left, right) {
    const normalizedLeft = normalize(left);
    return Boolean(normalizedLeft && normalizedLeft === normalize(right));
  }
  function tariffTitleWithoutUrgency(item) {
    const title = tariffDisplayName(item);
    const urgency = String(item?.urgencyLabel || '').trim();
    return urgency && sameNormalizedText(title, urgency) ? '' : title;
  }
  function tariffLabel(item) {
    return [item.deliveryCompanyLabel || 'ТК', item.urgencyLabel, tariffTitleWithoutUrgency(item), item.deliveryMethodLabel || item.deliveryTypeLabel, formatTerm(item), moneyText(item.userPrice)].filter(Boolean).join(' · ');
  }
  function tariffSearchText(item) {
    return normalize([
      item?.deliveryCompanyLabel,
      item?.urgencyLabel,
      tariffDisplayName(item),
      item?.deliveryMethodLabel,
      item?.deliveryTypeLabel,
      formatTerm(item),
      moneyText(item?.userPrice)
    ].filter(Boolean).join(' '));
  }
  function tariffMatchesSearch(item, query) {
    const tokens = normalize(query).split(' ').filter(Boolean);
    if (!tokens.length) return true;
    const text = tariffSearchText(item);
    return tokens.every(token => text.includes(token));
  }
  function filteredTariffsWithSelected(tariffs, query, selectedKey) {
    const filtered = tariffs.filter(item => tariffMatchesSearch(item, query));
    if (selectedKey && !filtered.some(item => tariffKey(item) === selectedKey)) {
      const selected = tariffs.find(item => tariffKey(item) === selectedKey);
      if (selected) filtered.unshift(selected);
    }
    return filtered;
  }
  function tariffSearchCountText(filteredCount, totalCount, query) {
    if (!totalCount) return 'Нет тарифов дверь-дверь';
    if (!normalize(query)) return `${totalCount} тарифов`;
    return `${Math.min(filteredCount, totalCount)} из ${totalCount}`;
  }
  function tariffEntry(item, value) {
    return {
      value,
      item,
      company: item?.deliveryCompanyLabel || 'ТК',
      urgency: String(item?.urgencyLabel || '').trim(),
      title: tariffTitleWithoutUrgency(item),
      method: item?.deliveryMethodLabel || item?.deliveryTypeLabel || 'Дверь-дверь',
      price: parseNumber(item?.userPrice, 0),
      term: formatTerm(item),
      label: tariffLabel(item)
    };
  }
  function tariffEntryBadges(entry, entries) {
    const prices = entries.map(item => item.price).filter(value => value > 0);
    const terms = entries.map(item => Number(item.item?.maxPeriod)).filter(value => Number.isFinite(value) && value > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const minTerm = terms.length ? Math.min(...terms) : 0;
    const badges = [];
    if (entry.price > 0 && entry.price === minPrice) badges.push('дешёвый');
    if (Number(entry.item?.maxPeriod) > 0 && Number(entry.item.maxPeriod) === minTerm) badges.push('быстрый');
    return badges;
  }
  function tariffComboListMarkup(entries, selectedValue, optionAttr, emptyText = 'Нет тарифов по поиску') {
    if (!entries.length) return `<div class="tariff-combo-empty">${escapeHtml(emptyText)}</div>`;
    const groups = new Map();
    entries.forEach(entry => {
      const key = entry.company || 'ТК';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });
    return [...groups.entries()].map(([company, group]) => `<div class="tariff-combo-group">
      <div class="tariff-combo-group-title">${escapeHtml(company)}</div>
      ${group.map(entry => {
        const badges = tariffEntryBadges(entry, entries);
        return `<button class="tariff-combo-option ${entry.value === selectedValue ? 'selected' : ''}" type="button" ${optionAttr}="${escapeHtml(entry.value)}">
          <span class="tariff-option-main">
            <span class="tariff-option-title ${entry.title ? '' : 'only-badge'}">
              ${entry.urgency ? `<span class="tariff-urgency-badge">${escapeHtml(entry.urgency)}</span>` : ''}
              ${entry.title ? `<strong>${escapeHtml(entry.title)}</strong>` : ''}
            </span>
            <small>${escapeHtml(entry.method)} · ${escapeHtml(entry.term)}</small>
          </span>
          <span class="tariff-option-side"><b>${moneyText(entry.price)}</b>${badges.length ? `<em>${badges.map(escapeHtml).join(' · ')}</em>` : ''}</span>
          ${entry.value === selectedValue ? `<i>${icon('check')}</i>` : ''}
        </button>`;
      }).join('')}
    </div>`).join('');
  }
  function tariffComboSelectedLabel(entries, selectedValue) {
    const selected = entries.find(entry => entry.value === selectedValue);
    return selected?.label || 'Выберите тариф';
  }
  function closeTariffCombos(except = null) {
    $$('.tariff-combo.open').forEach(combo => {
      if (combo === except) return;
      combo.classList.remove('open');
      const menu = combo.querySelector('.tariff-combo-menu');
      if (menu) menu.hidden = true;
      const toggle = combo.querySelector('[data-tariff-combo-toggle], [data-bulk-tariff-toggle]');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }
  function openTariffCombo(combo) {
    if (!combo || combo.classList.contains('disabled')) return;
    closeTariffCombos(combo);
    combo.classList.add('open');
    const menu = combo.querySelector('.tariff-combo-menu');
    if (menu) menu.hidden = false;
    const toggle = combo.querySelector('[data-tariff-combo-toggle], [data-bulk-tariff-toggle]');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    setTimeout(() => combo.querySelector('.tariff-combo-search')?.focus(), 0);
  }
  function toggleTariffCombo(combo) {
    if (!combo || combo.classList.contains('disabled')) return;
    if (combo.classList.contains('open')) closeTariffCombos();
    else openTariffCombo(combo);
  }
  function rowTariffEntries(row) {
    return doorTariffs(row).map(item => tariffEntry(item, tariffKey(item)));
  }
  function filteredRowTariffEntries(row, entries = rowTariffEntries(row)) {
    const filtered = entries.filter(entry => tariffMatchesSearch(entry.item, row.tariffSearch));
    if (row.tariffKey && !filtered.some(entry => entry.value === row.tariffKey)) {
      const selected = entries.find(entry => entry.value === row.tariffKey);
      if (selected) filtered.unshift(selected);
    }
    return filtered;
  }
  function bulkTariffEntries() {
    const rows = state.rows.filter(row => row.selected && row.status !== 'created');
    const seen = new Set();
    const entries = [];
    rows.flatMap(row => doorTariffs(row)).forEach(item => {
      const signature = tariffSignature(item);
      if (seen.has(signature)) return;
      seen.add(signature);
      entries.push(tariffEntry(item, signature));
    });
    return entries;
  }
  function filteredBulkTariffEntries(entries = bulkTariffEntries()) {
    const filtered = entries.filter(entry => tariffMatchesSearch(entry.item, state.bulk.tariffSearch));
    if (state.bulk.tariffSignature && !filtered.some(entry => entry.value === state.bulk.tariffSignature)) {
      const selected = entries.find(entry => entry.value === state.bulk.tariffSignature);
      if (selected) filtered.unshift(selected);
    }
    return filtered;
  }
  function isDoorDoorTariff(item) {
    if (Number(item?.deliveryMethod) === 1) return true;
    const text = normalize([item?.deliveryMethodLabel, item?.deliveryTypeLabel].filter(Boolean).join(' '));
    return text.includes('двер') && !text.includes('склад');
  }
  function companyExcludedFromCreation(company) {
    const name = normalize(company);
    return name.includes('достависта') || name.includes('dostavista') || name.includes('пешкар') || name.includes('yandex') || name.includes('яндекс');
  }
  function doorTariffs(row) {
    return (Array.isArray(row?.result?.allTariffs) ? row.result.allTariffs : [])
      .filter(item => Number(item.userPrice) > 0 && !item.hasError && isDoorDoorTariff(item) && !companyExcludedFromCreation(item.deliveryCompanyLabel));
  }
  function compactOrderService(service) {
    const compactParamOptions = value => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return value;
      return [];
    };
    return {
      key: service?.key || '',
      required: Boolean(service?.required),
      caption: service?.caption || service?.key || '',
      description: String(service?.description || '').slice(0, 700),
      price: service?.price ?? '',
      individualPrice: Boolean(service?.individualPrice),
      params: Array.isArray(service?.params) ? service.params.map(param => ({
        key: param?.key || '',
        caption: param?.caption || param?.key || '',
        type: param?.type || '',
        valueType: param?.valueType || '',
        value: param?.value ?? '',
        defaultValue: param?.defaultValue ?? '',
        required: Boolean(param?.required),
        rules: Array.isArray(param?.rules) ? param.rules : [],
        options: compactParamOptions(param?.options),
        values: compactParamOptions(param?.values)
      })).filter(param => param.key) : [],
      incompatibleServices: Array.isArray(service?.incompatibleServices) ? service.incompatibleServices.map(String).filter(Boolean) : []
    };
  }
  function compactOrderTariff(item, index = 0) {
    return {
      calculatorOrder: index,
      tariffId: item?.tariffId || '',
      deliveryCompany: item?.deliveryCompany ?? '',
      tariffName: item?.tariffName || '',
      urgencyId: item?.urgencyId || '',
      urgencyLabel: item?.urgencyLabel || '',
      tariffCaption: item?.tariffCaption || item?.urgencyLabel || item?.tariffName || '',
      deliveryCompanyLabel: item?.deliveryCompanyLabel || '',
      deliveryCompanyIcon: item?.deliveryCompanyIcon || '',
      deliveryMethod: item?.deliveryMethod,
      deliveryMethodLabel: item?.deliveryMethodLabel || '',
      deliveryType: item?.deliveryType ?? '',
      deliveryTypeLabel: item?.deliveryTypeLabel || '',
      hasError: Boolean(item?.hasError),
      maxPeriod: Number.isFinite(Number(item?.maxPeriod)) ? Number(item.maxPeriod) : null,
      userPrice: Number.isFinite(Number(item?.userPrice)) ? Number(item.userPrice) : 0,
      returnServiceAllowed: Boolean(item?.returnServiceAllowed),
      returnServicePrice: Number.isFinite(Number(item?.returnServicePrice)) ? Number(item.returnServicePrice) : null,
      services: Array.isArray(item?.services) ? item.services.map(compactOrderService) : []
    };
  }
  function compactOrderCalculationResult(result) {
    const source = { ...(result || {}) };
    const allTariffs = (Array.isArray(source.allTariffs) ? source.allTariffs : [])
      .filter(item => Number(item?.userPrice) > 0 && !item?.hasError && isDoorDoorTariff(item) && !companyExcludedFromCreation(item?.deliveryCompanyLabel))
      .map(compactOrderTariff);
    return {
      projectId: source.projectId || '',
      projectLabel: source.projectLabel || '',
      sortStrategy: source.sortStrategy || '',
      bestMethodMode: source.bestMethodMode || 'door',
      calculatedAt: source.calculatedAt || new Date().toISOString(),
      cached: Boolean(source.cached),
      cacheSource: source.cacheSource || '',
      allTariffs
    };
  }
  function cheapestTariff(tariffs) {
    return tariffs.length ? [...tariffs].sort((a, b) => Number(a.userPrice) - Number(b.userPrice))[0] : null;
  }
  function fastestTariff(tariffs) {
    const sorted = [...tariffs].sort((a, b) => {
      const periodA = Number(a.maxPeriod) > 0 ? Number(a.maxPeriod) : Number.POSITIVE_INFINITY;
      const periodB = Number(b.maxPeriod) > 0 ? Number(b.maxPeriod) : Number.POSITIVE_INFINITY;
      return periodA - periodB || Number(a.userPrice) - Number(b.userPrice);
    });
    return sorted[0] || null;
  }
  function cheapestAmongFastestTariff(tariffs) {
    const periods = tariffs.map(item => Number(item.maxPeriod)).filter(value => Number.isFinite(value) && value > 0);
    if (!periods.length) return cheapestTariff(tariffs);
    const fastestPeriod = Math.min(...periods);
    return cheapestTariff(tariffs.filter(item => Number(item.maxPeriod) === fastestPeriod));
  }
  function selectedTariff(row) {
    if (!row) return null;
    const signatureBefore = rowTariffSignature(row);
    const cached = selectedTariffCache.get(row);
    if (cached?.signature === signatureBefore) return cached.value;
    const tariffs = doorTariffs(row);
    if (!tariffs.length) {
      selectedTariffCache.set(row, { signature: signatureBefore, value: null });
      return null;
    }
    const selected = tariffs.find(item => tariffKey(item) === row.tariffKey);
    if (selected) {
      selectedTariffCache.set(row, { signature: signatureBefore, value: selected });
      return selected;
    }
    const hint = normalize(row.deliveryCompanyHint);
    if (hint) {
      const hinted = tariffs.find(item => normalize(item.deliveryCompanyLabel).includes(hint) || hint.includes(normalize(item.deliveryCompanyLabel)));
      if (hinted) {
        row.tariffKey = tariffKey(hinted);
        selectedTariffCache.set(row, { signature: rowTariffSignature(row), value: hinted });
        return hinted;
      }
    }
    const best = cheapestTariff(tariffs);
    if (best) {
      row.tariffKey = tariffKey(best);
    }
    selectedTariffCache.set(row, { signature: rowTariffSignature(row), value: best || null });
    return best;
  }
  function rowPrice(row) {
    const item = selectedTariff(row);
    if (!item) return 0;
    const signature = rowPriceSignature(row, item);
    const cached = rowPriceCache.get(row);
    if (cached?.signature === signature) return cached.value;
    const base = Math.max(0, parseNumber(item.userPrice, 0));
    const services = selectedTariffServices(item)
      .filter(service => serviceEnabled(row, service))
      .reduce((sum, service) => sum + Math.max(0, parseNumber(service.price, 0)), 0);
    const value = base + services;
    rowPriceCache.set(row, { signature, value });
    return value;
  }
  function companyIsFlipPost(company) {
    const name = normalize(company);
    return name.includes('flip') || name.includes('флип');
  }
  function companyIsPek(value) {
    if (value && typeof value === 'object') {
      if (String(value.deliveryCompany || '') === '18') return true;
      return companyIsPek(value.deliveryCompanyLabel || value.company || value.name || '');
    }
    const name = normalize(value);
    return name.includes('пэк') || name.includes('pek');
  }
  function companyAllowsDeclared(company) {
    const name = normalize(company);
    return name.includes('ops') || name.includes('опс') || name.includes('cse') || name.includes('ксэ') || name.includes('ксе') || name.includes('курьер сервис');
  }
  function companyNeedsIdentity(company) {
    const name = normalize(company);
    return name.includes('делов') || name.includes('байкал') || name.includes('пэк') || name.includes('pek');
  }
  function isPhysicalPerson(person) {
    return person?.personType === 'physical';
  }
  function personIdentityValidForCreation(person, item, row) {
    if (isPhysicalPerson(person)) {
      if (companyIsBusinessLine(item?.deliveryCompanyLabel || '')) return true;
      return hasPassport(person);
    }
    return validInn(person.inn);
  }
  function applyIdentityChoice(attrs, prefix, person) {
    const innKey = `${prefix}_inn`;
    const seriesKey = `${prefix}_passport_series`;
    const numberKey = `${prefix}_passport_number`;
    const dateKey = `${prefix}_passport_issue_date`;
    const juridicalKey = `${prefix}_juridical`;
    const isLegal = !isPhysicalPerson(person);
    attrs[juridicalKey] = isLegal ? 1 : 0;
    if (isLegal) {
      if (validInn(person.inn)) attrs[innKey] = sanitizeInn(person.inn);
      else delete attrs[innKey];
      delete attrs[seriesKey];
      delete attrs[numberKey];
      delete attrs[dateKey];
      return;
    }
    delete attrs[innKey];
    if (!hasPassport(person)) {
      delete attrs[seriesKey];
      delete attrs[numberKey];
      delete attrs[dateKey];
    }
  }
  function allowedValueModes(row, item = selectedTariff(row)) {
    const company = item?.deliveryCompanyLabel || '';
    if (companyIsFlipPost(company)) return ['none'];
    if (companyIsPek(item || company)) return ['none'];
    const allowsDeclared = companyAllowsDeclared(company);
    if (allowsDeclared) {
      return normalizeCargoType(row.cargo.type) === 'documents' ? ['none', 'declared'] : ['none', 'declared', 'insurance'];
    }
    return ['none', 'insurance'];
  }
  function normalizeValueMode(row, item = selectedTariff(row)) {
    const allowed = allowedValueModes(row, item);
    if (!allowed.includes(row.cargo.valueMode)) {
      if (row.cargo.valueMode === 'insurance' && allowed.includes('declared')) row.cargo.valueMode = 'declared';
      else if (row.cargo.valueMode === 'declared' && allowed.includes('insurance')) row.cargo.valueMode = 'insurance';
      else row.cargo.valueMode = allowed[0];
    }
    return row.cargo.valueMode;
  }

  function renderSettings() {
    els.projectSelect.innerHTML = state.projects.map(project => `<option value="${escapeHtml(project.id)}" ${project.id === state.settings.projectId ? 'selected' : ''}>${escapeHtml(project.label)}</option>`).join('');
    renderSettingsProjectTabs();
    els.emailInput.value = state.settings.email;
    els.passwordInput.value = state.settings.password;
    els.dadataInput.value = state.settings.tokenDaData;
    els.innInput.value = sanitizeInn(state.settings.userInn);
    els.concurrencySelect.value = String(state.settings.concurrency || 3);
    if (els.timeoutInput) els.timeoutInput.value = String(calculationTimeoutMs());
    if (els.retriesSelect) els.retriesSelect.value = String(calculationRetries());
    if (els.densitySelect) els.densitySelect.value = ['comfortable', 'compact', 'dense'].includes(state.settings.density) ? state.settings.density : 'comfortable';
    if (els.showOnboardingInput) els.showOnboardingInput.checked = state.settings.showOnboarding !== false;
    if (els.performanceModeInput) els.performanceModeInput.checked = Boolean(state.settings.performanceMode);
    const today = todayInputDate();
    els.defaultTakeDate.min = today;
    els.defaultTakeDate.value = state.settings.takeDate ? clampDateNotPast(dateInputValue(state.settings.takeDate)) : '';
    els.defaultTimeFrom.value = timeInputValue(state.settings.takeTimeFrom);
    els.defaultTimeTo.value = timeInputValue(state.settings.takeTimeTo);
    if (els.autoCalculateInput) els.autoCalculateInput.checked = Boolean(state.settings.autoCalculate);
    if (els.settingsAuthStatus) {
      els.settingsAuthStatus.className = 'settings-auth-status';
      els.settingsAuthStatus.textContent = state.settings.authChecked ? 'Доступ проверен' : 'Доступ не проверен';
      els.settingsAuthStatus.classList.toggle('ready', Boolean(state.settings.authChecked));
    }
    renderClient();
    applyTheme();
    hydrateIcons();
  }
  function renderSettingsProjectTabs() {
    if (!els.settingsProjectTabs) return;
    els.settingsProjectTabs.innerHTML = state.projects.map(project => {
      const ready = project.id === state.settings.projectId && state.settings.userId ? 'выбран' : 'доступ';
      return `<button class="project-settings-button ${project.id === state.settings.projectId ? 'active' : ''}" type="button" data-settings-project="${escapeHtml(project.id)}">${escapeHtml(project.shortLabel || project.label)} <small>${escapeHtml(ready)}</small></button>`;
    }).join('');
  }
  function renderClient() {
    const ready = Boolean(state.settings.userId);
    els.clientResult.classList.toggle('ready', ready);
    els.clientResult.classList.toggle('error', !ready && Boolean(state.settings.userInn));
    els.clientResult.textContent = ready
      ? (state.settings.userDisplay || 'Клиент выбран')
      : state.settings.userInn ? 'ИНН введён, но клиент не выбран. Нажмите «Найти».' : 'Клиент не выбран';
  }
  function bulkServiceParamInputMarkup(fakeRow, service, param) {
    const value = serviceParamValue(fakeRow, service, param);
    const required = serviceParamRequired(param);
    const label = labelTitle(param.caption || param.key || 'Параметр', required);
    const common = `data-bulk-service-param="${escapeHtml(service.key)}" data-param-key="${escapeHtml(param.key || '')}" ${required ? 'required aria-required="true"' : ''}`;
    if (serviceParamIsBoolean(param)) {
      return `<label class="check-line bulk-service-param-check"><input type="checkbox" ${common} ${value === true || value === 'true' || value === 1 || value === '1' ? 'checked' : ''}><span>${label}</span></label>`;
    }
    if (serviceParamIsRadio(param)) {
      const options = serviceParamOptions(param);
      const current = String(value ?? serviceParamDefaultValue(param) ?? '');
      const name = `bulk-service-${service.key}-${param.key}`;
      return `<div class="service-param-choice"><span>${label}</span><div class="service-param-radio-group">${options.map(option => serviceParamRadioMarkup({ value: option.value, label: option.label, common, name, checked: current === String(option.value) || (serviceParamIsBoolean(param) && String(Boolean(current === true || current === 'true' || current === 1 || current === '1')) === String(option.value)) })).join('')}</div></div>`;
    }
    const type = serviceParamIsNumeric(param) ? 'number' : 'text';
    const inputMode = serviceParamIsNumeric(param) ? 'decimal' : 'text';
    return `<label>${label}<input type="${type}" inputmode="${inputMode}" ${common} value="${escapeHtml(value)}"></label>`;
  }
  function bulkCompanyServiceParamInputMarkup(company, fakeRow, service, param) {
    const value = serviceParamValue(fakeRow, service, param);
    const required = serviceParamRequired(param);
    const label = labelTitle(param.caption || param.key || 'Параметр', required);
    const common = `data-bulk-company-service-param="${escapeHtml(service.key)}" data-bulk-service-company="${escapeHtml(company)}" data-param-key="${escapeHtml(param.key || '')}" ${required ? 'required aria-required="true"' : ''}`;
    if (serviceParamIsBoolean(param)) {
      return `<label class="check-line bulk-service-param-check"><input type="checkbox" ${common} ${value === true || value === 'true' || value === 1 || value === '1' ? 'checked' : ''}><span>${label}</span></label>`;
    }
    if (serviceParamIsRadio(param)) {
      const options = serviceParamOptions(param);
      const current = String(value ?? serviceParamDefaultValue(param) ?? '');
      const name = `bulk-company-service-${company}-${service.key}-${param.key}`;
      return `<div class="service-param-choice"><span>${label}</span><div class="service-param-radio-group">${options.map(option => serviceParamRadioMarkup({ value: option.value, label: option.label, common, name, checked: current === String(option.value) || (serviceParamIsBoolean(param) && String(Boolean(current === true || current === 'true' || current === 1 || current === '1')) === String(option.value)) })).join('')}</div></div>`;
    }
    const type = serviceParamIsNumeric(param) ? 'number' : 'text';
    const inputMode = serviceParamIsNumeric(param) ? 'decimal' : 'text';
    return `<label>${label}<input type="${type}" inputmode="${inputMode}" ${common} value="${escapeHtml(value)}"></label>`;
  }
  function bulkServiceCatalogCacheSignature(rows) {
    return rows.map(row => [
      row.id,
      row.status,
      row.selected ? 1 : 0,
      row.result?.calculatedAt || '',
      row.result?.allTariffs?.length || 0
    ].join(':')).join('|');
  }
  function bulkServiceCatalogByCompany() {
    const rows = state.rows.filter(row => row.selected && row.status !== 'created');
    const cacheKey = bulkServiceCatalogCacheSignature(rows);
    if (cacheKey && cacheKey === bulkServiceCatalogKey) return bulkServiceCatalogCache;
    // Каталог услуг строится по выбранным строкам один раз и кешируется, чтобы раскрытие групп не сканировало сотни заказов заново.
    const groups = new Map();
    const processedTariffs = new Set();
    rows.forEach(row => {
      doorTariffs(row).forEach(item => {
        const company = item.deliveryCompanyLabel || 'ТК';
        const uniqueTariffKey = `${company}|${tariffSignature(item)}|${tariffKey(item)}`;
        if (processedTariffs.has(uniqueTariffKey)) return;
        processedTariffs.add(uniqueTariffKey);
        if (!groups.has(company)) groups.set(company, { company, services: new Map(), tariffs: 0 });
        const group = groups.get(company);
        group.tariffs += 1;
        selectedTariffServices(item).forEach(service => {
          if (!service?.key) return;
          const sourceKey = String(service.key);
          const key = bulkServiceKey(service);
          const existing = group.services.get(key);
          if (!existing) {
            group.services.set(key, {
              ...service,
              key,
              sourceKeys: new Set([sourceKey]),
              prices: new Set([service.price].filter(value => value !== '' && value !== null && value !== undefined)),
              count: 1,
              searchText: normalize([company, service.caption, service.title, service.name, key, sourceKey, service.description].filter(Boolean).join(' '))
            });
          } else {
            existing.count += 1;
            existing.sourceKeys.add(sourceKey);
            if (service.price !== '' && service.price !== null && service.price !== undefined) existing.prices.add(service.price);
            existing.required = Boolean(existing.required && service.required);
            if (!existing.params?.length && Array.isArray(service.params)) existing.params = service.params;
            if (!existing.description && service.description) existing.description = service.description;
            existing.incompatibleServices = [...new Set([...(existing.incompatibleServices || []), ...(service.incompatibleServices || [])])];
            existing.searchText = '';
          }
        });
      });
    });
    const catalog = [...groups.values()]
      .map(group => ({
        ...group,
        services: [...group.services.values()].map(service => ({
          ...service,
          searchText: service.searchText || normalize([group.company, service.caption, service.title, service.name, service.key, service.description, [...(service.sourceKeys || [])].join(' ')].filter(Boolean).join(' '))
        }))
      }))
      .filter(group => group.services.length)
      .sort((a, b) => a.company.localeCompare(b.company, 'ru'));
    bulkServiceCatalogKey = cacheKey;
    bulkServiceCatalogCache = catalog;
    return catalog;
  }
  function assignedBulkServiceCompanies() {
    const companies = new Set();
    state.rows.filter(row => row.selected && row.status !== 'created').forEach(row => {
      const item = doorTariffs(row).find(tariff => tariffKey(tariff) === row.tariffKey);
      if (item?.deliveryCompanyLabel) companies.add(item.deliveryCompanyLabel);
    });
    return companies;
  }
  function visibleBulkServiceGroups(groups = bulkServiceCatalogByCompany()) {
    if (!state.bulk.servicesOnlyAssigned) return groups;
    const assigned = assignedBulkServiceCompanies();
    return groups.filter(group => assigned.has(group.company));
  }
  function bulkServiceMatchesSearch(group, service, query) {
    if (!query) return true;
    return String(service.searchText || '').includes(query);
  }
  function servicePriceSummary(service) {
    const prices = [...(service.prices || [])].map(value => parseNumber(value, 0)).filter(value => value > 0);
    if (!prices.length && service.price !== '' && service.price !== null && service.price !== undefined) return moneyText(service.price);
    if (!prices.length) return 'по запросу';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? moneyText(min) : `${moneyText(min)}–${moneyText(max)}`;
  }
  function rememberBulkServiceIdentity(stateItem, service) {
    stateItem.sourceKeys = [...serviceIdentityKeys(service)];
    return stateItem;
  }
  function bulkCompanyServiceCardMarkup(group, fakeRow, service) {
    const enabled = serviceEnabled(fakeRow, service);
    const required = Boolean(service.required);
    const params = Array.isArray(service.params) ? service.params : [];
    const blockedBy = !enabled && !required ? serviceConflictSource(fakeRow, service, group.services) : null;
    const price = servicePriceSummary(service);
    return `<div class="bulk-service-card ${enabled ? 'enabled' : ''} ${blockedBy ? 'blocked' : ''}">
      <label class="bulk-service-option">
        <input type="checkbox" data-bulk-company-service-key="${escapeHtml(service.key)}" data-bulk-service-company="${escapeHtml(group.company)}" ${enabled ? 'checked' : ''} ${required || blockedBy ? 'disabled' : ''}>
        <span><b>${escapeHtml(service.caption || service.key)}</b>${blockedBy ? `<small>Недоступно вместе с «${escapeHtml(blockedBy.caption || blockedBy.key)}»</small>` : ''}</span>
        <em>${escapeHtml(price)}</em>
      </label>
      ${enabled && params.length ? `<div class="bulk-service-params">${params.map(param => bulkCompanyServiceParamInputMarkup(group.company, fakeRow, service, param)).join('')}</div>` : ''}
    </div>`;
  }
  function bulkCompanyServiceListMarkup(group) {
    const fakeRow = { services: state.bulk.companyServices[group.company] || {} };
    const limitKey = `${group.company}|${normalize(state.bulk.servicesSearch || '')}`;
    const limit = Math.min(group.services.length, bulkServiceVisibleLimits.get(limitKey) || servicesRenderChunk());
    const visibleServices = group.services.slice(0, limit);
    const rest = group.services.length - visibleServices.length;
    return `<div class="bulk-company-service-list">
      ${visibleServices.map(service => bulkCompanyServiceCardMarkup(group, fakeRow, service)).join('')}
      ${rest > 0 ? `<button class="button secondary mini bulk-services-more" type="button" data-show-more-bulk-services="${escapeHtml(group.company)}">Показать ещё ${escapeHtml(Math.min(rest, servicesRenderChunk()))} из ${escapeHtml(rest)}</button>` : ''}
    </div>`;
  }
  function bulkCompanyServiceGroupMarkup(group, query, openCompanies) {
    const isOpen = Boolean(query || openCompanies.has(group.company));
    return `<section class="bulk-company-services ${isOpen ? 'is-open' : ''}" data-bulk-services-company="${escapeHtml(group.company)}">
      <button class="bulk-company-services-summary" type="button" data-bulk-services-toggle="${escapeHtml(group.company)}" aria-expanded="${isOpen ? 'true' : 'false'}"><b>${escapeHtml(group.company)}</b><span>${escapeHtml(group.services.length)} услуг · ${escapeHtml(group.tariffs)} тарифов</span></button>
      ${isOpen ? bulkCompanyServiceListMarkup(group) : ''}
    </section>`;
  }
  function bulkCompanyServiceGroupByCompany(company) {
    return bulkServiceCatalogByCompany().find(group => group.company === company) || null;
  }
  function bulkCompanyServiceRenderGroupByCompany(company) {
    const query = normalize(state.bulk.servicesSearch || '');
    const group = visibleBulkServiceGroups(bulkServiceCatalogByCompany()).find(candidate => candidate.company === company);
    if (!group) return null;
    const services = query ? group.services.filter(service => bulkServiceMatchesSearch(group, service, query)) : group.services;
    return services.length ? { ...group, services } : null;
  }
  function bulkCompanyServiceSection(company) {
    if (!els.bulkServicesPanel) return null;
    return [...els.bulkServicesPanel.querySelectorAll('[data-bulk-services-company]')]
      .find(section => section.dataset.bulkServicesCompany === company) || null;
  }
  function refreshBulkCompanyServiceGroup(company) {
    const section = bulkCompanyServiceSection(company);
    const group = bulkCompanyServiceRenderGroupByCompany(company);
    if (!section || !group) {
      scheduleBulkServicesRender();
      return;
    }
    const isOpen = section.classList.contains('is-open');
    const query = normalize(state.bulk.servicesSearch || '');
    section.outerHTML = bulkCompanyServiceGroupMarkup(group, query, new Set(isOpen ? [company] : []));
  }
  function setBulkServicesCompanyOpen(company, open) {
    const section = bulkCompanyServiceSection(company);
    const group = bulkCompanyServiceRenderGroupByCompany(company);
    if (!section || !group) return;
    section.classList.toggle('is-open', open);
    section.querySelector('[data-bulk-services-toggle]')?.setAttribute('aria-expanded', open ? 'true' : 'false');
    const list = section.querySelector('.bulk-company-service-list');
    if (open && !list) section.insertAdjacentHTML('beforeend', bulkCompanyServiceListMarkup(group));
    if (!open && list) list.remove();
  }
  function renderBulkServices() {
    if (!els.bulkServicesPanel) return;
    const allGroups = bulkServiceCatalogByCompany();
    const groups = visibleBulkServiceGroups(allGroups);
    const search = String(state.bulk.servicesSearch || '');
    const query = normalize(search);
    state.bulk.services = normalizeRowServices(state.bulk.services);
    state.bulk.companyServices = normalizeCompanyServices(state.bulk.companyServices);
    const validCompanies = new Set(allGroups.map(group => group.company));
    Object.keys(state.bulk.companyServices).forEach(company => { if (!validCompanies.has(company)) delete state.bulk.companyServices[company]; });
    allGroups.forEach(group => {
      const validKeys = new Set(group.services.map(service => String(service.key)));
      const saved = state.bulk.companyServices[group.company] || {};
      Object.keys(saved).forEach(key => { if (!validKeys.has(String(key))) delete saved[key]; });
    });
    if (!allGroups.length) {
      els.bulkServicesPanel.hidden = true;
      els.bulkServicesPanel.innerHTML = '';
      return;
    }
    const visibleGroups = groups
      .map(group => ({ ...group, services: group.services.filter(service => bulkServiceMatchesSearch(group, service, query)) }))
      .filter(group => group.services.length);
    els.bulkServicesPanel.hidden = false;
    const openCompanies = new Set(state.bulk.servicesOpenCompanies || []);
    const assignedCount = assignedBulkServiceCompanies().size;
    const serviceActionsDisabled = state.running || !groups.length;
    const visibleServiceCount = groups.reduce((sum, group) => sum + group.services.length, 0);
    els.bulkServicesPanel.innerHTML = `<div class="bulk-services-head">
        <div><b>Доп. услуги по ТК</b><small>${escapeHtml(groups.length)} ТК · ${escapeHtml(visibleServiceCount)} услуг</small></div>
      </div>
      <label class="bulk-services-filter check-line">
        <input type="checkbox" data-bulk-services-only-assigned ${state.bulk.servicesOnlyAssigned ? 'checked' : ''}>
        <span>Только ТК, выбранные в заказах${assignedCount ? ` (${escapeHtml(assignedCount)})` : ''}</span>
      </label>
      <input class="bulk-services-search" data-bulk-services-search placeholder="Найти услугу или ТК..." value="${escapeHtml(search)}">
      <div class="bulk-services-list">
        ${visibleGroups.length ? visibleGroups.map(group => bulkCompanyServiceGroupMarkup(group, query, openCompanies)).join('') : `<div class="empty-mini">${state.bulk.servicesOnlyAssigned && !assignedCount ? 'Сначала примените или выберите тарифы в заказах.' : 'Нет услуг по поиску.'}</div>`}
      </div>
      <div class="bulk-services-actions">
        <button class="button secondary mini" type="button" data-select-all-bulk-services ${serviceActionsDisabled ? 'disabled' : ''}>Выбрать все услуги</button>
        <button class="button ghost mini" type="button" data-clear-bulk-services ${serviceActionsDisabled ? 'disabled' : ''}>Снять услуги</button>
        <button class="button primary mini apply-action-button" type="button" data-apply-bulk-services ${state.running ? 'disabled' : ''}>${icon('check')} Применить услуги к выбранным</button>
      </div>`;
  }
  function scheduleBulkServicesRender() {
    if (bulkServicesRenderFrame) return;
    bulkServicesRenderFrame = requestAnimationFrame(() => {
      bulkServicesRenderFrame = 0;
      renderBulkServices();
    });
  }
  function scheduleBulkControlsRender() {
    if (bulkControlsRenderFrame) return;
    bulkControlsRenderFrame = requestAnimationFrame(() => {
      bulkControlsRenderFrame = 0;
      renderBulkControls();
    });
  }
  function captureBulkServicesOpenCompanies() {
    if (!els.bulkServicesPanel) return;
    state.bulk.servicesOpenCompanies = [...els.bulkServicesPanel.querySelectorAll('.bulk-company-services.is-open')]
      .map(item => item.dataset.bulkServicesCompany)
      .filter(Boolean);
  }
  function selectAllBulkServices(enabled) {
    captureBulkServicesOpenCompanies();
    state.bulk.companyServices = normalizeCompanyServices(state.bulk.companyServices);
    visibleBulkServiceGroups().forEach(group => {
      if (!state.bulk.companyServices[group.company]) state.bulk.companyServices[group.company] = {};
      const fakeRow = { services: state.bulk.companyServices[group.company] };
      group.services.forEach(service => {
        const stateItem = bulkCompanyServiceState(group.company, service.key);
        if (service.required) {
          rememberBulkServiceIdentity(stateItem, service).enabled = true;
          return;
        }
        if (!enabled) {
          stateItem.enabled = false;
          return;
        }
        if (serviceConflictSource(fakeRow, service, group.services)) return;
        rememberBulkServiceIdentity(stateItem, service).enabled = true;
      });
    });
    saveStateSoon(250);
    scheduleBulkServicesRender();
  }
  function updateBulkServiceParam(control) {
    const serviceKey = control?.dataset?.bulkServiceParam;
    const paramKey = control?.dataset?.paramKey;
    if (!serviceKey || !paramKey) return false;
    state.bulk.services = normalizeRowServices(state.bulk.services);
    rowServiceState({ services: state.bulk.services }, serviceKey).params[paramKey] = control.type === 'checkbox' ? control.checked : control.value;
    saveStateSoon(250);
    return true;
  }
  function updateBulkCompanyServiceParam(control) {
    const company = control?.dataset?.bulkServiceCompany;
    const serviceKey = control?.dataset?.bulkCompanyServiceParam;
    const paramKey = control?.dataset?.paramKey;
    if (!company || !serviceKey || !paramKey) return false;
    state.bulk.companyServices = normalizeCompanyServices(state.bulk.companyServices);
    bulkCompanyServiceState(company, serviceKey).params[paramKey] = control.type === 'checkbox' ? control.checked : control.value;
    saveStateSoon(250);
    return true;
  }
  function updateBulkCompanyServiceCheckbox(companyCheckbox) {
    const company = companyCheckbox?.dataset?.bulkServiceCompany;
    const key = companyCheckbox?.dataset?.bulkCompanyServiceKey;
    if (!company || !key) return false;
    captureBulkServicesOpenCompanies();
    const group = bulkServiceCatalogByCompany().find(candidate => candidate.company === company);
    const services = group?.services || [];
    const service = services.find(candidate => String(candidate.key) === String(key));
    if (!service) return false;
    state.bulk.companyServices = normalizeCompanyServices(state.bulk.companyServices);
    const stateItem = bulkCompanyServiceState(company, key);
    rememberBulkServiceIdentity(stateItem, service);
    stateItem.enabled = Boolean(companyCheckbox.checked || service.required);
    if (stateItem.enabled) {
      serviceIncompatibleKeys(service, services).forEach(incompatibleKey => {
        const incompatible = bulkCompanyServiceState(company, incompatibleKey);
        if (incompatible) incompatible.enabled = false;
      });
    }
    companyCheckbox.checked = stateItem.enabled;
    companyCheckbox.closest('.bulk-service-card')?.classList.toggle('enabled', stateItem.enabled);
    saveStateSoon(250);
    const needsRefresh = Boolean((service.params || []).length || serviceIncompatibleKeys(service, services).size);
    if (needsRefresh) refreshBulkCompanyServiceGroup(company);
    return true;
  }
  function renderBulkControls() {
    const rows = state.rows.filter(row => row.selected && row.status !== 'created');
    const tariffs = rows.flatMap(row => doorTariffs(row));
    const companies = [...new Set(tariffs.map(item => item.deliveryCompanyLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    if (!companies.includes(state.bulk.company)) state.bulk.company = companies[0] || '';
    state.bulk.preferredCompanies = (state.bulk.preferredCompanies || []).filter(company => companies.includes(company));
    if (!state.bulk.preferredCompaniesTouched && companies.length) state.bulk.preferredCompanies = [...companies];
    if (state.bulk.mode === 'cheapest') state.bulk.mode = 'preferred-cheapest';
    if (state.bulk.mode === 'fastest') state.bulk.mode = 'preferred-fastest';
    if (!['preferred-cheapest', 'preferred-fastest', 'preferred-fast-cheapest', 'manual'].includes(state.bulk.mode)) state.bulk.mode = 'preferred-cheapest';
    els.bulkTariffMode.value = state.bulk.mode;
    els.bulkCompanySelect.innerHTML = companies.length ? companies.map(company => `<option value="${escapeHtml(company)}" ${company === state.bulk.company ? 'selected' : ''}>${escapeHtml(company)}</option>`).join('') : '<option value="">Нет рассчитанных ТК</option>';
    els.bulkPreferredCompanies.innerHTML = companies.length ? companies.map(company => `<option value="${escapeHtml(company)}" ${(state.bulk.preferredCompanies || []).includes(company) ? 'selected' : ''}>${escapeHtml(company)}</option>`).join('') : '<option value="">Нет рассчитанных ТК</option>';
    if (els.bulkPreferredList) {
      els.bulkPreferredList.innerHTML = companies.length ? companies.map(company => `<label class="check-line preferred-company"><input type="checkbox" data-preferred-company value="${escapeHtml(company)}" ${(state.bulk.preferredCompanies || []).includes(company) ? 'checked' : ''}><span>${escapeHtml(company)}</span></label>`).join('') : '<div class="empty-mini">Нет рассчитанных ТК</div>';
      els.bulkPreferredList.classList.toggle('short-list', companies.length > 0 && companies.length < 15);
    }
    const uniqueTariffs = [];
    const seen = new Set();
    tariffs.forEach(item => {
      const signature = tariffSignature(item);
      if (seen.has(signature)) return;
      seen.add(signature);
      uniqueTariffs.push({ signature, item, label: tariffLabel(item) });
    });
    if (!uniqueTariffs.some(item => item.signature === state.bulk.tariffSignature)) state.bulk.tariffSignature = uniqueTariffs[0]?.signature || '';
    state.bulk.tariffSearch = String(state.bulk.tariffSearch || '');
    const filteredUniqueTariffs = uniqueTariffs.filter(item => tariffMatchesSearch(item.item, state.bulk.tariffSearch));
    const selectedUniqueTariff = uniqueTariffs.find(item => item.signature === state.bulk.tariffSignature);
    if (selectedUniqueTariff && !filteredUniqueTariffs.some(item => item.signature === selectedUniqueTariff.signature)) {
      filteredUniqueTariffs.unshift(selectedUniqueTariff);
    }
    if (els.bulkTariffCombo) {
      const entries = uniqueTariffs.map(item => tariffEntry(item.item, item.signature));
      const filteredEntries = filteredUniqueTariffs.map(item => tariffEntry(item.item, item.signature));
      els.bulkTariffCombo.innerHTML = `<button class="tariff-combo-button" type="button" data-bulk-tariff-toggle data-tariff-combo-toggle aria-expanded="false">
          <span class="tariff-combo-value">${escapeHtml(tariffComboSelectedLabel(entries, state.bulk.tariffSignature))}</span>
          ${icon('chevron-right')}
        </button>
        <div class="tariff-combo-menu" hidden>
          <input class="tariff-combo-search" data-bulk-tariff-search placeholder="Найти тариф, ТК, срок или цену..." value="${escapeHtml(state.bulk.tariffSearch)}">
          <div class="tariff-combo-meta">${escapeHtml(tariffSearchCountText(filteredEntries.length, uniqueTariffs.length, state.bulk.tariffSearch))}</div>
          <div class="tariff-combo-list">${tariffComboListMarkup(filteredEntries, state.bulk.tariffSignature, 'data-bulk-tariff-option', uniqueTariffs.length ? 'Нет тарифов по поиску' : 'Нет тарифов дверь-дверь')}</div>
        </div>`;
    }
    const preferredMode = state.bulk.mode !== 'manual';
    if (els.bulkCompanySelect) els.bulkCompanySelect.disabled = true;
    els.bulkPreferredCompanies.disabled = !preferredMode;
    if (els.bulkPreferredList) els.bulkPreferredList.classList.toggle('disabled', !preferredMode);
    if (els.selectAllPreferredBtn) els.selectAllPreferredBtn.disabled = !preferredMode || !companies.length;
    if (els.clearPreferredBtn) els.clearPreferredBtn.disabled = !preferredMode || !companies.length;
    if (els.bulkTariffCombo) els.bulkTariffCombo.classList.toggle('disabled', state.bulk.mode !== 'manual');
    renderBulkServices();
  }
  function availablePreferredCompanies() {
    const rows = state.rows.filter(row => row.selected && row.status !== 'created');
    return [...new Set(rows.flatMap(row => doorTariffs(row)).map(item => item.deliveryCompanyLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  }
  function setPreferredCompanies(companies) {
    state.bulk.preferredCompanies = companies;
    state.bulk.preferredCompaniesTouched = true;
    saveStateSoon(250);
    scheduleBulkControlsRender();
  }
  function matchesStatusFilter(row) {
    const filter = state.filter.status || 'all';
    if (filter === 'all') return true;
    if (filter === 'problem') return Boolean(rowIssue(row));
    return row.status === filter;
  }
  function filteredRows() {
    const duplicateIds = state.filter.status === 'duplicate' ? duplicateRowIdSets().duplicateIds : null;
    const rows = duplicateIds
      ? state.rows.filter(row => duplicateIds.has(row.id))
      : state.rows.filter(matchesStatusFilter);
    const sort = state.filter.sort || 'index';
    const statusRank = row => ({ error: 0, running: 1, imported: 2, calculated: 3, created: 4 }[row.status] ?? 5);
    return [...rows].sort((a, b) => {
      if (sort === 'status') return statusRank(a) - statusRank(b) || a.index - b.index;
      if (sort === 'price-asc') return rowPrice(a) - rowPrice(b) || a.index - b.index;
      if (sort === 'price-desc') return rowPrice(b) - rowPrice(a) || a.index - b.index;
      return a.index - b.index;
    });
  }
  const DETAIL_TAB_LABELS = {
    cargo: 'Груз',
    sender: 'Отправитель',
    recipient: 'Получатель',
    cost: 'Груз',
    services: 'Услуги'
  };
  function tabFromError(message) {
    const text = String(message || '').toLowerCase();
    if (/отправител/.test(text)) return 'sender';
    if (/получател|инн|паспорт/.test(text)) return 'recipient';
    if (/услуг/.test(text)) return 'services';
    if (/стоим|страх|объяв/.test(text)) return 'cargo';
    return 'cargo';
  }
  function issueTabTitle(issue) {
    return DETAIL_TAB_LABELS[issue?.tab] || 'Груз';
  }
  function uniqueIssueTitles(issues) {
    return [...new Set((issues || []).map(issueTabTitle).filter(Boolean))];
  }
  function issueSectionsText(issues) {
    const titles = uniqueIssueTitles(issues);
    if (!titles.length) return 'раздел';
    if (titles.length === 1) return `раздел «${titles[0]}»`;
    return `разделы ${titles.map(title => `«${title}»`).join(', ')}`;
  }
  function issueSummaryText(issues) {
    const grouped = new Map();
    (issues || []).forEach(issue => {
      const title = issueTabTitle(issue);
      const message = String(issue?.message || '').trim();
      if (!message) return;
      if (!grouped.has(title)) grouped.set(title, []);
      const messages = grouped.get(title);
      if (!messages.includes(message)) messages.push(message);
    });
    return [...grouped.entries()]
      .map(([title, messages]) => `${title}: ${messages.join('; ')}`)
      .join('. ');
  }
  function rowIssueTabs(row) {
    return new Set(cachedRowIssues(row).map(issue => issue.tab).filter(Boolean));
  }
  function moveRowToIssueTab(row) {
    const issue = rowIssue(row);
    if (issue?.tab) row.uiTab = issue.tab;
    return issue;
  }
  function rowIssues(row) {
    if (!row || row.status === 'created') return [];
    const issues = [];
    const addIssue = issue => {
      if (!issue?.tab) return;
      const message = String(issue.message || '').trim();
      const duplicate = issues.some(item => item.kind === issue.kind && item.tab === issue.tab && item.message === message);
      if (!duplicate) issues.push({ ...issue, message });
    };
    if (row.status === 'error' && row.error) {
      const tab = tabFromError(row.error);
      addIssue({ kind: 'error', tab, title: issueTabTitle({ tab }), message: row.error });
    }
    const senderMissing = personMissingRequiredFields(row.sender);
    if (senderMissing.length) addIssue({ kind: 'fields', tab: 'sender', title: 'Отправитель', message: `Заполните ${senderMissing.join(', ')}` });
    const recipientMissing = personMissingRequiredFields(row.recipient);
    if (recipientMissing.length) addIssue({ kind: 'fields', tab: 'recipient', title: 'Получатель', message: `Заполните ${recipientMissing.join(', ')}` });
    const cargoMissing = cargoMissingRequiredFields(row);
    if (cargoMissing.length) addIssue({ kind: 'fields', tab: 'cargo', title: 'Груз', message: `Заполните ${cargoMissing.join(', ')}` });
    if (!row.sender.resolved && !personMissingAddressFields(row.sender).length) {
      addIssue({ kind: 'address', tab: 'sender', title: 'Отправитель', message: 'Распознайте город и адрес' });
    }
    if (!row.recipient.resolved && !personMissingAddressFields(row.recipient).length) {
      addIssue({ kind: 'address', tab: 'recipient', title: 'Получатель', message: 'Распознайте город и адрес' });
    }
    const tariffs = doorTariffs(row);
    const hasBlockingInputIssues = issues.some(issue => issue.kind === 'fields' || issue.kind === 'address');
    if (!tariffs.length && !hasBlockingInputIssues) addIssue({ kind: 'tariff', tab: 'cargo', title: 'Тарифы', message: 'Рассчитайте тарифы дверь-дверь' });
    const item = selectedTariff(row);
    if (item && companyNeedsIdentity(item.deliveryCompanyLabel) && !personIdentityValidForCreation(row.recipient, item, row)) {
      addIssue({ kind: 'identity', tab: 'recipient', title: 'Получатель', message: row.recipient.personType === 'physical' ? 'Укажите паспорт получателя' : 'Укажите ИНН получателя-юрлица' });
    }
    return issues;
  }
  function rowIssue(row) {
    return cachedRowIssues(row)[0] || null;
  }
  function attentionItems() {
    return state.rows.map(row => {
      const issues = cachedRowIssues(row);
      return { row, issue: issues[0], issues };
    }).filter(item => item.issue);
  }
  function collectWorkflowStats() {
    const stats = {
      total: state.rows.length,
      resolved: 0,
      calculated: 0,
      issues: 0,
      ready: 0,
      selected: 0,
      selectedTotal: 0,
      created: 0,
      errors: 0,
      attention: [],
      clientReady: Boolean(state.settings.userId),
      setupReady: Boolean(state.settings.takeDate && state.bulk.mode)
    };
    state.rows.forEach(row => {
      if (row.status === 'created') {
        row.selected = false;
        stats.created += 1;
      }
      if (row.status === 'error') stats.errors += 1;
      if (row.sender?.resolved && row.recipient?.resolved) stats.resolved += 1;
      if (doorTariffs(row).length) stats.calculated += 1;
      const issues = cachedRowIssues(row);
      if (issues.length) {
        stats.issues += 1;
        stats.attention.push({ row, issue: issues[0], issues });
      } else if (row.status !== 'created') {
        stats.ready += 1;
      }
      if (row.selected && row.status !== 'created') {
        stats.selected += 1;
        stats.selectedTotal += rowPrice(row);
      }
    });
    return stats;
  }
  function enterReviewMode(focusFirst = true) {
    const first = attentionItems()[0];
    state.reviewMode = true;
    state.viewMode = 'cards';
    state.filter.status = 'problem';
    state.filter.sort = 'status';
    state.page = 0;
    if (first?.row?.id) {
      state.activeRowId = first.row.id;
      moveRowToIssueTab(first.row);
    }
    saveStateSoon(250);
    if (focusFirst && first?.row?.id) focusRow(first.row.id);
    else renderOrderWorkspace();
  }
  function exitReviewMode() {
    state.reviewMode = false;
    if (state.filter.status === 'problem') state.filter.status = 'all';
    state.page = 0;
    saveStateSoon(250);
    renderOrderWorkspace();
  }
  function rowReadyForCreate(row) {
    return row.status !== 'created' && !rowIssue(row);
  }
  function rowHasReadyCalculation(row) {
    const context = row?.result?.calculationContext || {};
    const matchesClient = String(context.projectId || '') === String(state.settings.projectId || '')
      && String(context.clientId || '') === String(state.settings.userId || '');
    return Boolean(matchesClient && row?.status === 'calculated' && row.sender?.resolved && row.recipient?.resolved && doorTariffs(row).length);
  }
  function invalidateClientResults(clientId = state.settings.userId) {
    let invalidated = 0;
    state.rows.forEach(row => {
      if (!row.result || row.status === 'created') return;
      const context = row.result.calculationContext || {};
      if (String(context.projectId || '') === String(state.settings.projectId || '') && String(context.clientId || '') === String(clientId || '')) return;
      row.result = null;
      row.tariffKey = '';
      row.tariffSearch = '';
      row.services = {};
      row.error = '';
      clearRowFieldErrors(row);
      row.status = row.sender?.resolved && row.recipient?.resolved ? 'imported' : row.status;
      invalidated += 1;
    });
    if (!invalidated) return 0;
    invalidateRowsRenderCache();
    saveState();
    render();
    setStatus(`Клиент изменён: ${invalidated} строк требуют проверки тарифа. Совпавшие расчёты загрузятся из кеша.`, 'error');
    return invalidated;
  }
  function sessionHasData() {
    return Boolean(
      state.settings.userInn
      || state.settings.userId
      || state.settings.takeDate
      || state.settings.takeTimeFrom
      || state.settings.takeTimeTo
      || state.rows.length
      || state.created.length
      || state.cancelResults.length
    );
  }
  function workflowSnapshot(attention = null) {
    if (!attention) return collectWorkflowStats();
    const stats = collectWorkflowStats();
    stats.attention = attention;
    stats.issues = attention.length;
    return stats;
  }
  function nextWorkflowAction(snapshot = workflowSnapshot()) {
    if (!snapshot.clientReady) {
      return { tone: 'start', action: 'client', button: 'Начать', title: 'Выберите клиента', hint: 'Введите ИНН клиента в панели слева и нажмите «Найти».' };
    }
    if (!snapshot.setupReady) {
      return { tone: 'start', action: 'schedule', button: 'Выбрать дату', title: 'Укажите дату и правило тарифа', hint: 'Дата забора и правило выбора тарифа применятся ко всем заказам.' };
    }
    if (!snapshot.total) {
      return { tone: 'start', action: 'import', button: 'Загрузить заказы', title: 'Добавьте список заказов', hint: 'Загрузите XLSX/CSV или добавьте заказ вручную.' };
    }
    if (snapshot.resolved < snapshot.total || snapshot.calculated < snapshot.total) {
      return { tone: 'work', action: 'calculate', button: 'Рассчитать', title: 'Распознайте адреса и рассчитайте тарифы', hint: `Готово: адреса ${snapshot.resolved}/${snapshot.total}, тарифы ${snapshot.calculated}/${snapshot.total}.` };
    }
    if (snapshot.issues) {
      return { tone: 'warning', action: 'problems', button: 'Показать ошибки', title: 'Исправьте строки перед созданием', hint: `${snapshot.issues} строк нужно проверить. При открытии заказа будет подсвечен нужный раздел.` };
    }
    if (snapshot.ready && !snapshot.selected) {
      return { tone: 'ready', action: 'select-ready', button: 'Выбрать готовые', title: 'Заказы готовы', hint: 'Выберите заказы, которые нужно создать.' };
    }
    if (snapshot.selected) {
      return { tone: 'ready', action: 'create', button: 'Создать', title: 'Можно создавать выбранные', hint: `${snapshot.selected} заказов на ${moneyText(snapshot.selectedTotal)}.` };
    }
    return { tone: 'ready', action: 'created', button: 'Готово', title: 'Работа завершена', hint: 'Созданные ID доступны в панели ниже.' };
  }
  function renderWorkflowSteps(snapshot = null) {
    if (!els.workflowSteps) return;
    if (state.settings.showOnboarding === false) {
      els.workflowSteps.hidden = true;
      els.workflowSteps.innerHTML = '';
      return;
    }
    els.workflowSteps.hidden = false;
    const data = snapshot || workflowSnapshot();
    const next = nextWorkflowAction(data);
    const steps = [
      { key: 'client', title: 'Клиент', value: data.clientReady ? 'выбран' : 'начать', done: data.clientReady },
      { key: 'setup', title: 'Дата и тариф', value: data.setupReady ? 'задано' : 'задать', done: data.setupReady },
      { key: 'orders', title: 'Заказы', value: data.total ? `${data.total}` : 'загрузить', done: data.total > 0 },
      { key: 'tariffs', title: 'Расчёт', value: data.total ? `${data.calculated}/${data.total}` : 'после загрузки', done: data.total > 0 && data.calculated === data.total },
      { key: 'ready', title: 'Проверка', value: data.issues ? `${data.issues} ошибок` : 'ок', done: data.total > 0 && !data.issues && data.ready > 0 },
      { key: 'created', title: 'Создание', value: data.created ? `${data.created}` : 'финал', done: data.total > 0 && data.created === data.total }
    ];
    const activeIndex = Math.max(0, steps.findIndex(step => !step.done));
    const stepActions = {
      client: { action: 'client', disabled: false },
      setup: { action: 'schedule', disabled: !data.clientReady },
      orders: { action: 'import', disabled: state.running },
      tariffs: { action: data.resolved < data.total ? 'resolve' : 'calculate', disabled: !data.total || state.running },
      ready: { action: data.issues ? 'problems' : 'select-ready', disabled: !data.issues && !data.ready },
      created: { action: 'create', disabled: !data.selected || state.running }
    };
    els.workflowSteps.innerHTML = `<div class="workflow-compact ${escapeHtml(next.tone)}">
      <div class="workflow-title"><b>${escapeHtml(next.title)}</b><small>${escapeHtml(next.hint)}</small></div>
      <div class="workflow-strip">${steps.map((step, index) => {
        const actionMeta = stepActions[step.key] || {};
        const disabled = Boolean(actionMeta.disabled);
        const actionAttr = actionMeta.action && !disabled ? ` data-flow-action="${escapeHtml(actionMeta.action)}"` : '';
        return `<button class="workflow-step ${step.done ? 'done' : ''} ${index === activeIndex ? 'active' : ''}" type="button" data-workflow-step="${escapeHtml(step.key)}"${actionAttr} ${disabled ? 'disabled' : ''}>
        <span>${step.done ? icon('check') : index + 1}</span>
        <b>${escapeHtml(step.title)}</b>
        <small>${escapeHtml(step.value)}</small>
      </button>`;
      }).join('')}</div>
      <div class="workflow-actions">
        ${sessionHasData() ? '<button class="button ghost mini" type="button" data-flow-action="new-session">Начать заново</button>' : ''}
        <button class="button primary mini" type="button" data-flow-action="${escapeHtml(next.action)}">${escapeHtml(next.button)}</button>
      </div>
    </div>`;
  }
  function renderHeaderSelectionSummary(snapshot = null) {
    if (!els.headerSelectionSummary) return;
    const data = snapshot || workflowSnapshot();
    els.headerSelectionSummary.hidden = false;
    els.headerSelectedCount.textContent = `${data.selected} из ${data.total || 0}`;
    els.headerSelectedTotal.textContent = moneyText(data.selectedTotal);
  }
  function renderAttentionPanel(items = null) {
    if (!els.attentionPanel) return;
    const list = items || attentionItems();
    if (!state.rows.length || !list.length) {
      els.attentionPanel.hidden = true;
      els.attentionPanel.innerHTML = '';
      return;
    }
    els.attentionPanel.hidden = false;
    const first = list[0];
    const firstSummary = issueSummaryText(first.issues) || first.issue.message;
    const reviewButton = state.reviewMode ? '<button class="button ghost mini" type="button" data-exit-review>Все строки</button>' : '<button class="button ghost mini" type="button" data-filter-problems>Проверка</button>';
    els.attentionPanel.className = 'attention-panel';
    els.attentionPanel.innerHTML = `<div class="attention-head compact"><span>${icon('alert-triangle')}</span><div><b>${state.reviewMode ? 'Режим проверки' : `Проверьте ${escapeHtml(list.length)} строк`}</b><small>#${escapeHtml(first.row.index)} · ${escapeHtml(firstSummary)}</small></div><button class="button secondary mini" type="button" data-focus-row="${escapeHtml(first.row.id)}">Открыть</button>${reviewButton}</div>`;
  }
  function renderStats() {
    const snapshot = withIssueCache(() => collectWorkflowStats());
    const next = nextWorkflowAction(snapshot);
    window.parent?.postMessage({
      type: 'ops-toolkit-module-state', tool: 'orders', busy: Boolean(state.running || state.uiBusy),
      summary: {
        total: state.rows.length,
        resolved: snapshot.resolved,
        calculated: snapshot.calculated,
        issues: snapshot.issues,
        ready: snapshot.ready,
        created: snapshot.created,
        errors: snapshot.errors,
        clientReady: snapshot.clientReady,
        setupReady: snapshot.setupReady,
        selected: snapshot.selected,
        selectedTotal: snapshot.selectedTotal,
        selectedTotalText: moneyText(snapshot.selectedTotal),
        showOnboarding: state.settings.showOnboarding !== false,
        nextTitle: next.title,
        nextHint: next.hint
      }
    }, location.origin);
    const attention = snapshot.attention;
    if (state.reviewMode && !attention.length) {
      state.reviewMode = false;
      if (state.filter.status === 'problem') state.filter.status = 'all';
      state.page = 0;
    }
    if (els.rowsCount) els.rowsCount.textContent = String(state.rows.length);
    if (els.calculatedCount) els.calculatedCount.textContent = String(snapshot.calculated);
    if (els.selectedCount) els.selectedCount.textContent = String(snapshot.selected);
    if (els.totalPrice) els.totalPrice.textContent = moneyText(snapshot.selectedTotal);
    if (els.statusFilter) els.statusFilter.value = state.filter.status || 'all';
    if (els.sortSelect) els.sortSelect.value = state.filter.sort || 'index';
    renderWorkflowSteps(snapshot);
    renderHeaderSelectionSummary(snapshot);
    if (els.resetSessionBtn) els.resetSessionBtn.hidden = !(state.settings.showOnboarding === false && sessionHasData());
    if (els.clearDuplicateRowsBtn) {
      const showDuplicateDelete = state.filter.status === 'duplicate' && duplicateRowIdSets().removableIds.size > 0;
      els.clearDuplicateRowsBtn.hidden = !showDuplicateDelete;
      els.clearDuplicateRowsBtn.style.display = showDuplicateDelete ? '' : 'none';
    }
    if (els.clearCreatedRowsBtn) els.clearCreatedRowsBtn.hidden = !snapshot.created;
    renderAttentionPanel(attention);
    renderStatusBars(snapshot);
  }
  function renderStatusBars() {
    if (!els.statusBars) return;
    els.statusBars.hidden = true;
    els.statusBars.innerHTML = '';
    return;
    if (state.createProgress?.active) {
      els.statusBars.hidden = true;
      els.statusBars.innerHTML = '';
      return;
    }
    const total = Math.max(1, state.rows.length);
    const resolved = state.rows.filter(row => row.sender.resolved && row.recipient.resolved).length;
    const calculated = state.rows.filter(row => doorTariffs(row).length).length;
    const createProgress = state.createProgress || {};
    const created = createProgress.active ? Number(createProgress.done || 0) : state.rows.filter(row => row.status === 'created').length;
    const createTotal = createProgress.active ? Math.max(1, Number(createProgress.total || 0)) : total;
    const errors = state.rows.filter(row => row.status === 'error').length;
    const cancelled = (state.cancelResults || []).filter(item => item.ok).length;
    const cancelTotal = Math.max(state.cancelTotal || 0, (state.cancelResults || []).length);
    const shouldShow = Boolean(state.running || createProgress.active || errors || cancelTotal);
    els.statusBars.hidden = !shouldShow;
    if (!shouldShow) {
      els.statusBars.innerHTML = '';
      return;
    }
    const pct = value => Math.round((value / total) * 100);
    const createPct = Math.round((created / createTotal) * 100);
    const cancelPct = cancelTotal ? Math.round((cancelled / cancelTotal) * 100) : 0;
    const items = [
      ['Адреса', `${resolved}/${state.rows.length}`, pct(resolved), 'resolve', ''],
      ['Тарифы', `${calculated}/${state.rows.length}`, pct(calculated), 'calculate', ''],
      [createProgress.active ? 'Создание' : 'Создано', `${created}/${createProgress.active ? createProgress.total : state.rows.length}`, createPct, 'create', ''],
      ['Отменено', cancelTotal ? `${cancelled}/${cancelTotal}` : '0', cancelPct, 'cancel', ''],
      ['Ошибки', String(errors), Math.min(100, pct(errors)), 'error', 'danger']
    ];
    els.statusBars.innerHTML = items.map(([label, value, percent, operation, cls]) => `<div class="status-bar-item ${cls} ${state.operation === operation ? 'active' : ''}"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><i><em style="width:${percent}%"></em></i></div>`).join('');
  }
  function renderCreateProgress() {
    if (!els.createProgressPanel) return;
    const progress = state.createProgress || {};
    if (!progress.active || !progress.total) {
      els.createProgressPanel.hidden = true;
      els.createProgressPanel.innerHTML = '';
      return;
    }
    const total = Math.max(1, Number(progress.total || 0));
    const done = Math.min(total, Number(progress.done || 0));
    const percent = Math.round((done / total) * 100);
    const remaining = Math.max(0, total - done);
    els.createProgressPanel.hidden = false;
    els.createProgressPanel.innerHTML = `<div class="create-progress-head">
        <span class="loading-spinner" aria-hidden="true"></span>
        <div><b>Создание заказов</b><small>${escapeHtml(done)} из ${escapeHtml(total)} обработано, осталось ${escapeHtml(remaining)}</small>${progress.current ? `<small class="create-progress-current">${escapeHtml(progress.current)}</small>` : ''}</div>
        <strong>${escapeHtml(percent)}%</strong>
      </div>
      <i><em style="width:${percent}%"></em></i>
      <div class="create-progress-meta"><span>Создано: ${escapeHtml(progress.success || 0)}</span><span>Ошибки: ${escapeHtml(progress.errors || 0)}</span></div>`;
  }
  function renderPager(rows = filteredRows()) {
    const pageSize = currentPageSize();
    const pages = pagesForRows(rows);
    state.page = Math.min(Math.max(0, state.page), pages - 1);
    const pageSizeOptions = PAGE_SIZE_OPTIONS.map(value => `<option value="${value}" ${value === pageSize ? 'selected' : ''}>${value}</option>`).join('');
    const start = Math.max(0, state.page - 2);
    const end = Math.min(pages - 1, state.page + 2);
    const numbers = pages > 1 ? Array.from({ length: end - start + 1 }, (_, index) => {
      const page = start + index;
      return `<button class="button secondary mini pager-number ${page === state.page ? 'active' : ''}" type="button" data-page-number="${page}" ${page === state.page ? 'aria-current="page"' : ''}>${page + 1}</button>`;
    }).join('') : '';
    // В пагинации показываем страницы, но не выводим количество заказов, чтобы оно не путалось со счётчиками тарифов.
    const html = rows.length > 10
      ? `<label class="pager-page-size">Заказов <select data-page-size>${pageSizeOptions}</select></label><button class="button secondary mini pager-arrow" type="button" data-page="prev" ${state.page <= 0 ? 'disabled' : ''} aria-label="Предыдущая страница">‹</button>${numbers ? `<span class="pager-numbers">${numbers}</span>` : ''}<span class="pager-info">Страница ${state.page + 1} / ${pages}</span><button class="button secondary mini pager-arrow" type="button" data-page="next" ${state.page >= pages - 1 ? 'disabled' : ''} aria-label="Следующая страница">›</button>`
      : '';
    if (els.pageControlsTop) els.pageControlsTop.innerHTML = '';
    if (els.pageControlsBottom) els.pageControlsBottom.innerHTML = html;
  }
  function labelTitle(title, required = false) {
    return `<span class="label-title${required ? ' required' : ''}">${escapeHtml(title)}</span>`;
  }
  function personFields(row, side, title) {
    const person = row[side];
    const isPhysical = person.personType === 'physical';
    const resolveErrorClass = addressResolveFailed(person) ? ' address-resolve-error' : '';
    const resolveErrorTitle = addressResolveFailed(person) ? ` title="${escapeHtml(person.error)}"` : '';
    const identityFields = isPhysical
      ? `<label>${labelTitle('Паспорт серия')}<input data-field="${side}.passportSeries" value="${escapeHtml(person.passportSeries)}" ${optionalInputErrorAttrs(row, `${side}.passportSeries`)}>${fieldErrorHint(row, `${side}.passportSeries`)}</label>
         <label>${labelTitle('Паспорт номер')}<input data-field="${side}.passportNumber" value="${escapeHtml(person.passportNumber)}" ${optionalInputErrorAttrs(row, `${side}.passportNumber`)}>${fieldErrorHint(row, `${side}.passportNumber`)}</label>
         <label>${labelTitle('Дата выдачи')}<input type="date" data-field="${side}.passportIssueDate" value="${escapeHtml(dateInputValue(person.passportIssueDate))}" ${optionalInputErrorAttrs(row, `${side}.passportIssueDate`)}>${fieldErrorHint(row, `${side}.passportIssueDate`)}</label>`
      : `<label>${labelTitle('ИНН')}<input data-field="${side}.inn" inputmode="numeric" maxlength="12" pattern="\\d{10}|\\d{12}" value="${escapeHtml(sanitizeInn(person.inn))}" ${optionalInputErrorAttrs(row, `${side}.inn`)}>${fieldErrorHint(row, `${side}.inn`)}</label>`;
    return `<section class="order-section full person-section">
      <h3>${title}</h3>
      <div class="person-grid">
        <div class="person-row person-row-main">
          <label class="required-label">${labelTitle('Организация', true)}<input data-field="${side}.name" value="${escapeHtml(person.name)}" ${requiredInputAttrs(row, `${side}.name`)}>${fieldErrorHint(row, `${side}.name`)}</label>
          <label class="required-label">${labelTitle('Контакт', true)}<input data-field="${side}.contact" value="${escapeHtml(person.contact)}" ${requiredInputAttrs(row, `${side}.contact`)}>${fieldErrorHint(row, `${side}.contact`)}</label>
          <label class="required-label">${labelTitle('Телефон', true)}<input data-field="${side}.phone" value="${escapeHtml(person.phone)}" ${requiredInputAttrs(row, `${side}.phone`)}>${fieldErrorHint(row, `${side}.phone`)}</label>
          <label>${labelTitle('Email')}<input data-field="${side}.email" value="${escapeHtml(person.email)}"></label>
        </div>
        <div class="person-row person-row-address">
          <label class="required-label${resolveErrorClass}"${resolveErrorTitle}>${labelTitle('Город', true)}<input data-field="${side}.city" value="${escapeHtml(person.city)}" ${requiredInputAttrs(row, `${side}.city`)}>${fieldErrorHint(row, `${side}.city`)}</label>
          <label class="required-label address-field${resolveErrorClass}"${resolveErrorTitle}>${labelTitle('Адрес', true)}<input data-field="${side}.address" value="${escapeHtml(person.address || person.fullAddress)}" ${requiredInputAttrs(row, `${side}.address`)}>${fieldErrorHint(row, `${side}.address`)}</label>
          <label>${labelTitle('Индекс')}<input data-field="${side}.postIndex" value="${escapeHtml(person.postIndex)}"></label>
        </div>
        <div class="person-row person-row-identity">
          <label>${labelTitle('Тип')}<select data-field="${side}.personType"><option value="legal" ${person.personType !== 'physical' ? 'selected' : ''}>Юр. лицо</option><option value="physical" ${person.personType === 'physical' ? 'selected' : ''}>Физ. лицо</option></select></label>
          ${identityFields}
        </div>
        <label class="person-info-row">${labelTitle('Доп. инфо')}<input data-field="${side}.info" value="${escapeHtml(person.info)}"></label>
      </div>
    </section>`;
  }
  function costMarkup(row, item) {
    const company = item?.deliveryCompanyLabel || '';
    const isDocsDeclared = companyAllowsDeclared(company) && normalizeCargoType(row.cargo.type) === 'documents';
    const disabled = companyIsFlipPost(company);
    const value = row.cargo.insuranceValue || row.cargo.declaredValue || '';
    const label = isDocsDeclared ? 'Объявленная стоимость' : 'Страховка';
    const hint = disabled
      ? 'Для Flip Post страхование и объявленная стоимость не передаются.'
      : isDocsDeclared
        ? 'Для документов CSE/OPS сумма передаётся как объявленная стоимость. Лимит для документов — 50 000 ₽.'
        : 'Сумма передаётся только в страхование.';
    return `<div class="cost-box">
      <label class="value-amount single-value"><span>${escapeHtml(label)}</span><input data-field="cargo.insuranceValue" inputmode="decimal" placeholder="0" value="${escapeHtml(value)}" ${disabled ? 'disabled' : ''}><small class="field-hint insurance-hint">${escapeHtml(hint)}</small></label>
    </div>`;
  }
  function serviceParamInputMarkup(row, service, param) {
    const value = serviceParamValue(row, service, param);
    const required = serviceParamRequired(param);
    const label = labelTitle(param.caption || param.key || 'Параметр', required);
    const common = `data-service-param="${escapeHtml(service.key)}" data-param-key="${escapeHtml(param.key || '')}" ${required ? 'required aria-required="true"' : ''}`;
    if (serviceParamIsBoolean(param)) {
      return `<label class="check-line service-param-check"><input type="checkbox" ${common} ${value === true || value === 'true' || value === 1 || value === '1' ? 'checked' : ''}><span>${label}</span></label>`;
    }
    if (serviceParamIsRadio(param)) {
      const options = serviceParamOptions(param);
      const current = String(value ?? serviceParamDefaultValue(param) ?? '');
      const name = `service-${row.id}-${service.key}-${param.key}`;
      return `<div class="service-param-choice"><span>${label}</span><div class="service-param-radio-group">${options.map(option => serviceParamRadioMarkup({ value: option.value, label: option.label, common, name, checked: current === String(option.value) || (serviceParamIsBoolean(param) && String(Boolean(current === true || current === 'true' || current === 1 || current === '1')) === String(option.value)) })).join('')}</div></div>`;
    }
    const type = serviceParamIsNumeric(param) ? 'number' : 'text';
    const inputMode = serviceParamIsNumeric(param) ? 'decimal' : 'text';
    return `<label>${label}<input type="${type}" inputmode="${inputMode}" ${common} value="${escapeHtml(value)}"></label>`;
  }
  function servicesMarkup(row, item, forceOpen = false) {
    const services = selectedTariffServices(item);
    const enabledCount = services.filter(service => serviceEnabled(row, service)).length;
    const needParamsCount = services.filter(service => serviceEnabled(row, service) && Array.isArray(service.params) && service.params.length).length;
    if (!services.length) {
      return `<details class="services-details" data-services-details><summary><span>Доп. услуги</span><b>нет доступных</b></summary><div class="empty-mini">В выбранном тарифе калькулятор не вернул услуги.</div></details>`;
    }
    const open = forceOpen || row.uiTab === 'services' || (row.servicesOpen === undefined ? (needParamsCount || services.some(service => service.required)) : Boolean(row.servicesOpen));
    const limit = Math.min(services.length, Number(row.servicesVisibleLimit) || servicesRenderChunk());
    const visibleServices = services.slice(0, limit);
    const rest = services.length - visibleServices.length;
    return `<details class="services-details" data-services-details ${open ? 'open' : ''}>
      <summary><span>Доп. услуги</span><b>${enabledCount ? `выбрано ${enabledCount}` : `${services.length} доступно`}</b></summary>
      <div class="services-list">
        ${visibleServices.map(service => {
          const enabled = serviceEnabled(row, service);
          const required = Boolean(service.required);
          const params = Array.isArray(service.params) ? service.params : [];
          const blockedBy = !enabled && !required ? serviceConflictSource(row, service, services) : null;
          const incompatibleNames = serviceIncompatibleNames(service, services);
          const incompatible = blockedBy
            ? `Недоступно вместе с «${blockedBy.caption || blockedBy.key}».`
            : (incompatibleNames.length ? `Недоступно вместе с ${incompatibleNames.map(name => `«${name}»`).join(', ')}.` : '');
          return `<div class="service-card ${enabled ? 'enabled' : ''} ${required ? 'required' : ''} ${blockedBy ? 'blocked' : ''}">
            <div class="service-main">
              <label class="check-line service-check ${required || blockedBy ? 'disabled' : ''}"><input type="checkbox" data-service-key="${escapeHtml(service.key)}" ${enabled ? 'checked' : ''} ${required || blockedBy ? 'disabled' : ''}><span><b>${escapeHtml(service.caption || service.key)}</b>${required ? '<em>включена в тариф</em>' : ''}</span></label>
              <span class="service-price">${service.price !== '' && service.price !== null && service.price !== undefined ? moneyText(service.price) : 'по запросу'}</span>
            </div>
            ${service.description ? `<p class="service-description">${escapeHtml(service.description)}</p>` : ''}
            ${required ? '<p class="service-note">Обязательная услуга: она уже выбрана и не отключается.</p>' : ''}
            ${incompatible ? `<p class="service-warning">${escapeHtml(incompatible)}</p>` : ''}
            ${enabled && params.length ? `<div class="service-params"><p>Заполните параметры услуги:</p><div class="service-param-grid">${params.map(param => serviceParamInputMarkup(row, service, param)).join('')}</div></div>` : ''}
          </div>`;
        }).join('')}
        ${rest > 0 ? `<button class="button secondary mini services-more" type="button" data-show-more-services="${escapeHtml(row.id)}">Показать ещё ${escapeHtml(Math.min(rest, servicesRenderChunk()))} из ${escapeHtml(rest)}</button>` : ''}
      </div>
    </details>`;
  }
  function cargoTypeMarkup(row) {
    const current = normalizeCargoType(row.cargo.type);
    return `<div class="cargo-type-options segmented-control" role="group" aria-label="Тип груза">
      ${['cargo', 'documents'].map(key => `<button type="button" class="seg-button ${current === key ? 'active' : ''}" data-cargo-type="${key}" aria-pressed="${current === key ? 'true' : 'false'}">${escapeHtml(CARGO_TYPES[key].label)}</button>`).join('')}
    </div>`;
  }
  function updateCargoType(row, value) {
    const previous = normalizeCargoType(row.cargo?.type);
    const next = normalizeCargoType(value);
    if (previous === next) return false;
    row.cargo.type = next;
    syncCargoNameWithType(row, previous);
    row.result = null;
    row.tariffKey = '';
    row.error = '';
    if (row.status === 'calculated' || row.status === 'error') row.status = 'imported';
    return true;
  }
  function rowStatusMeta(row) {
    if (row.status === 'created') return { statusClass: 'ready', statusText: `Создано ${row.orderId || ''}` };
    if (row.status === 'running') return { statusClass: 'running', statusText: 'В работе...' };
    const isDuplicate = rowIsDuplicate(row);
    const duplicateSuffix = isDuplicate ? ' (дубль)' : '';
    if (row.status === 'error') return { statusClass: `error${isDuplicate ? ' duplicate' : ''}`, statusText: `Ошибка${duplicateSuffix}` };
    const issue = rowIssue(row);
    const statusClass = `${issue || isDuplicate ? 'warning' : 'ready'}${isDuplicate ? ' duplicate' : ''}`;
    const statusText = `${issue ? (issue.kind === 'tariff' ? 'Нужен расчёт' : 'Проверить') : 'Готов к созданию'}${duplicateSuffix}`;
    return { statusClass, statusText };
  }
  function routeText(row) {
    return `${row.sender.resolved?.placeText || personAddress(row.sender) || '—'} → ${row.recipient.resolved?.placeText || personAddress(row.recipient) || '—'}`;
  }
  function companyInitials(name) {
    const words = String(name || 'ТК').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] || 'ТК').slice(0, 2)).toUpperCase();
  }
  function companyLogoMarkup(item, fallback = '') {
    const label = item?.deliveryCompanyLabel || fallback || 'ТК';
    const iconUrl = String(item?.deliveryCompanyIcon || '').trim();
    const fallbackMarkup = `<span class="company-logo-fallback">${escapeHtml(companyInitials(label))}</span>`;
    return `<span class="company-logo ${iconUrl ? 'has-image' : ''}" title="${escapeHtml(label)}">${fallbackMarkup}${iconUrl ? `<img src="${escapeHtml(iconUrl)}" alt="">` : ''}</span>`;
  }
  function companyTitleMarkup(item, fallback = '') {
    const label = item?.deliveryCompanyLabel || fallback || 'ТК';
    if (!item && !fallback) return '<span class="company-title no-logo"><span class="company-name">—</span></span>';
    return `<span class="company-title">${item ? companyLogoMarkup(item, label) : ''}<span class="company-name">${escapeHtml(label)}</span></span>`;
  }
  function tariffPickerMarkup(row, item) {
    const tariffs = doorTariffs(row);
    if (!tariffs.length) return '';
    const entries = rowTariffEntries(row);
    const filteredEntries = filteredRowTariffEntries(row, entries);
    return `<section class="tariff-picker-panel">
        <div class="tariff-select-label"><span class="label-title">Тариф дверь-дверь</span>
          <div class="tariff-combo" data-row-tariff-combo>
            <button class="tariff-combo-button" type="button" data-tariff-combo-toggle aria-expanded="false">
              <span class="tariff-combo-value">${escapeHtml(tariffComboSelectedLabel(entries, row.tariffKey))}</span>
              ${icon('chevron-right')}
            </button>
            <div class="tariff-combo-menu" hidden>
              <input class="tariff-combo-search" data-tariff-search placeholder="Найти тариф, ТК, срок или цену..." value="${escapeHtml(row.tariffSearch || '')}">
              <div class="tariff-combo-meta">${escapeHtml(tariffSearchCountText(filteredEntries.length, entries.length, row.tariffSearch))}</div>
              <div class="tariff-combo-list">${tariffComboListMarkup(filteredEntries, row.tariffKey, 'data-row-tariff-option', entries.length ? 'Нет тарифов по поиску' : 'Нет тарифов дверь-дверь')}</div>
            </div>
          </div>
        </div>
        <div class="tariff-price"><span>Сумма с услугами</span><b>${moneyText(rowPrice(row))}</b></div>
      </section>`;
  }
  function updateRowTariffCombo(card, row) {
    const combo = card?.querySelector?.('[data-row-tariff-combo]');
    if (!combo) return;
    const entries = rowTariffEntries(row);
    const filteredEntries = filteredRowTariffEntries(row, entries);
    const value = combo.querySelector('.tariff-combo-value');
    if (value) value.textContent = tariffComboSelectedLabel(entries, row.tariffKey);
    const meta = combo.querySelector('.tariff-combo-meta');
    if (meta) meta.textContent = tariffSearchCountText(filteredEntries.length, entries.length, row.tariffSearch);
    const list = combo.querySelector('.tariff-combo-list');
    if (list) list.innerHTML = tariffComboListMarkup(filteredEntries, row.tariffKey, 'data-row-tariff-option', entries.length ? 'Нет тарифов по поиску' : 'Нет тарифов дверь-дверь');
  }
  function updateBulkTariffCombo() {
    if (!els.bulkTariffCombo) return;
    const entries = bulkTariffEntries();
    const filteredEntries = filteredBulkTariffEntries(entries);
    const value = els.bulkTariffCombo.querySelector('.tariff-combo-value');
    if (value) value.textContent = tariffComboSelectedLabel(entries, state.bulk.tariffSignature);
    const meta = els.bulkTariffCombo.querySelector('.tariff-combo-meta');
    if (meta) meta.textContent = tariffSearchCountText(filteredEntries.length, entries.length, state.bulk.tariffSearch);
    const list = els.bulkTariffCombo.querySelector('.tariff-combo-list');
    if (list) list.innerHTML = tariffComboListMarkup(filteredEntries, state.bulk.tariffSignature, 'data-bulk-tariff-option', entries.length ? 'Нет тарифов по поиску' : 'Нет тарифов дверь-дверь');
  }
  function tariffAndCargoSection(row, item, includeCost = false) {
    return `<section class="order-section full cargo-section">
      <div class="section-head"><h3>Груз</h3></div>
      <div class="cargo-grid">
        <div class="cargo-type-field"><span class="field-label">${labelTitle('Тип груза')}</span>${cargoTypeMarkup(row)}</div>
        <label class="required-label">${labelTitle('Вес, кг', true)}<input data-field="cargo.weight" inputmode="decimal" value="${escapeHtml(row.cargo.weight)}" ${requiredInputAttrs(row, 'cargo.weight')}>${fieldErrorHint(row, 'cargo.weight')}</label>
        <label class="required-label">${labelTitle('Мест', true)}<input data-field="cargo.seats" inputmode="numeric" value="${escapeHtml(row.cargo.seats)}" ${requiredInputAttrs(row, 'cargo.seats')}>${fieldErrorHint(row, 'cargo.seats')}</label>
        <label class="required-label">${labelTitle('Длина', true)}<input data-field="cargo.length" inputmode="decimal" value="${escapeHtml(row.cargo.length)}" ${requiredInputAttrs(row, 'cargo.length')}>${fieldErrorHint(row, 'cargo.length')}</label>
        <label class="required-label">${labelTitle('Ширина', true)}<input data-field="cargo.width" inputmode="decimal" value="${escapeHtml(row.cargo.width)}" ${requiredInputAttrs(row, 'cargo.width')}>${fieldErrorHint(row, 'cargo.width')}</label>
        <label class="required-label">${labelTitle('Высота', true)}<input data-field="cargo.height" inputmode="decimal" value="${escapeHtml(row.cargo.height)}" ${requiredInputAttrs(row, 'cargo.height')}>${fieldErrorHint(row, 'cargo.height')}</label>
        <label class="required-label cargo-description">${labelTitle('Описание груза', true)}<input data-field="cargo.name" value="${escapeHtml(row.cargo.name)}" ${requiredInputAttrs(row, 'cargo.name')}>${fieldErrorHint(row, 'cargo.name')}</label>
        ${includeCost && !companyIsPek(item) ? `<div class="cargo-insurance-field">${costMarkup(row, item)}</div>` : ''}
      </div>
    </section>`;
  }
  function pickupSection(row) {
    const minDate = todayInputDate();
    return `<section class="order-section">
      <h3>Забор</h3>
      <div class="field-grid compact-schedule-grid">
        <label>Дата<input type="date" min="${escapeHtml(minDate)}" data-field="schedule.takeDate" value="${escapeHtml(scheduleDateValue(row.schedule.takeDate))}" ${optionalInputErrorAttrs(row, 'schedule.takeDate')}>${fieldErrorHint(row, 'schedule.takeDate')}</label>
        <label>Сбор с<input type="time" step="1800" list="timeOptions" data-field="schedule.takeTimeFrom" value="${escapeHtml(timeInputValue(row.schedule.takeTimeFrom))}"></label>
        <label>Сбор до<input type="time" step="1800" list="timeOptions" data-field="schedule.takeTimeTo" value="${escapeHtml(timeInputValue(row.schedule.takeTimeTo))}"></label>
      </div>
    </section>`;
  }
  function compactSummaryMarkup(row, item) {
    if (!item) return '';
    const schedule = scheduleDisplay(row);
    return `<div class="detail-summary-grid">
      <div class="summary-chip"><span>Маршрут</span><b>${escapeHtml(routeText(row))}</b></div>
      <div class="summary-chip"><span>Тариф</span><b>${escapeHtml(tariffDisplayName(item))}</b></div>
      <div class="summary-chip"><span>Забор</span><b>${escapeHtml(schedule.full)}</b></div>
      <div class="summary-chip strong"><span>К созданию</span><b>${moneyText(rowPrice(row))}</b></div>
    </div>`;
  }
  function personSummaryText(person) {
    const name = String(person?.name || '').trim() || 'Организация не заполнена';
    const contact = [person?.contact, person?.phone].map(value => String(value || '').trim()).filter(Boolean).join(' · ');
    const place = [person?.city, person?.address || person?.fullAddress].map(value => String(value || '').trim()).filter(Boolean).join(', ');
    return { name, contact: contact || 'Контакт не заполнен', place: place || 'Адрес не заполнен' };
  }
  function peopleSummaryMarkup(row) {
    const issueTabs = rowIssueTabs(row);
    return `<div class="people-summary-grid">
      ${[
        ['sender', 'Отправитель'],
        ['recipient', 'Получатель']
      ].map(([side, title]) => {
        const summary = personSummaryText(row[side]);
        const hasIssue = issueTabs.has(side);
        return `<button class="person-summary-chip ${hasIssue ? 'has-issue' : ''}" type="button" data-detail-tab="${escapeHtml(side)}">
          <span>${escapeHtml(title)}${hasIssue ? '<i>!</i>' : ''}</span>
          <b>${escapeHtml(summary.name)}</b>
          <small>${escapeHtml(summary.contact)}</small>
          <small>${escapeHtml(summary.place)}</small>
        </button>`;
      }).join('')}
    </div>`;
  }
  function detailTabsMarkup(row) {
    const tabs = [
      ['cargo', 'Груз'],
      ['sender', 'Отправитель'],
      ['recipient', 'Получатель'],
      ['services', 'Услуги']
    ];
    const current = row.uiTab || 'cargo';
    const issueTabs = rowIssueTabs(row);
    return `<div class="detail-tabs" role="tablist" aria-label="Разделы заказа">${tabs.map(([key, title]) => {
      const hasIssue = issueTabs.has(key);
      return `<button type="button" class="detail-tab-button ${current === key ? 'active' : ''} ${hasIssue ? 'has-issue' : ''}" data-detail-tab="${key}" aria-selected="${current === key ? 'true' : 'false'}" ${hasIssue ? `title="Проверьте вкладку «${escapeHtml(title)}»"` : ''}>${escapeHtml(title)}${hasIssue ? '<span class="tab-issue-dot">!</span>' : ''}</button>`;
    }).join('')}</div>`;
  }
  function issueHintMarkup(row) {
    const issues = cachedRowIssues(row);
    if (!issues.length) return '';
    const issue = issues[0];
    const sections = issueSectionsText(issues);
    const summary = issueSummaryText(issues);
    return `<button class="issue-route-hint" type="button" data-detail-tab="${escapeHtml(issue.tab || 'cargo')}">
      <span>${icon('alert-triangle')}</span>
      <b>Проверьте ${escapeHtml(sections)}</b>
      <small>${escapeHtml(summary || issue.message)}</small>
    </button>`;
  }
  function detailTabContent(row) {
    const item = selectedTariff(row);
    const tab = row.uiTab || 'cargo';
    if (tab === 'sender') return `<div class="detail-tab-body">${personFields(row, 'sender', 'Отправитель')}</div>`;
    if (tab === 'recipient') return `<div class="detail-tab-body">${personFields(row, 'recipient', 'Получатель')}</div>`;
    if (tab === 'services') return `<div class="detail-tab-body"><section class="order-section full services-section">${servicesMarkup(row, item)}</section></div>`;
    return `<div class="detail-tab-body">${tariffAndCargoSection(row, item, true)}</div>`;
  }
  function orderDetailsMarkup(row) {
    const item = selectedTariff(row);
    return `<div class="table-detail-card" data-row-id="${escapeHtml(row.id)}">
      ${tariffPickerMarkup(row, item)}
      ${pickupSection(row)}
      ${peopleSummaryMarkup(row)}
      ${issueHintMarkup(row)}
      ${detailTabsMarkup(row)}
      ${detailTabContent(row)}
    </div>
    ${row.error ? `<div class="row-error">${escapeHtml(row.error)}</div>` : ''}`;
  }
  function tableDetailFloatingMarkup(pageRows) {
    if (state.viewMode !== 'table' || !state.expandedRowId) return '';
    const row = pageRows.find(item => item.id === state.expandedRowId);
    if (!row) return '';
    const item = selectedTariff(row);
    const company = item?.deliveryCompanyLabel || row.deliveryCompanyHint || '';
    return `<div class="table-detail-floating" data-row-id="${escapeHtml(row.id)}" role="dialog" aria-modal="true" aria-label="Просмотр заказа ${escapeHtml(row.index)}">
      <button class="table-detail-backdrop" type="button" data-close-table-detail aria-label="Закрыть просмотр заказа"></button>
      <section class="table-detail-floating-panel">
        <header class="table-detail-floating-head">
          <div>
            <h2>${item ? companyTitleMarkup(item, company) : `Заказ #${escapeHtml(row.index)}`}</h2>
            <p>${escapeHtml(routeText(row))}</p>
          </div>
          <button class="icon-button" type="button" data-close-table-detail aria-label="Закрыть просмотр заказа">${icon('x')}</button>
        </header>
        ${orderDetailsMarkup(row)}
      </section>
    </div>`;
  }
  function orderListCard(row, active = false) {
    const item = selectedTariff(row);
    const company = item?.deliveryCompanyLabel || row.deliveryCompanyHint || '';
    const { statusClass, statusText } = rowStatusMeta(row);
    const selectable = row.status !== 'created';
    const schedule = scheduleDisplay(row);
    return `<article class="order-list-card ${active ? 'active' : ''} ${row.status === 'created' ? 'created' : ''}" data-row-id="${escapeHtml(row.id)}" data-activate-row>
      <div class="order-list-card-head">
        <label class="check-line ${!selectable ? 'disabled' : ''}"><input type="checkbox" data-field="selected" ${row.selected ? 'checked' : ''} ${!selectable ? 'disabled aria-disabled="true"' : ''}><span>#${row.index}</span></label>
        <span class="status-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </div>
      <div class="order-list-card-title"><b>${item ? companyTitleMarkup(item, company) : `Заказ #${escapeHtml(row.index)}`}</b>${item ? `<small>${escapeHtml(tariffDisplayName(item))}</small>` : ''}</div>
      <div class="order-list-card-route">${escapeHtml(routeText(row))}</div>
      <div class="order-list-card-meta">
        <span>${escapeHtml(row.cargo.weight)} кг · ${escapeHtml(row.cargo.seats)} м.</span>
        <span>${escapeHtml(row.cargo.length)}×${escapeHtml(row.cargo.width)}×${escapeHtml(row.cargo.height)}</span>
        ${item ? `<b>${moneyText(rowPrice(row))}</b>` : ''}
      </div>
      <div class="order-list-card-foot"><small>${escapeHtml(schedule.full)}</small></div>
    </article>`;
  }
  function cardDetailMarkup(row) {
    const item = selectedTariff(row);
    const company = item?.deliveryCompanyLabel || row.deliveryCompanyHint || '';
    const { statusClass, statusText } = rowStatusMeta(row);
    return `<section class="detail-panel ${row.status === 'created' ? 'created' : ''}" data-row-id="${escapeHtml(row.id)}">
      <div class="detail-panel-header">
        <div class="detail-panel-title"><h2 class="detail-title-line">${item ? `<span class="detail-title-company">${companyTitleMarkup(item, company)}</span><span class="title-tariff">${escapeHtml(tariffDisplayName(item))}</span>` : `Заказ #${escapeHtml(row.index)}`}</h2><p>${escapeHtml(routeText(row))}</p></div>
        <div class="detail-panel-actions">${row.status === 'created' ? '<span class="readonly-badge">Только просмотр</span>' : ''}<span class="status-pill ${statusClass}">${escapeHtml(statusText)}</span>${row.status !== 'created' ? '<button class="button primary" type="button" data-create-row>Создать</button>' : ''}<button class="button ghost danger" type="button" data-delete-row>Удалить</button></div>
      </div>
      ${tariffPickerMarkup(row, item)}
      ${pickupSection(row)}
      ${peopleSummaryMarkup(row)}
      ${issueHintMarkup(row)}
      ${detailTabsMarkup(row)}
      ${detailTabContent(row)}
      ${row.error ? `<div class="detail-panel-footer"><div class="row-error">${escapeHtml(row.error)}</div></div>` : ''}
    </section>`;
  }
  function tableRowMarkup(row) {
    const item = selectedTariff(row);
    const company = item?.deliveryCompanyLabel || row.deliveryCompanyHint || '—';
    const { statusClass, statusText } = rowStatusMeta(row);
    const expanded = state.expandedRowId === row.id;
    const schedule = scheduleDisplay(row);
    const senderContact = [row.sender.contact, row.sender.phone].map(value => String(value || '').trim()).filter(Boolean).join(' · ');
    const recipientContact = [row.recipient.contact, row.recipient.phone].map(value => String(value || '').trim()).filter(Boolean).join(' · ');
    const senderAddress = [row.sender.city, personAddress(row.sender)].map(value => String(value || '').trim()).filter(Boolean).join(', ');
    const recipientAddress = [row.recipient.city, personAddress(row.recipient)].map(value => String(value || '').trim()).filter(Boolean).join(', ');
    const checkbox = row.status === 'created'
      ? '<input type="checkbox" data-field="selected" disabled aria-disabled="true">'
      : `<input type="checkbox" data-field="selected" ${row.selected ? 'checked' : ''}>`;
    const createAction = row.status === 'created'
      ? `<span class="table-row-tool ready" title="Создано" aria-label="Создано">${icon('check')}</span>`
      : `<button class="table-row-tool primary" type="button" data-create-row title="Создать заказ" aria-label="Создать заказ">${icon('send')}</button>`;
    const deleteAction = row.status === 'created'
      ? ''
      : `<button class="table-row-tool danger" type="button" data-delete-row title="Удалить строку" aria-label="Удалить строку">${icon('trash')}</button>`;
    return `<tr class="order-table-row ${expanded ? 'expanded' : ''}" data-row-id="${escapeHtml(row.id)}">
      <td><div class="table-row-tools"><span class="table-row-index">#${escapeHtml(row.index)}</span><button class="table-row-tool" type="button" data-toggle-row title="${expanded ? 'Свернуть' : 'Развернуть'}" aria-label="${expanded ? 'Свернуть' : 'Развернуть'}">${icon(expanded ? 'chevron-up' : 'chevron-right')}</button>${createAction}${deleteAction}</div></td>
      <td><label class="table-check">${checkbox}</label></td>
      <td><b>${companyTitleMarkup(item, company)}</b></td>
      <td>${escapeHtml(item ? tariffDisplayName(item) : '—')}</td>
      <td>${escapeHtml(routeText(row))}</td>
      <td>${escapeHtml(schedule.date)}${schedule.time ? `<small>${escapeHtml(schedule.time)}</small>` : ''}</td>
      <td><b>${escapeHtml(row.sender.name || '—')}</b><small>${escapeHtml(senderContact)}</small><small>${escapeHtml(senderAddress)}</small></td>
      <td><b>${escapeHtml(row.recipient.name || '—')}</b><small>${escapeHtml(recipientContact)}</small><small>${escapeHtml(recipientAddress)}</small></td>
      <td><b>${escapeHtml(row.cargo.weight)} кг / ${escapeHtml(row.cargo.seats)} м.</b><small>${escapeHtml(row.cargo.length)}×${escapeHtml(row.cargo.width)}×${escapeHtml(row.cargo.height)}</small></td>
      <td><b>${moneyText(rowPrice(row))}</b></td>
      <td><span class="status-pill ${statusClass}">${escapeHtml(statusText)}</span></td>
    </tr>`;
  }
  function virtualViewportHeight(mode) {
    const selector = mode === 'table' ? '.table-mode-wrap' : '.cards-list-scroll';
    const current = els.orderRows?.querySelector(selector);
    const measured = current?.clientHeight || 0;
    if (measured > 120) return measured;
    return Math.max(260, Math.min(760, window.innerHeight - 260));
  }
  function virtualSlice(total, mode, rowHeight) {
    const key = `${state.viewMode}|${state.filter.status}|${state.filter.sort}|${state.page}|${currentPageSize()}|${total}`;
    const pending = pendingVirtualScrollTop?.mode === mode ? pendingVirtualScrollTop.top : null;
    if (virtualRowsKey !== key) {
      virtualRowsKey = key;
      virtualCardScrollTop = mode === 'cards' ? (pending ?? 0) : 0;
      virtualTableScrollTop = mode === 'table' ? (pending ?? 0) : 0;
      pendingVirtualScrollTop = null;
    } else if (pending !== null) {
      if (mode === 'cards') virtualCardScrollTop = pending;
      else virtualTableScrollTop = pending;
      pendingVirtualScrollTop = null;
    }
    const scrollTop = mode === 'table' ? virtualTableScrollTop : virtualCardScrollTop;
    const viewport = virtualViewportHeight(mode);
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_ROW_BUFFER);
    const end = Math.min(total, Math.ceil((scrollTop + viewport) / rowHeight) + VIRTUAL_ROW_BUFFER);
    return {
      start,
      end,
      top: start * rowHeight,
      bottom: Math.max(0, (total - end) * rowHeight)
    };
  }
  function tableVirtualSlice(pageRows) {
    return virtualSlice(pageRows.length, 'table', TABLE_VIRTUAL_ROW_HEIGHT);
  }
  function virtualRenderKey(mode, total, virtual) {
    return [
      mode,
      state.viewMode,
      state.filter.status,
      state.filter.sort,
      state.page,
      currentPageSize(),
      total,
      virtual.start,
      virtual.end,
      state.activeRowId,
      state.expandedRowId,
      state.running ? 1 : 0,
      state.uiBusy ? 1 : 0
    ].join('|');
  }
  function renderTableRows(pageRows) {
    const virtual = tableVirtualSlice(pageRows);
    const body = tableVirtualBodyMarkup(pageRows, virtual);
    lastVisibleRowsKey = virtualRenderKey('table', pageRows.length, virtual);
    return `<div class="table-mode-wrap"><table class="orders-table">
      <thead><tr><th></th><th><input type="checkbox" data-select-visible ${pageRows.every(row => row.selected || row.status === 'created') && pageRows.some(row => row.status !== 'created') ? 'checked' : ''}></th><th>ТК</th><th>Тариф</th><th>Маршрут</th><th>Дата забора</th><th>Отправитель</th><th>Получатель</th><th>Вес / места</th><th>Сумма</th><th>Статус</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>${tableDetailFloatingMarkup(pageRows)}`;
  }
  function tableVirtualBodyMarkup(pageRows, virtual = tableVirtualSlice(pageRows)) {
    const visibleRows = pageRows.slice(virtual.start, virtual.end);
    const topSpacer = virtual.top ? `<tr class="virtual-table-spacer" aria-hidden="true"><td colspan="11" style="height:${virtual.top}px"></td></tr>` : '';
    const bottomSpacer = virtual.bottom ? `<tr class="virtual-table-spacer" aria-hidden="true"><td colspan="11" style="height:${virtual.bottom}px"></td></tr>` : '';
    return `${topSpacer}${visibleRows.map(tableRowMarkup).join('')}${bottomSpacer}`;
  }
  function renderCardMode(pageRows) {
    const active = pageRows.find(row => row.id === state.activeRowId) || pageRows[0];
    if (active && state.activeRowId !== active.id) state.activeRowId = active.id;
    const review = state.reviewMode || state.filter.status === 'problem';
    return `<div class="card-mode-shell">
      <aside class="cards-list-panel">
        <div class="cards-list-header"><h2>${review ? 'Проблемы' : 'Заказы'}</h2><span>${pageRows.length} на странице</span></div>
        <div class="cards-list-scroll" data-virtual-scroll="cards">${cardVirtualListMarkup(pageRows, active?.id)}</div>
      </aside>
      <div class="cards-detail-column">${active ? cardDetailMarkup(active) : '<div class="empty-state">Выберите заказ слева.</div>'}</div>
    </div>`;
  }
  function cardVirtualListMarkup(pageRows, activeId = state.activeRowId, virtual = virtualSlice(pageRows.length, 'cards', CARD_VIRTUAL_ROW_HEIGHT)) {
    lastVisibleRowsKey = virtualRenderKey('cards', pageRows.length, virtual);
    const visibleRows = pageRows.slice(virtual.start, virtual.end);
    const topSpacer = virtual.top ? `<div class="virtual-card-spacer" aria-hidden="true" style="height:${virtual.top}px"></div>` : '';
    const bottomSpacer = virtual.bottom ? `<div class="virtual-card-spacer" aria-hidden="true" style="height:${virtual.bottom}px"></div>` : '';
    return `${topSpacer}${visibleRows.map(row => orderListCard(row, activeId === row.id)).join('')}${bottomSpacer}`;
  }
  function currentPageRows() {
    const rows = withIssueCache(() => filteredRows());
    const pageSize = currentPageSize();
    const from = state.page * pageSize;
    return rows.slice(from, from + pageSize);
  }
  function renderVisibleRowsOnly() {
    if (!state.rows.length) return;
    const pageRows = currentPageRows();
    withRowRenderCaches(() => {
      if (state.viewMode === 'table') {
        const virtual = tableVirtualSlice(pageRows);
        const key = virtualRenderKey('table', pageRows.length, virtual);
        if (key === lastVisibleRowsKey) return;
        lastVisibleRowsKey = key;
        const body = els.orderRows?.querySelector('.orders-table tbody');
        if (body) {
          body.innerHTML = tableVirtualBodyMarkup(pageRows, virtual);
          restoreExpandedDetailScroll();
        }
      } else {
        const virtual = virtualSlice(pageRows.length, 'cards', CARD_VIRTUAL_ROW_HEIGHT);
        const key = virtualRenderKey('cards', pageRows.length, virtual);
        if (key === lastVisibleRowsKey) return;
        lastVisibleRowsKey = key;
        const list = els.orderRows?.querySelector('[data-virtual-scroll="cards"]');
        if (list) list.innerHTML = cardVirtualListMarkup(pageRows, state.activeRowId, virtual);
      }
    });
    if (state.running || state.uiBusy) syncRowsEditLock(true);
  }
  function restoreVirtualScrollPosition() {
    const cards = els.orderRows?.querySelector('[data-virtual-scroll="cards"]');
    if (cards) cards.scrollTop = virtualCardScrollTop;
    const table = els.orderRows?.querySelector('.table-mode-wrap');
    if (table) table.scrollTop = virtualTableScrollTop;
    restoreExpandedDetailScroll();
  }
  function restoreExpandedDetailScroll() {
    if (!state.expandedRowId || !els.orderRows) return;
    const detail = els.orderRows.querySelector(`.table-detail-floating[data-row-id="${escapeCssIdent(state.expandedRowId)}"] .table-detail-card`);
    if (!detail) return;
    const savedTop = tableDetailScrollTopByRow.get(state.expandedRowId);
    if (Number.isFinite(savedTop)) detail.scrollTop = savedTop;
  }
  function syncVisibleSelectionControls() {
    if (!els.orderRows) return;
    els.orderRows.querySelectorAll('[data-row-id] input[data-field="selected"]').forEach(input => {
      const row = rowById(input.closest('[data-row-id]')?.dataset.rowId);
      if (!row) return;
      input.checked = Boolean(row.selected);
      input.disabled = row.status === 'created';
    });
    const header = els.orderRows.querySelector('[data-select-visible]');
    if (header) {
      const pageRows = currentPageRows();
      header.checked = Boolean(pageRows.length && pageRows.every(row => row.selected || row.status === 'created') && pageRows.some(row => row.status !== 'created'));
    }
  }
  function renderRows() {
    const rows = withIssueCache(() => filteredRows());
    renderPager(rows);
    const locked = Boolean(state.running || state.uiBusy);
    els.orderRows.classList.toggle('rows-locked', locked);
    els.orderRows.setAttribute('aria-busy', locked ? 'true' : 'false');
    if (!state.rows.length) {
      const html = '<button class="empty-import-drop" type="button" data-empty-import><span class="empty-import-icon">⇧</span><b>Перетащите сюда XLSX или CSV</b><small>или нажмите, чтобы выбрать файл</small></button>';
      const key = markupCacheKey(html);
      if (lastRowsHtml !== key) {
        els.orderRows.innerHTML = html;
        lastRowsHtml = key;
      }
      return;
    }
    if (!rows.length) {
      const html = '<div class="empty-state">По текущему фильтру строк нет.</div>';
      const key = markupCacheKey(html);
      if (lastRowsHtml !== key) {
        els.orderRows.innerHTML = html;
        lastRowsHtml = key;
      }
      return;
    }
    const pageSize = currentPageSize();
    const from = state.page * pageSize;
    const pageRows = rows.slice(from, from + pageSize);
    els.orderRows.classList.toggle('table-mode', state.viewMode === 'table');
    const html = withRowRenderCaches(() => state.viewMode === 'table' ? renderTableRows(pageRows) : renderCardMode(pageRows));
    const key = markupCacheKey(html);
    if (lastRowsHtml !== key) {
      els.orderRows.innerHTML = html;
      lastRowsHtml = key;
      restoreVirtualScrollPosition();
      syncRowsEditLock(true);
    } else {
      syncRowsEditLock();
    }
  }
  function scheduleVirtualRowsRender() {
    if (virtualRowsFrame) return;
    virtualRowsFrame = requestAnimationFrame(() => {
      virtualRowsFrame = 0;
      renderVisibleRowsOnly();
    });
  }
  function handleVirtualRowsScroll(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('[data-virtual-scroll="cards"]')) {
      virtualCardScrollTop = target.scrollTop;
      scheduleVirtualRowsRender();
      return;
    }
    if (target.matches('.table-mode-wrap')) {
      virtualTableScrollTop = target.scrollTop;
      scheduleVirtualRowsRender();
      return;
    }
    const detail = target.closest?.('.table-detail-floating .table-detail-card');
    if (detail && target === detail) {
      const rowId = detail.closest('.table-detail-floating')?.dataset.rowId;
      if (rowId) tableDetailScrollTopByRow.set(rowId, detail.scrollTop);
    }
  }
  function handleNestedTableWheel(event) {
    const detail = event.target?.closest?.('.table-detail-floating .table-detail-card');
    if (!detail) return;
    const rowId = detail.closest('.table-detail-floating')?.dataset.rowId;
    if (rowId) tableDetailScrollTopByRow.set(rowId, detail.scrollTop);
  }
  function focusRow(rowId) {
    const row = rowById(rowId);
    if (!row) return;
    let rows = filteredRows();
    let index = rows.findIndex(item => item.id === rowId);
    if (index < 0) {
      state.filter.status = 'all';
      rows = filteredRows();
      index = rows.findIndex(item => item.id === rowId);
    }
    if (index >= 0) {
      const pageSize = currentPageSize();
      state.page = Math.floor(index / pageSize);
      const indexInPage = index % pageSize;
      pendingVirtualScrollTop = {
        mode: state.viewMode === 'table' ? 'table' : 'cards',
        top: Math.max(0, indexInPage * (state.viewMode === 'table' ? TABLE_VIRTUAL_ROW_HEIGHT : CARD_VIRTUAL_ROW_HEIGHT) - 80)
      };
    }
    state.activeRowId = rowId;
    state.expandedRowId = rowId;
    moveRowToIssueTab(row);
    saveStateSoon(250);
    renderOrderWorkspace();
    setTimeout(() => {
      const target = document.querySelector(`[data-row-id="${escapeCssIdent(rowId)}"]`);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.classList.add('row-focus-flash');
      setTimeout(() => target?.classList.remove('row-focus-flash'), 1400);
    }, 0);
  }
  function runWorkflowAction(action) {
    if (action === 'new-session') {
      void resetWorkSession();
      return;
    }
    if (action === 'client') {
      els.innInput?.focus();
      els.innInput?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (action === 'schedule') {
      els.defaultTakeDate?.focus();
      els.defaultTakeDate?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (action === 'import') {
      els.importFileInput?.click();
      return;
    }
    if (action === 'calculate') {
      void calculateRows();
      return;
    }
    if (action === 'resolve') {
      void resolveAddresses();
      return;
    }
    if (action === 'problems') {
      enterReviewMode(true);
      return;
    }
    if (action === 'exit-review') {
      exitReviewMode();
      return;
    }
    if (action === 'select-ready') {
      state.rows.forEach(row => { row.selected = rowReadyForCreate(row); });
      state.filter.status = 'all';
      state.page = 0;
      saveState();
      render();
      return;
    }
    if (action === 'create') {
      void createOrders();
    }
  }
  async function resetWorkSession() {
    const ok = await confirmAction({
      title: 'Начать заново',
      message: 'Сбросить текущий сеанс работы? Креды, токены и настройки доступа останутся.',
      detailsHtml: `<div class="create-preview-summary"><span>Будет очищено</span><b>${escapeHtml(state.rows.length)} строк</b><span>Клиент, ИНН, дата/время, созданные заказы и результаты отмены будут сброшены.</span></div>`,
      confirmText: 'Начать заново'
    });
    if (!ok) return;
    clearTimeout(autoClientSearchTimer);
    clearTimeout(autoResolveTimer);
    clearTimeout(autoCalculateTimer);
    state.settings.userInn = '';
    state.settings.userId = '';
    state.settings.userDisplay = '';
    state.settings.takeDate = '';
    state.settings.takeTimeFrom = '';
    state.settings.takeTimeTo = '';
    state.bulk = defaultBulkState();
    state.filter = { status: 'all', sort: 'index' };
    state.rows = [];
    state.created = [];
    state.cancelResults = [];
    state.cancelTotal = 0;
    state.page = 0;
    state.activeRowId = '';
    state.expandedRowId = '';
    state.createProgress = { active: false, total: 0, done: 0, success: 0, errors: 0 };
    invalidateRowsRenderCache();
    saveState();
    await syncToolkitCredentials();
    render();
    window.parent?.postMessage({ type: 'ops-toolkit-client-cleared', tool: 'orders', projectId: state.settings.projectId }, location.origin);
    showToast('Сеанс очищен. Можно выбрать клиента и загрузить новый файл.', 'ready');
  }
  function clearRowFieldErrors(row, paths = null) {
    if (!row) return;
    row.fieldErrors = normalizeFieldErrors(row.fieldErrors);
    if (!paths) {
      row.fieldErrors = {};
      return;
    }
    paths.forEach(path => delete row.fieldErrors[path]);
  }
  function addFieldError(errors, path, message) {
    errors[path] = message || 'Проверьте поле';
  }
  function collectPersonFieldErrors(row, side, errors, includeContacts = false) {
    const person = row?.[side] || {};
    const title = side === 'sender' ? 'Отправитель' : 'Получатель';
    if (includeContacts) {
      if (!String(person.name || '').trim()) addFieldError(errors, `${side}.name`, `${title}: заполните организацию`);
      if (!String(person.contact || '').trim()) addFieldError(errors, `${side}.contact`, `${title}: заполните контакт`);
      if (!String(person.phone || '').trim()) addFieldError(errors, `${side}.phone`, `${title}: заполните телефон`);
    }
    if (!String(person.city || '').trim()) addFieldError(errors, `${side}.city`, `${title}: заполните город`);
    if (!personAddress(person)) addFieldError(errors, `${side}.address`, `${title}: заполните адрес`);
    if (row?.status === 'error' && !person.resolved) {
      addFieldError(errors, `${side}.city`, `${title}: распознайте город`);
      addFieldError(errors, `${side}.address`, `${title}: проверьте адрес`);
    }
  }
  function collectCargoFieldErrors(row, errors) {
    if (!String(row?.cargo?.name || '').trim()) addFieldError(errors, 'cargo.name', 'Заполните описание груза');
    [
      ['cargo.weight', row?.cargo?.weight, 'Укажите вес больше 0'],
      ['cargo.seats', row?.cargo?.seats, 'Укажите количество мест'],
      ['cargo.length', row?.cargo?.length, 'Укажите длину больше 0'],
      ['cargo.width', row?.cargo?.width, 'Укажите ширину больше 0'],
      ['cargo.height', row?.cargo?.height, 'Укажите высоту больше 0']
    ].forEach(([path, value, message]) => {
      if (!(positiveNumber(value, 0) > 0)) addFieldError(errors, path, message);
    });
  }
  function collectIdentityFieldErrors(row, item, errors) {
    if (!item || !companyNeedsIdentity(item.deliveryCompanyLabel) || personIdentityValidForCreation(row.recipient, item, row)) return;
    if (row.recipient.personType === 'physical') {
      addFieldError(errors, 'recipient.passportSeries', 'Укажите серию паспорта');
      addFieldError(errors, 'recipient.passportNumber', 'Укажите номер паспорта');
    } else {
      addFieldError(errors, 'recipient.inn', 'Укажите корректный ИНН');
    }
  }
  function collectScheduleFieldErrors(row, errors) {
    const takeDate = dateInputValue(row?.schedule?.takeDate);
    if (!takeDate) addFieldError(errors, 'schedule.takeDate', 'Укажите дату забора');
    else if (takeDate < todayInputDate()) addFieldError(errors, 'schedule.takeDate', 'Дата не может быть в прошлом');
  }
  function markRowFieldError(row, message, item = selectedTariff(row), options = {}) {
    row.status = 'error';
    row.error = message;
    const errors = {};
    const includeContacts = options.scope === 'create';
    collectPersonFieldErrors(row, 'sender', errors, includeContacts);
    collectPersonFieldErrors(row, 'recipient', errors, includeContacts);
    collectCargoFieldErrors(row, errors);
    if (includeContacts) {
      collectScheduleFieldErrors(row, errors);
      collectIdentityFieldErrors(row, item, errors);
    }
    const text = normalize(message);
    if (text.includes('отправитель') && text.includes('город')) addFieldError(errors, 'sender.city', 'Проверьте город отправителя');
    if (text.includes('получатель') && text.includes('город')) addFieldError(errors, 'recipient.city', 'Проверьте город получателя');
    if (text.includes('отправитель') && text.includes('адрес')) addFieldError(errors, 'sender.address', 'Проверьте адрес отправителя');
    if (text.includes('получатель') && text.includes('адрес')) addFieldError(errors, 'recipient.address', 'Проверьте адрес получателя');
    row.fieldErrors = errors;
  }
  function renderCreated() {
    const created = state.created.filter(item => item.ok);
    const errorRows = state.rows.filter(row => row.status === 'error');
    const total = created.reduce((sum, item) => sum + parseNumber(item.price, 0), 0);
    if (!created.length) createdDrawerOpen = false;
    // Drawer созданных заказов вынесен из потока таблицы, чтобы он не перекрывал строки и пагинацию.
    if (els.createdOrdersPanel) {
      els.createdOrdersPanel.hidden = !created.length;
      const drawerVisible = Boolean(created.length && createdDrawerOpen);
      els.createdOrdersPanel.classList.toggle('is-open', drawerVisible);
      els.createdOrdersPanel.toggleAttribute('open', drawerVisible);
      els.createdOrdersPanel.setAttribute('aria-hidden', drawerVisible ? 'false' : 'true');
    }
    if (els.createdDrawerButton) {
      els.createdDrawerButton.hidden = !created.length;
      els.createdDrawerButton.classList.toggle('active', Boolean(created.length && createdDrawerOpen));
    }
    if (els.createdDrawerBadge) {
      els.createdDrawerBadge.textContent = String(created.length);
    }
    if (els.createdSummaryMeta) {
      els.createdSummaryMeta.textContent = created.length ? `${created.length} заказов · ${moneyText(total)}` : 'Пока нет созданных заказов';
    }
    if (els.createdOrdersPanel) {
      els.createdOrdersPanel.classList.toggle('has-created', Boolean(created.length));
    }
    if (els.retryErrorRowsBtn) {
      els.retryErrorRowsBtn.disabled = state.running || !errorRows.length;
      els.retryErrorRowsBtn.innerHTML = `<span class="button-icon">${icon('refresh')}</span>${errorRows.length ? `Повторить ошибки (${errorRows.length})` : 'Повторить ошибки'}`;
    }
    const createdRenderKey = created.length
      ? markupCacheKey(created.map(item => [item.id, item.title, item.price, item.route, item.ok].join('|')).join('~'))
      : 'empty';
    if (createdRenderKey !== lastCreatedRenderKey) {
      lastCreatedRenderKey = createdRenderKey;
      if (!created.length) {
        els.createdList.innerHTML = '<div class="empty-state">Созданные заказы появятся здесь.</div>';
      } else {
        els.createdList.innerHTML = `<div class="created-summary-strip"><span>Создано: <b>${escapeHtml(created.length)}</b></span><span>Сумма: <b>${moneyText(total)}</b></span><span>ID готовы к копированию</span></div>
          <div class="created-table-list" role="table" aria-label="Созданные заказы">
            <div class="created-table-row created-table-head" role="row"><span>Заказ</span><span>ID</span><span>Сумма</span><span>Маршрут</span><span>Статус</span></div>
            ${created.map(item => `<div class="created-table-row" role="row"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.id || '')}</span><span>${moneyText(item.price || 0)}</span><small>${escapeHtml(item.route || '')}</small><em class="status-pill ready">Создан</em></div>`).join('')}
          </div>`;
      }
    }
    renderCancelResults();
  }
  function renderCancelResults() {
    if (!els.cancelResults) return;
    const items = Array.isArray(state.cancelResults) ? state.cancelResults : [];
    if (!items.length) {
      els.cancelResults.innerHTML = '<div class="empty-mini">Результаты отмены появятся здесь.</div>';
      return;
    }
    els.cancelResults.innerHTML = items.map(item => `<div class="cancel-result-item ${item.ok ? 'ready' : 'error'}"><b>ID ${escapeHtml(item.id)}</b><span>${escapeHtml(item.message || (item.ok ? 'Отменён' : 'Ошибка отмены'))}</span></div>`).join('');
  }
  function renderButtons() {
    const busy = state.running || state.uiBusy;
    const blockedByAccess = !clientReady();
    document.body.classList.toggle('ui-busy', busy);
    [els.resolveBtn, els.calculateBtn, els.createOrdersBtn, els.applyScheduleBtn, els.applyTariffBtn, els.addRowBtn, els.selectAllBtn, els.clearRowsBtn, els.clearDuplicateRowsBtn, els.clearCreatedRowsBtn, els.resetSessionBtn, els.openCancelModalBtn, els.openSettingsModalBtn, els.autoCalculateInput, els.cancelOrdersBtn, els.checkCredentialsBtn, els.retryErrorRowsBtn, els.importFileInput, els.clearDraftsBtn, els.innInput, els.findClientBtn].filter(Boolean).forEach(button => { button.disabled = busy; });
    syncBulkActionLock(busy);
    [els.calculateBtn, els.createOrdersBtn].filter(Boolean).forEach(button => {
      if (!busy) {
        button.disabled = blockedByAccess;
        button.title = blockedByAccess ? 'Сначала проверьте доступ и выберите клиента' : '';
      }
    });
    if (els.fileButton) {
      els.fileButton.classList.toggle('disabled', busy);
      els.fileButton.setAttribute('aria-disabled', busy ? 'true' : 'false');
    }
    if (els.stopBtn) els.stopBtn.disabled = !busy;
    if (els.resolveBtn) els.resolveBtn.innerHTML = busy ? `<span class="button-icon">${icon('refresh')}</span>Идёт обработка...` : `<span class="button-icon">${icon('refresh')}</span>Распознать адреса`;
    const busyLabel = state.uiBusyText || 'Идёт обработка...';
    els.calculateBtn.innerHTML = busy ? `<span class="button-icon">${icon('calculator')}</span>${escapeHtml(busyLabel)}` : `<span class="button-icon">${icon('calculator')}</span>Рассчитать тарифы`;
    const createProgress = state.createProgress || {};
    const createLabel = createProgress.active && createProgress.total ? `Создание ${createProgress.done || 0}/${createProgress.total}` : 'Идёт обработка...';
    els.createOrdersBtn.innerHTML = busy ? `<span class="button-icon">${icon('check')}</span>${escapeHtml(createLabel)}` : `<span class="button-icon">${icon('check')}</span>Создать`;
    if (els.stopBtn) els.stopBtn.hidden = !busy;
    if (els.cancelOrdersBtn) els.cancelOrdersBtn.textContent = busy ? 'Идёт отмена...' : 'Отменить заказы';
    if (els.retryErrorRowsBtn && !busy) {
      const errorRows = state.rows.filter(row => row.status === 'error').length;
      els.retryErrorRowsBtn.disabled = !errorRows;
      els.retryErrorRowsBtn.innerHTML = `<span class="button-icon">${icon('refresh')}</span>${errorRows ? `Повторить ошибки (${errorRows})` : 'Повторить ошибки'}`;
    }
    if (els.viewModeBtn) {
      const toCards = state.viewMode === 'table';
      els.viewModeBtn.innerHTML = icon(toCards ? 'cards' : 'table');
      els.viewModeBtn.title = toCards ? 'Карточный режим' : 'Табличный режим';
      els.viewModeBtn.setAttribute('aria-label', els.viewModeBtn.title);
    }
    syncRowsEditLock();
  }
  function syncBulkActionLock(busy = state.running || state.uiBusy) {
    if (!els.sidePanel) return;
    els.sidePanel.classList.toggle('bulk-action-busy', Boolean(state.uiBusy));
    els.sidePanel.style.setProperty('--bulk-busy-label', `"${String(state.uiBusyText || 'Идёт применение...').replace(/["\\]/g, '\\$&')}"`);
    els.sidePanel.querySelectorAll('.apply-action-button, #bulkTariffMode, #bulkPreferredCompanies, #bulkPreferredList input, #bulkTariffCombo input, #bulkServicesPanel input, #bulkServicesPanel select, #bulkServicesPanel button, #defaultTakeDate, #defaultTimeFrom, #defaultTimeTo').forEach(control => {
      if (busy) {
        if (!control.disabled) {
          control.dataset.busyDisabled = 'true';
          control.disabled = true;
        }
        return;
      }
      if (control.dataset.busyDisabled) {
        control.disabled = false;
        delete control.dataset.busyDisabled;
      }
    });
  }
  function syncRowsEditLock(force = false) {
    if (!els.orderRows) return;
    const locked = Boolean(state.running || state.uiBusy);
    els.orderRows.classList.toggle('rows-locked', locked);
    els.orderRows.setAttribute('aria-busy', locked ? 'true' : 'false');
    if (!force && lastRowsLocked === locked) return;
    lastRowsLocked = locked;
    els.orderRows.querySelectorAll('input, select, textarea, button').forEach(control => {
      if (locked) {
        if (!control.disabled) {
          control.dataset.busyDisabled = 'true';
          control.disabled = true;
        }
        return;
      }
      if (control.dataset.busyDisabled) {
        control.disabled = false;
        delete control.dataset.busyDisabled;
      }
    });
  }
  function render() {
    renderSettings();
    renderSidebarState();
    renderBulkControls();
    renderStats();
    renderCreateProgress();
    renderRows();
    renderCreated();
    renderButtons();
  }
  function renderOrderWorkspace() {
    renderStats();
    renderCreateProgress();
    renderRows();
    renderCreated();
    renderButtons();
  }
  function replaceVisibleRowMarkup(row) {
    if (!row || !els.orderRows) return false;
    const selector = `[data-row-id="${escapeCssIdent(row.id)}"]`;
    if (state.viewMode === 'table') {
      const tr = els.orderRows.querySelector(`tr.order-table-row${selector}`);
      if (!tr) return false;
      const temp = document.createElement('tbody');
      temp.innerHTML = tableRowMarkup(row);
      const next = temp.firstElementChild;
      if (!next) return false;
      tr.replaceWith(next);
      return true;
    }
    const card = els.orderRows.querySelector(`.order-list-card${selector}`);
    if (!card) return false;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = orderListCard(row, state.activeRowId === row.id);
    const next = wrapper.firstElementChild;
    if (!next) return false;
    card.replaceWith(next);
    return true;
  }
  function replaceActiveDetailMarkup(row) {
    if (!row || !els.orderRows) return false;
    if (state.viewMode === 'table' && state.expandedRowId === row.id) {
      const floating = els.orderRows.querySelector(`.table-detail-floating[data-row-id="${escapeCssIdent(row.id)}"]`);
      if (!floating) return false;
      const savedTop = floating.querySelector('.table-detail-card')?.scrollTop || 0;
      const pageRows = currentPageRows();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = tableDetailFloatingMarkup(pageRows);
      const next = wrapper.firstElementChild;
      if (!next) return false;
      floating.replaceWith(next);
      const detail = next.querySelector('.table-detail-card');
      if (detail) detail.scrollTop = savedTop;
      return true;
    }
    if (state.viewMode === 'cards' && state.activeRowId === row.id) {
      const detail = els.orderRows.querySelector(`.detail-panel[data-row-id="${escapeCssIdent(row.id)}"]`);
      if (!detail) return false;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = cardDetailMarkup(row);
      const next = wrapper.firstElementChild;
      if (!next) return false;
      detail.replaceWith(next);
      return true;
    }
    return false;
  }
  function refreshSingleRow(row, options = {}) {
    const rowUpdated = replaceVisibleRowMarkup(row);
    const detailUpdated = options.detail ? replaceActiveDetailMarkup(row) : false;
    if (rowUpdated || detailUpdated) {
      syncRowsEditLock(true);
      hydrateIcons();
      return true;
    }
    renderRows();
    return false;
  }

  function updateSettingFromInput(input) {
    const map = {
      projectSelect: 'projectId', emailInput: 'email', passwordInput: 'password', dadataInput: 'tokenDaData',
      innInput: 'userInn', concurrencySelect: 'concurrency', timeoutInput: 'timeoutMs', retriesSelect: 'retries', densitySelect: 'density', defaultTakeDate: 'takeDate',
      showOnboardingInput: 'showOnboarding', performanceModeInput: 'performanceMode', defaultTimeFrom: 'takeTimeFrom', defaultTimeTo: 'takeTimeTo', autoCalculateInput: 'autoCalculate'
    };
    const key = map[input.id];
    if (!key) return;
    let value = input.type === 'checkbox' ? input.checked : input.value;
    if (key === 'userInn') {
      value = sanitizeInn(value);
      input.value = value;
    }
    if (key === 'timeoutMs') {
      value = calculationTimeoutMs(value);
      input.value = String(value);
    }
    if (key === 'retries') value = calculationRetries(value);
    if (key === 'density' && !['comfortable', 'compact', 'dense'].includes(value)) value = 'comfortable';
    if (key === 'takeDate') {
      value = value ? clampDateNotPast(value) : '';
      input.value = value;
    }
    state.settings[key] = value;
    if (key === 'projectId' || key === 'userInn') {
      state.settings.userId = '';
      state.settings.userDisplay = '';
    }
    if (['projectId', 'email', 'password'].includes(key)) {
      state.settings.authChecked = false;
      if (els.settingsAuthStatus) {
        els.settingsAuthStatus.className = 'settings-auth-status';
        els.settingsAuthStatus.textContent = 'Доступ не проверен';
      }
    }
    const liveCredentials = ['email', 'password', 'tokenDaData', 'userInn'].includes(key);
    liveCredentials ? saveStateSoon() : saveState();
    if (liveCredentials) syncToolkitCredentialsSoon();
    renderStats();
    renderClient();
    if (key === 'density') applyTheme();
    if (key === 'performanceMode') {
      applyTheme();
      bulkServiceVisibleLimits.clear();
      renderBulkControls();
      renderRows();
    }
    if (key === 'userInn') scheduleClientSearch();
    if (key === 'autoCalculate' && state.settings.autoCalculate) {
      scheduleAutoResolveForRows(state.rows);
      scheduleAutoCalculateForReadyRows(state.rows);
    }
  }
  function handleRowInput(event) {
    if (state.running) {
      event.preventDefault();
      event.stopPropagation();
      syncRowsEditLock();
      showToast('Дождитесь завершения обработки. Поля заказа временно заблокированы.', 'error');
      return;
    }
    const card = event.target.closest('[data-row-id]');
    const row = rowById(card?.dataset.rowId);
    if (!row) return;
    if (row.status === 'created') {
      row.selected = false;
      renderOrderWorkspace();
      return;
    }
    if (event.target.matches('[data-tariff-search]')) {
      row.tariffSearch = event.target.value;
      updateRowTariffCombo(card, row);
      saveStateSoon();
      return;
    }
    if (event.target.matches('[data-service-param]')) {
      const serviceKey = event.target.dataset.serviceParam;
      const paramKey = event.target.dataset.paramKey;
      if (serviceKey && paramKey) {
        row.servicesOpen = true;
        rowServiceState(row, serviceKey).params[paramKey] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        row.error = '';
        clearRowFieldErrors(row, [`service.${serviceKey}.${paramKey}`]);
        if (row.status === 'error') row.status = 'imported';
        saveStateSoon();
        renderStatsSoon();
      }
      return;
    }
    if (event.target.tagName === 'SELECT' || event.target.type === 'radio' || event.target.type === 'checkbox') return;
    if (event.target.matches('[data-field]')) {
      let value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      const fieldName = event.target.dataset.field;
      if (fieldName.endsWith('.inn')) {
        value = sanitizeInn(value);
        event.target.value = value;
      }
      if (fieldName === 'schedule.takeDate') {
        value = scheduleDateValue(value);
        event.target.value = value;
      }
      setPath(row, fieldName, value);
      clearRowFieldErrors(row, [fieldName]);
      if (fieldAffectsAddress(fieldName)) {
        const side = fieldName.split('.')[0];
        row[side].resolved = null;
        row[side].error = '';
        clearRowFieldErrors(row, [`${side}.city`, `${side}.address`]);
        if (row.status === 'error') row.status = 'imported';
      }
      if (fieldAffectsCalculation(fieldName)) {
        row.result = null;
        row.tariffKey = '';
        if (row.status === 'calculated') row.status = 'imported';
      }
      if (fieldAffectsAddress(fieldName)) scheduleAutoResolve(row);
      if (fieldAffectsCalculation(fieldName)) scheduleAutoCalculate(row);
      if (fieldName === 'cargo.valueMode') normalizeValueMode(row);
      if (row.status === 'created') row.status = 'calculated';
      row.error = '';
    }
    saveStateSoon();
    renderStatsSoon();
  }
  function handleRowChange(event) {
    if (state.running) {
      event.preventDefault();
      event.stopPropagation();
      syncRowsEditLock();
      showToast('Дождитесь завершения обработки. Поля заказа временно заблокированы.', 'error');
      return;
    }
    const field = event.target.dataset.field;
    const card = event.target.closest('[data-row-id]');
    const row = rowById(card?.dataset.rowId);
    if (!row) return;
    if (event.target.matches('[data-service-key]')) {
      const key = event.target.dataset.serviceKey;
      const item = selectedTariff(row);
      const services = selectedTariffServices(item);
      const service = services.find(candidate => String(candidate.key) === String(key));
      const stateItem = rowServiceState(row, key);
      row.servicesOpen = true;
      stateItem.enabled = Boolean(event.target.checked || service?.required);
      if (stateItem.enabled) {
        serviceIncompatibleKeys(service, services).forEach(incompatibleKey => {
          const incompatible = rowServiceState(row, incompatibleKey);
          if (incompatible) incompatible.enabled = false;
        });
      }
      row.error = '';
      clearRowFieldErrors(row);
      if (row.status === 'error') row.status = 'imported';
      saveStateSoon();
      renderStatsSoon();
      refreshSingleRow(row, { detail: true });
      return;
    }
    if (event.target.matches('[data-service-param]')) {
      const serviceKey = event.target.dataset.serviceParam;
      const paramKey = event.target.dataset.paramKey;
      row.servicesOpen = true;
      if (serviceKey && paramKey) rowServiceState(row, serviceKey).params[paramKey] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      row.error = '';
      clearRowFieldErrors(row, [`service.${serviceKey}.${paramKey}`]);
      if (row.status === 'error') row.status = 'imported';
      saveStateSoon();
      renderStatsSoon();
      return;
    }
    let changed = false;
    if (field && event.target.matches('[data-field]')) {
      changed = true;
      let value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      const previousCargoType = normalizeCargoType(row.cargo?.type);
      if (field.endsWith('.inn')) {
        value = sanitizeInn(value);
        event.target.value = value;
      }
      if (field === 'schedule.takeDate') {
        value = scheduleDateValue(value);
        event.target.value = value;
      }
      if (field === 'cargo.type') value = normalizeCargoType(value);
      if (field === 'sender.personType' || field === 'recipient.personType') value = value === 'physical' ? 'physical' : 'legal';
      setPath(row, field, value);
      clearRowFieldErrors(row, [field]);
      if (field === 'cargo.type') syncCargoNameWithType(row, previousCargoType);
      if (fieldAffectsAddress(field)) {
        const side = field.split('.')[0];
        row[side].resolved = null;
        row[side].error = '';
        clearRowFieldErrors(row, [`${side}.city`, `${side}.address`]);
        if (row.status === 'error') row.status = 'imported';
      }
      if (fieldAffectsCalculation(field)) {
        row.result = null;
        row.tariffKey = '';
        row.error = '';
        clearRowFieldErrors(row);
        if (row.status === 'calculated' || row.status === 'error') row.status = 'imported';
      }
    }
    if (field === 'sender.personType' || field === 'recipient.personType') {
      saveStateSoon(250);
      refreshSingleRow(row, { detail: true });
      return;
    }
    if (field === 'tariffKey') {
      const item = selectedTariff(row);
      normalizeValueMode(row, item);
      row.servicesVisibleLimit = servicesRenderChunk();
      saveStateSoon(250);
      renderStats();
      refreshSingleRow(row, { detail: true });
      scheduleBulkControlsRender();
      return;
    }
    if (field === 'cargo.type' || field === 'cargo.valueMode') {
      normalizeValueMode(row);
      saveStateSoon(250);
      refreshSingleRow(row, { detail: true });
    }
    if (field === 'selected') {
      bulkServiceCatalogKey = '';
      saveStateSoon(250);
      syncVisibleSelectionControls();
      renderStats();
      scheduleBulkControlsRender();
      return;
    }
    if (fieldAffectsAddress(field)) scheduleAutoResolve(row);
    if (fieldAffectsCalculation(field)) scheduleAutoCalculate(row);
    if (changed) {
      saveStateSoon();
      renderStatsSoon();
    }
  }
  function handleServicesToggle(event) {
    const details = event.target.closest?.('[data-services-details]');
    if (!details) return;
    const card = details.closest('[data-row-id]');
    const row = rowById(card?.dataset.rowId);
    if (!row) return;
    row.servicesOpen = Boolean(details.open);
    saveState();
  }

  function stopCurrentOperation() {
    if (!state.running) return;
    state.running = false;
    clearTimeout(autoResolveTimer);
    clearTimeout(autoCalculateTimer);
    renderButtons();
    setStatus('Остановка запрошена. Уже отправленные запросы завершаются, новые не стартуют.', 'error');
  }

  function togglePasswordVisibility() {
    if (!els.passwordInput || !els.togglePasswordBtn) return;
    const visible = els.passwordInput.type === 'text';
    els.passwordInput.type = visible ? 'password' : 'text';
    els.togglePasswordBtn.innerHTML = icon(visible ? 'eye' : 'eye-off');
    els.togglePasswordBtn.title = visible ? 'Показать пароль' : 'Скрыть пароль';
    els.togglePasswordBtn.setAttribute('aria-label', els.togglePasswordBtn.title);
  }

  async function checkCredentials() {
    state.settings.email = els.emailInput.value.trim();
    state.settings.password = els.passwordInput.value;
    state.settings.tokenDaData = els.dadataInput.value.trim();
    saveState();
    const settings = credentials();
    if (!settings.email || !settings.password || !settings.tokenDaData) {
      state.settings.authChecked = false;
      renderSettings();
      setStatus('Введите email, пароль проекта и DaData token.', 'error');
      return;
    }
    try {
      if (els.settingsAuthStatus) {
        els.settingsAuthStatus.className = 'settings-auth-status running';
        els.settingsAuthStatus.textContent = 'Проверяю доступ...';
      }
      const result = await KDBridge.rpc('auth', { projectId: settings.projectId, email: settings.email, password: settings.password, force: true });
      if (!result?.token) throw new Error('ЛК не вернул authToken');
      state.settings.authChecked = true;
      saveState();
      void syncToolkitCredentials();
      renderSettings();
      setStatus('Доступ проверен, логин и пароль подходят.', 'ready');
    } catch (error) {
      state.settings.authChecked = false;
      saveState();
      renderSettings();
      setStatus(`Не удалось авторизоваться: ${error.message || error}. Проверьте логин и пароль.`, 'error');
    }
  }

  async function findClient() {
    const settings = credentials();
    const previousClientId = String(state.settings.userId || '');
    state.settings.userInn = sanitizeInn(state.settings.userInn);
    if (!validInn(state.settings.userInn)) {
      setStatus('Введите ИНН клиента: 10 или 12 цифр.', 'error');
      return;
    }
    if (!settings.email || !settings.password) {
      setStatus('Сначала заполните логин и пароль проекта в настройках.', 'error');
      return;
    }
    try {
      setStatus('Ищу клиента в ЛК...', 'running');
      const result = await KDBridge.rpc('searchUser', { projectId: settings.projectId, email: settings.email, password: settings.password, inn: sanitizeInn(state.settings.userInn) });
      state.settings.userId = result.id;
      state.settings.userDisplay = result.display;
      if (previousClientId && previousClientId !== String(result.id || '')) invalidateClientResults(result.id);
      saveState();
      void syncToolkitCredentials();
      render();
      setStatus(`Клиент выбран: ${result.display} · ID ${result.id}`, 'ready');
    } catch (error) {
      state.settings.userId = '';
      state.settings.userDisplay = '';
      saveState();
      render();
      setStatus(`Клиент не найден: ${error.message || error}`, 'error');
    }
  }
  function scheduleClientSearch() {
    clearTimeout(autoClientSearchTimer);
    const settings = credentials();
    if (!validInn(state.settings.userInn) || !settings.email || !settings.password || state.settings.userId) return;
    autoClientSearchTimer = setTimeout(() => {
      void findClient();
    }, 550);
  }
  function shouldAutoResolve(row) {
    if (state.running || !credentials().tokenDaData || row.status === 'created') return false;
    return ['sender', 'recipient'].some(side => !personMissingAddressFields(row[side]).length && personAddress(row[side]) && !row[side].resolved);
  }
  function scheduleAutoResolve(row) {
    scheduleAutoResolveForRows([row]);
  }
  function scheduleAutoResolveForRows(rows = state.rows) {
    const targets = rows.filter(shouldAutoResolve);
    if (!targets.length) return;
    clearTimeout(autoResolveTimer);
    autoResolveTimer = setTimeout(() => {
      void resolveAddressesForRows(targets, true);
    }, 650);
  }
  function shouldAutoCalculate(row) {
    if (!state.settings.autoCalculate || state.running || row.status === 'created') return false;
    if (rowHasReadyCalculation(row)) return false;
    if (!credentials().userId) return false;
    if (personMissingAddressFields(row.sender).length || personMissingAddressFields(row.recipient).length) return false;
    if (cargoMissingRequiredFields(row).length) return false;
    return Boolean(row.sender.resolved && row.recipient.resolved);
  }
  function scheduleAutoCalculate(row) {
    if (!shouldAutoCalculate(row)) return;
    clearTimeout(autoCalculateTimer);
    autoCalculateTimer = setTimeout(() => {
      void calculateRows([row], true);
    }, 900);
  }
  function scheduleAutoCalculateForReadyRows(rows = state.rows) {
    if (!state.settings.autoCalculate || state.running) return;
    const targets = rows.filter(shouldAutoCalculate);
    if (!targets.length) return;
    clearTimeout(autoCalculateTimer);
    autoCalculateTimer = setTimeout(() => {
      void calculateRows(targets, true);
    }, 900);
  }
  async function resolveAddressesForRows(rows, auto = false) {
    const settings = credentials();
    if (!settings.tokenDaData) {
      if (!auto) setStatus('Укажите DaData token.', 'error');
      return;
    }
    if (state.running) return;
    state.running = true;
    renderButtons();
    let done = 0;
    let errors = 0;
    const jobs = [];
    rows.filter(row => row.status !== 'created').forEach(row => {
      ['sender', 'recipient'].forEach(side => {
        const missing = personMissingAddressFields(row[side]);
        if (missing.length) {
          if (!auto) {
            markRowFieldError(row, `${side === 'sender' ? 'Отправитель' : 'Получатель'}: заполните ${missing.join(', ')}`);
            errors += 1;
          }
          return;
        }
        const query = String(row[side].city || '').trim();
        if (!query || row[side].resolved) return;
        jobs.push({ row, side, query });
      });
    });
    if (!jobs.length) {
      state.running = false;
      renderButtons();
      if (errors) {
        saveState();
        renderOrderWorkspace();
        if (!auto) setStatus(`Распознавание не запущено: ${errors} строк с незаполненным городом или адресом.`, 'error');
        return;
      }
      if (!auto) setStatus('Нет адресов для распознавания.', 'ready');
      return;
    }
    setStatus(`${auto ? 'Автораспознавание адресов' : 'Распознаю адреса'}: 0 / ${jobs.length}`, 'running');
    for (const job of jobs) {
      try {
        job.row[job.side].resolved = await KDBridge.rpc('resolveAddress', { projectId: settings.projectId, tokenDaData: settings.tokenDaData, query: job.query });
        job.row[job.side].error = '';
        clearRowFieldErrors(job.row, [`${job.side}.city`, `${job.side}.address`]);
        if (job.row.status === 'error') {
          job.row.error = '';
          job.row.status = 'imported';
        }
      } catch (error) {
        errors += 1;
        job.row[job.side].error = error.message || String(error);
        markRowFieldError(job.row, `${job.side === 'sender' ? 'Отправитель' : 'Получатель'}: ${job.row[job.side].error}`);
      }
      done += 1;
      if (done % 5 === 0 || done === jobs.length) setStatus(`${auto ? 'Автораспознавание адресов' : 'Распознаю адреса'}: ${done} / ${jobs.length}`, 'running');
    }
    state.running = false;
    saveState();
    renderOrderWorkspace();
    setStatus(`${auto ? 'Автораспознавание' : 'Распознавание'} завершено: ${done - errors} успешно, ${errors} ошибок.`, errors ? 'error' : 'ready');
    if (auto) scheduleAutoCalculateForReadyRows(rows);
  }
  async function resolveAddresses() {
    return resolveAddressesForRows(state.rows, false);
  }
  async function runConcurrent(items, limit, worker) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length && state.running) {
        const index = cursor++;
        await worker(items[index], index);
      }
    });
    await Promise.all(workers);
  }
  async function calculateRows(rowsOverride = null, auto = false) {
    const settings = credentials();
    if (auto && state.running) return;
    if (!auto && !requireAccessAndClient('рассчитать тарифы')) return;
    if (!settings.userId) {
      if (!auto) setStatus('Сначала найдите клиента по ИНН.', 'error');
      return;
    }
    const candidates = Array.isArray(rowsOverride) ? rowsOverride.filter(row => row.status !== 'created') : state.rows.filter(row => row.selected && row.status !== 'created');
    const skippedReady = candidates.filter(rowHasReadyCalculation).length;
    const targets = candidates.filter(row => !rowHasReadyCalculation(row));
    if (!targets.length) {
      if (!auto) {
        setStatus(skippedReady ? `Все выбранные строки уже распознаны и рассчитаны. Пропущено: ${skippedReady}.` : 'Выберите строки для расчёта.', skippedReady ? 'ready' : 'error');
      }
      return;
    }
    const needResolve = targets.filter(row => (!row.sender.resolved || !row.recipient.resolved) && !personMissingAddressFields(row.sender).length && !personMissingAddressFields(row.recipient).length && !cargoMissingRequiredFields(row).length);
    if (needResolve.length && settings.tokenDaData) await resolveAddressesForRows(needResolve, true);
    state.running = true;
    renderButtons();
    let done = 0;
    let errors = 0;
    setStatus(`Расчёт тарифов: 0 / ${targets.length}`, 'running');
    await runConcurrent(targets, concurrency(), async row => {
      try {
        const senderMissing = personMissingAddressFields(row.sender);
        const recipientMissing = personMissingAddressFields(row.recipient);
        const cargoMissing = cargoMissingRequiredFields(row);
        if (senderMissing.length) throw new Error(`Отправитель: заполните ${senderMissing.join(', ')}`);
        if (recipientMissing.length) throw new Error(`Получатель: заполните ${recipientMissing.join(', ')}`);
        if (cargoMissing.length) throw new Error(`Груз: заполните ${cargoMissing.join(', ')}`);
        if (!row.sender.resolved || !row.recipient.resolved) throw new Error('Сначала распознайте города отправителя и получателя');
        row.status = 'running';
        row.error = '';
        clearRowFieldErrors(row);
        const payload = {
          projectId: settings.projectId, email: settings.email, password: settings.password, userId: settings.userId,
          senderCity: row.sender.resolved.placeId || row.sender.resolved.kdId,
          recipientCity: row.recipient.resolved.placeId || row.recipient.resolved.kdId,
          cargoType: cargoTypeId(row),
          cargoWeight: positiveNumber(row.cargo.weight, 0.1),
          cargoSeats: Math.max(1, Math.round(positiveNumber(row.cargo.seats, 1))),
          cargoLength: positiveNumber(row.cargo.length, 10),
          cargoWidth: positiveNumber(row.cargo.width, 10),
          cargoHeight: positiveNumber(row.cargo.height, 10),
          exclusions: ['Достависта', 'Пешкарики', 'Яндекс Доставка', 'Yandex'],
          bestMethodMode: 'door',
          orderCreatorCompact: true,
          maxConcurrentCalculations: concurrency(),
          timeoutMs: calculationTimeoutMs(),
          retries: calculationRetries()
        };
        const cacheKey = orderCalculationCacheKey(row, settings);
        let result = await state.cache?.get(cacheKey);
        if (result) {
          result = compactOrderCalculationResult({ ...result, cached: true, cacheSource: 'browser' });
          await state.cache?.set(cacheKey, result, 2 * 24 * 60 * 60 * 1000);
        } else {
          result = compactOrderCalculationResult(await KDBridge.rpc('calculate', payload));
          await state.cache?.set(cacheKey, result, 2 * 24 * 60 * 60 * 1000);
        }
        result.calculationContext ||= {
          projectId: settings.projectId,
          clientId: String(settings.userId || ''),
          signature: cacheKey
        };
        row.result = result;
        const item = selectedTariff(row);
        if (!item) throw new Error('Нет тарифов дверь-дверь для создания заказа');
        normalizeValueMode(row, item);
        row.status = 'calculated';
        clearRowFieldErrors(row);
      } catch (error) {
        errors += 1;
        markRowFieldError(row, error.message || String(error), selectedTariff(row), { scope: 'calculate' });
      }
      done += 1;
      if (done % 5 === 0 || done === targets.length) setStatus(`Расчёт тарифов: ${done} / ${targets.length}`, 'running');
      renderStatsSoon(240);
    });
    const stopped = done < targets.length;
    state.running = false;
    saveState();
    renderBulkControls();
    renderOrderWorkspace();
    const skippedText = skippedReady ? `, пропущено ${skippedReady}` : '';
    setStatus(stopped
      ? `Расчёт остановлен: обработано ${done} из ${targets.length}, ошибок ${errors}${skippedText}.`
      : `Расчёт завершён: ${done - errors} успешно, ${errors} ошибок${skippedText}.`,
      stopped || errors ? 'error' : 'ready');
  }
  async function applyScheduleToAll() {
    const takeDate = dateInputValue(els.defaultTakeDate.value);
    if (!takeDate) {
      setStatus('Укажите дату забора перед применением ко всем строкам.', 'error');
      els.defaultTakeDate?.focus();
      return;
    }
    await withUiBusy('Применяем дату...', async () => {
      state.settings.takeDate = clampDateNotPast(takeDate);
      els.defaultTakeDate.value = state.settings.takeDate;
      state.settings.takeTimeFrom = timeInputValue(els.defaultTimeFrom.value);
      state.settings.takeTimeTo = timeInputValue(els.defaultTimeTo.value);
      await processInUiChunks(state.rows, row => {
        row.schedule.takeDate = state.settings.takeDate;
        row.schedule.takeTimeFrom = state.settings.takeTimeFrom;
        row.schedule.takeTimeTo = state.settings.takeTimeTo;
      });
      saveStateSoon(80);
      renderOrderWorkspace();
      announceAction('Дата и время забора применены ко всем строкам.', 'ready');
    });
  }
  function chooseTariffForBulk(row) {
    let tariffs = doorTariffs(row);
    if (state.bulk.mode !== 'manual') {
      const preferred = new Set(state.bulk.preferredCompanies || []);
      tariffs = tariffs.filter(item => preferred.has(item.deliveryCompanyLabel));
    }
    if (state.bulk.mode === 'manual') return tariffs.find(item => tariffSignature(item) === state.bulk.tariffSignature) || null;
    if (state.bulk.mode === 'preferred-fastest') return fastestTariff(tariffs);
    return cheapestTariff(tariffs);
  }
  function addBulkServiceLookupKeys(map, key, value) {
    const raw = String(key || '').trim();
    if (!raw) return;
    map.set(raw, value);
    map.set(normalize(raw), value);
  }
  function buildBulkServiceSelectionLookup() {
    // Выбор услуг хранится один раз по ТК, а применение ниже сопоставляет его с реальными услугами тарифа строки.
    state.bulk.services = normalizeRowServices(state.bulk.services);
    state.bulk.companyServices = normalizeCompanyServices(state.bulk.companyServices);
    const companyLookup = new Map();
    Object.entries(state.bulk.companyServices).forEach(([company, services]) => {
      const map = new Map();
      Object.entries(services || {}).forEach(([key, value]) => {
        addBulkServiceLookupKeys(map, key, value);
        (Array.isArray(value?.sourceKeys) ? value.sourceKeys : []).forEach(sourceKey => addBulkServiceLookupKeys(map, sourceKey, value));
      });
      companyLookup.set(company, map);
    });
    const manualLookup = new Map();
    Object.entries(state.bulk.services || {}).forEach(([key, value]) => addBulkServiceLookupKeys(manualLookup, key, value));
    return { companyLookup, manualLookup };
  }
  function bulkServiceSelectionForService(lookup, company, service) {
    const maps = [lookup.companyLookup.get(company), state.bulk.mode === 'manual' ? lookup.manualLookup : null].filter(Boolean);
    const candidates = [bulkServiceKey(service), String(service?.key || ''), ...serviceIdentityKeys(service)];
    for (const map of maps) {
      for (const key of candidates) {
        const raw = String(key || '').trim();
        const value = map.get(raw) || map.get(normalize(raw));
        if (value) return value;
      }
    }
    return null;
  }
  function applyBulkServicesToRow(row, item, lookup) {
    if (!item) return;
    const company = item.deliveryCompanyLabel || 'ТК';
    // В строке включаем только те массовые услуги, которые существуют в выбранном тарифе этой строки.
    selectedTariffServices(item).forEach(service => {
      const source = bulkServiceSelectionForService(lookup, company, service);
      const target = rowServiceState(row, service.key);
      target.enabled = Boolean(service.required || source?.enabled);
      target.params = { ...target.params, ...(source?.params || {}) };
    });
  }
  async function applyBulkServicesToAll() {
    await withUiBusy('Применяем услуги...', async () => {
      let applied = 0;
      let skipped = 0;
      const lookup = buildBulkServiceSelectionLookup();
      await processInUiChunks(state.rows.filter(row => row.selected && row.status !== 'created'), row => {
        const item = selectedTariff(row);
        if (!item) {
          skipped += 1;
          return;
        }
        applyBulkServicesToRow(row, item, lookup);
        applied += 1;
      });
      invalidateRowsRenderCache();
      saveStateSoon(80);
      renderOrderWorkspace();
      announceAction(`Услуги применены: ${applied} строк, пропущено ${skipped}.`, skipped ? 'error' : 'ready');
    });
  }
  async function applyTariffToAll() {
    await withUiBusy('Применяем тариф...', async () => {
      let applied = 0;
      let skipped = 0;
      await processInUiChunks(state.rows.filter(row => row.selected && row.status !== 'created'), row => {
        const item = chooseTariffForBulk(row);
        if (!item) {
          skipped += 1;
          return;
        }
        row.tariffKey = tariffKey(item);
        normalizeValueMode(row, item);
        if (row.status !== 'created') row.status = 'calculated';
        row.error = '';
        clearRowFieldErrors(row);
        applied += 1;
      });
      saveStateSoon(80);
      renderOrderWorkspace();
      requestAnimationFrame(() => renderBulkServices());
      announceAction(`Тариф применён: ${applied} строк, пропущено ${skipped}.`, skipped ? 'error' : 'ready');
    });
  }
  function addManualRow() {
    const row = defaultRow({ index: state.rows.length + 1 });
    state.rows.push(row);
    state.activeRowId = row.id;
    state.filter.status = 'all';
    state.page = Math.max(0, Math.ceil(filteredRows().length / currentPageSize()) - 1);
    invalidateRowsRenderCache();
    saveStateSoon(120);
    render();
    setStatus('Добавлена новая строка.', 'ready');
    scheduleAutoResolveForRows(state.rows.slice(-1));
  }
  function deleteRow(rowId) {
    const index = state.rows.findIndex(row => row.id === rowId);
    if (index < 0) return;
    state.rows.splice(index, 1);
    state.rows.forEach((row, idx) => { row.index = idx + 1; });
    if (state.activeRowId === rowId) state.activeRowId = state.rows[0]?.id || '';
    state.page = Math.min(state.page, pagesForRows(filteredRows()) - 1);
    invalidateRowsRenderCache();
    saveStateSoon(120);
    render();
    setStatus('Строка удалена.', 'ready');
  }
  function selectAllFiltered() {
    const rows = filteredRows().filter(row => row.status !== 'created');
    const shouldSelect = rows.some(row => !row.selected);
    rows.forEach(row => { row.selected = shouldSelect; });
    bulkServiceCatalogKey = '';
    saveStateSoon(250);
    syncVisibleSelectionControls();
    renderStats();
    scheduleBulkControlsRender();
    setStatus(shouldSelect ? 'Видимые строки выбраны.' : 'Выбор видимых строк снят.', 'ready');
  }
  async function clearRows() {
    const selected = state.rows.filter(row => row.selected && row.status !== 'created');
    if (!selected.length) {
      setStatus('Выберите заказы, которые нужно удалить.', 'warning');
      return;
    }
    const ok = await confirmAction({
      title: 'Удалить выбранные заказы',
      message: 'Удалить выбранные строки из текущего списка заказов?',
      detailsHtml: `<div class="confirm-summary-line"><b>${escapeHtml(selected.length)} строк</b><span>останутся только остальные заказы из списка.</span></div>`,
      confirmText: 'Удалить выбранные'
    });
    if (!ok) return;
    const removeIds = new Set(selected.map(row => row.id));
    state.rows = state.rows.filter(row => !removeIds.has(row.id));
    state.rows.forEach((row, index) => { row.index = index + 1; });
    if (!state.rows.some(row => row.id === state.activeRowId)) state.activeRowId = state.rows[0]?.id || '';
    if (!state.rows.some(row => row.id === state.expandedRowId)) state.expandedRowId = '';
    state.page = Math.max(0, Math.min(state.page, Math.ceil(state.rows.length / currentPageSize()) - 1));
    state.filter.status = 'all';
    invalidateRowsRenderCache();
    saveStateSoon(120);
    render();
    setStatus(`Удалено выбранных заказов: ${selected.length}.`, 'ready');
  }
  async function clearDuplicateRows() {
    const { removableIds } = duplicateRowIdSets();
    const duplicateRows = state.rows.filter(row => removableIds.has(row.id));
    if (!duplicateRows.length) {
      setStatus('Повторных строк для удаления нет.', 'ready');
      return;
    }
    const ok = await confirmAction({
      title: 'Удалить дубли?',
      message: 'Будут удалены повторные строки, первая строка в каждой группе останется.',
      detailsHtml: `<div class="confirm-summary-line"><b>${escapeHtml(duplicateRows.length)} дублей</b><span>будет удалено из текущего списка.</span></div>`,
      confirmText: 'Удалить дубли'
    });
    if (!ok) return;
    state.rows = state.rows.filter(row => !removableIds.has(row.id));
    state.rows.forEach((row, index) => { row.index = index + 1; });
    if (!state.rows.some(row => row.id === state.activeRowId)) state.activeRowId = state.rows[0]?.id || '';
    if (!state.rows.some(row => row.id === state.expandedRowId)) state.expandedRowId = '';
    state.filter.status = 'all';
    state.page = Math.max(0, Math.min(state.page, Math.ceil(state.rows.length / currentPageSize()) - 1));
    invalidateRowsRenderCache();
    saveStateSoon(120);
    render();
    setStatus(`Удалено дублей: ${duplicateRows.length}.`, 'ready');
  }
  async function clearCreatedRows() {
    const createdRows = state.rows.filter(row => row.status === 'created');
    if (!createdRows.length) {
      setStatus('Созданных строк для удаления нет.', 'ready');
      return;
    }
    const ok = await confirmAction({
      title: 'Удалить созданные строки',
      message: 'Убрать созданные заказы из текущего списка?',
      detailsHtml: `<div class="confirm-summary-line"><b>${escapeHtml(createdRows.length)} строк</b><span>ID останутся в панели созданных заказов.</span></div>`,
      confirmText: 'Удалить созданные'
    });
    if (!ok) return;
    state.rows = state.rows.filter(row => row.status !== 'created');
    state.rows.forEach((row, index) => { row.index = index + 1; });
    if (!state.rows.some(row => row.id === state.activeRowId)) state.activeRowId = state.rows[0]?.id || '';
    if (!state.rows.some(row => row.id === state.expandedRowId)) state.expandedRowId = '';
    state.page = Math.max(0, Math.min(state.page, Math.ceil(state.rows.length / currentPageSize()) - 1));
    invalidateRowsRenderCache();
    saveStateSoon(120);
    render();
    announceAction(`Удалено созданных строк: ${createdRows.length}.`, 'ready');
  }

  function applyValueAttrs(attrs, row, item) {
    const company = item?.deliveryCompanyLabel || '';
    if (companyIsFlipPost(company)) return;
    if (companyIsPek(item || company)) return;
    const value = positiveNumber(row.cargo.insuranceValue || row.cargo.declaredValue, 0);
    if (!(value > 0)) return;
    const isDocumentsDeclared = companyAllowsDeclared(company) && normalizeCargoType(row.cargo.type) === 'documents';
    if (isDocumentsDeclared) {
      attrs.declared_value = value;
      attrs.declared_value_rate = value;
      attrs.customs_value = value;
      return;
    }
    attrs.insurance_rate = value;
  }
  function enabledServicesForOrder(row, item) {
    return selectedTariffServices(item).filter(service => serviceEnabled(row, service));
  }
  function serviceParamIsFilled(value, param) {
    if (serviceParamIsBoolean(param)) return true;
    return String(value ?? '').trim() !== '';
  }
  function validateServices(row, item) {
    const services = enabledServicesForOrder(row, item);
    for (const service of services) {
      const params = Array.isArray(service.params) ? service.params : [];
      for (const param of params) {
        const value = serviceParamValue(row, service, param);
        if (serviceParamRequired(param) && !serviceParamIsFilled(value, param)) {
          return `Доп. услуга «${service.caption || service.key}»: заполните «${param.caption || param.key}»`;
        }
      }
      if (Array.isArray(service.incompatibleServices) && service.incompatibleServices.length) {
        const incompatible = services.find(selected => serviceIncompatibleKeys(service, services).has(String(selected.key)) && String(selected.key) !== String(service.key));
        if (incompatible) return `Доп. услуга «${service.caption || service.key}» несовместима с услугой «${incompatible.caption || incompatible.key}»`;
      }
    }
    return '';
  }
  function applyServicesAttrs(attrs, row, item) {
    enabledServicesForOrder(row, item).filter(service => !service.virtualReturn).forEach((service, serviceIndex) => {
      attrs[`services][${serviceIndex}][key`] = service.key;
      attrs[`services][${serviceIndex}][enabled`] = 1;
      const params = Array.isArray(service.params) ? service.params : [];
      let paramIndex = 0;
      params.forEach(param => {
        const key = String(param.key || '').trim();
        if (!key) return;
        let value = serviceParamValue(row, service, param);
        if (!serviceParamIsBoolean(param) && String(value ?? '').trim() === '') return;
        if (serviceParamIsBoolean(param)) value = (value === true || value === 'true' || value === 1 || value === '1') ? 1 : 0;
        attrs[`services][${serviceIndex}][params][${paramIndex}][key`] = key;
        attrs[`services][${serviceIndex}][params][${paramIndex}][value`] = value;
        paramIndex += 1;
      });
    });
  }
  function applyReturnServiceAttrs(attrs, row, item) {
    if (!item?.returnServiceAllowed) return;
    const service = selectedTariffServices(item).find(candidate => candidate.virtualReturn);
    if (service && serviceEnabled(row, service)) attrs.delivery_method = 2;
  }
  function applyScheduleAttrs(attrs, row) {
    attrs.take_date = dateForApi(row.schedule.takeDate);
    const from = timeParts(row.schedule.takeTimeFrom);
    const to = timeParts(row.schedule.takeTimeTo);
    if (from) {
      attrs.take_time_from = from.hour;
      attrs.take_time_from_minutes = from.minute;
    }
    if (to) {
      attrs.take_time_to = to.hour;
      attrs.take_time_to_minutes = to.minute;
    }
  }
  function validateRow(row, item) {
    const senderMissing = personMissingRequiredFields(row.sender);
    const recipientMissing = personMissingRequiredFields(row.recipient);
    const cargoMissing = cargoMissingRequiredFields(row);
    if (senderMissing.length) return `Отправитель: заполните ${senderMissing.join(', ')}`;
    if (recipientMissing.length) return `Получатель: заполните ${recipientMissing.join(', ')}`;
    if (cargoMissing.length) return `Груз: заполните ${cargoMissing.join(', ')}`;
    const takeDate = dateInputValue(row.schedule.takeDate);
    if (!takeDate) return 'Дата забора: укажите дату';
    if (takeDate < todayInputDate()) return 'Дата забора не может быть в прошлом';
    const value = positiveNumber(row.cargo.insuranceValue || row.cargo.declaredValue, 0);
    if (value > 50000 && item && companyAllowsDeclared(item.deliveryCompanyLabel || '') && normalizeCargoType(row.cargo.type) === 'documents') return 'Для документов CSE/OPS лимит объявленной стоимости — 50 000 ₽';
    const serviceError = validateServices(row, item);
    if (serviceError) return serviceError;
    const required = [
      ['Клиент', state.settings.userId],
      ['Тариф', item],
      ['Город отправителя', row.sender.resolved],
      ['Город получателя', row.recipient.resolved],
      ['Адрес отправителя', personAddress(row.sender)],
      ['Адрес получателя', personAddress(row.recipient)]
    ].filter(([, value]) => !value);
    if (required.length) return `Заполните: ${required.map(([label]) => label).join(', ')}`;
    if (companyNeedsIdentity(item.deliveryCompanyLabel) && !personIdentityValidForCreation(row.recipient, item, row)) {
      return row.recipient.personType === 'physical'
        ? 'Для этой ТК укажите паспортные данные получателя. Для ДЛ достаточно выбрать физ. лицо'
        : 'Для этой ТК укажите ИНН получателя-юрлица';
    }
    return '';
  }
  function buildOrderAttributes(row) {
    const item = selectedTariff(row);
    const attrs = {
      status: 0,
      delivery_method: 1,
      user_id: state.settings.userId,
      sender_city: row.sender.resolved?.placeId || row.sender.resolved?.kdId,
      recipient_city: row.recipient.resolved?.placeId || row.recipient.resolved?.kdId,
      sender: row.sender.name,
      sender_contact: row.sender.contact || row.sender.name,
      sender_phone: row.sender.phone,
      sender_address: personApiAddress(row.sender),
      sender_post_index: row.sender.postIndex,
      sender_email: row.sender.email,
      sender_info: row.sender.info,
      sender_inn: row.sender.inn,
      sender_passport_series: row.sender.passportSeries,
      sender_passport_number: row.sender.passportNumber,
      sender_passport_issue_date: dateForApi(row.sender.passportIssueDate),
      recipient: row.recipient.name,
      recipient_contact: row.recipient.contact || row.recipient.name,
      recipient_phone: row.recipient.phone,
      recipient_address: personApiAddress(row.recipient),
      recipient_post_index: row.recipient.postIndex,
      recipient_email: row.recipient.email,
      recipient_info: row.recipient.info,
      recipient_inn: row.recipient.inn,
      recipient_passport_series: row.recipient.passportSeries,
      recipient_passport_number: row.recipient.passportNumber,
      recipient_passport_issue_date: dateForApi(row.recipient.passportIssueDate),
      cargo_type: cargoTypeId(row),
      cargo_name: row.cargo.name,
      cargo_description: row.cargo.name,
      cargo_seats_number: Math.max(1, Math.round(positiveNumber(row.cargo.seats, 1))),
      cargo_weight: positiveNumber(row.cargo.weight, 0.1),
      cargo_length: positiveNumber(row.cargo.length, 10),
      cargo_width: positiveNumber(row.cargo.width, 10),
      cargo_height: positiveNumber(row.cargo.height, 10),
      deliveryCompany: item.deliveryCompany,
      delivery_company: item.deliveryCompany,
      tariff_id: item.tariffId,
      tariff_name: item.tariffName || item.tariffCaption,
      tariff_caption: item.tariffCaption,
      urgency_id: item.urgencyId,
      delivery_type: item.deliveryType,
      tariff_delivery_method: item.deliveryMethod
    };
    applyIdentityChoice(attrs, 'sender', row.sender);
    applyIdentityChoice(attrs, 'recipient', row.recipient);
    applyScheduleAttrs(attrs, row);
    applyValueAttrs(attrs, row, item);
    applyReturnServiceAttrs(attrs, row, item);
    applyServicesAttrs(attrs, row, item);
    return attrs;
  }
  function stableSignature(value) {
    if (Array.isArray(value)) return `[${value.map(stableSignature).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().filter(key => key !== 'status').map(key => `${JSON.stringify(key)}:${stableSignature(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value ?? '');
  }
  function orderSignature(row) {
    return stableSignature(buildOrderAttributes(row));
  }
  function orderDuplicateSignature(row) {
    try {
      return orderSignature(row);
    } catch {
      return stableSignature({
        sender: {
          city: row.sender?.resolved?.placeId || row.sender?.city,
          address: personAddress(row.sender),
          name: row.sender?.name,
          contact: row.sender?.contact,
          phone: row.sender?.phone
        },
        recipient: {
          city: row.recipient?.resolved?.placeId || row.recipient?.city,
          address: personAddress(row.recipient),
          name: row.recipient?.name,
          contact: row.recipient?.contact,
          phone: row.recipient?.phone
        },
        cargo: row.cargo,
        schedule: row.schedule,
        tariff: row.tariffKey || tariffKey(selectedTariff(row))
      });
    }
  }
  function duplicateRowsCacheKey(rows = state.rows) {
    return rows.map(row => [
      state.settings.userId,
      row.id, row.status, row.tariffKey,
      row.sender?.personType, row.sender?.city, row.sender?.address, row.sender?.fullAddress, row.sender?.name, row.sender?.contact, row.sender?.phone,
      row.sender?.postIndex, row.sender?.email, row.sender?.info, row.sender?.inn, row.sender?.passportSeries, row.sender?.passportNumber,
      row.sender?.passportIssueDate, row.sender?.resolved?.placeId, row.sender?.resolved?.kdId,
      row.recipient?.personType, row.recipient?.city, row.recipient?.address, row.recipient?.fullAddress, row.recipient?.name, row.recipient?.contact,
      row.recipient?.phone, row.recipient?.postIndex, row.recipient?.email, row.recipient?.info, row.recipient?.inn, row.recipient?.passportSeries,
      row.recipient?.passportNumber, row.recipient?.passportIssueDate, row.recipient?.resolved?.placeId, row.recipient?.resolved?.kdId,
      row.cargo?.type, row.cargo?.name, row.cargo?.weight, row.cargo?.seats, row.cargo?.length, row.cargo?.width, row.cargo?.height,
      row.cargo?.valueMode, row.cargo?.insuranceValue, row.cargo?.declaredValue,
      row.schedule?.takeDate, row.schedule?.takeTimeFrom, row.schedule?.takeTimeTo,
      stableSignature(row.services)
    ].map(value => String(value ?? '')).join('\u001f')).join('\u001e');
  }
  function duplicateRowIdSets(rows = state.rows) {
    if (rows === state.rows) {
      const key = duplicateRowsCacheKey(rows);
      if (key === duplicateRowsKey) return duplicateRowsCache;
      duplicateRowsKey = key;
    }
    const seen = new Map();
    const duplicateIds = new Set();
    const removableIds = new Set();
    rows.forEach(row => {
      if (row.status === 'created') return;
      const signature = orderDuplicateSignature(row);
      if (!signature) return;
      const first = seen.get(signature);
      if (first) {
        duplicateIds.add(first.id);
        duplicateIds.add(row.id);
        removableIds.add(row.id);
      } else {
        seen.set(signature, row);
      }
    });
    const result = { duplicateIds, removableIds };
    if (rows === state.rows) duplicateRowsCache = result;
    return result;
  }
  function confirmAction({ title, message, detailsHtml = '', confirmText = 'Продолжить', cancelText = 'Отмена' }) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'confirm-modal';
      modal.innerHTML = `<div class="confirm-backdrop"></div><div class="confirm-panel"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${detailsHtml ? `<div class="confirm-details">${detailsHtml}</div>` : ''}<div class="confirm-actions"><button class="button secondary" type="button" data-confirm-cancel>${escapeHtml(cancelText)}</button><button class="button primary" type="button" data-confirm-ok>${escapeHtml(confirmText)}</button></div></div>`;
      const close = value => {
        modal.remove();
        resolve(value);
      };
      modal.querySelector('[data-confirm-cancel]').addEventListener('click', () => close(false));
      modal.querySelector('[data-confirm-ok]').addEventListener('click', () => close(true));
      modal.querySelector('.confirm-backdrop').addEventListener('click', () => close(false));
      document.body.appendChild(modal);
    });
  }
  async function confirmDuplicateOrders(targets) {
    const existing = new Set(state.created.filter(item => item.ok && item.signature).map(item => item.signature));
    const seen = new Set();
    let duplicateCreated = 0;
    let duplicateSelected = 0;
    for (const row of targets) {
      const item = selectedTariff(row);
      if (validateRow(row, item)) continue;
      const signature = orderSignature(row);
      if (existing.has(signature)) duplicateCreated += 1;
      if (seen.has(signature)) duplicateSelected += 1;
      seen.add(signature);
    }
    if (!duplicateCreated && !duplicateSelected) return true;
    const parts = [];
    if (duplicateCreated) parts.push(`уже созданных совпадений: ${duplicateCreated}`);
    if (duplicateSelected) parts.push(`одинаковых строк в текущей выборке: ${duplicateSelected}`);
    return confirmAction({
      title: 'Похожие заказы уже есть',
      message: `${parts.join(', ')}. Точно повторно отправить эти заказы в ЛК?`,
      confirmText: 'Отправить повторно'
    });
  }
  function confirmCreateOrders(targets) {
    const total = targets.length;
    const price = targets.reduce((sum, row) => sum + rowPrice(row), 0);
    const invalid = targets.map(row => ({ row, issues: rowIssues(row) })).filter(item => item.issues.length);
    const detailsHtml = `<div class="create-preview-summary">
        <span>Строк: <b>${escapeHtml(total)}</b></span>
        <span>Сумма: <b>${moneyText(price)}</b></span>
        <span>Проблем: <b>${escapeHtml(invalid.length)}</b></span>
      </div>`;
    return confirmAction({
      title: 'Создать заказы?',
      message: `Будет обработано строк: ${total}. Общая сумма по выбранным тарифам и услугам: ${moneyText(price)}.`,
      detailsHtml,
      confirmText: 'Создать заказы'
    });
  }
  function humanizeCreateError(error) {
    const fieldLabels = {
      user_id: 'клиент',
      sender_city: 'город отправителя',
      recipient_city: 'город получателя',
      sender_address: 'адрес отправителя',
      recipient_address: 'адрес получателя',
      sender: 'организация отправителя',
      recipient: 'организация получателя',
      sender_contact: 'контакт отправителя',
      recipient_contact: 'контакт получателя',
      sender_phone: 'телефон отправителя',
      recipient_phone: 'телефон получателя',
      sender_inn: 'ИНН отправителя',
      recipient_inn: 'ИНН получателя',
      sender_juridical: 'тип отправителя',
      recipient_juridical: 'тип получателя',
      sender_passport_series: 'серия паспорта отправителя',
      sender_passport_number: 'номер паспорта отправителя',
      recipient_passport_series: 'серия паспорта получателя',
      recipient_passport_number: 'номер паспорта получателя',
      cargo_type: 'тип груза',
      cargo_name: 'описание груза',
      cargo_weight: 'вес',
      cargo_seats_number: 'мест',
      cargo_length: 'длина',
      cargo_width: 'ширина',
      cargo_height: 'высота',
      tariff_id: 'тариф',
      tariff_caption: 'название тарифа',
      deliveryCompany: 'транспортная компания',
      take_date: 'дата забора',
      take_time_from: 'время забора с',
      take_time_to: 'время забора до'
    };
    let text = error?.message || String(error || 'Неизвестная ошибка создания');
    text = text.replace(/attributes\[([^\]]+)\]/g, (_, key) => fieldLabels[key] || key.replace(/_/g, ' '));
    Object.entries(fieldLabels).forEach(([key, label]) => {
      text = text.replace(new RegExp(`\\b${key}\\b`, 'g'), label);
    });
    text = text.replace(/\s+/g, ' ').trim();
    if (/CITY_REQUIRED|город/i.test(error?.code || '')) return 'Не распознан город отправителя или получателя. Проверьте город и адрес, затем пересчитайте строку.';
    if (/USER_REQUIRED|клиент/i.test(error?.code || '')) return 'Не выбран клиент. Найдите клиента по ИНН в левой панели.';
    if (/AUTH_REQUIRED|логин|парол/i.test(text)) return 'Не заполнены логин или пароль проекта в настройках доступа.';
    if (/inn|инн/i.test(text)) return `${text}. Проверьте, что выбран тип "Юр. лицо" и указан корректный ИНН.`;
    if (/passport|паспорт/i.test(text)) return `${text}. Для физлица заполните серию, номер и дату выдачи паспорта.`;
    return text || 'ЛК вернул ошибку создания заказа. Проверьте обязательные поля строки.';
  }
  async function createOrders(rowsOverride = null) {
    const settings = credentials();
    if (!requireAccessAndClient('создать заказы')) return;
    if (!settings.email || !settings.password) {
      setStatus('Заполните email и пароль проекта.', 'error');
      return;
    }
    const targets = Array.isArray(rowsOverride) ? rowsOverride.filter(row => row.status !== 'created') : state.rows.filter(row => row.selected && row.status !== 'created');
    if (!targets.length) {
      setStatus('Выберите строки для создания.', 'error');
      return;
    }
    if (!(await confirmDuplicateOrders(targets))) {
      setStatus('Создание отменено: найдены одинаковые заказы.', 'error');
      return;
    }
    if (!(await confirmCreateOrders(targets))) {
      setStatus('Создание заказов отменено.', 'error');
      return;
    }
    state.running = true;
    state.createProgress = { active: true, total: targets.length, done: 0, success: 0, errors: 0, current: 'Подготовка очереди' };
    renderButtons();
    renderCreateProgress();
    renderStatusBars();
    let success = 0;
    let errors = 0;
    for (let offset = 0; offset < targets.length && state.running; offset += CREATE_CHUNK_SIZE) {
      const chunk = targets.slice(offset, offset + CREATE_CHUNK_SIZE);
      setStatus(`Создание заказов: ${state.createProgress.done} / ${targets.length}`, 'running');
      await runConcurrent(chunk, concurrency(), async row => {
        const item = selectedTariff(row);
        const title = `Строка ${row.index} · ${item?.deliveryCompanyLabel || 'ТК'} · ${item ? tariffDisplayName(item) : 'тариф'}`;
        const route = `${personAddress(row.sender)} → ${personAddress(row.recipient)}`;
        state.createProgress.current = title;
        renderCreationUiSoon();
        const validationError = validateRow(row, item);
        let signature = '';
        if (validationError) {
          markRowFieldError(row, validationError, item, { scope: 'create' });
          errors += 1;
          state.createProgress.done += 1;
          state.createProgress.success = success;
          state.createProgress.errors = errors;
          state.createProgress.current = `Ошибка в строке ${row.index}`;
          setStatus(`Создание заказов: ${state.createProgress.done} / ${targets.length}`, 'running');
          renderCreationUiSoon();
          return;
        }
        row.status = 'running';
        row.error = '';
        clearRowFieldErrors(row);
        try {
          signature = orderSignature(row);
          const result = await KDBridge.rpc('createOrder', {
            projectId: settings.projectId,
            email: settings.email,
            password: settings.password,
            attributes: buildOrderAttributes(row),
            maxConcurrentOrders: concurrency()
          });
          const id = result.id || result.orderId || result.requestId || result.attributes?.id || result.raw?.id || 'без номера';
          row.status = 'created';
          row.orderId = id;
          row.selected = false;
          clearRowFieldErrors(row);
          success += 1;
          state.created.unshift({ ok: true, id, title, route, price: rowPrice(row), signature, message: `Заявка ${id} · ${moneyText(rowPrice(row))}`, createdAt: new Date().toLocaleString('ru-RU') });
        } catch (error) {
          markRowFieldError(row, humanizeCreateError(error), item, { scope: 'create' });
          errors += 1;

        } finally {
          state.createProgress.done += 1;
          state.createProgress.success = success;
          state.createProgress.errors = errors;
          state.createProgress.current = row.status === 'created' ? `Создан заказ ${row.orderId}` : `Ошибка в строке ${row.index}`;
          setStatus(`Создание заказов: ${state.createProgress.done} / ${targets.length}`, 'running');
          renderCreationUiSoon();
        }
      });
      saveStateSoon(100);
      renderCreationUiSoon();
    }
    state.running = false;
    state.createProgress = { ...state.createProgress, active: false };
    saveState();
    renderBulkControls();
    renderOrderWorkspace();
    setStatus(`Создание завершено: ${success} успешно, ${errors} ошибок.`, errors ? 'error' : 'ready');
  }
  function exportCreated() {
    const created = state.created.filter(item => item.ok);
    if (!created.length) {
      setStatus('Список созданных заказов пуст.', 'error');
      return;
    }
    const rows = created.map(item => ({
      'Статус': item.ok ? 'Создан' : 'Ошибка',
      'ID заказа': item.id || '',
      'Строка/тариф': item.title || '',
      'Маршрут': item.route || '',
      'Цена': item.price || '',
      'Сообщение': item.message || '',
      'Дата': item.createdAt || ''
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Созданные заказы');
    XLSX.writeFile(book, 'Созданные_заказы.xlsx', { compression: true });
  }
  async function copyCreatedIds() {
    const ids = state.created.filter(item => item.ok && item.id).map(item => String(item.id));
    if (!ids.length) {
      setStatus('Нет ID созданных заказов для копирования.', 'error');
      return;
    }
    const text = ids.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Скопировано ID заказов: ${ids.length}.`, 'ready');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      setStatus(`Скопировано ID заказов: ${ids.length}.`, 'ready');
    }
  }
  function clearCreated() {
    state.created = [];
    saveState();
    renderCreated();
    setStatus('Список созданных заказов очищен.', 'ready');
  }
  async function retryErrorRows() {
    const rows = state.rows.filter(row => row.status === 'error');
    if (!rows.length) {
      setStatus('Нет строк с ошибками для повтора.', 'ready');
      return;
    }
    rows.forEach(row => {
      row.selected = true;
      if (row.error) row.error = '';
    });
    saveStateSoon(250);
    renderBulkControls();
    renderOrderWorkspace();
    await createOrders(rows);
  }
  function parseCancelOrderIds(value) {
    return [...new Set(String(value || '').split(/[\s,;]+/).map(item => item.trim()).filter(Boolean))];
  }
  function openModal(modal, focusTarget) {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => focusTarget?.focus(), 0);
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    const hasOpenModal = [els.cancelModal, els.settingsModal, els.helpModal].some(item => item && !item.hidden);
    if (!hasOpenModal) document.body.classList.remove('modal-open');
  }
  function openCancelModal() {
    openModal(els.cancelModal, els.cancelOrderIdsInput);
  }
  function closeCancelModal() {
    closeModal(els.cancelModal);
  }
  function openSettingsModal() {
    openModal(els.settingsModal, els.emailInput);
  }
  function closeSettingsModal() {
    closeModal(els.settingsModal);
  }
  function openHelpModal() {
    openModal(els.helpModal, els.helpModal?.querySelector('[data-help-modal-close]'));
  }
  function closeHelpModal() {
    closeModal(els.helpModal);
  }
  async function cancelOrders() {
    const settings = credentials();
    if (!settings.email || !settings.password) {
      setStatus('Заполните email и пароль проекта.', 'error');
      return;
    }
    const ids = parseCancelOrderIds(els.cancelOrderIdsInput?.value);
    if (!ids.length) {
      setStatus('Укажите ID заказов для отмены через запятую или с новой строки.', 'error');
      return;
    }
    const ok = await confirmAction({
      title: 'Отменить заказы?',
      message: `Будет отменено заказов: ${ids.length}.`,
      confirmText: 'Отменить заказы'
    });
    if (!ok) return;
    state.running = true;
    state.cancelResults = [];
    state.cancelTotal = ids.length;
    renderButtons();
    renderCancelResults();
    let success = 0;
    let errors = 0;
    await runConcurrent(ids, MAX_CANCEL_CONCURRENCY, async id => {
      setStatus(`Отмена заказов: ${success + errors} / ${ids.length}`, 'running');
      try {
        const result = await KDBridge.rpc('cancelOrder', {
          projectId: settings.projectId,
          email: settings.email,
          password: settings.password,
          id,
          maxConcurrentCancels: MAX_CANCEL_CONCURRENCY
        });
        success += 1;
        state.cancelResults.unshift({ ok: true, id, message: result?.message || 'Отменён' });
      } catch (error) {
        errors += 1;
        state.cancelResults.unshift({ ok: false, id, message: error.message || String(error) });
      }
      renderCancelResults();
    });
    state.running = false;
    state.cancelTotal = ids.length;
    saveState();
    renderButtons();
    renderCancelResults();
    setStatus(`Отмена завершена: ${success} успешно, ${errors} ошибок.`, errors ? 'error' : 'ready');
  }
  async function clearAllCache() {
    try {
      const result = await KDBridge.rpc('clearCache', { category: 'all' });
      const total = result?.stats?.totalEntries ?? 0;
      setStatus(`Кеш очищен. Осталось записей: ${total}.`, 'ready');
    } catch (error) {
      setStatus(`Не удалось очистить кеш: ${error.message || error}`, 'error');
    }
  }

  async function init() {
    cacheElements();
    state.cache = new IndexedCache();
    await loadState();
    try {
      const ping = await KDBridge.ping();
      if (Array.isArray(ping.projects) && ping.projects.length) state.projects = ping.projects;
      void ping;
    } catch {
      setStatus('Нет связи с background. Проверьте, что расширение загружено корректно.', 'error');
    }
    await hydrateToolkitCredentials();
    initToolkitStorageSync();
    if (state.settings.projectId !== workspaceProjectId) await loadProjectWorkspace(state.settings.projectId);
    syncScrolledHeader();
    render();
    hydrateIcons();
    initTooltips();
    els.projectSelect.addEventListener('change', event => {
      void switchActiveProject(event.target.value);
    });
    if (els.settingsProjectTabs) {
      els.settingsProjectTabs.addEventListener('click', event => {
        const button = event.target.closest('[data-settings-project]');
        if (!button || button.dataset.settingsProject === state.settings.projectId) return;
        void switchActiveProject(button.dataset.settingsProject);
      });
    }
    [els.emailInput, els.passwordInput, els.dadataInput, els.innInput, els.concurrencySelect, els.timeoutInput, els.retriesSelect, els.densitySelect, els.showOnboardingInput, els.performanceModeInput, els.defaultTakeDate, els.defaultTimeFrom, els.defaultTimeTo, els.autoCalculateInput].filter(Boolean).forEach(input => {
      const live = input === els.emailInput || input === els.passwordInput || input === els.dadataInput || input === els.innInput;
      input.addEventListener(live ? 'input' : 'change', event => updateSettingFromInput(event.target));
      if (live) input.addEventListener('change', event => updateSettingFromInput(event.target));
    });
    if (els.themeToggleBtn) els.themeToggleBtn.addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; saveState(); applyTheme(); });
    if (els.sidebarToggleBtn) els.sidebarToggleBtn.addEventListener('click', toggleSidebar);
    if (els.sidebarResizer) els.sidebarResizer.addEventListener('pointerdown', startSidebarResize);
    if (els.viewModeBtn) els.viewModeBtn.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'table' ? 'cards' : 'table';
      resetVirtualScroll();
      saveStateSoon(900);
      renderOrderWorkspace();
    });
    if (els.openSettingsModalBtn) els.openSettingsModalBtn.addEventListener('click', openSettingsModal);
    if (els.openHelpModalBtn) els.openHelpModalBtn.addEventListener('click', openHelpModal);
    if (els.togglePasswordBtn) els.togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    if (els.checkCredentialsBtn) els.checkCredentialsBtn.addEventListener('click', checkCredentials);
    $$('[data-settings-modal-close]').forEach(button => button.addEventListener('click', closeSettingsModal));
    $$('[data-help-modal-close]').forEach(button => button.addEventListener('click', closeHelpModal));
    $$('.results-actions button').forEach(button => button.addEventListener('click', event => event.stopPropagation()));
    els.findClientBtn.addEventListener('click', findClient);
    els.innInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      clearTimeout(autoClientSearchTimer);
      void findClient();
    });
    els.innInput.addEventListener('blur', scheduleClientSearch);
    if (els.clearCacheBtn) els.clearCacheBtn.addEventListener('click', clearAllCache);
    if (els.clearDraftsBtn) els.clearDraftsBtn.addEventListener('click', clearLocalDrafts);
    els.downloadTemplateBtn.addEventListener('click', downloadTemplate);
    els.importFileInput.addEventListener('change', importFile);
    initImportDropZone();
    els.applyScheduleBtn.addEventListener('click', applyScheduleToAll);
    if (els.resolveBtn) els.resolveBtn.addEventListener('click', resolveAddresses);
    els.calculateBtn.addEventListener('click', () => calculateRows());
    if (els.stopBtn) els.stopBtn.addEventListener('click', stopCurrentOperation);
    els.createOrdersBtn.addEventListener('click', createOrders);
    els.applyTariffBtn.addEventListener('click', applyTariffToAll);
    els.addRowBtn.addEventListener('click', addManualRow);
    els.selectAllBtn.addEventListener('click', selectAllFiltered);
    els.clearRowsBtn.addEventListener('click', clearRows);
    els.clearDuplicateRowsBtn?.addEventListener('click', clearDuplicateRows);
    els.clearCreatedRowsBtn?.addEventListener('click', clearCreatedRows);
    els.resetSessionBtn?.addEventListener('click', resetWorkSession);
    els.statusFilter.addEventListener('change', event => {
      state.filter.status = event.target.value;
      state.reviewMode = state.filter.status === 'problem';
      if (state.reviewMode) state.viewMode = 'cards';
      state.page = 0;
      resetVirtualScroll();
      saveState();
      render();
    });
    if (els.sortSelect) els.sortSelect.addEventListener('change', event => {
      state.filter.sort = event.target.value;
      state.page = 0;
      resetVirtualScroll();
      saveState();
      render();
    });
    els.bulkTariffMode.addEventListener('change', event => { state.bulk.mode = event.target.value; saveState(); renderBulkControls(); });
    els.bulkCompanySelect.addEventListener('change', event => { state.bulk.company = event.target.value; saveState(); });
    els.bulkPreferredCompanies.addEventListener('change', event => {
      state.bulk.preferredCompanies = [...event.target.selectedOptions].map(option => option.value);
      state.bulk.preferredCompaniesTouched = true;
      saveStateSoon(250);
      scheduleBulkServicesRender();
    });
    if (els.selectAllPreferredBtn) els.selectAllPreferredBtn.addEventListener('click', () => setPreferredCompanies(availablePreferredCompanies()));
    if (els.clearPreferredBtn) els.clearPreferredBtn.addEventListener('click', () => setPreferredCompanies([]));
    if (els.bulkPreferredList) els.bulkPreferredList.addEventListener('change', event => {
      const box = event.target.closest('[data-preferred-company]');
      if (!box) return;
      const set = new Set(state.bulk.preferredCompanies || []);
      box.checked ? set.add(box.value) : set.delete(box.value);
      state.bulk.preferredCompanies = [...set];
      state.bulk.preferredCompaniesTouched = true;
      saveStateSoon(250);
      scheduleBulkServicesRender();
    });
    if (els.bulkTariffCombo) {
      els.bulkTariffCombo.addEventListener('input', event => {
        if (!event.target.matches('[data-bulk-tariff-search]')) return;
        state.bulk.tariffSearch = event.target.value;
        saveStateSoon(450);
        updateBulkTariffCombo();
      });
      els.bulkTariffCombo.addEventListener('click', event => {
        const toggle = event.target.closest('[data-bulk-tariff-toggle]');
        if (toggle) {
          toggleTariffCombo(els.bulkTariffCombo);
          return;
        }
        const option = event.target.closest('[data-bulk-tariff-option]');
        if (!option) return;
        state.bulk.tariffSignature = option.dataset.bulkTariffOption || '';
        saveState();
        renderBulkControls();
        closeTariffCombos();
      });
    }
    if (els.bulkServicesPanel) {
      els.bulkServicesPanel.addEventListener('click', event => {
        const groupToggle = event.target.closest('[data-bulk-services-toggle]');
        if (groupToggle) {
          const company = groupToggle.dataset.bulkServicesToggle;
          const openCompanies = new Set(state.bulk.servicesOpenCompanies || []);
          const shouldOpen = !bulkCompanyServiceSection(company)?.classList.contains('is-open');
          shouldOpen ? openCompanies.add(company) : openCompanies.delete(company);
          state.bulk.servicesOpenCompanies = [...openCompanies];
          saveStateSoon(250);
          setBulkServicesCompanyOpen(company, shouldOpen);
          return;
        }
        if (event.target.closest('[data-apply-bulk-services]')) {
          applyBulkServicesToAll();
          return;
        }
        if (event.target.closest('[data-select-all-bulk-services]')) {
          selectAllBulkServices(true);
          return;
        }
        if (event.target.closest('[data-clear-bulk-services]')) {
          selectAllBulkServices(false);
          return;
        }
        const moreBulkServices = event.target.closest('[data-show-more-bulk-services]');
        if (moreBulkServices) {
          const company = moreBulkServices.dataset.showMoreBulkServices || '';
          const key = `${company}|${normalize(state.bulk.servicesSearch || '')}`;
          bulkServiceVisibleLimits.set(key, (bulkServiceVisibleLimits.get(key) || servicesRenderChunk()) + servicesRenderChunk());
          setBulkServicesCompanyOpen(company, true);
          return;
        }
      });
      els.bulkServicesPanel.addEventListener('input', event => {
        if (event.target.matches('[data-bulk-services-search]')) {
          const cursor = event.target.selectionStart;
          state.bulk.servicesSearch = event.target.value;
          saveStateSoon(450);
          scheduleBulkServicesRender();
          requestAnimationFrame(() => {
            const input = els.bulkServicesPanel.querySelector('[data-bulk-services-search]');
            if (!input) return;
            input.focus();
            if (cursor !== null) input.setSelectionRange(cursor, cursor);
          });
          return;
        }
        if (event.target.matches('[data-bulk-company-service-param]')) {
          updateBulkCompanyServiceParam(event.target);
          return;
        }
        if (event.target.matches('[data-bulk-service-param]')) updateBulkServiceParam(event.target);
      });
      els.bulkServicesPanel.addEventListener('change', event => {
        if (event.target.matches('[data-bulk-services-only-assigned]')) {
          captureBulkServicesOpenCompanies();
          state.bulk.servicesOnlyAssigned = Boolean(event.target.checked);
          saveStateSoon(250);
          scheduleBulkServicesRender();
          return;
        }
        if (event.target.matches('[data-bulk-company-service-param]')) {
          updateBulkCompanyServiceParam(event.target);
          return;
        }
        if (event.target.matches('[data-bulk-service-param]')) {
          updateBulkServiceParam(event.target);
          return;
        }
        const companyCheckbox = event.target.closest('[data-bulk-company-service-key]');
        if (companyCheckbox) {
          updateBulkCompanyServiceCheckbox(companyCheckbox);
          return;
        }
        const checkbox = event.target.closest('[data-bulk-service-key]');
        if (!checkbox) return;
        const key = checkbox.dataset.bulkServiceKey;
        const item = bulkTariffEntries().find(entry => entry.value === state.bulk.tariffSignature)?.item;
        const services = selectedTariffServices(item);
        const service = services.find(candidate => String(candidate.key) === String(key));
        state.bulk.services = normalizeRowServices(state.bulk.services);
        const stateItem = rowServiceState({ services: state.bulk.services }, key);
        stateItem.enabled = Boolean(checkbox.checked || service?.required);
        if (stateItem.enabled) {
          serviceIncompatibleKeys(service, services).forEach(incompatibleKey => {
            const incompatible = rowServiceState({ services: state.bulk.services }, incompatibleKey);
            if (incompatible) incompatible.enabled = false;
          });
        }
        saveStateSoon(250);
        scheduleBulkServicesRender();
      });
    }
    els.orderRows.addEventListener('input', handleRowInput);
    els.orderRows.addEventListener('change', handleRowChange);
    els.orderRows.addEventListener('toggle', handleServicesToggle, true);
    els.orderRows.addEventListener('scroll', handleVirtualRowsScroll, true);
    els.orderRows.addEventListener('wheel', handleNestedTableWheel, { passive: false });
    els.orderRows.addEventListener('error', event => {
      if (event.target?.matches?.('.company-logo img')) {
        event.target.closest('.company-logo')?.classList.remove('has-image');
        event.target.remove();
      }
    }, true);
    els.orderRows.addEventListener('click', event => {
      if (event.target.closest('[data-empty-import]')) {
        els.importFileInput?.click();
        return;
      }
      if (event.target.closest('[data-close-table-detail]')) {
        state.expandedRowId = '';
        saveStateSoon(250);
        renderRows();
        return;
      }
      const showMoreServices = event.target.closest('[data-show-more-services]');
      if (showMoreServices) {
        const row = rowById(showMoreServices.dataset.showMoreServices);
        if (row) {
          row.servicesVisibleLimit = (Number(row.servicesVisibleLimit) || servicesRenderChunk()) + servicesRenderChunk();
          row.servicesOpen = true;
          saveStateSoon(250);
          refreshSingleRow(row, { detail: true });
        }
        return;
      }
      const tariffToggle = event.target.closest('[data-tariff-combo-toggle]');
      if (tariffToggle && !event.target.closest('[data-bulk-tariff-combo]')) {
        toggleTariffCombo(tariffToggle.closest('.tariff-combo'));
        return;
      }
      const rowTariffOption = event.target.closest('[data-row-tariff-option]');
      if (rowTariffOption) {
        const rowId = rowTariffOption.closest('[data-row-id]')?.dataset.rowId;
        const row = rowById(rowId);
        if (row && row.status !== 'created') {
          row.tariffKey = rowTariffOption.dataset.rowTariffOption || '';
          const item = selectedTariff(row);
          normalizeValueMode(row, item);
          row.error = '';
          if (row.status === 'error') row.status = 'calculated';
          saveStateSoon(250);
          closeTariffCombos();
          renderStats();
          refreshSingleRow(row, { detail: true });
          scheduleBulkControlsRender();
        }
        return;
      }
      const selectVisible = event.target.closest('[data-select-visible]');
      if (selectVisible) {
        const checked = Boolean(selectVisible.checked);
        const pageSize = currentPageSize();
        filteredRows().slice(state.page * pageSize, state.page * pageSize + pageSize).forEach(row => { if (row.status !== 'created') row.selected = checked; });
        bulkServiceCatalogKey = '';
        saveStateSoon(250);
        syncVisibleSelectionControls();
        renderStats();
        scheduleBulkControlsRender();
        return;
      }
      const cargoButton = event.target.closest('[data-cargo-type]');
      if (cargoButton) {
        const rowId = cargoButton.closest('[data-row-id]')?.dataset.rowId;
        const row = rowById(rowId);
        if (row && updateCargoType(row, cargoButton.dataset.cargoType)) {
          normalizeValueMode(row);
          saveStateSoon(250);
          refreshSingleRow(row, { detail: true });
          scheduleAutoCalculate(row);
        }
        return;
      }
      const toggleButton = event.target.closest('[data-toggle-row]');
      if (toggleButton) {
        const rowId = toggleButton.closest('[data-row-id]')?.dataset.rowId;
        const now = Date.now();
        if (rowId && lastRowToggleId === rowId && now - lastRowToggleAt < 320) return;
        lastRowToggleId = rowId || '';
        lastRowToggleAt = now;
        const row = rowById(rowId);
        state.expandedRowId = state.expandedRowId === rowId ? '' : rowId;
        state.activeRowId = rowId || state.activeRowId;
        if (row && state.expandedRowId === rowId) moveRowToIssueTab(row);
        saveStateSoon(600);
        renderRows();
        return;
      }
      const tabButton = event.target.closest('[data-detail-tab]');
      if (tabButton) {
        const panel = tabButton.closest('[data-row-id]');
        const row = rowById(panel?.dataset.rowId);
        if (row) {
          row.uiTab = tabButton.dataset.detailTab || 'cargo';
          if (row.uiTab === 'services') row.servicesOpen = true;
          saveStateSoon(600);
          refreshSingleRow(row, { detail: true });
        }
        return;
      }
      const createButton = event.target.closest('[data-create-row]');
      if (createButton) {
        const rowId = createButton.closest('[data-row-id]')?.dataset.rowId;
        const row = rowById(rowId);
        if (row) void createOrders([row]);
        return;
      }
      const button = event.target.closest('[data-delete-row]');
      if (button) {
        const rowId = button.closest('[data-row-id]')?.dataset.rowId;
        if (rowId) deleteRow(rowId);
        return;
      }
      const activator = event.target.closest('[data-activate-row]');
      if (activator) {
        const rowId = activator.dataset.rowId;
        if (rowId && rowId !== state.activeRowId) {
          const row = rowById(rowId);
          state.activeRowId = rowId;
          if (row) moveRowToIssueTab(row);
          saveStateSoon(600);
          renderRows();
        }
      }
    });
    [els.pageControlsBottom].filter(Boolean).forEach(node => node.addEventListener('click', event => {
      const pageNumber = event.target.closest('[data-page-number]');
      if (pageNumber) {
        const pages = pagesForRows(filteredRows());
        const value = Number(pageNumber.dataset.pageNumber);
        state.page = Number.isFinite(value) ? Math.min(Math.max(0, value), pages - 1) : state.page;
        resetVirtualScroll();
        saveStateSoon(600);
        renderRows();
        return;
      }
      const button = event.target.closest('[data-page]');
      if (!button) return;
      const pages = pagesForRows(filteredRows());
      state.page = button.dataset.page === 'prev' ? Math.max(0, state.page - 1) : Math.min(pages - 1, state.page + 1);
      resetVirtualScroll();
      saveStateSoon(600);
      renderRows();
    }));
    [els.pageControlsBottom].filter(Boolean).forEach(node => node.addEventListener('change', event => {
      const select = event.target.closest('[data-page-size]');
      if (!select) return;
      const value = Number(select.value);
      state.pageSize = PAGE_SIZE_OPTIONS.includes(value) ? value : DEFAULT_PAGE_SIZE;
      state.page = 0;
      resetVirtualScroll();
      saveStateSoon(600);
      renderRows();
    }));
    if (els.copyCreatedIdsBtn) els.copyCreatedIdsBtn.addEventListener('click', copyCreatedIds);
    if (els.createdDrawerButton) els.createdDrawerButton.addEventListener('click', () => {
      createdDrawerOpen = true;
      renderCreated();
    });
    if (els.closeCreatedDrawerBtn) els.closeCreatedDrawerBtn.addEventListener('click', () => {
      createdDrawerOpen = false;
      renderCreated();
    });
    els.exportCreatedBtn.addEventListener('click', exportCreated);
    if (els.retryErrorRowsBtn) els.retryErrorRowsBtn.addEventListener('click', retryErrorRows);
    els.clearCreatedBtn.addEventListener('click', clearCreated);
    if (els.attentionPanel) els.attentionPanel.addEventListener('click', event => {
      if (event.target.closest('[data-exit-review]')) {
        exitReviewMode();
        return;
      }
      const filterButton = event.target.closest('[data-filter-problems]');
      if (filterButton) {
        enterReviewMode(true);
        return;
      }
      const focus = event.target.closest('[data-focus-row]');
      if (!focus) return;
      focusRow(focus.dataset.focusRow);
    });
    if (els.workflowSteps) els.workflowSteps.addEventListener('click', event => {
      const action = event.target.closest('[data-flow-action]')?.dataset.flowAction;
      if (action) {
        runWorkflowAction(action);
        return;
      }
      const step = event.target.closest('[data-workflow-step]')?.dataset.workflowStep;
      if (!step) return;
      if (step === 'setup') {
        runWorkflowAction('schedule');
        return;
      }
      if (step === 'ready' && attentionItems().length) {
        enterReviewMode(true);
        return;
      }
      state.reviewMode = false;
      if (step === 'tariffs') state.filter.status = 'calculated';
      else if (step === 'created') state.filter.status = 'created';
      else if (step === 'ready') state.filter.status = 'all';
      else state.filter.status = 'all';
      state.page = 0;
      resetVirtualScroll();
      saveState();
      render();
    });
    if (els.openCancelModalBtn) els.openCancelModalBtn.addEventListener('click', openCancelModal);
    $$('[data-cancel-modal-close]').forEach(button => button.addEventListener('click', closeCancelModal));
    if (els.cancelOrdersBtn) els.cancelOrdersBtn.addEventListener('click', cancelOrders);
    window.addEventListener('click', event => {
      if (!event.target.closest?.('.tariff-combo')) closeTariffCombos();
      if (els.headerMore && !event.target.closest?.('.header-more')) els.headerMore.open = false;
    });
    window.addEventListener('scroll', syncScrolledHeader, { passive: true });
    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if ($$('.tariff-combo.open').length) {
        closeTariffCombos();
        return;
      }
      if (state.running) return;
      if (els.cancelModal && !els.cancelModal.hidden) closeCancelModal();
      else if (els.settingsModal && !els.settingsModal.hidden) closeSettingsModal();
      else if (els.helpModal && !els.helpModal.hidden) closeHelpModal();
    });
    window.addEventListener('beforeunload', event => {
      if (saveStateTimer) saveState();
      if (toolkitSyncTimer) void syncToolkitCredentials();
      if (state.running || state.rows.length || state.created.length || state.cancelResults.length) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
    window.addEventListener('pagehide', () => {
      if (saveStateTimer) saveState();
      if (toolkitSyncTimer) void syncToolkitCredentials();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && saveStateTimer) saveState();
      if (document.visibilityState === 'hidden' && toolkitSyncTimer) void syncToolkitCredentials();
    });
  }

  window.OPS_TOOLKIT_MODULE = {
    tool: 'orders',
    isBusy() { return Boolean(state.running || state.uiBusy); },
    switchProject(projectId) { return switchActiveProject(projectId); },
    async refreshCredentials() {
      const previousClient = String(state.settings.userId || '');
      await refreshToolkitCredentialsFromStorage();
      const nextClient = String(state.settings.userId || '');
      if (previousClient !== nextClient) invalidateClientResults(nextClient);
    },
    invalidateClientResults,
    openSettings() { openSettingsModal(); },
    openHelp() { openHelpModal(); },
    setTheme(theme) {
      state.settings.theme = theme;
      applyTheme();
      try { saveState(); } catch { /* applying the theme must not depend on draft storage */ }
    },
    getSettings() {
      return {
        concurrency: concurrency(), timeoutMs: calculationTimeoutMs(), retries: calculationRetries(), density: state.settings.density,
        autoCalculate: Boolean(state.settings.autoCalculate), showOnboarding: state.settings.showOnboarding !== false,
        performanceMode: Boolean(state.settings.performanceMode), viewMode: state.viewMode
      };
    },
    updateSettings(next = {}) {
      if (Object.prototype.hasOwnProperty.call(next, 'concurrency')) state.settings.concurrency = Math.min(6, Math.max(1, Number(next.concurrency) || 3));
      if (Object.prototype.hasOwnProperty.call(next, 'timeoutMs')) state.settings.timeoutMs = calculationTimeoutMs(next.timeoutMs);
      if (Object.prototype.hasOwnProperty.call(next, 'retries')) state.settings.retries = calculationRetries(next.retries);
      if (Object.prototype.hasOwnProperty.call(next, 'density')) state.settings.density = ['comfortable', 'compact', 'dense'].includes(next.density) ? next.density : 'comfortable';
      if (Object.prototype.hasOwnProperty.call(next, 'autoCalculate')) state.settings.autoCalculate = Boolean(next.autoCalculate);
      if (Object.prototype.hasOwnProperty.call(next, 'showOnboarding')) state.settings.showOnboarding = Boolean(next.showOnboarding);
      if (Object.prototype.hasOwnProperty.call(next, 'performanceMode')) state.settings.performanceMode = Boolean(next.performanceMode);
      saveState();
      renderSettings();
      render();
      return this.getSettings();
    },
    runAction(action) {
      if (action === 'resolve') return resolveAddresses();
      if (action === 'calculate') return calculateRows();
      if (action === 'stop') return stopCurrentOperation();
      if (action === 'create') return createOrders();
      if (action === 'import') return els.importFileInput?.click();
      if (action === 'template') return downloadTemplate();
      if (action === 'toggle-view') { els.viewModeBtn?.click(); return; }
      if (action === 'toggle-auto') { state.settings.autoCalculate = !state.settings.autoCalculate; saveState(); renderSettings(); renderButtons(); return state.settings.autoCalculate; }
      if (action === 'start-over') return resetWorkSession();
      if (action === 'help') return openHelpModal();
      if (action === 'settings') return openSettingsModal();
    },
    async clearLocalCache() {
      if (state.cache?.clear) await state.cache.clear();
    }
  };

  void init().then(() => window.parent?.postMessage({ type: 'ops-toolkit-ready', tool: 'orders' }, location.origin));
})();
