(() => {
  'use strict';

  const PROJECTS = {
    kd: { id: 'kd', label: 'Курьер Дисконт', shortLabel: 'КД', apiLabel: 'lk.kdiscont.ru', defaultBestMethod: 'door', sortStrategy: 'company', targetCompanies: ['OPS', 'CSE', 'MExpress', 'CDEK', 'DPD', 'Flip Post', 'PonyExpress', 'Деловые линии', 'Байкал Сервис'] },
    me: { id: 'me', label: 'ME Express', shortLabel: 'ME', apiLabel: 'lk.m1express.ru', defaultBestMethod: 'all', sortStrategy: 'urgency', targetCompanies: [] },
    ops: { id: 'ops', label: 'OPSPost', shortLabel: 'OPS', apiLabel: 'lk.opspost.ru', defaultBestMethod: 'all', sortStrategy: 'urgency', targetCompanies: [] }
  };
  const TARGET_COMPANIES = PROJECTS.kd.targetCompanies;
  const DEFAULT_COMPANY_EXCLUSIONS = ['Достависта', 'Пешкарики', 'Dimex', 'FoxExpress', 'Яндекс Доставка', 'Global Delivery', 'TNT', 'UPS'];
  function defaultCompanyExclusions() { return [...DEFAULT_COMPANY_EXCLUSIONS]; }
  function uniqueCompanyNames(values) {
    const seen = new Set();
    return (values || []).map(value => String(value || '').trim()).filter(value => {
      const key = normalize(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const MAIN_EXPORT_FIELDS = [
    { key: 'requestNo', label: '№ запроса', category: 'Запрос' },
    { key: 'senderQuery', label: 'Откуда', category: 'Маршрут' },
    { key: 'senderKd', label: 'Распознано откуда', category: 'Маршрут' },
    { key: 'recipientQuery', label: 'Куда', category: 'Маршрут' },
    { key: 'recipientKd', label: 'Распознано куда', category: 'Маршрут' },
    { key: 'weight', label: 'Вес, кг', category: 'Груз' },
    { key: 'seats', label: 'Мест', category: 'Груз' },
    { key: 'length', label: 'Длина, см', category: 'Груз' },
    { key: 'width', label: 'Ширина, см', category: 'Груз' },
    { key: 'height', label: 'Высота, см', category: 'Груз' },
    { key: 'status', label: 'Статус', category: 'Результат' },
    { key: 'error', label: 'Ошибка строки', category: 'Результат' },
    { key: 'bestCompany', label: 'Лучшая ТК', category: 'Лучший тариф' },
    { key: 'bestUrgency', label: 'Срочность', category: 'Лучший тариф' },
    { key: 'bestTariff', label: 'Лучший тариф', category: 'Лучший тариф' },
    { key: 'bestMethod', label: 'Тип доставки', category: 'Лучший тариф' },
    { key: 'bestMaxPeriod', label: 'Срок доставки', category: 'Лучший тариф' },
    { key: 'bestPrice', label: 'Цена', category: 'Лучший тариф' },
    { key: 'bestInput', label: 'Вход', category: 'Лучший тариф' },
    { key: 'bestRetail', label: 'Розница', category: 'Лучший тариф' },
    { key: 'bestDiscount', label: 'Скидка от розницы, %', category: 'Лучший тариф' }
  ];
  const TARIFF_EXPORT_FIELDS = [
    { key: 'requestNo', label: '№ запроса', category: 'Запрос', scope: 'request' },
    { key: 'senderQuery', label: 'Откуда: запрос', category: 'Маршрут', scope: 'request' },
    { key: 'senderKd', label: 'Откуда: распознано', category: 'Маршрут', scope: 'request' },
    { key: 'recipientQuery', label: 'Куда: запрос', category: 'Маршрут', scope: 'request' },
    { key: 'recipientKd', label: 'Куда: распознано', category: 'Маршрут', scope: 'request' },
    { key: 'weight', label: 'Вес, кг', category: 'Груз', scope: 'request' },
    { key: 'seats', label: 'Мест', category: 'Груз', scope: 'request' },
    { key: 'length', label: 'Длина, см', category: 'Груз', scope: 'request' },
    { key: 'width', label: 'Ширина, см', category: 'Груз', scope: 'request' },
    { key: 'height', label: 'Высота, см', category: 'Груз', scope: 'request' },
    { key: 'company', label: 'ТК', category: 'Тариф', scope: 'tariff' },
    { key: 'urgency', label: 'Срочность', category: 'Тариф', scope: 'tariff' },
    { key: 'tariffCaption', label: 'Тариф', category: 'Тариф', scope: 'tariff' },
    { key: 'method', label: 'Тип доставки', category: 'Доставка', scope: 'tariff' },
    { key: 'minPeriod', label: 'Мин. срок, дн.', category: 'Срок', scope: 'tariff' },
    { key: 'maxPeriod', label: 'Макс. срок, дн.', category: 'Срок', scope: 'tariff' },
    { key: 'userPrice', label: 'Цена клиента', category: 'Цены', scope: 'tariff' },
    { key: 'userPriceWithoutDiscount', label: 'Цена без скидки', category: 'Цены', scope: 'tariff' },
    { key: 'inputPrice', label: 'Вход', category: 'Цены', scope: 'tariff' },
    { key: 'inputPricePercent', label: 'Вход, %', category: 'Цены', scope: 'tariff' },
    { key: 'retailPrice', label: 'Розница', category: 'Цены', scope: 'tariff' },
    { key: 'servicesPrice', label: 'Стоимость услуг', category: 'Цены', scope: 'tariff' },
    { key: 'activeDiscount', label: 'Активная скидка, %', category: 'Скидки', scope: 'tariff' },
    { key: 'discountPercent', label: 'Скидка тарифа, %', category: 'Скидки', scope: 'tariff' },
    { key: 'calculatedDiscount', label: 'Скидка от розницы, %', category: 'Скидки', scope: 'tariff' },
    { key: 'minPrice', label: 'Минимально допустимая цена (ЛК)', category: 'Цены', scope: 'tariff' },
    { key: 'minPricePercent', label: 'Минимально допустимая цена, %', category: 'Цены', scope: 'tariff' },
    { key: 'returnAllowed', label: 'Возврат разрешён', category: 'Услуги', scope: 'tariff' },
    { key: 'returnPrice', label: 'Цена возврата', category: 'Услуги', scope: 'tariff' },
    { key: 'includedServices', label: 'Включённые услуги', category: 'Услуги', scope: 'tariff' },
    { key: 'allServices', label: 'Все услуги', category: 'Услуги', scope: 'tariff' }
  ];
  const MAIN_EXPORT_PRESETS = {
    compact: ['requestNo','senderQuery','recipientQuery','weight','seats','length','width','height','status','bestCompany','bestUrgency','bestTariff','bestMethod','bestMaxPeriod','bestPrice'],
    finance: ['requestNo','senderQuery','recipientQuery','bestCompany','bestUrgency','bestTariff','bestMethod','bestMaxPeriod','bestPrice','bestInput','bestRetail','bestDiscount'],
    full: MAIN_EXPORT_FIELDS.map(field => field.key)
  };
  const TARIFF_EXPORT_PRESETS = {
    compact: ['requestNo','senderQuery','recipientQuery','weight','seats','length','width','height','company','urgency','tariffCaption','method','minPeriod','maxPeriod','userPrice','inputPrice','calculatedDiscount'],
    finance: ['requestNo','senderQuery','recipientQuery','company','tariffCaption','method','maxPeriod','userPrice','userPriceWithoutDiscount','inputPrice','inputPricePercent','retailPrice','servicesPrice','activeDiscount','discountPercent','calculatedDiscount','minPrice','minPricePercent','returnPrice'],
    logistics: ['requestNo','senderQuery','recipientQuery','weight','seats','length','width','height','company','urgency','tariffCaption','method','maxPeriod','includedServices'],
    full: TARIFF_EXPORT_FIELDS.map(field => field.key)
  };
  const COMPARISON_METRICS = [
    { key:'minPrice', label:'Лучшая цена клиента', unit:'₽', lowerBetter:true, tip:'Минимальная цена клиента среди выбранных тарифов ТК.' },
    { key:'avgPrice', label:'Средняя цена клиента', unit:'₽', lowerBetter:true, tip:'Средняя цена клиента по выбранным маршрутам.' },
    { key:'avgPriceWithoutDiscount', label:'Средняя цена без скидки', unit:'₽', lowerBetter:true, tip:'Средняя цена до клиентской скидки. Пустые значения не учитываются.' },
    { key:'bestPeriod', label:'Лучший максимальный срок', unit:'дн.', lowerBetter:true, tip:'Самый короткий максимальный срок. Значение «По запросу» не участвует в среднем.' },
    { key:'avgPeriod', label:'Средний максимальный срок', unit:'дн.', lowerBetter:true, tip:'Средний максимальный срок по предложениям с указанным сроком.' },
    { key:'avgClientDiscount', label:'Персональная скидка клиента', unit:'%', lowerBetter:false, tip:'Дополнительная скидка конкретного клиента: разница между ценой клиента без персональной скидки и фактической ценой. 0% означает, что дополнительной персональной скидки нет.' },
    { key:'avgActiveDiscount', label:'Активная скидка ЛК', unit:'%', lowerBetter:false, tip:'Средняя активная скидка, переданная личным кабинетом для выбранных тарифов.' },
    { key:'avgRetailDiscount', label:'Скидка от розницы', unit:'%', lowerBetter:false, tip:'Средняя скидка цены клиента относительно розничной цены, когда розница доступна.' },
    { key:'avgMarginRub', label:'Средняя маржа', unit:'₽', lowerBetter:false, tip:'Средняя разница между ценой клиента и входом по предложениям, где вход доступен.' },
    { key:'avgMarginPct', label:'Средняя маржа', unit:'%', lowerBetter:false, tip:'Средняя доля маржи в цене клиента по предложениям, где вход доступен.' },
    { key:'marketGapPct', label:'Разница с лучшей альтернативой', unit:'%', lowerBetter:true, tip:'Сравнение с минимальной ценой другой выбранной ТК на том же маршруте. Отрицательное значение — дешевле альтернативы, положительное — дороже.' },
    { key:'safeDiscountPct', label:'Максимальная безопасная скидка', unit:'%', lowerBetter:false, tip:'На сколько процентов в среднем можно снизить цену, не опускаясь ниже минимальной цены ЛК или цены с заданной маржой.' },
    { key:'recommendedPrice', label:'Цена для предложения клиенту', unit:'₽', lowerBetter:true, tip:'Расчётная цена для предложения: конкурентнее лучшей другой ТК, но не ниже выбранного ограничения цены.' },
    { key:'recommendedDiscountPct', label:'Дополнительная скидка до рекомендации', unit:'%', lowerBetter:false, tip:'Какую дополнительную скидку от текущей цены можно дать, чтобы прийти к цене для предложения.' },
    { key:'winRatePct', label:'Доля лучших цен', unit:'%', lowerBetter:false, tip:'Доля маршрутов, где ТК дала лучшую цену среди выбранных ТК.' },
    { key:'coveragePct', label:'Покрытие маршрутов', unit:'%', lowerBetter:false, tip:'Доля рассчитанных маршрутов выбранного типа доставки, где ТК дала предложение.' },
    { key:'offersCount', label:'Количество предложений', unit:'шт.', lowerBetter:false, tip:'Количество предложений ТК, попавших в текущую выборку.' }
  ];
  const COMPARISON_PRESETS = {
    sale: ['minPrice','marketGapPct','winRatePct','avgClientDiscount','avgActiveDiscount','safeDiscountPct','recommendedDiscountPct'],
    discount: ['avgClientDiscount','avgActiveDiscount','avgRetailDiscount','avgMarginPct','safeDiscountPct','recommendedPrice','recommendedDiscountPct'],
    margin: ['avgMarginRub','avgMarginPct','avgClientDiscount','safeDiscountPct','recommendedPrice'],
    logistics: ['minPrice','avgPrice','bestPeriod','avgPeriod','winRatePct','coveragePct']
  };
  const COMPANY_COLUMN_ORDERS = {
    logistics: ['requestNo','route','cargo','company','tariff','method','period','price','input','retail','details'],
    sales: ['requestNo','route','company','tariff','method','period','price','cargo','input','retail','details'],
    finance: ['requestNo','route','company','tariff','method','period','price','input','retail','cargo','details']
  };
  const DEFAULT_PROJECT_SETTINGS = {
    kd: { enabled:true, email:'', password:'', authChecked:false, inn:'', userId:'', userDisplay:'', exclusions:defaultCompanyExclusions(), bestExclusions:[], bestMethodMode:'door' },
    me: { enabled:false, email:'', password:'', authChecked:false, inn:'', userId:'', userDisplay:'', exclusions:defaultCompanyExclusions(), bestExclusions:[], bestMethodMode:'all' },
    ops: { enabled:false, email:'', password:'', authChecked:false, inn:'', userId:'', userDisplay:'', exclusions:defaultCompanyExclusions(), bestExclusions:[], bestMethodMode:'all' }
  };
  const DEFAULT_SETTINGS = {
    tokenDaData:'', saveSecrets:true, secretPolicyVersion:2, companyExclusionsVersion:2, concurrency:3, debounceMs:900, calcTimeoutMs:120000, calcRetries:0,
    activeProject:'kd', projects: JSON.parse(JSON.stringify(DEFAULT_PROJECT_SETTINGS)),
    exportCompanySheets:true, exportMainCompanyColumns:false, exportAnalyticsSheet:false, companySheetLayout:'wide',
    mainExportPreset:'compact', tariffExportPreset:'compact', mainExportFields:[...MAIN_EXPORT_PRESETS.compact], tariffExportFields:[...TARIFF_EXPORT_PRESETS.compact],
    advancedTariffView:false, showServiceInfo:false, theme:'system', density:'medium', overviewColumnOrder:'logistics',
    comparisonMetrics:[...COMPARISON_PRESETS.sale], comparisonTariffMode:'cheapest', comparisonPeriodMax:'', salesFloorMode:'strict', salesFloorPercent:10, salesBeatMarketPct:1,
    managerView:'recommendations', managerBaseCompany:'cheapest', managerTariffMode:'cheapest', managerPeriodMax:'', managerMethod:'', managerPreset:'custom', managerFloorMode:'strict', managerFloorPercent:10, managerBeatMarketPct:1, managerVisibleColumns:[],
    matrixDiscountMode:'', matrixVisibleColumns:[], matrixMethodByProject:{kd:'',me:'',ops:''},
    analyticsMethodByProject:{kd:'',me:'',ops:''}, analyticsSelections:{kd:{},me:{},ops:{}}
  };
  const state = {
    rows: [], projectRows: { kd: [], me: [], ops: [] }, settings:{...DEFAULT_SETTINGS}, running:false, runGeneration:0,
    addressTimers:new Map(), calcTimers:new Map(), cache:null, activeTariffRowId:'', settingsProjectId:'kd',
    partnerCompanies:{kd:[],me:[],ops:[]}, partnerCompanyStatus:{kd:'',me:'',ops:''},
    tableFilter:{status:'all', query:'', sort:'index'},
    orderView:{drafts:[],created:[],running:false,page:0,defaults:{takeDate:'',takeTimeFrom:'09:00',takeTimeTo:'18:00'}},
    tariffView:{ sortKey:'calculatorOrder', sortDir:'asc', filtered:[], advanced:false, facets:{company:new Set(),type:new Set(),method:new Set(),urgency:new Set(),tariff:new Set()}, touchedFacets:new Set(), filtersReady:false },
    companyView:{ company:'', sortKey:'calculatorOrder', sortDir:'asc', filtered:[], advanced:false, pane:'tariffs', selectedCompanies:new Set(), selectedTariffs:new Set(), selectedTypes:new Set(), selectedMethods:new Set(), selectedUrgencies:new Set(), selectedRoutes:new Set(), selectedCargo:new Set(), touchedFacets:new Set(), filtersReady:false },
    analyticsDirty:{comparison:false,manager:false}, tableSaveTimer:null, sessionReady:false
  };
  const TABLE_STATE_KEY = 'kd.tableState.v1';
  const TOOLKIT_CREDENTIALS_KEY = 'opsToolkitCredentials';
  const DEFAULT_CARGO_TYPE = '4aab1fc6-fc2b-473a-8728-58bcd4ff79ba';
  const ADDRESS_RPC_RATE_LIMIT_PER_SECOND = 20;
  const MAX_CALCULATION_RPC_CONCURRENCY = 6;
  const ORDER_DRAFT_PAGE_SIZE = 20;
  let confirmDialogState = null;
  let fileDropDocumentHandlersBound = false;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const els = {};
  const moneyFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

  function clampInteger(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(number)));
  }
  function createRateLimiter(limit, intervalMs) {
    const queue = [];
    const timestamps = [];
    let timer = null;
    const schedule = () => {
      if (timer || !queue.length) return;
      const now = Date.now();
      while (timestamps.length && now - timestamps[0] >= intervalMs) timestamps.shift();
      while (queue.length && timestamps.length < limit) {
        const item = queue.shift();
        timestamps.push(Date.now());
        Promise.resolve().then(item.task).then(item.resolve, item.reject).finally(schedule);
      }
      if (queue.length && !timer) {
        timer = setTimeout(() => { timer = null; schedule(); }, Math.max(1, intervalMs - (now - timestamps[0])));
      }
    };
    return {
      run(task) {
        return new Promise((resolve, reject) => {
          queue.push({ task, resolve, reject });
          schedule();
        });
      }
    };
  }
  function createConcurrencyLimiter(defaultMax) {
    const queue = [];
    let active = 0;
    const schedule = () => {
      while (queue.length) {
        const max = clampInteger(queue[0].max, defaultMax, 1, defaultMax);
        if (active >= max) break;
        const item = queue.shift();
        active += 1;
        Promise.resolve().then(item.task).then(item.resolve, item.reject).finally(() => {
          active -= 1;
          schedule();
        });
      }
    };
    return {
      run(task, max = defaultMax) {
        return new Promise((resolve, reject) => {
          queue.push({ task, resolve, reject, max });
          schedule();
        });
      }
    };
  }
  const addressRpcLimiter = createRateLimiter(ADDRESS_RPC_RATE_LIMIT_PER_SECOND, 1000);
  const calculationRpcLimiter = createConcurrencyLimiter(MAX_CALCULATION_RPC_CONCURRENCY);
  function maxCalculationConcurrency() {
    return clampInteger(state.settings.concurrency, DEFAULT_SETTINGS.concurrency, 1, MAX_CALCULATION_RPC_CONCURRENCY);
  }
  function resolveAddressRpc(payload) {
    return addressRpcLimiter.run(() => KDBridge.rpc('resolveAddress', payload));
  }
  function calculateTariffRpc(payload) {
    const maxConcurrentCalculations = maxCalculationConcurrency();
    return calculationRpcLimiter.run(
      () => KDBridge.rpc('calculate', { ...payload, maxConcurrentCalculations }),
      maxConcurrentCalculations
    );
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
      } catch { /* IndexedDB may be unavailable in private mode. */ }
    }
    async clear(prefixes = null) {
      try {
        const db = await this.dbPromise;
        await new Promise(resolve => {
          const tx = db.transaction('cache', 'readwrite');
          const store = tx.objectStore('cache');
          if (!prefixes || !prefixes.length) store.clear();
          else {
            const request = store.openCursor();
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) return;
              if (prefixes.some(prefix => String(cursor.key).startsWith(prefix))) cursor.delete();
              cursor.continue();
            };
          }
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        });
      } catch { /* noop */ }
    }
    async stats() {
      try {
        const db = await this.dbPromise;
        return await new Promise(resolve => {
          const tx = db.transaction('cache', 'readwrite');
          const store = tx.objectStore('cache');
          const request = store.openCursor();
          const groups = {};
          let totalEntries = 0, totalBytes = 0, expired = 0;
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) { resolve({ groups, totalEntries, totalBytes, expired }); return; }
            const item = cursor.value || {};
            if (item.expiresAt <= Date.now()) { cursor.delete(); expired += 1; cursor.continue(); return; }
            const key = String(item.key || '');
            const category = key.startsWith('address:') ? 'addresses' : key.startsWith('calc:') ? 'calculations' : 'other';
            const bytes = new Blob([JSON.stringify(item)]).size;
            if (!groups[category]) groups[category] = { entries: 0, bytes: 0 };
            groups[category].entries += 1; groups[category].bytes += bytes;
            totalEntries += 1; totalBytes += bytes;
            cursor.continue();
          };
          request.onerror = () => resolve({ groups, totalEntries, totalBytes, expired });
        });
      } catch { return { groups: {}, totalEntries: 0, totalBytes: 0, expired: 0 }; }
    }
  }

  function uid() {
    return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function normalize(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }
  function parsePositive(value, fallback) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
  function parseInputNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const parsed = Number(text.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function normalizeWeightValue(value, fallback = '') {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    const parsed = parseInputNumber(text);
    return parsed === 0 ? '0.1' : text;
  }
  function cargoWeightValue(value) {
    const parsed = parseInputNumber(value);
    return parsed === 0 ? 0.1 : parsePositive(value, 0.1);
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }
  function formatValue(value) {
    if (value === '' || value === null || value === undefined) return '';
    return typeof value === 'number' ? moneyFormatter.format(value) : String(value);
  }
  function createRow(data = {}) {
    return {
      id: uid(),
      senderQuery: String(data.senderQuery ?? data.sender ?? '').trim(),
      senderResolved: data.senderResolved || null,
      recipientQuery: String(data.recipientQuery ?? data.recipient ?? '').trim(),
      recipientResolved: data.recipientResolved || null,
      weight: normalizeWeightValue(data.weight ?? '0.1', '0.1'),
      seats: String(data.seats ?? '1'),
      length: String(data.length ?? '10'),
      width: String(data.width ?? '10'),
      height: String(data.height ?? '10'),
      orderDraft: data.orderDraft ? { ...data.orderDraft } : null,
      status: 'idle',
      statusText: 'Ожидание',
      error: '',
      result: null,
      senderVersion: 0,
      recipientVersion: 0,
      calcVersion: 0,
      calcPromise: null
    };
  }

  function cacheKeyAddress(query) {
    return `address:v1:${normalize(query)}`;
  }
  function cacheKeyCalculation(row) {
    const s = state.settings;
    return ['calc:v2', s.userId, row.senderResolved?.kdId, row.recipientResolved?.kdId,
      cargoWeightValue(row.weight), Math.round(parsePositive(row.seats, 1)), parsePositive(row.length, 10),
      parsePositive(row.width, 10), parsePositive(row.height, 10), s.bestMethodMode, [...s.exclusions].sort().join(',')].join('|');
  }

  function sanitizeFieldSelection(selection, registry, fallback) {
    const allowed = new Set(registry.map(field => field.key));
    const result = Array.isArray(selection) ? selection.filter(key => allowed.has(key)) : [];
    return result.length ? [...new Set(result)] : [...fallback];
  }
  function presetForSelection(selection, presets) {
    const normalized = [...selection].sort().join('|');
    return Object.entries(presets).find(([, keys]) => [...keys].sort().join('|') === normalized)?.[0] || 'custom';
  }

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem('kd.settings.v1') || '{}');
      state.settings = { ...DEFAULT_SETTINGS, ...stored };
      if (!state.settings.saveSecrets) {
        state.settings.password = '';
        state.settings.tokenDaData = '';
      }
      state.settings.concurrency = Math.min(6, Math.max(1, Number(state.settings.concurrency) || 3));
      state.settings.debounceMs = 900;
      state.settings.exclusions = Array.isArray(state.settings.exclusions) ? state.settings.exclusions : [];
      state.settings.bestMethodMode = state.settings.bestMethodMode === 'all' ? 'all' : 'door';
      state.settings.calcTimeoutMs = Math.min(180000, Math.max(30000, Number(state.settings.calcTimeoutMs) || 120000));
      state.settings.calcRetries = Math.min(3, Math.max(0, Number.isFinite(Number(state.settings.calcRetries)) ? Number(state.settings.calcRetries) : 0));
      state.settings.exportCompanySheets = state.settings.exportCompanySheets !== false;
      state.settings.exportMainCompanyColumns = Boolean(state.settings.exportMainCompanyColumns);
      state.settings.companySheetLayout = state.settings.companySheetLayout === 'long' ? 'long' : 'wide';
      state.settings.mainExportPreset = ['compact', 'finance', 'full', 'custom'].includes(state.settings.mainExportPreset) ? state.settings.mainExportPreset : 'compact';
      state.settings.tariffExportPreset = ['compact', 'finance', 'logistics', 'full', 'custom'].includes(state.settings.tariffExportPreset) ? state.settings.tariffExportPreset : 'compact';
      state.settings.mainExportFields = sanitizeFieldSelection(state.settings.mainExportFields, MAIN_EXPORT_FIELDS, MAIN_EXPORT_PRESETS.compact);
      state.settings.tariffExportFields = sanitizeFieldSelection(state.settings.tariffExportFields, TARIFF_EXPORT_FIELDS, TARIFF_EXPORT_PRESETS.compact);
      state.settings.mainExportPreset = presetForSelection(state.settings.mainExportFields, MAIN_EXPORT_PRESETS);
      state.settings.tariffExportPreset = presetForSelection(state.settings.tariffExportFields, TARIFF_EXPORT_PRESETS);
      state.settings.advancedTariffView = Boolean(state.settings.advancedTariffView);
      state.settings.theme = ['system', 'light', 'dark'].includes(state.settings.theme) ? state.settings.theme : 'system';
    } catch { state.settings = { ...DEFAULT_SETTINGS }; }
  }
  function persistSettings() {
    const toStore = { ...state.settings };
    if (!toStore.saveSecrets) {
      toStore.password = '';
      toStore.tokenDaData = '';
    }
    localStorage.setItem('kd.settings.v1', JSON.stringify(toStore));
  }
  function effectiveTheme(theme = state.settings.theme) {
    if (theme === 'system') return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return theme === 'dark' ? 'dark' : 'light';
  }
  function applyTheme(theme = state.settings.theme) {
    const resolved = effectiveTheme(theme);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.project = currentProjectId();
    if (els.themeToggleBtn) {
      els.themeToggleBtn.textContent = resolved === 'dark' ? '☀' : '☾';
      els.themeToggleBtn.title = resolved === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
    }
  }
  function toggleTheme() {
    state.settings.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    persistSettings();
    applyTheme();
    if (els.themeSelect) els.themeSelect.value = state.settings.theme;
  }

  function cacheElements() {
    Object.assign(els, {
      runtimeLabel: $('#runtimeLabel'), connectionBadge: $('#connectionBadge'), openSettingsBtn: $('#openSettingsBtn'), themeToggleBtn: $('#themeToggleBtn'),
      settingsPanel: $('#settingsPanel'), emailInput: $('#emailInput'), passwordInput: $('#passwordInput'), dadataInput: $('#dadataInput'),
      savePasswordToggle: $('#savePasswordToggle'), innInput: $('#innInput'), findClientBtn: $('#findClientBtn'), clientResult: $('#clientResult'),
      concurrencySelect: $('#concurrencySelect'), debounceSelect: $('#debounceSelect'), bestMethodSelect: $('#bestMethodSelect'), exclusionsList: $('#exclusionsList'), bestExclusionsList: $('#bestExclusionsList'),
      calcTimeoutSelect: $('#calcTimeoutSelect'), calcRetriesSelect: $('#calcRetriesSelect'),
      exportCompanySheetsToggle: $('#exportCompanySheetsToggle'), exportMainCompanyColumnsToggle: $('#exportMainCompanyColumnsToggle'), companySheetLayoutSelect: $('#companySheetLayoutSelect'),
      mainExportPresetSelect: $('#mainExportPresetSelect'), tariffExportPresetSelect: $('#tariffExportPresetSelect'),
      mainExportFields: $('#mainExportFields'), tariffExportFields: $('#tariffExportFields'), mainFieldsCount: $('#mainFieldsCount'), tariffFieldsCount: $('#tariffFieldsCount'),
      themeSelect: $('#themeSelect'),
      saveSettingsBtn: $('#saveSettingsBtn'), clearCacheBtn: $('#clearCacheBtn'),
      addRowBtn: $('#addRowBtn'), pasteBtn: $('#pasteBtn'), fileInput: $('#fileInput'), downloadTemplateBtn: $('#downloadTemplateBtn'), demoBtn: $('#demoBtn'),
      autoCalcToggle: $('#autoCalcToggle'), calculateAllBtn: $('#calculateAllBtn'), stopBtn: $('#stopBtn'),
      tableBody: $('#tableBody'), dataTable: $('#dataTable'), clearResultsBtn: $('#clearResultsBtn'), clearAllBtn: $('#clearAllBtn'),
      statusTitle: $('#statusTitle'), statusDetails: $('#statusDetails'), progressBar: $('#progressBar'),
      countTotal: $('#countTotal'), countDone: $('#countDone'), countErrors: $('#countErrors'),
      companyOverviewBtn: $('#companyOverviewBtn'), copyBtn: $('#copyBtn'), downloadCsvBtn: $('#downloadCsvBtn'), downloadXlsxBtn: $('#downloadXlsxBtn'),
      pasteModal: $('#pasteModal'), pasteArea: $('#pasteArea'), pasteHasHeader: $('#pasteHasHeader'), applyPasteBtn: $('#applyPasteBtn'), pasteTemplateBtn: $('#pasteTemplateBtn'),
      tariffsModal: $('#tariffsModal'), tariffsBody: $('#tariffsBody'), tariffsSubtitle: $('#tariffsSubtitle'), toastContainer: $('#toastContainer'),
      tariffSearchInput: $('#tariffSearchInput'), tariffCompanyFilter: $('#tariffCompanyFilter'), tariffMethodFilter: $('#tariffMethodFilter'),
      tariffPriceMin: $('#tariffPriceMin'), tariffPriceMax: $('#tariffPriceMax'), tariffPeriodMin: $('#tariffPeriodMin'), tariffPeriodMax: $('#tariffPeriodMax'),
      resetTariffFiltersBtn: $('#resetTariffFiltersBtn'), copyTariffsBtn: $('#copyTariffsBtn'), downloadTariffsCsvBtn: $('#downloadTariffsCsvBtn'),
      downloadTariffsXlsxBtn: $('#downloadTariffsXlsxBtn'), tariffCountMetric: $('#tariffCountMetric'), tariffMinPriceMetric: $('#tariffMinPriceMetric'),
      tariffFastestMetric: $('#tariffFastestMetric'), advancedTariffViewToggle: $('#advancedTariffViewToggle'),
      companyModal: $('#companyModal'), companyCards: $('#companyCards'), companySelect: $('#companySelect'), companySearchInput: $('#companySearchInput'),
      companyMethodFilter: $('#companyMethodFilter'), companyPriceMin: $('#companyPriceMin'), companyPriceMax: $('#companyPriceMax'),
      companyPeriodMin: $('#companyPeriodMin'), companyPeriodMax: $('#companyPeriodMax'), resetCompanyFiltersBtn: $('#resetCompanyFiltersBtn'),
      companyTariffsTable: $('#companyTariffsTable'), companyTariffsBody: $('#companyTariffsBody'), advancedCompanyViewToggle: $('#advancedCompanyViewToggle'),
      companyCountMetric: $('#companyCountMetric'), companyRequestsMetric: $('#companyRequestsMetric'), companyMinPriceMetric: $('#companyMinPriceMetric'),
      companyAvgPriceMetric: $('#companyAvgPriceMetric'), companyFastestMetric: $('#companyFastestMetric'), copyCompanyBtn: $('#copyCompanyBtn'),
      downloadCompanyCsvBtn: $('#downloadCompanyCsvBtn'), downloadCompanyXlsxBtn: $('#downloadCompanyXlsxBtn')
    });
  }

  async function init() {
    cacheElements();
    state.cache = new IndexedCache();
    loadSettings();
    applyTheme();
    renderExclusions();
    renderExportFieldSelectors();
    fillSettingsForm();
    bindEvents();
    state.rows.push(createRow(), createRow(), createRow());
    renderTable();
    refreshSummary();
    await checkRuntime();
    updateConnectionBadge();
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (state.settings.theme === 'system') applyTheme();
    });
  }

  async function checkRuntime() {
    els.runtimeLabel.textContent = KDBridge.mode === 'extension' ? 'Расширение браузера' : 'Локальное приложение';
    try {
      const result = await KDBridge.ping();
      els.runtimeLabel.textContent = `${KDBridge.mode === 'extension' ? 'Расширение браузера' : 'Локальный сервер'} · v${result.version || '1.0.0'}`;
    } catch (error) {
      els.runtimeLabel.textContent = error.message;
      toast(error.message, 'error');
    }
  }

  function bindEvents() {
    document.addEventListener('click', event=>{ const button=event.target.closest('[data-toggle-secret]'); if(button) toggleSecretVisibility(button); });
    els.openSettingsBtn.addEventListener('click', openSettings);
    els.themeToggleBtn.addEventListener('click', toggleTheme);
    $$('[data-close-drawer]').forEach(el => el.addEventListener('click', closeSettings));
    $$('[data-close-modal]').forEach(el => el.addEventListener('click', closePasteModal));
    $$('[data-close-tariffs]').forEach(el => el.addEventListener('click', closeTariffsModal));
    $$('[data-close-company]').forEach(el => el.addEventListener('click', closeCompanyModal));
    els.saveSettingsBtn.addEventListener('click', saveSettingsFromForm);
    els.mainExportPresetSelect.addEventListener('change', () => applyExportPreset('main', els.mainExportPresetSelect.value));
    els.tariffExportPresetSelect.addEventListener('change', () => applyExportPreset('tariff', els.tariffExportPresetSelect.value));
    els.mainExportFields.addEventListener('change', () => handleExportFieldsChanged('main'));
    els.tariffExportFields.addEventListener('change', () => handleExportFieldsChanged('tariff'));
    $$('[data-fields-action]').forEach(button => button.addEventListener('click', handleFieldsAction));
    els.findClientBtn.addEventListener('click', findClientFromForm);
    els.innInput.addEventListener('input', debounceGlobal('inn-search', () => {
      if (els.innInput.value.trim().length >= 10 && els.emailInput.value.trim() && els.passwordInput.value) findClientFromForm(true);
    }, 750));
    els.clearCacheBtn.addEventListener('click', clearCaches);
    els.addRowBtn.addEventListener('click', () => addRows([createRow()], true));
    els.pasteBtn.addEventListener('click', openPasteModal);
    els.applyPasteBtn.addEventListener('click', applyPaste);
    els.fileInput.addEventListener('change', importFile);
    els.downloadTemplateBtn.addEventListener('click', downloadImportTemplate);
    els.pasteTemplateBtn.addEventListener('click', downloadImportTemplate);
    els.demoBtn.addEventListener('click', insertDemo);
    els.calculateAllBtn.addEventListener('click', calculateAll);
    els.stopBtn.addEventListener('click', stopCalculation);
    els.clearResultsBtn.addEventListener('click', clearResults);
    els.clearAllBtn.addEventListener('click', clearAll);
    els.copyBtn.addEventListener('click', copyResults);
    els.downloadCsvBtn.addEventListener('click', downloadCsv);
    els.downloadXlsxBtn.addEventListener('click', downloadXlsx);
    els.companyOverviewBtn.addEventListener('click', openCompanyModal);
    els.tableBody.addEventListener('input', handleTableInput);
    els.tableBody.addEventListener('change', handleTableChange);
    els.tableBody.addEventListener('click', handleTableClick);
    const filterInputs = [els.tariffSearchInput, els.tariffCompanyFilter, els.tariffMethodFilter, els.tariffPriceMin, els.tariffPriceMax, els.tariffPeriodMin, els.tariffPeriodMax];
    filterInputs.forEach(input => input.addEventListener(input.tagName === 'INPUT' ? 'input' : 'change', renderTariffsView));
    els.resetTariffFiltersBtn.addEventListener('click', resetTariffFilters);
    els.copyTariffsBtn.addEventListener('click', copyTariffsView);
    els.downloadTariffsCsvBtn.addEventListener('click', downloadTariffsCsv);
    els.downloadTariffsXlsxBtn.addEventListener('click', downloadTariffsXlsx);
    els.advancedTariffViewToggle.addEventListener('change', () => {
      state.tariffView.advanced = els.advancedTariffViewToggle.checked;
      state.settings.advancedTariffView = state.tariffView.advanced;
      persistSettings();
      applyAdvancedTableMode(els.tariffsModal, state.tariffView.advanced);
    });
    els.tariffsBody.addEventListener('click', handleTariffsClick);
    const companyFilterInputs = [els.companySelect, els.companySearchInput, els.companyMethodFilter, els.companyPriceMin, els.companyPriceMax, els.companyPeriodMin, els.companyPeriodMax];
    companyFilterInputs.forEach(input => input.addEventListener(input.tagName === 'INPUT' ? 'input' : 'change', renderCompanyView));
    els.resetCompanyFiltersBtn.addEventListener('click', resetCompanyFilters);
    els.advancedCompanyViewToggle.addEventListener('change', () => {
      state.companyView.advanced = els.advancedCompanyViewToggle.checked;
      applyAdvancedTableMode(els.companyModal, state.companyView.advanced);
    });
    els.copyCompanyBtn.addEventListener('click', copyCompanyView);
    els.downloadCompanyCsvBtn.addEventListener('click', downloadCompanyCsv);
    els.downloadCompanyXlsxBtn.addEventListener('click', downloadCompanyXlsx);
    els.companyCards.addEventListener('click', handleCompanyCardClick);
    els.companyTariffsBody.addEventListener('click', handleCompanyDetailsClick);
    $$('.company-sort-button').forEach(button => button.addEventListener('click', () => setCompanySort(button.dataset.companySort)));
    $$('.sort-button').forEach(button => button.addEventListener('click', () => setTariffSort(button.dataset.sort)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { closeSettings(); closePasteModal(); closeTariffsModal(); closeCompanyModal(); }
    });
  }

  function debounceGlobal(key, fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function renderExclusions() {
    els.exclusionsList.innerHTML = TARGET_COMPANIES.map(company => `
      <label><input type="checkbox" value="${escapeHtml(company)}"><span>${escapeHtml(company)}</span></label>
    `).join('');
  }
  function renderFieldSelector(container, registry) {
    const groups = new Map();
    registry.forEach(field => {
      if (!groups.has(field.category)) groups.set(field.category, []);
      groups.get(field.category).push(field);
    });
    container.innerHTML = [...groups.entries()].map(([category, fields]) => `
      <fieldset class="field-group">
        <legend>${escapeHtml(category)}</legend>
        ${fields.map(field => `<label><input type="checkbox" value="${escapeHtml(field.key)}"><span>${escapeHtml(field.label)}</span></label>`).join('')}
      </fieldset>`).join('');
  }
  function renderExportFieldSelectors() {
    renderFieldSelector(els.mainExportFields, MAIN_EXPORT_FIELDS);
    renderFieldSelector(els.tariffExportFields, TARIFF_EXPORT_FIELDS);
  }
  function setCheckedFields(container, keys) {
    const selected = new Set(keys);
    container.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = selected.has(input.value); });
  }
  function checkedFields(container) {
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  }
  function updateFieldCounts() {
    const main = checkedFields(els.mainExportFields);
    const tariff = checkedFields(els.tariffExportFields);
    els.mainFieldsCount.textContent = `(${main.length}/${MAIN_EXPORT_FIELDS.length})`;
    els.tariffFieldsCount.textContent = `(${tariff.length}/${TARIFF_EXPORT_FIELDS.length})`;
  }
  function applyExportPreset(kind, preset) {
    if (preset === 'custom') return;
    const container = kind === 'main' ? els.mainExportFields : els.tariffExportFields;
    const presets = kind === 'main' ? MAIN_EXPORT_PRESETS : TARIFF_EXPORT_PRESETS;
    setCheckedFields(container, presets[preset] || presets.compact);
    updateFieldCounts();
  }
  function handleExportFieldsChanged(kind) {
    const container = kind === 'main' ? els.mainExportFields : els.tariffExportFields;
    const presets = kind === 'main' ? MAIN_EXPORT_PRESETS : TARIFF_EXPORT_PRESETS;
    const select = kind === 'main' ? els.mainExportPresetSelect : els.tariffExportPresetSelect;
    select.value = presetForSelection(checkedFields(container), presets);
    updateFieldCounts();
  }
  function handleFieldsAction(event) {
    const [kind, action] = String(event.currentTarget.dataset.fieldsAction || '').split('-');
    const container = kind === 'main' ? els.mainExportFields : els.tariffExportFields;
    const registry = kind === 'main' ? MAIN_EXPORT_FIELDS : TARIFF_EXPORT_FIELDS;
    setCheckedFields(container, action === 'all' ? registry.map(field => field.key) : []);
    handleExportFieldsChanged(kind);
    scheduleSettingsAutosave();
  }

  function fillSettingsForm() {
    const s = state.settings;
    els.emailInput.value = s.email || '';
    els.passwordInput.value = s.password || '';
    els.dadataInput.value = s.tokenDaData || '';
    resetSecretVisibility();
    els.savePasswordToggle.checked = Boolean(s.saveSecrets);
    els.innInput.value = s.inn || '';
    els.concurrencySelect.value = String(s.concurrency);
    els.debounceSelect.value = String(s.debounceMs);
    els.bestMethodSelect.value = s.bestMethodMode || 'door';
    els.calcTimeoutSelect.value = String(s.calcTimeoutMs || 120000);
    els.calcRetriesSelect.value = String(s.calcRetries ?? 0);
    els.exportCompanySheetsToggle.checked = s.exportCompanySheets !== false;
    els.exportMainCompanyColumnsToggle.checked = Boolean(s.exportMainCompanyColumns);
    els.companySheetLayoutSelect.value = s.companySheetLayout === 'long' ? 'long' : 'wide';
    els.mainExportPresetSelect.value = s.mainExportPreset || presetForSelection(s.mainExportFields, MAIN_EXPORT_PRESETS);
    els.tariffExportPresetSelect.value = s.tariffExportPreset || presetForSelection(s.tariffExportFields, TARIFF_EXPORT_PRESETS);
    setCheckedFields(els.mainExportFields, s.mainExportFields || MAIN_EXPORT_PRESETS.compact);
    setCheckedFields(els.tariffExportFields, s.tariffExportFields || TARIFF_EXPORT_PRESETS.compact);
    updateFieldCounts();
    els.themeSelect.value = s.theme || 'system';
    $$('#exclusionsList input').forEach(input => input.checked = s.exclusions.includes(input.value));
    renderClientResult();
  }

  function readSettingsForm() {
    const mainExportFields = sanitizeFieldSelection(checkedFields(els.mainExportFields), MAIN_EXPORT_FIELDS, MAIN_EXPORT_PRESETS.compact);
    const tariffExportFields = sanitizeFieldSelection(checkedFields(els.tariffExportFields), TARIFF_EXPORT_FIELDS, TARIFF_EXPORT_PRESETS.compact);
    return {
      email: els.emailInput.value.trim(), password: els.passwordInput.value,
      tokenDaData: els.dadataInput.value.trim(), inn: els.innInput.value.trim(),
      saveSecrets: els.savePasswordToggle.checked,
      concurrency: Number(els.concurrencySelect.value) || 3,
      debounceMs: 900,
      bestMethodMode: els.bestMethodSelect.value === 'all' ? 'all' : 'door',
      calcTimeoutMs: Math.min(180000, Math.max(30000, Number(els.calcTimeoutSelect.value) || 120000)),
      calcRetries: Math.min(3, Math.max(0, Number(els.calcRetriesSelect.value) || 0)),
      exportCompanySheets: els.exportCompanySheetsToggle.checked,
      exportMainCompanyColumns: els.exportMainCompanyColumnsToggle.checked,
      companySheetLayout: els.companySheetLayoutSelect.value === 'long' ? 'long' : 'wide',
      mainExportFields,
      tariffExportFields,
      mainExportPreset: presetForSelection(mainExportFields, MAIN_EXPORT_PRESETS),
      tariffExportPreset: presetForSelection(tariffExportFields, TARIFF_EXPORT_PRESETS),
      theme: ['system', 'light', 'dark'].includes(els.themeSelect.value) ? els.themeSelect.value : 'system',
      exclusions: $$('#exclusionsList input:checked').map(input => input.value)
    };
  }

  function saveSettingsFromForm() {
    const previousIdentity = `${state.settings.email}|${state.settings.inn}`;
    const form = readSettingsForm();
    const nextIdentity = `${form.email}|${form.inn}`;
    state.settings = { ...state.settings, ...form };
    if (previousIdentity !== nextIdentity) {
      state.settings.userId = '';
      state.settings.userDisplay = '';
    }
    persistSettings();
    applyTheme();
    renderClientResult();
    updateConnectionBadge();
    closeSettings();
    toast('Настройки сохранены', 'success');
    if (els.autoCalcToggle.checked) state.rows.forEach(scheduleAutoCalculation);
  }
  function openSettings() {
    fillSettingsForm();
    els.settingsPanel.classList.add('open');
    els.settingsPanel.setAttribute('aria-hidden', 'false');
  }
  function closeSettings() {
    els.settingsPanel.classList.remove('open');
    els.settingsPanel.setAttribute('aria-hidden', 'true');
  }
  function renderClientResult(error = '') {
    if (error) {
      els.clientResult.className = 'client-result error';
      els.clientResult.textContent = error;
      return;
    }
    if (state.settings.userId) {
      els.clientResult.className = 'client-result ok';
      els.clientResult.textContent = `${state.settings.userDisplay || 'Контрагент'} · ID ${state.settings.userId}`;
    } else {
      els.clientResult.className = 'client-result neutral';
      els.clientResult.textContent = 'Контрагент не выбран';
    }
  }
  function updateConnectionBadge() {
    const ready = state.settings.email && state.settings.password && state.settings.tokenDaData && state.settings.userId;
    els.connectionBadge.className = `badge ${ready ? 'ok' : 'neutral'}`;
    els.connectionBadge.textContent = ready ? state.settings.userDisplay || 'Подключено' : 'Не настроено';
  }
  async function findClientFromForm(silent = false) {
    const form = readSettingsForm();
    if (!form.email || !form.password || !form.inn) {
      if (!silent) renderClientResult('Заполните email, пароль и ИНН.');
      return;
    }
    els.findClientBtn.disabled = true;
    els.findClientBtn.textContent = 'Поиск…';
    els.clientResult.className = 'client-result neutral';
    els.clientResult.textContent = 'Ищем контрагента по ИНН…';
    try {
      const result = await KDBridge.rpc('searchUser', { email: form.email, password: form.password, inn: form.inn });
      state.settings = { ...state.settings, ...form, userId: result.id, userDisplay: result.display };
      persistSettings();
      renderClientResult();
      updateConnectionBadge();
      if (!silent) toast('Контрагент найден', 'success');
    } catch (error) {
      state.settings.userId = '';
      state.settings.userDisplay = '';
      renderClientResult(error.message);
      updateConnectionBadge();
    } finally {
      els.findClientBtn.disabled = false;
      els.findClientBtn.textContent = 'Найти';
    }
  }

  function rowHasTableContent(row) {
    return Boolean(row.senderQuery || row.recipientQuery || row.result || row.error || row.senderResolved || row.recipientResolved || row.senderError || row.recipientError);
  }
  function rowHasAddressError(row) {
    return Boolean(row.senderError || row.recipientError || row.statusText === 'Город не распознан');
  }
  function tableRowSearchText(row, index) {
    const best = row.result?.best || {};
    return normalize([
      index + 1,
      row.senderQuery,
      row.senderResolved?.placeText,
      row.senderResolved?.kdText,
      row.senderError,
      row.recipientQuery,
      row.recipientResolved?.placeText,
      row.recipientResolved?.kdText,
      row.recipientError,
      row.statusText,
      row.error,
      best.deliveryCompanyLabel,
      best.urgencyLabel,
      tariffDisplayName(best),
      best.deliveryTypeLabel,
      best.deliveryMethodLabel,
      formatTerm(best)
    ].filter(Boolean).join(' '));
  }
  function tableStatusMatches(row, status) {
    if (status === 'not-calculated') return rowHasTableContent(row) && row.status !== 'done' && !row.result;
    if (status === 'ready') return row.status === 'ready' || (row.senderResolved && row.recipientResolved && !row.result);
    if (status === 'loading') return /resolving|calculating/.test(row.status);
    if (status === 'done') return row.status === 'done' || Boolean(row.result);
    if (status === 'errors') return row.status === 'error' || rowHasAddressError(row);
    if (status === 'address-error') return rowHasAddressError(row);
    if (status === 'calculation-error') return row.status === 'error' && !rowHasAddressError(row);
    return true;
  }
  function tableRowMatchesFilter(row, index) {
    const filter = state.tableFilter || {};
    const status = filter.status || 'all';
    const query = normalize(filter.query || '');
    return tableStatusMatches(row, status) && (!query || tableRowSearchText(row, index).includes(query));
  }
  function tableStatusRank(row) {
    if (rowHasAddressError(row)) return 0;
    if (row.status === 'error') return 1;
    if (/resolving|calculating/.test(row.status)) return 2;
    if (row.status === 'ready' || (row.senderResolved && row.recipientResolved && !row.result)) return 3;
    if (rowHasTableContent(row) && !row.result) return 4;
    if (row.status === 'done' || row.result) return 5;
    return 6;
  }
  function tableSortRank(row, sort) {
    if (sort === 'not-calculated') return tableStatusMatches(row, 'not-calculated') ? 0 : 1;
    if (sort === 'errors') return tableStatusMatches(row, 'errors') ? 0 : 1;
    if (sort === 'done') return tableStatusMatches(row, 'done') ? 0 : 1;
    if (sort === 'status') return tableStatusRank(row);
    return 0;
  }
  function sortTableEntries(entries) {
    const sort = state.tableFilter?.sort || 'index';
    if (sort === 'index') return entries;
    return [...entries].sort((a, b) => {
      const rank = tableSortRank(a.row, sort) - tableSortRank(b.row, sort);
      if (rank) return rank;
      if (sort === 'status') {
        const status = String(a.row.statusText || '').localeCompare(String(b.row.statusText || ''), 'ru');
        if (status) return status;
      }
      return a.index - b.index;
    });
  }
  function filteredTableEntries() {
    const entries = state.rows.map((row, index) => ({ row, index })).filter(({ row, index }) => tableRowMatchesFilter(row, index));
    return sortTableEntries(entries);
  }
  function isTableFilterActive() {
    return Boolean((state.tableFilter?.status || 'all') !== 'all' || normalize(state.tableFilter?.query || '') || (state.tableFilter?.sort || 'index') !== 'index');
  }
  function updateTableFilterMeta(visibleCount = filteredTableEntries().length) {
    if (els.tableFilterCount) {
      els.tableFilterCount.textContent = isTableFilterActive()
        ? `Показано ${visibleCount} из ${state.rows.length}`
        : `Все строки: ${state.rows.length}`;
    }
    els.resetTableFilterBtn?.classList.toggle('hidden', !isTableFilterActive());
  }
  function handleTableFilterChange() {
    state.tableFilter.status = els.tableStatusFilter?.value || 'all';
    state.tableFilter.query = els.tableSearchInput?.value || '';
    state.tableFilter.sort = els.tableSortSelect?.value || 'index';
    renderTable();
  }
  function resetTableFilter() {
    state.tableFilter.status = 'all';
    state.tableFilter.query = '';
    state.tableFilter.sort = 'index';
    if (els.tableStatusFilter) els.tableStatusFilter.value = 'all';
    if (els.tableSearchInput) els.tableSearchInput.value = '';
    if (els.tableSortSelect) els.tableSortSelect.value = 'index';
    renderTable();
  }

  function renderTable() {
    els.tableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const entries = filteredTableEntries();
    if (!entries.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="empty-table-filter" colspan="19">Нет строк по текущему фильтру.</td>';
      fragment.appendChild(tr);
    } else {
      entries.forEach(({ row, index }) => fragment.appendChild(renderRow(row, index)));
    }
    els.tableBody.appendChild(fragment);
    updateTableFilterMeta(entries.length);
  }
  function renderRow(row, index) {
    const tr = document.createElement('tr');
    tr.dataset.rowId = row.id;
    tr.innerHTML = `
      <td class="sticky-col row-number">${index + 1}</td>
      <td class="col-address"><input data-field="senderQuery" value="${escapeHtml(row.senderQuery)}" placeholder="Город или полный адрес"></td>
      <td class="col-resolved"><div data-role="senderResolved"></div></td>
      <td class="col-address"><input data-field="recipientQuery" value="${escapeHtml(row.recipientQuery)}" placeholder="Город или полный адрес"></td>
      <td class="col-resolved"><div data-role="recipientResolved"></div></td>
      <td class="col-number"><input data-field="weight" inputmode="decimal" value="${escapeHtml(row.weight)}"></td>
      <td class="col-number"><input data-field="seats" inputmode="numeric" value="${escapeHtml(row.seats)}"></td>
      <td class="col-number"><input data-field="length" inputmode="decimal" value="${escapeHtml(row.length)}"></td>
      <td class="col-number"><input data-field="width" inputmode="decimal" value="${escapeHtml(row.width)}"></td>
      <td class="col-number"><input data-field="height" inputmode="decimal" value="${escapeHtml(row.height)}"></td>
      <td class="col-status"><span data-role="status"></span></td>
      <td class="col-result"><div data-role="bestCompany" class="cell-ellipsis"></div></td>
      <td class="col-result"><div data-role="bestTariff" class="cell-ellipsis"></div></td>
      <td class="col-method"><div data-role="bestMethod" class="cell-ellipsis"></div></td>
      <td class="col-result"><div data-role="bestPeriod"></div></td>
      <td class="col-result"><div data-role="bestPrice"></div></td>
      <td class="col-result"><div data-role="bestInput"></div></td>
      <td class="col-result"><div data-role="bestDiscount"></div></td>
      <td><div class="row-actions">
        <button class="icon-button action-button" data-action="calculate" title="Рассчитать строку">▶</button>
        <button class="icon-button action-button" data-action="tariffs" title="Все тарифы">≡</button>
        <button class="icon-button action-button" data-action="duplicate" title="Дублировать">⧉</button>
        <button class="icon-button action-button" data-action="delete" title="Удалить">×</button>
      </div></td>`;
    updateRowDom(row, tr);
    return tr;
  }
  function resolvedMarkup(resolved, phase, error) {
    const cls = phase === 'loading' ? 'loading' : error ? 'error' : resolved ? 'ok' : '';
    const text = phase === 'loading' ? 'Поиск…' : error || resolved?.kdText || '—';
    const title = resolved ? (resolved.unrestrictedValue || resolved.kdText || text) : text;
    return `<div class="resolved-line ${cls}" title="${escapeHtml(title)}"><span class="dot"></span><span class="cell-ellipsis">${escapeHtml(text)}</span></div>`;
  }
  function updateRowDom(row, suppliedTr = null) {
    const tr = suppliedTr || els.tableBody.querySelector(`tr[data-row-id="${CSS.escape(row.id)}"]`);
    if (!tr) return;
    const senderPhase = row.status === 'resolving-sender' ? 'loading' : '';
    const recipientPhase = row.status === 'resolving-recipient' ? 'loading' : '';
    tr.querySelector('[data-role="senderResolved"]').innerHTML = resolvedMarkup(row.senderResolved, senderPhase, row.senderError);
    tr.querySelector('[data-role="recipientResolved"]').innerHTML = resolvedMarkup(row.recipientResolved, recipientPhase, row.recipientError);
    const statusClass = row.status === 'done' ? 'ready' : row.status === 'error' ? 'error' : /resolving|calculating/.test(row.status) ? 'loading' : '';
    tr.querySelector('[data-role="status"]').innerHTML = `<span class="status-pill ${statusClass}" title="${escapeHtml(row.error || row.statusText)}">${escapeHtml(row.statusText)}</span>`;
    const best = row.result?.best;
    tr.querySelector('[data-role="bestCompany"]').textContent = best?.deliveryCompanyLabel || '—';
    tr.querySelector('[data-role="bestTariff"]').innerHTML = best ? `${usesUrgencyView()&&best.urgencyLabel?`<small class="best-urgency">${escapeHtml(best.urgencyLabel)}</small>`:''}<span>${escapeHtml(tariffDisplayName(best))}</span>` : '—';
    tr.querySelector('[data-role="bestMethod"]').textContent = best?.deliveryTypeLabel || best?.deliveryMethodLabel || '—';
    tr.querySelector('[data-role="bestPeriod"]').textContent = best ? formatTerm(best) : '—';
    tr.querySelector('[data-role="bestPrice"]').textContent = best ? moneyOrDash(best.userPrice, { positive:true }) : '—';
    tr.querySelector('[data-role="bestInput"]').textContent = best ? moneyOrDash(best.inputPrice, { nonNegative:true }) : '—';
    tr.querySelector('[data-role="bestDiscount"]').textContent = best ? percentOrDash(best.discount) : '—';
    const tariffsButton = tr.querySelector('[data-action="tariffs"]');
    tariffsButton.disabled = !row.result?.allTariffs?.length;
    refreshSummary();
  }

  function handleTableInput(event) {
    const input = event.target.closest('input[data-field]');
    if (!input) return;
    const row = findRowByElement(input);
    if (!row) return;
    const field = input.dataset.field;
    row[field] = input.value;
    row.error = '';
    if (field === 'senderQuery' || field === 'recipientQuery') {
      const side = field === 'senderQuery' ? 'sender' : 'recipient';
      row[`${side}Resolved`] = null;
      row[`${side}Error`] = '';
      row[`${side}Version`] += 1;
      clearRowResult(row);
      scheduleAddressResolve(row, side);
    } else {
      clearRowResult(row);
      validateNumberInput(input);
      scheduleAutoCalculation(row, 0);
    }
    updateRowDom(row);
    scheduleTableAutosave();
  }
  function handleTableChange(event) {
    const input = event.target.closest('input[data-field]');
    if (!input) return;
    const row = findRowByElement(input);
    if (!row) return;
    if (input.dataset.field === 'weight') {
      const normalized = normalizeWeightValue(input.value, '');
      if (normalized && normalized !== input.value.trim()) {
        input.value = normalized;
        row.weight = normalized;
        clearRowResult(row);
        validateNumberInput(input);
        updateRowDom(row);
        scheduleTableAutosave();
      }
    }
    if (input.dataset.field === 'senderQuery') resolveAddressForRow(row, 'sender');
    if (input.dataset.field === 'recipientQuery') resolveAddressForRow(row, 'recipient');
  }
  function handleTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = findRowByElement(button);
    if (!row) return;
    const action = button.dataset.action;
    if (action === 'calculate') calculateRow(row, { force: true });
    if (action === 'tariffs') openTariffs(row);
    if (action === 'duplicate') duplicateRow(row);
    if (action === 'delete') deleteRow(row);
  }
  function findRowByElement(element) {
    const id = element.closest('tr')?.dataset.rowId;
    return state.rows.find(row => row.id === id);
  }
  function validateNumberInput(input) {
    const number = parseInputNumber(input.value);
    const valid = input.dataset.field === 'weight' ? number !== null && number >= 0 : number !== null && number > 0;
    input.classList.toggle('invalid', !valid);
  }
  function refreshOpenAnalytics() {
    if (els.companyModal?.classList.contains('open')) markAnalyticsDirty('both');
  }
  function clearRowResult(row) {
    row.result = null;
    row.error = '';
    row.calcVersion += 1;
    if (row.senderResolved && row.recipientResolved) {
      row.status = 'ready'; row.statusText = 'Готов к расчёту';
    } else {
      row.status = 'idle'; row.statusText = 'Ожидание';
    }
    refreshOpenAnalytics();
  }

  function scheduleAddressResolve(row, side) {
    const key = `${row.id}:${side}`;
    clearTimeout(state.addressTimers.get(key));
    const query = row[`${side}Query`].trim();
    if (query.length < 3) return;
    const timer = setTimeout(() => resolveAddressForRow(row, side), state.settings.debounceMs);
    state.addressTimers.set(key, timer);
  }
  async function resolveAddressForRow(row, side) {
    const queryField = `${side}Query`;
    const resolvedField = `${side}Resolved`;
    const errorField = `${side}Error`;
    const versionField = `${side}Version`;
    const query = row[queryField].trim();
    if (query.length < 3) return null;
    if (!state.settings.tokenDaData) {
      row[errorField] = 'Настройте токен DaData';
      row.status = 'error'; row.statusText = 'Нет токена DaData';
      updateRowDom(row);
      return null;
    }
    const version = ++row[versionField];
    row[errorField] = '';
    row.status = side === 'sender' ? 'resolving-sender' : 'resolving-recipient';
    row.statusText = side === 'sender' ? 'Ищем отправителя' : 'Ищем получателя';
    updateRowDom(row);
    try {
      const key = cacheKeyAddress(query);
      let result = await state.cache.get(key);
      if (!result) {
        result = await resolveAddressRpc({ query, tokenDaData: state.settings.tokenDaData });
        await state.cache.set(key, result, 7 * 24 * 60 * 60 * 1000);
      }
      if (version !== row[versionField] || query !== row[queryField].trim()) return null;
      row[resolvedField] = result;
      row[errorField] = '';
      row.status = row.senderResolved && row.recipientResolved ? 'ready' : 'idle';
      row.statusText = row.senderResolved && row.recipientResolved ? 'Готов к расчёту' : 'Ожидание адреса';
      updateRowDom(row);
      scheduleAutoCalculation(row);
      return result;
    } catch (error) {
      if (version !== row[versionField]) return null;
      row[resolvedField] = null;
      row[errorField] = error.message;
      row.status = 'error';
      row.statusText = 'Адрес не найден';
      row.error = error.message;
      updateRowDom(row);
      return null;
    }
  }

  function scheduleAutoCalculation(row, delay = 450) {
    const key = row.id;
    clearTimeout(state.calcTimers.get(key));
    if (!els.autoCalcToggle.checked || !row.senderResolved || !row.recipientResolved || state.running) return;
    const timer = setTimeout(() => calculateRow(row), Math.max(0, delay));
    state.calcTimers.set(key, timer);
  }
  function validateConfigured(show = true) {
    const s = state.settings;
    const missing = [];
    if (!s.email) missing.push('email');
    if (!s.password) missing.push('пароль');
    if (!s.tokenDaData) missing.push('токен DaData');
    if (!s.userId) missing.push('контрагент');
    if (missing.length) {
      if (show) {
        toast(`Не настроено: ${missing.join(', ')}`, 'error');
        openSettings();
      }
      return false;
    }
    return true;
  }
  function validateRow(row) {
    if (!row.senderQuery.trim() || !row.recipientQuery.trim()) return 'Заполните оба адреса';
    for (const [field, label] of [['weight', 'вес'], ['seats', 'количество мест'], ['length', 'длину'], ['width', 'ширину'], ['height', 'высоту']]) {
      const number = parseInputNumber(row[field]);
      const valid = field === 'weight' ? number !== null && number >= 0 : number !== null && number > 0;
      if (!valid) return `Проверьте ${label}`;
    }
    return '';
  }
  function markUnresolvedCitySkipped(row) {
    const missing = [
      !row.senderResolved ? 'откуда' : '',
      !row.recipientResolved ? 'куда' : ''
    ].filter(Boolean).join(' и ');
    row.result = null;
    row.status = 'error';
    row.statusText = 'Город не распознан';
    row.error = `Расчёт пропущен: не распознан город ${missing || 'маршрута'}.`;
    updateRowDom(row);
    scheduleTableAutosave();
    refreshOpenAnalytics();
    return null;
  }
  async function calculateRow(row, options = {}) {
    if (row.calcPromise && !options.force) return row.calcPromise;
    if (!validateConfigured(!options.silent)) return null;
    const validationError = validateRow(row);
    if (validationError) {
      row.status = 'error'; row.statusText = validationError; row.error = validationError; updateRowDom(row); return null;
    }
    const calcVersion = ++row.calcVersion;
    const work = (async () => {
      try {
        if (!row.senderResolved) await resolveAddressForRow(row, 'sender');
        if (!row.recipientResolved) await resolveAddressForRow(row, 'recipient');
        if (!row.senderResolved || !row.recipientResolved) return markUnresolvedCitySkipped(row);
        row.status = 'calculating'; row.statusText = 'Расчёт…'; row.error = ''; updateRowDom(row);
        const key = cacheKeyCalculation(row);
        let result = options.force ? null : await state.cache.get(key);
        if (result) result = { ...result, cached:true, cacheSource:'browser' };
        if (!result) {
          result = await calculateTariffRpc({
            email: state.settings.email,
            password: state.settings.password,
            userId: state.settings.userId,
            senderCity: row.senderResolved.kdId,
            recipientCity: row.recipientResolved.kdId,
            cargoWeight: cargoWeightValue(row.weight),
            cargoSeats: Math.round(parsePositive(row.seats, 1)),
            cargoLength: parsePositive(row.length, 10),
            cargoWidth: parsePositive(row.width, 10),
            cargoHeight: parsePositive(row.height, 10),
            exclusions: state.settings.exclusions,
            bestMethodMode: state.settings.bestMethodMode,
            timeoutMs: state.settings.calcTimeoutMs,
            retries: state.settings.calcRetries
          });
          if (result?.cached && !result.cacheSource) result = { ...result, cacheSource:'calculator' };
          await state.cache.set(key, result, 2 * 24 * 60 * 60 * 1000);
        }
        if (calcVersion !== row.calcVersion) return null;
        result.calculatedAt ||= new Date().toISOString();
        result.calculationContext ||= { projectId: currentProjectId(), clientId: String(projectSettings().userId || ''), signature: key };
        row.result = result;
        row.status = 'done';
        row.statusText = cacheStatusText(result);
        row.error = '';
        updateRowDom(row);
        return result;
      } catch (error) {
        if (calcVersion !== row.calcVersion) return null;
        row.result = null;
        row.status = 'error';
        row.statusText = 'Ошибка расчёта';
        row.error = error.message;
        updateRowDom(row);
        if (options.force) toast(error.message, 'error');
        return null;
      } finally {
        row.calcPromise = null;
      }
    })();
    row.calcPromise = work;
    return work;
  }

  async function calculateAll() {
    if (state.running || !validateConfigured(true)) return;
    const rows = state.rows.filter(row => row.senderQuery.trim() || row.recipientQuery.trim());
    if (!rows.length) { toast('Нет заполненных строк', 'error'); return; }
    state.running = true;
    window.parent?.postMessage({type:'ops-toolkit-module-state',tool:'calculator',busy:true},location.origin);
    const generation = ++state.runGeneration;
    els.calculateAllBtn.disabled = true;
    els.stopBtn.classList.remove('hidden');
    els.statusTitle.textContent = 'Идёт пакетный расчёт';
    els.statusDetails.textContent = `Одновременно выполняется до ${state.settings.concurrency} запросов.`;
    try {
      await runPool(rows, state.settings.concurrency, async row => {
        if (!state.running || generation !== state.runGeneration) return;
        await calculateRow(row, { silent: true });
      });
      if (state.running && generation === state.runGeneration) {
        els.statusTitle.textContent = 'Пакетный расчёт завершён';
        els.statusDetails.textContent = 'Готовую таблицу можно скопировать или скачать.';
        toast('Расчёт завершён', 'success');
      }
    } finally {
      if (generation === state.runGeneration) {
        state.running = false;
        window.parent?.postMessage({type:'ops-toolkit-module-state',tool:'calculator',busy:false},location.origin);
        els.stopBtn.classList.add('hidden');
        refreshSummary();
        updateConnectionBadge();
      }
    }
  }
  async function runPool(items, concurrency, worker) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length && state.running) {
        const index = cursor++;
        await worker(items[index], index);
      }
    });
    await Promise.all(runners);
  }
  function stopCalculation() {
    state.running = false;
    window.parent?.postMessage({type:'ops-toolkit-module-state',tool:'calculator',busy:false},location.origin);
    state.runGeneration += 1;
    els.stopBtn.classList.add('hidden');
    els.statusTitle.textContent = 'Расчёт остановлен';
    els.statusDetails.textContent = 'Текущие сетевые запросы завершатся, новые запускаться не будут.';
    updateConnectionBadge();
  }

  function addRows(rows, focusLast = false) {
    const start = state.rows.length;
    state.rows.push(...rows);
    const fragment = document.createDocumentFragment();
    rows.forEach((row, i) => fragment.appendChild(renderRow(row, start + i)));
    els.tableBody.appendChild(fragment);
    renumberRows();
    refreshSummary();
    if (focusLast) els.tableBody.lastElementChild?.querySelector('input')?.focus();
    rows.forEach(row => {
      if (row.senderQuery) scheduleAddressResolve(row, 'sender');
      if (row.recipientQuery) scheduleAddressResolve(row, 'recipient');
    });
    scheduleTableAutosave();
  }
  function duplicateRow(row) {
    const copy = createRow({ ...row, senderResolved: row.senderResolved, recipientResolved: row.recipientResolved });
    copy.result = row.result;
    copy.status = row.status;
    copy.statusText = row.statusText;
    const index = state.rows.indexOf(row) + 1;
    state.rows.splice(index, 0, copy);
    renderTable();
    refreshSummary();
    scheduleTableAutosave();
  }
  function deleteRow(row) {
    if (state.rows.length === 1) {
      Object.assign(row, createRow(), { id: row.id });
      renderTable();
      scheduleTableAutosave();
      return;
    }
    state.rows = state.rows.filter(item => item.id !== row.id);
    els.tableBody.querySelector(`tr[data-row-id="${CSS.escape(row.id)}"]`)?.remove();
    renumberRows();
    refreshSummary();
    refreshOpenAnalytics();
    scheduleTableAutosave();
  }
  function renumberRows() {
    [...els.tableBody.rows].forEach((tr, index) => tr.querySelector('.row-number').textContent = index + 1);
  }
  async function clearResults() {
    if (!(await confirmDialog({
      title: 'Очистить результаты?',
      message: 'Будут удалены только результаты расчётов. Введённые адреса и параметры груза останутся в таблице.',
      confirmText: 'Очистить',
      danger: true
    }))) return;
    state.rows.forEach(row => {
      row.result = null; row.error = '';
      row.status = row.senderResolved && row.recipientResolved ? 'ready' : 'idle';
      row.statusText = row.senderResolved && row.recipientResolved ? 'Готов к расчёту' : 'Ожидание';
      updateRowDom(row);
    });
    refreshOpenAnalytics();
    scheduleTableAutosave();
  }
  async function clearAll() {
    if (!(await confirmDialog({
      title: 'Очистить всю таблицу?',
      message: 'Будут удалены введённые строки, адреса и результаты текущего проекта. Это действие нельзя отменить.',
      confirmText: 'Очистить всё',
      danger: true
    }))) return;
    state.rows = [createRow(), createRow(), createRow()];
    renderTable();
    refreshSummary();
    refreshOpenAnalytics();
    scheduleTableAutosave();
  }

  function openPasteModal() {
    els.pasteArea.value = '';
    els.pasteModal.classList.add('open');
    els.pasteModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => els.pasteArea.focus(), 0);
  }
  function closePasteModal() {
    els.pasteModal.classList.remove('open');
    els.pasteModal.setAttribute('aria-hidden', 'true');
  }
  function closeConfirmDialog(result = false) {
    const modal = $('#confirmModal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    const pending = confirmDialogState;
    confirmDialogState = null;
    if (pending) pending.resolve(Boolean(result));
  }
  function confirmDialog({ title = 'Подтверждение', message = '', confirmText = 'Подтвердить', cancelText = 'Отмена', danger = false } = {}) {
    const modal = $('#confirmModal');
    const titleEl = $('#confirmTitle');
    const messageEl = $('#confirmMessage');
    const okBtn = $('#confirmOkBtn');
    const cancelBtn = $('#confirmCancelBtn');
    if (!modal || !okBtn || !cancelBtn) return Promise.resolve(false);
    if (confirmDialogState) closeConfirmDialog(false);
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    okBtn.classList.toggle('danger', danger);
    okBtn.classList.toggle('primary', !danger);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    return new Promise(resolve => {
      confirmDialogState = { resolve };
      setTimeout(() => okBtn.focus(), 0);
    });
  }
  function applyPaste() {
    const text = els.pasteArea.value.trim();
    if (!text) return;
    const matrix = parseTextTable(text);
    const rows = rowsFromMatrix(matrix, els.pasteHasHeader.checked);
    if (!rows.length) { toast('Не удалось распознать строки', 'error'); return; }
    removeInitialBlankRows();
    addRows(rows);
    closePasteModal();
    toast(`Добавлено строк: ${rows.length}`, 'success');
  }
  function parseTextTable(text) {
    const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(field); field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field); field = '';
        if (row.some(value => String(value).trim())) rows.push(row);
        row = [];
      } else field += char;
    }
    row.push(field);
    if (row.some(value => String(value).trim())) rows.push(row);
    return rows;
  }
  function normalizeHeader(value) {
    return normalize(value).replace(/[._-]/g, ' ');
  }
  function detectColumns(header) {
    const aliases = {
      sender: ['откуда', 'отправитель', 'адрес отправителя', 'sender', 'from'],
      recipient: ['куда', 'получатель', 'адрес получателя', 'recipient', 'to'],
      weight: ['вес', 'вес кг', 'weight'], seats: ['мест', 'количество мест', 'места', 'seats'],
      length: ['длина', 'длина см', 'length'], width: ['ширина', 'ширина см', 'width'], height: ['высота', 'высота см', 'height']
    };
    const result = {};
    header.map(normalizeHeader).forEach((name, index) => {
      Object.entries(aliases).forEach(([field, values]) => {
        if (values.some(alias => name === alias || name.includes(alias))) result[field] ??= index;
      });
    });
    return result;
  }
  function rowsFromMatrix(matrix, hasHeader = false) {
    if (!matrix.length) return [];
    let start = hasHeader ? 1 : 0;
    let columns = hasHeader ? detectColumns(matrix[0]) : { sender: 0, recipient: 1, weight: 2, seats: 3, length: 4, width: 5, height: 6 };
    if (hasHeader && (columns.sender === undefined || columns.recipient === undefined)) {
      columns = { sender: 0, recipient: 1, weight: 2, seats: 3, length: 4, width: 5, height: 6 };
    }
    return matrix.slice(start).filter(values => values.some(value => String(value).trim())).map(values => createRow({
      sender: values[columns.sender] ?? '', recipient: values[columns.recipient] ?? '',
      weight: values[columns.weight] || '0.1', seats: values[columns.seats] || '1',
      length: values[columns.length] || '10', width: values[columns.width] || '10', height: values[columns.height] || '10'
    }));
  }
  function isFileDrag(event) {
    return [...(event.dataTransfer?.types || [])].includes('Files');
  }
  function firstDroppedFile(event) {
    return [...(event.dataTransfer?.files || [])].find(file => /\.(xlsx|xls|csv|tsv|txt)$/i.test(file.name || '')) || event.dataTransfer?.files?.[0] || null;
  }
  function initFileDropZone(input, zone, importer, blocked, blockedMessage) {
    if (!input || !zone || !importer) return;
    const setActive = active => zone.classList.toggle('drag-over', active && !blocked?.());
    ['dragenter', 'dragover'].forEach(type => {
      zone.addEventListener(type, event => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = blocked?.() ? 'none' : 'copy';
        setActive(true);
      });
    });
    ['dragleave', 'dragend'].forEach(type => zone.addEventListener(type, () => setActive(false)));
    zone.addEventListener('drop', event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setActive(false);
      if (blocked?.()) {
        toast(blockedMessage || 'Дождитесь завершения текущей обработки.', 'error');
        return;
      }
      const file = firstDroppedFile(event);
      if (!file) {
        toast('Перетащите файл XLSX, XLS, CSV, TSV или TXT.', 'error');
        return;
      }
      void importer(file);
    });
    if (!fileDropDocumentHandlersBound) {
      fileDropDocumentHandlersBound = true;
      document.addEventListener('dragover', event => {
        if (isFileDrag(event)) event.preventDefault();
      });
      document.addEventListener('drop', event => {
        if (isFileDrag(event)) event.preventDefault();
      });
    }
  }
  async function importFileObject(file) {
    if (state.running) {
      toast('Сначала остановите пакетный расчёт', 'error');
      return;
    }
    if (!file) return;
    try {
      let matrix;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      } else {
        matrix = parseTextTable(await file.text());
      }
      const first = matrix[0] || [];
      const detected = detectColumns(first);
      const hasHeader = detected.sender !== undefined || detected.recipient !== undefined;
      const rows = rowsFromMatrix(matrix, hasHeader);
      if (!rows.length) throw new Error('В файле не найдено строк данных');
      removeInitialBlankRows();
      addRows(rows);
      toast(`Импортировано строк: ${rows.length}`, 'success');
    } catch (error) { toast(`Ошибка импорта: ${error.message}`, 'error'); }
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    await importFileObject(file);
  }
  function removeInitialBlankRows() {
    if (state.rows.every(row => !row.senderQuery && !row.recipientQuery && !row.result)) {
      state.rows = [];
      els.tableBody.innerHTML = '';
    }
  }
  function insertDemo() {
    removeInitialBlankRows();
    addRows([
      createRow({ sender: 'Москва', recipient: 'Санкт-Петербург', weight: '2.5', seats: '1', length: '30', width: '20', height: '15' }),
      createRow({ sender: 'Казань', recipient: 'Екатеринбург', weight: '8', seats: '2', length: '40', width: '30', height: '25' }),
      createRow({ sender: 'Новосибирск', recipient: 'Красноярск', weight: '1.2', seats: '1', length: '20', width: '15', height: '10' })
    ]);
  }

  function formatTerm(item) {
    const min = Number(item?.minPeriod), max = Number(item?.maxPeriod);
    const hasMin = Number.isFinite(min) && min > 0, hasMax = Number.isFinite(max) && max > 0;
    if (hasMin && hasMax && min !== max) return `${min}–${max} дн.`;
    if (hasMax) return `${max} дн.`;
    if (hasMin) return `от ${min} дн.`;
    return 'По запросу';
  }
  function safeNumber(value) {
    if (value === '' || value === null || value === undefined) return '';
    const number = Number(value);
    return Number.isFinite(number) ? number : '';
  }
  function servicesList(item, requiredOnly = false) {
    const services = Array.isArray(item?.services) ? item.services : [];
    return services.filter(service => !requiredOnly || service.required || service.enabled);
  }
  function serviceText(service) {
    const price = Number(service?.price);
    const suffix = Number.isFinite(price) && price > 0 ? ` (${formatValue(Math.ceil(price))} ₽)` : '';
    return `${service?.caption || service?.key || 'Услуга'}${suffix}`;
  }
  function servicesSummary(item, requiredOnly = false) {
    return servicesList(item, requiredOnly).map(serviceText).join('; ');
  }
  function getExportCompanies() {
    const found = new Set();
    state.rows.forEach(row => (row.result?.allTariffs || []).forEach(item => {
      if (item.deliveryCompanyLabel) found.add(item.deliveryCompanyLabel);
    }));
    return [...TARGET_COMPANIES.filter(name => found.has(name) || state.rows.some(row => row.result?.companies?.[name])),
      ...[...found].filter(name => !TARGET_COMPANIES.includes(name)).sort((a, b) => a.localeCompare(b, 'ru'))];
  }
  function selectedDefinitions(registry, keys) {
    const selected = new Set(keys || []);
    return registry.filter(field => selected.has(field.key));
  }
  function calculationTime(row) {
    return row.result?.calculatedAt ? new Date(row.result.calculatedAt).toLocaleString('ru-RU') : '';
  }
  function mainFieldValue(key, row, index) {
    const best = row.result?.best || {};
    const values = {
      requestNo: index + 1,
      calculatedAt: calculationTime(row),
      senderQuery: row.senderQuery,
      senderKd: row.senderResolved?.kdText || '',
      senderFias: row.senderResolved?.fiasId || '',
      senderKdId: row.senderResolved?.kdId || '',
      recipientQuery: row.recipientQuery,
      recipientKd: row.recipientResolved?.kdText || '',
      recipientFias: row.recipientResolved?.fiasId || '',
      recipientKdId: row.recipientResolved?.kdId || '',
      weight: parsePositive(row.weight, .1),
      seats: Math.round(parsePositive(row.seats, 1)),
      length: parsePositive(row.length, 10),
      width: parsePositive(row.width, 10),
      height: parsePositive(row.height, 10),
      status: row.statusText,
      error: row.error || '',
      bestCompany: best.deliveryCompanyLabel || '',
      bestTariff: best.tariffCaption || '',
      bestMethod: best.deliveryTypeLabel || best.deliveryMethodLabel || '',
      bestMaxPeriod: safeNumber(best.maxPeriod),
      bestPrice: safeNumber(best.userPrice),
      bestInput: best.inputPrice ?? '',
      bestRetail: safeNumber(best.retailPrice),
      bestDiscount: best.discount ?? ''
    };
    return values[key] ?? '';
  }
  function tariffFieldValue(key, item, row, index) {
    const values = {
      requestNo: index + 1,
      calculatedAt: calculationTime(row),
      senderQuery: row.senderQuery,
      senderKd: row.senderResolved?.kdText || '',
      senderFias: row.senderResolved?.fiasId || '',
      senderKdId: row.senderResolved?.kdId || '',
      recipientQuery: row.recipientQuery,
      recipientKd: row.recipientResolved?.kdText || '',
      recipientFias: row.recipientResolved?.fiasId || '',
      recipientKdId: row.recipientResolved?.kdId || '',
      weight: parsePositive(row.weight, .1),
      seats: Math.round(parsePositive(row.seats, 1)),
      length: parsePositive(row.length, 10),
      width: parsePositive(row.width, 10),
      height: parsePositive(row.height, 10),
      company: item?.deliveryCompanyLabel || '',
      companyId: item?.deliveryCompany ?? '',
      tariffId: item?.tariffId || '',
      tariffName: item?.tariffName || '',
      tariffCaption: item?.tariffCaption || '',
      tariffDescription: item?.tariffDescription || '',
      methodId: item?.deliveryMethod ?? '',
      method: item?.deliveryMethodLabel || '',
      deliveryType: item?.deliveryTypeLabel || '',
      maxPeriod: safeNumber(item?.maxPeriod),
      pickupDays: safeNumber(item?.pickupDaysCount),
      deliveryDays: safeNumber(item?.deliveryDaysCount),
      totalDays: safeNumber(item?.totalDeliveryDaysCount),
      userPrice: safeNumber(item?.userPrice),
      userPriceWithoutDiscount: safeNumber(item?.userPriceWithoutDiscount),
      inputPrice: item?.inputPrice ?? '',
      retailPrice: safeNumber(item?.retailPrice),
      ratePrice: safeNumber(item?.ratePrice),
      servicesPrice: safeNumber(item?.servicesPrice),
      activeDiscount: safeNumber(item?.activeDiscount),
      discountPercent: safeNumber(item?.discountPercent),
      calculatedDiscount: safeNumber(item?.discount),
      rateName: item?.rateName || '',
      rateId: item?.rateId || '',
      minPrice: safeNumber(item?.minPrice),
      basePrice: safeNumber(item?.basePrice),
      returnAllowed: item?.returnServiceAllowed ? 'Да' : 'Нет',
      returnPrice: safeNumber(item?.returnServicePrice),
      includedServices: servicesSummary(item, true),
      allServices: servicesSummary(item, false),
      hasError: item?.hasError ? 'Да' : 'Нет',
      filteredReason: item?.filteredReason || '',
      priority: item?.priority ?? '',
      sort: item?.sort ?? '',
      periodSort: item?.periodSort ?? '',
      isAgent: item?.isAgent ? 'Да' : 'Нет'
    };
    return values[key] ?? '';
  }
  function buildExportAoa() {
    const fields = selectedDefinitions(MAIN_EXPORT_FIELDS, state.settings.mainExportFields);
    const companiesOrder = state.settings.exportMainCompanyColumns ? getExportCompanies() : [];
    const headers = fields.map(field => field.label);
    if (companiesOrder.length) {
      companiesOrder.forEach(company => headers.push(`${company}: тариф`, `${company}: метод`, `${company}: срок`, `${company}: цена`, `${company}: вход`, `${company}: скидка, %`));
    }
    const rows = state.rows.filter(row => row.senderQuery || row.recipientQuery || row.result).map((row, index) => {
      const values = fields.map(field => mainFieldValue(field.key, row, index));
      companiesOrder.forEach(company => {
        const item = row.result?.companies?.[company];
        values.push(...(item ? [item.tariffCaption, item.deliveryTypeLabel || item.deliveryMethodLabel, formatTerm(item), item.userPrice, item.inputPrice, item.discount] : ['', '', '', '', '', '']));
      });
      return values;
    });
    return [headers, ...rows];
  }
  function flattenTariffs(rows = state.rows, companyFilter = '') {
    const result = [];
    rows.forEach(row => {
      const rowIndex = state.rows.indexOf(row);
      visibleTariffs(row.result?.allTariffs).forEach(item => {
        if (!companyFilter || item.deliveryCompanyLabel === companyFilter) result.push({ row, rowIndex, item });
      });
    });
    return result;
  }
  function selectedTariffFields() {
    return selectedDefinitions(TARIFF_EXPORT_FIELDS, state.settings.tariffExportFields);
  }
  function buildAllTariffsAoa(rows = state.rows, companyFilter = '', flattened = null) {
    const fields = selectedTariffFields();
    const records = flattened || flattenTariffs(rows, companyFilter);
    return [fields.map(field => field.label), ...records.map(({ row, rowIndex, item }) => fields.map(field => tariffFieldValue(field.key, item, row, rowIndex)))];
  }
  function buildTariffsAoaForRow(row, tariffs = row.result?.allTariffs || []) {
    const rowIndex = Math.max(0, state.rows.indexOf(row));
    const fields = selectedTariffFields();
    return [fields.map(field => field.label), ...tariffs.map(item => fields.map(field => tariffFieldValue(field.key, item, row, rowIndex)))];
  }
  function tariffVariantKey(item) {
    return `${item.tariffId || item.tariffCaption}|${item.deliveryMethod ?? ''}|${item.deliveryType ?? ''}`;
  }
  function buildCompanyWideModel(company) {
    const selected = selectedTariffFields();
    let requestFields = selected.filter(field => field.scope === 'request');
    let tariffFields = selected.filter(field => field.scope === 'tariff' && field.key !== 'company');
    if (!requestFields.length) requestFields = selectedDefinitions(TARIFF_EXPORT_FIELDS, ['requestNo', 'senderQuery', 'recipientQuery']);
    if (!tariffFields.length) tariffFields = selectedDefinitions(TARIFF_EXPORT_FIELDS, ['tariffCaption', 'method', 'maxPeriod', 'userPrice']);
    const records = flattenTariffs(state.rows, company);
    const variantsMap = new Map();
    records.forEach(({ item }) => {
      const key = tariffVariantKey(item);
      if (!variantsMap.has(key)) variantsMap.set(key, item);
    });
    const variants = [...variantsMap.entries()].sort((a, b) => {
      const ai = a[1], bi = b[1];
      return (Number(ai.sort) || 9999) - (Number(bi.sort) || 9999) || String(ai.tariffCaption).localeCompare(String(bi.tariffCaption), 'ru') || (Number(ai.deliveryMethod) || 0) - (Number(bi.deliveryMethod) || 0);
    });
    const row1 = [];
    const row2 = [];
    if (requestFields.length) {
      row1.push('Запрос', ...new Array(requestFields.length - 1).fill(''));
      row2.push(...requestFields.map(field => field.label));
    }
    variants.forEach(([, item]) => {
      const title = `${item.tariffCaption || item.tariffName || 'Тариф'} (${item.deliveryTypeLabel || item.deliveryMethodLabel || 'метод'})`;
      row1.push(title, ...new Array(tariffFields.length - 1).fill(''));
      row2.push(...tariffFields.map(field => field.label));
    });
    const dataRows = state.rows.filter(row => row.senderQuery || row.recipientQuery || row.result).map((row, fallbackIndex) => {
      const rowIndex = state.rows.indexOf(row);
      const values = requestFields.map(field => tariffFieldValue(field.key, null, row, rowIndex >= 0 ? rowIndex : fallbackIndex));
      const map = new Map();
      visibleTariffs(row.result?.allTariffs).filter(item => item.deliveryCompanyLabel === company).forEach(item => {
        const key = tariffVariantKey(item);
        const current = map.get(key);
        if (!current || Number(item.userPrice) < Number(current.userPrice)) map.set(key, item);
      });
      variants.forEach(([key]) => {
        const item = map.get(key);
        values.push(...tariffFields.map(field => item ? tariffFieldValue(field.key, item, row, rowIndex) : ''));
      });
      return values;
    });
    const merges = [];
    let col = 0;
    if (requestFields.length > 1) merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: requestFields.length - 1 } });
    col += requestFields.length;
    variants.forEach(() => {
      if (tariffFields.length > 1) merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + tariffFields.length - 1 } });
      col += tariffFields.length;
    });
    return { aoa: [row1, row2, ...dataRows], merges, freezeColumns: requestFields.length, headerRows: 2 };
  }
  function buildCompanySummaryAoa() {
    const groups = new Map();
    state.rows.forEach((row, rowIndex) => (row.result?.allTariffs || []).forEach(item => {
      const name = item.deliveryCompanyLabel || 'Неизвестная ТК';
      if (!groups.has(name)) groups.set(name, { tariffs: [], requests: new Set() });
      groups.get(name).tariffs.push(item);
      groups.get(name).requests.add(rowIndex);
    }));
    const headers = ['ТК', 'Запросов', 'Тарифов', 'Мин. цена', 'Средняя цена', 'Макс. цена', 'Самый быстрый срок', 'Макс. срок', 'Методов доставки'];
    const rows = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru')).map(([name, group]) => {
      const prices = group.tariffs.map(item => Number(item.userPrice)).filter(Number.isFinite);
      const periods = group.tariffs.map(item => Number(item.maxPeriod)).filter(Number.isFinite);
      const methods = new Set(group.tariffs.map(item => item.deliveryTypeLabel || item.deliveryMethodLabel).filter(Boolean));
      return [name, group.requests.size, group.tariffs.length, prices.length ? Math.min(...prices) : '', prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100 : '',
        prices.length ? Math.max(...prices) : '', periods.length ? Math.min(...periods) : '', periods.length ? Math.max(...periods) : '', [...methods].join('; ')];
    });
    return [headers, ...rows];
  }
  function makeWorksheet(aoa, maxWidth = 42, options = {}) {
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const headerRow = Number(options.headerRow ?? 0);
    const freezeRows = Number(options.freezeRows ?? 1);
    const freezeColumns = Number(options.freezeColumns ?? 0);
    worksheet['!freeze'] = { xSplit: freezeColumns, ySplit: freezeRows };
    if (aoa.length && (aoa[headerRow] || []).length) worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: Math.max(headerRow, aoa.length - 1), c: aoa[headerRow].length - 1 } }) };
    const widthRow = aoa[headerRow] || aoa[0] || [];
    worksheet['!cols'] = widthRow.map((header, index) => ({ wch: Math.min(maxWidth, Math.max(10, String(header).length + 2, ...aoa.slice(headerRow + 1, headerRow + 81).map(row => String(row[index] ?? '').length + 1))) }));
    return worksheet;
  }
  function makeWideCompanyWorksheet(model, maxWidth = 42) {
    const worksheet = makeWorksheet(model.aoa, maxWidth, { headerRow: 1, freezeRows: 2, freezeColumns: model.freezeColumns });
    worksheet['!merges'] = model.merges;
    return worksheet;
  }
  function safeSheetName(name, used) {
    const base = String(name || 'Лист').replace(/[\\/?*:[\]]/g, ' ').trim().slice(0, 31) || 'Лист';
    let result = base, suffix = 2;
    while (used.has(result)) {
      const tail = ` ${suffix++}`;
      result = `${base.slice(0, 31 - tail.length)}${tail}`;
    }
    used.add(result);
    return result;
  }
  async function copyAoa(aoa, successMessage) {
    if (aoa.length < 2) { toast('Нет данных для копирования', 'error'); return; }
    const text = aoa.map(row => row.map(value => String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t')).join('\n');
    try { await navigator.clipboard.writeText(text); }
    catch {
      const textarea = document.createElement('textarea');
      textarea.value = text; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
    }
    toast(successMessage, 'success');
  }
  async function copyResults() { return copyAoa(buildExportAoa(), 'Таблица скопирована в буфер обмена'); }
  function csvEscape(value) {
    const text = String(value ?? '');
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function aoaToCsv(aoa) { return '\ufeff' + aoa.map(row => row.map(csvEscape).join(';')).join('\r\n'); }
  function downloadCsv() {
    const aoa = buildExportAoa();
    if (aoa.length < 2) { toast('Нет данных для скачивания', 'error'); return; }
    downloadBlob(new Blob([aoaToCsv(aoa)], { type: 'text/csv;charset=utf-8' }), fileName('csv'));
  }
  function downloadXlsx() {
    const main = buildExportAoa();
    if (main.length < 2) { toast('Нет данных для скачивания', 'error'); return; }
    const workbook = XLSX.utils.book_new();
    const used = new Set();
    XLSX.utils.book_append_sheet(workbook, makeWorksheet(main), safeSheetName('Расчёт', used));
    const summary = buildCompanySummaryAoa();
    if (summary.length > 1) XLSX.utils.book_append_sheet(workbook, makeWorksheet(summary), safeSheetName('Сводка ТК', used));
    const allTariffs = buildAllTariffsAoa();
    if (allTariffs.length > 1) XLSX.utils.book_append_sheet(workbook, makeWorksheet(allTariffs, 55), safeSheetName('Все тарифы', used));
    if (state.settings.exportCompanySheets) {
      const companies = [...new Set(state.rows.flatMap(row => (row.result?.allTariffs || []).map(item => item.deliveryCompanyLabel || 'Неизвестная ТК')))].sort((a, b) => a.localeCompare(b, 'ru'));
      companies.forEach(company => {
        if (state.settings.companySheetLayout === 'long') {
          const aoa = buildAllTariffsAoa(state.rows, company);
          if (aoa.length > 1) XLSX.utils.book_append_sheet(workbook, makeWorksheet(aoa, 55), safeSheetName(company, used));
        } else {
          const model = buildCompanyWideModel(company);
          if (model.aoa.length > 2 && model.aoa[0].length) XLSX.utils.book_append_sheet(workbook, makeWideCompanyWorksheet(model, 48), safeSheetName(company, used));
        }
      });
    }
    XLSX.writeFile(workbook, fileName('xlsx'), { compression: true });
  }
  function downloadImportTemplate() {
    const workbook = XLSX.utils.book_new();
    const data = [
      ['Откуда', 'Куда', 'Вес, кг', 'Мест', 'Длина, см', 'Ширина, см', 'Высота, см'],
      ['Москва', 'Санкт-Петербург', 2.5, 1, 30, 20, 15],
      ['Казань, ул. Баумана, 1', 'Екатеринбург', 8, 2, 40, 30, 25]
    ];
    const sheet = makeWorksheet(data, 34);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Импорт');
    const instructions = [
      ['Шаблон массового расчёта КД'],
      ['Обязательные столбцы', 'Откуда и Куда'],
      ['Необязательные столбцы', 'Вес, Мест, Длина, Ширина, Высота'],
      ['Значения по умолчанию', 'Вес 0,1 кг; 1 место; габариты 10×10×10 см'],
      ['Адреса', 'Можно указывать город или полный адрес. Расширение определит FIAS и город КД автоматически.'],
      ['Поддерживаемые форматы', 'XLSX, XLS, CSV, TSV, TXT'],
      ['Важно', 'Не переименовывайте обязательные столбцы и не удаляйте строку заголовков.']
    ];
    XLSX.utils.book_append_sheet(workbook, makeWorksheet(instructions, 80), 'Инструкция');
    XLSX.writeFile(workbook, 'КД_шаблон_импорта.xlsx', { compression: true });
    toast('Шаблон импорта скачан', 'success');
  }
  function fileName(extension) {
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    return `КД_массовый_расчёт_${stamp}.${extension}`;
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function applyAdvancedTableMode(container, advanced) {
    container?.classList.toggle('advanced-view', Boolean(advanced));
  }

  function openTariffs(row) {
    const tariffs = visibleTariffs(row.result?.allTariffs);
    if (!tariffs.length) return;
    state.activeTariffRowId = row.id;
    state.tariffView.sortKey = 'userPrice';
    state.tariffView.sortDir = 'asc';
    state.tariffView.advanced = Boolean(state.settings.advancedTariffView);
    els.advancedTariffViewToggle.checked = state.tariffView.advanced;
    applyAdvancedTableMode(els.tariffsModal, state.tariffView.advanced);
    els.tariffsSubtitle.textContent = `${row.senderQuery} → ${row.recipientQuery} · ${tariffs.length} тарифов`;
    const companies = [...new Set(tariffs.map(item => item.deliveryCompanyLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const methods = [...new Set(tariffs.map(item => item.deliveryTypeLabel || item.deliveryMethodLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    els.tariffCompanyFilter.innerHTML = '<option value="">Все</option>' + companies.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    els.tariffMethodFilter.innerHTML = '<option value="">Все</option>' + methods.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    resetTariffFilters(false);
    renderTariffsView();
    els.tariffsModal.classList.add('open');
    els.tariffsModal.setAttribute('aria-hidden', 'false');
  }
  function activeTariffRow() { return state.rows.find(row => row.id === state.activeTariffRowId); }
  function resetTariffFilters(render = true) {
    [els.tariffSearchInput, els.tariffPriceMin, els.tariffPriceMax, els.tariffPeriodMin, els.tariffPeriodMax].forEach(input => input.value = '');
    els.tariffCompanyFilter.value = '';
    els.tariffMethodFilter.value = '';
    if (render) renderTariffsView();
  }
  function setTariffSort(key) {
    if (state.tariffView.sortKey === key) state.tariffView.sortDir = state.tariffView.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.tariffView.sortKey = key; state.tariffView.sortDir = 'asc'; }
    renderTariffsView();
  }
  function numericFilterValue(input) {
    if (!input.value.trim()) return null;
    const number = Number(input.value.replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  }
  function filteredTariffs() {
    const row = activeTariffRow();
    if (!row) return [];
    const query = normalize(els.tariffSearchInput.value);
    const company = els.tariffCompanyFilter.value;
    const method = els.tariffMethodFilter.value;
    const priceMin = numericFilterValue(els.tariffPriceMin), priceMax = numericFilterValue(els.tariffPriceMax);
    const periodMin = numericFilterValue(els.tariffPeriodMin), periodMax = numericFilterValue(els.tariffPeriodMax);
    const filtered = visibleTariffs(row.result?.allTariffs).filter(item => {
      const searchText = normalize([item.deliveryCompanyLabel, item.tariffCaption, item.tariffName, item.deliveryMethodLabel, item.deliveryTypeLabel, item.rateName].join(' '));
      const price = Number(item.userPrice), period = Number(item.maxPeriod);
      return (!query || searchText.includes(query)) && (!company || item.deliveryCompanyLabel === company) && (!method || (item.deliveryTypeLabel || item.deliveryMethodLabel) === method)
        && (priceMin === null || price >= priceMin) && (priceMax === null || price <= priceMax)
        && (periodMin === null || period >= periodMin) && (periodMax === null || period <= periodMax);
    });
    const { sortKey, sortDir } = state.tariffView;
    const direction = sortDir === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (['userPrice', 'inputPrice', 'retailPrice', 'discount', 'maxPeriod'].includes(sortKey)) return ((Number(av) || 0) - (Number(bv) || 0)) * direction;
      return String(av || '').localeCompare(String(bv || ''), 'ru') * direction;
    });
    return filtered;
  }
  function renderTariffsView() {
    const row = activeTariffRow();
    if (!row) return;
    const tariffs = filteredTariffs();
    state.tariffView.filtered = tariffs;
    const prices = tariffs.map(item => Number(item.userPrice)).filter(Number.isFinite);
    const periods = tariffs.map(item => Number(item.maxPeriod)).filter(Number.isFinite);
    els.tariffCountMetric.textContent = `${tariffs.length} из ${row.result?.allTariffs?.length || 0}`;
    els.tariffMinPriceMetric.textContent = prices.length ? `${formatValue(Math.min(...prices))} ₽` : '—';
    els.tariffFastestMetric.textContent = periods.length ? `${Math.min(...periods)} дн.` : '—';
    $$('.sort-button').forEach(button => {
      button.classList.toggle('active', button.dataset.sort === state.tariffView.sortKey);
      button.classList.toggle('asc', button.dataset.sort === state.tariffView.sortKey && state.tariffView.sortDir === 'asc');
      button.classList.toggle('desc', button.dataset.sort === state.tariffView.sortKey && state.tariffView.sortDir === 'desc');
    });
    if (!tariffs.length) {
      els.tariffsBody.innerHTML = '<tr><td colspan="10" class="empty-tariffs">По заданным фильтрам тарифы не найдены.</td></tr>';
      return;
    }
    const best = row.result?.best;
    els.tariffsBody.innerHTML = tariffs.map((item, index) => {
      const isBest = best && item.deliveryCompanyLabel === best.deliveryCompanyLabel && item.tariffCaption === best.tariffCaption && Number(item.userPrice) === Number(best.userPrice) && Number(item.deliveryMethod) === Number(best.deliveryMethod);
      const requiredCount = servicesList(item, true).length;
      const totalServices = servicesList(item, false).length;
      const description = item.tariffDescription ? `<small title="${escapeHtml(item.tariffDescription)}">${escapeHtml(item.tariffDescription)}</small>` : '';
      return `<tr>
        <td><div class="tariff-company">${item.deliveryCompanyIcon ? `<img src="${escapeHtml(item.deliveryCompanyIcon)}" alt="">` : ''}<span>${escapeHtml(item.deliveryCompanyLabel || '—')}</span></div></td>
        <td class="tariff-description"><b>${escapeHtml(item.tariffCaption || item.tariffName || '—')}</b>${isBest ? ' <span class="tariff-tag best-tag">лучший</span>' : ''}${description}</td>
        <td>${escapeHtml(item.deliveryTypeLabel || item.deliveryMethodLabel || '—')}</td>
        <td>${escapeHtml(formatTerm(item))}</td>
        <td><b>${escapeHtml(formatValue(item.userPrice))} ₽</b></td>
        <td class="advanced-column">${item.inputPrice !== '' ? `${escapeHtml(formatValue(item.inputPrice))} ₽` : '—'}</td>
        <td class="advanced-column">${escapeHtml(formatValue(item.retailPrice))} ₽</td>
        <td class="advanced-column">${escapeHtml(item.discount || 0)}%</td>
        
        <td class="tariff-services advanced-column">${totalServices ? `${totalServices} шт.${requiredCount ? ` · ${requiredCount} обяз.` : ''}` : '—'}</td>
        <td><button class="button ghost compact-detail" data-tariff-details="${index}">Подробнее</button></td>
      </tr><tr class="tariff-details-row hidden" data-details-row="${index}"><td colspan="10">${tariffDetailsMarkup(item)}</td></tr>`;
    }).join('');
  }
  function tariffDetailsMarkup(item) {
    const serviceBlocks = servicesList(item, false).map(service => `<span class="tariff-tag" title="${escapeHtml(service.description || '')}">${escapeHtml(serviceText(service))}${service.required ? ' · обязательно' : service.enabled ? ' · включено' : ''}</span>`).join('') || '<span class="tariff-tag">Нет данных об услугах</span>';
    const margin = marginMetrics(item);
    return `<div class="tariff-details"><div class="tariff-detail-block"><h4>Максимальный срок</h4><p><strong>${escapeHtml(formatTerm(item))}</strong></p></div><div class="tariff-detail-block"><h4>Цена</h4><p>Клиент: <strong>${escapeHtml(formatValue(item.userPrice))} ₽</strong></p><p>Вход: ${item.inputPrice !== '' ? `${escapeHtml(formatValue(item.inputPrice))} ₽` : '—'}</p><p>Розница: ${item.retailPrice ? `${escapeHtml(formatValue(item.retailPrice))} ₽` : '—'}</p></div><div class="tariff-detail-block"><h4>Маржа и скидка</h4><p>Маржа: ${margin.marginRub === null ? '—' : `${escapeHtml(formatValue(round2(margin.marginRub)))} ₽`}</p><p>Маржа: ${margin.marginPct === null ? '—' : `${escapeHtml(formatValue(round2(margin.marginPct)))}%`}</p><p>Скидка от розницы: ${escapeHtml(formatValue(item.discount || 0))}%</p></div><div class="tariff-detail-block"><h4>Возврат</h4><p>${item.returnServiceAllowed ? `Разрешён${item.returnServicePrice !== '' ? ` · ${escapeHtml(formatValue(item.returnServicePrice))} ₽` : ''}` : 'Не предусмотрен'}</p></div><div class="tariff-detail-block tariff-detail-wide"><h4>Услуги</h4>${serviceBlocks}</div></div>`;
  }
  function handleTariffsClick(event) {
    const button = event.target.closest('[data-tariff-details]');
    if (!button) return;
    const row = els.tariffsBody.querySelector(`[data-details-row="${button.dataset.tariffDetails}"]`);
    row?.classList.toggle('hidden');
    button.textContent = row?.classList.contains('hidden') ? 'Подробнее' : 'Скрыть';
  }
  async function copyTariffsView() {
    const row = activeTariffRow();
    if (!row) return;
    return copyAoa(buildTariffsAoaForRow(row, state.tariffView.filtered), 'Тарифы строки скопированы');
  }
  function downloadTariffsCsv() {
    const row = activeTariffRow();
    if (!row || !state.tariffView.filtered.length) { toast('Нет тарифов для скачивания', 'error'); return; }
    downloadBlob(new Blob([aoaToCsv(buildTariffsAoaForRow(row, state.tariffView.filtered))], { type: 'text/csv;charset=utf-8' }), tariffFileName(row, 'csv'));
  }
  function downloadTariffsXlsx() {
    const row = activeTariffRow();
    if (!row || !state.tariffView.filtered.length) { toast('Нет тарифов для скачивания', 'error'); return; }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, makeWorksheet(buildTariffsAoaForRow(row, state.tariffView.filtered), 55), 'Тарифы');
    XLSX.writeFile(workbook, tariffFileName(row, 'xlsx'), { compression: true });
  }
  function tariffFileName(row, extension) {
    const route = `${row.senderQuery}_${row.recipientQuery}`.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 70);
    return `КД_тарифы_${route || 'строка'}.${extension}`;
  }
  function closeTariffsModal() {
    resetModalFullscreen(els.tariffsModal);
    els.tariffsModal.classList.remove('open');
    els.tariffsModal.setAttribute('aria-hidden', 'true');
    state.activeTariffRowId = '';
    state.tariffView.filtered = [];
  }

  function allCompanyRecords() {
    return flattenTariffs(state.rows).filter(record=>!isHiddenCompanyName(record.item?.deliveryCompanyLabel));
  }
  function openCompanyModal() {
    const records = allCompanyRecords();
    if (!records.length) { toast('Сначала выполните хотя бы один расчёт', 'error'); return; }
    const companies = [...new Set(records.map(record => record.item.deliveryCompanyLabel || 'Неизвестная ТК'))].sort((a, b) => a.localeCompare(b, 'ru'));
    const methods = [...new Set(records.map(record => record.item.deliveryTypeLabel || record.item.deliveryMethodLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    els.companySelect.innerHTML = '<option value="">Все ТК</option>' + companies.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    els.companyMethodFilter.innerHTML = '<option value="">Все</option>' + methods.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    state.companyView.sortKey = 'userPrice';
    state.companyView.sortDir = 'asc';
    state.companyView.advanced = false;
    els.advancedCompanyViewToggle.checked = false;
    applyAdvancedTableMode(els.companyModal, false);
    resetCompanyFilters(false);
    renderCompanyCards(records);
    renderCompanyView();
    els.companyModal.classList.add('open');
    els.companyModal.setAttribute('aria-hidden', 'false');
  }
  function renderCompanyCards(records = allCompanyRecords()) {
    const groups = new Map();
    records.forEach(record => {
      const name = record.item.deliveryCompanyLabel || 'Неизвестная ТК';
      if (!groups.has(name)) groups.set(name, { count: 0, prices: [], requests: new Set() });
      const group = groups.get(name);
      group.count += 1;
      const price = Number(record.item.userPrice);
      if (Number.isFinite(price)) group.prices.push(price);
      group.requests.add(record.rowIndex);
    });
    els.companyCards.innerHTML = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru')).map(([name, group]) => {
      const min = group.prices.length ? Math.min(...group.prices) : '';
      return `<button class="company-card${els.companySelect.value === name ? ' active' : ''}" data-company-card="${escapeHtml(name)}">
        <span>${escapeHtml(name)}</span><b>${group.count} тарифов</b><small>${group.requests.size} запросов · от ${min === '' ? '—' : `${escapeHtml(formatValue(min))} ₽`}</small>
      </button>`;
    }).join('');
  }
  function handleCompanyCardClick(event) {
    const card = event.target.closest('[data-company-card]');
    if (!card) return;
    els.companySelect.value = card.dataset.companyCard;
    renderCompanyView();
  }
  function resetCompanyFilters(render = true) {
    els.companySelect.value = '';
    [els.companySearchInput, els.companyPriceMin, els.companyPriceMax, els.companyPeriodMin, els.companyPeriodMax].forEach(input => { input.value = ''; });
    els.companyMethodFilter.value = '';
    if (render) renderCompanyView();
  }
  function setCompanySort(key) {
    if (state.companyView.sortKey === key) state.companyView.sortDir = state.companyView.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.companyView.sortKey = key; state.companyView.sortDir = 'asc'; }
    renderCompanyView();
  }
  function filteredCompanyRecords() {
    const company = els.companySelect.value;
    const query = normalize(els.companySearchInput.value);
    const method = els.companyMethodFilter.value;
    const priceMin = numericFilterValue(els.companyPriceMin), priceMax = numericFilterValue(els.companyPriceMax);
    const periodMin = numericFilterValue(els.companyPeriodMin), periodMax = numericFilterValue(els.companyPeriodMax);
    const records = allCompanyRecords().filter(record => {
      const { row, item } = record;
      const search = normalize([row.senderQuery, row.recipientQuery, item.deliveryCompanyLabel, item.tariffCaption, item.tariffName, item.deliveryMethodLabel, item.deliveryTypeLabel, item.rateName].join(' '));
      const price = Number(item.userPrice), period = Number(item.maxPeriod);
      return (!company || item.deliveryCompanyLabel === company) && (!query || search.includes(query))
        && (!method || (item.deliveryTypeLabel || item.deliveryMethodLabel) === method)
        && (priceMin === null || price >= priceMin) && (priceMax === null || price <= priceMax)
        && (periodMin === null || period >= periodMin) && (periodMax === null || period <= periodMax);
    });
    const direction = state.companyView.sortDir === 'desc' ? -1 : 1;
    const key = state.companyView.sortKey;
    records.sort((a, b) => {
      let av, bv;
      if (key === 'requestNo') { av = a.rowIndex; bv = b.rowIndex; }
      else if (key === 'route') { av = `${a.row.senderQuery} ${a.row.recipientQuery}`; bv = `${b.row.senderQuery} ${b.row.recipientQuery}`; }
      else { av = a.item[key]; bv = b.item[key]; }
      if (['requestNo', 'userPrice', 'inputPrice', 'retailPrice', 'discount', 'maxPeriod'].includes(key)) return ((Number(av) || 0) - (Number(bv) || 0)) * direction;
      return String(av || '').localeCompare(String(bv || ''), 'ru') * direction;
    });
    return records;
  }
  function renderCompanyView() {
    const records = filteredCompanyRecords();
    state.companyView.company = els.companySelect.value;
    state.companyView.filtered = records;
    renderCompanyCards();
    const prices = records.map(record => Number(record.item.userPrice)).filter(Number.isFinite);
    const periods = records.map(record => Number(record.item.maxPeriod)).filter(Number.isFinite);
    const requests = new Set(records.map(record => record.rowIndex));
    els.companyCountMetric.textContent = String(records.length);
    els.companyRequestsMetric.textContent = String(requests.size);
    els.companyMinPriceMetric.textContent = prices.length ? `${formatValue(Math.min(...prices))} ₽` : '—';
    els.companyAvgPriceMetric.textContent = prices.length ? `${formatValue(Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length * 100) / 100)} ₽` : '—';
    els.companyFastestMetric.textContent = periods.length ? `${Math.min(...periods)} дн.` : '—';
    $$('.company-sort-button').forEach(button => {
      button.classList.toggle('active', button.dataset.companySort === state.companyView.sortKey);
      button.classList.toggle('asc', button.dataset.companySort === state.companyView.sortKey && state.companyView.sortDir === 'asc');
      button.classList.toggle('desc', button.dataset.companySort === state.companyView.sortKey && state.companyView.sortDir === 'desc');
    });
    if (!records.length) {
      els.companyTariffsBody.innerHTML = '<tr><td colspan="10" class="empty-tariffs">По заданным фильтрам тарифы не найдены.</td></tr>';
      return;
    }
    els.companyTariffsBody.innerHTML = records.map((record, index) => {
      const { row, rowIndex, item } = record;
      return `<tr>
        <td>${rowIndex + 1}</td>
        <td class="route-cell"><b>${escapeHtml(row.senderQuery || '—')}</b><span>→ ${escapeHtml(row.recipientQuery || '—')}</span></td>
        <td><div class="tariff-company">${item.deliveryCompanyIcon ? `<img src="${escapeHtml(item.deliveryCompanyIcon)}" alt="">` : ''}<span>${escapeHtml(item.deliveryCompanyLabel || '—')}</span></div></td>
        <td class="tariff-description"><b>${escapeHtml(item.tariffCaption || item.tariffName || '—')}</b></td>
        <td>${escapeHtml(item.deliveryTypeLabel || item.deliveryMethodLabel || '—')}</td>
        <td>${escapeHtml(formatTerm(item))}</td>
        <td><b>${escapeHtml(formatValue(item.userPrice))} ₽</b></td>
        <td class="advanced-column">${escapeHtml(formatValue(parsePositive(row.weight, .1)))} кг · ${escapeHtml(String(Math.round(parsePositive(row.seats, 1))))} м. · ${escapeHtml(formatValue(parsePositive(row.length, 10)))}×${escapeHtml(formatValue(parsePositive(row.width, 10)))}×${escapeHtml(formatValue(parsePositive(row.height, 10)))}</td>
        <td class="advanced-column">${item.inputPrice !== '' ? `${escapeHtml(formatValue(item.inputPrice))} ₽` : '—'}</td>
        <td class="advanced-column">${escapeHtml(formatValue(item.retailPrice))} ₽</td>
        
        <td><button class="button ghost compact-detail" data-company-details="${index}">Подробнее</button></td>
      </tr><tr class="tariff-details-row hidden" data-company-details-row="${index}"><td colspan="10">${tariffDetailsMarkup(item)}</td></tr>`;
    }).join('');
  }
  function handleCompanyDetailsClick(event) {
    const button = event.target.closest('[data-company-details]');
    if (!button) return;
    const row = els.companyTariffsBody.querySelector(`[data-company-details-row="${button.dataset.companyDetails}"]`);
    row?.classList.toggle('hidden');
    button.textContent = row?.classList.contains('hidden') ? 'Подробнее' : 'Скрыть';
  }
  function companyViewAoa() {
    return buildAllTariffsAoa(state.rows, '', state.companyView.filtered);
  }
  async function copyCompanyView() {
    return copyAoa(companyViewAoa(), 'Выбранные тарифы ТК скопированы');
  }
  function companyFileName(extension) {
    const company = (els.companySelect.value || 'все_ТК').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 60);
    return `КД_обзор_${company}.${extension}`;
  }
  function downloadCompanyCsv() {
    const aoa = companyViewAoa();
    if (aoa.length < 2) { toast('Нет тарифов для скачивания', 'error'); return; }
    downloadBlob(new Blob([aoaToCsv(aoa)], { type: 'text/csv;charset=utf-8' }), companyFileName('csv'));
  }
  function downloadCompanyXlsx() {
    const aoa = companyViewAoa();
    if (aoa.length < 2) { toast('Нет тарифов для скачивания', 'error'); return; }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, makeWorksheet(aoa, 55), 'Тарифы');
    XLSX.writeFile(workbook, companyFileName('xlsx'), { compression: true });
  }
  function closeCompanyModal() {
    resetModalFullscreen(els.companyModal);
    els.companyModal.classList.remove('open');
    els.companyModal.setAttribute('aria-hidden', 'true');
    state.companyView.filtered = [];
  }

  function refreshSummary() {
    const meaningful = state.rows.filter(row => row.senderQuery || row.recipientQuery || row.result);
    const done = meaningful.filter(row => row.status === 'done').length;
    const errors = meaningful.filter(row => row.status === 'error').length;
    els.countTotal.textContent = meaningful.length;
    els.countDone.textContent = done;
    els.countErrors.textContent = errors;
    const complete = done + errors;
    els.progressBar.style.width = meaningful.length ? `${Math.round(complete / meaningful.length * 100)}%` : '0%';
    if (!state.running) {
      if (!meaningful.length) {
        els.statusTitle.textContent = 'Готово к работе';
        els.statusDetails.textContent = 'Добавьте строки вручную, вставьте данные или импортируйте файл.';
      } else if (done === meaningful.length) {
        els.statusTitle.textContent = 'Все строки рассчитаны';
        els.statusDetails.textContent = 'Результат можно скачать в XLSX/CSV или скопировать.';
      } else if (errors) {
        els.statusTitle.textContent = 'Есть строки, требующие внимания';
        els.statusDetails.textContent = 'Наведите курсор на статус строки, чтобы увидеть причину.';
      }
    }
  }
  function toast(message, type = '') {
    const element = document.createElement('div');
    element.className = `toast ${type}`;
    element.textContent = message;
    els.toastContainer.appendChild(element);
    setTimeout(() => element.remove(), 3800);
  }



  /* ===== v1.6 project/settings overrides ===== */
  function currentProjectId() { return state.settings.activeProject && PROJECTS[state.settings.activeProject] ? state.settings.activeProject : 'kd'; }
  function projectSettings(projectId = currentProjectId()) {
    state.settings.projects ||= JSON.parse(JSON.stringify(DEFAULT_PROJECT_SETTINGS));
    state.settings.projects[projectId] ||= { ...DEFAULT_PROJECT_SETTINGS[projectId] };
    return state.settings.projects[projectId];
  }
  function projectDef(projectId = currentProjectId()) { return PROJECTS[projectId] || PROJECTS.kd; }
  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
  function applyDensity(density = state.settings.density) {
    const safe = ['micro','compact','medium','spacious'].includes(density) ? density : 'medium';
    document.documentElement.dataset.density = safe;
  }
  function sanitizeInn(value) { return String(value || '').replace(/\D+/g, '').slice(0, 12); }
  function isValidInn(value) { return /^\d{10}$|^\d{12}$/.test(String(value || '')); }
  function normalizeInnInput(input) {
    if (!input) return '';
    const clean = sanitizeInn(input.value);
    if (input.value !== clean) input.value = clean;
    return clean;
  }
  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem('kd.settings.v2') || localStorage.getItem('kd.settings.v1') || '{}');
      const secretPolicyVersion = Number(stored.secretPolicyVersion) || 0;
      const companyExclusionsVersion = Number(stored.companyExclusionsVersion) || 0;
      const projects = deepClone(DEFAULT_PROJECT_SETTINGS);
      if (stored.projects?.opspost && !stored.projects.me) stored.projects.me = stored.projects.opspost;
      if (stored.activeProject === 'opspost') stored.activeProject = 'me';
      if (stored.projects) {
        Object.keys(projects).forEach(id => Object.assign(projects[id], stored.projects[id] || {}));
      } else if (stored.email || stored.userId || stored.inn) {
        Object.assign(projects.kd, {
          email: stored.email || '', password: stored.password || '', inn: stored.inn || '', userId: stored.userId || '',
          userDisplay: stored.userDisplay || '', exclusions: Array.isArray(stored.exclusions) ? stored.exclusions : [],
          bestMethodMode: stored.bestMethodMode === 'all' ? 'all' : 'door'
        });
      }
      state.settings = { ...deepClone(DEFAULT_SETTINGS), ...stored, projects };
      if (secretPolicyVersion < 2) state.settings.saveSecrets = true;
      state.settings.secretPolicyVersion = 2;
      state.settings.companyExclusionsVersion = 2;
      state.settings.activeProject = PROJECTS[state.settings.activeProject] ? state.settings.activeProject : 'kd';
      state.settings.tokenDaData = stored.tokenDaData || '';
      state.settings.concurrency = Math.min(6, Math.max(1, Number(state.settings.concurrency) || 3));
      state.settings.debounceMs = 900;
      state.settings.calcTimeoutMs = Math.min(180000, Math.max(30000, Number(state.settings.calcTimeoutMs) || 120000));
      state.settings.calcRetries = Math.min(3, Math.max(0, Number.isFinite(Number(state.settings.calcRetries)) ? Number(state.settings.calcRetries) : 0));
      state.settings.exportCompanySheets = state.settings.exportCompanySheets !== false;
      state.settings.exportMainCompanyColumns = Boolean(state.settings.exportMainCompanyColumns);
      state.settings.exportAnalyticsSheet = Boolean(state.settings.exportAnalyticsSheet);
      state.settings.companySheetLayout = state.settings.companySheetLayout === 'long' ? 'long' : 'wide';
      state.settings.mainExportFields = sanitizeFieldSelection(state.settings.mainExportFields, MAIN_EXPORT_FIELDS, MAIN_EXPORT_PRESETS.compact);
      state.settings.tariffExportFields = sanitizeFieldSelection(state.settings.tariffExportFields, TARIFF_EXPORT_FIELDS, TARIFF_EXPORT_PRESETS.compact);
      state.settings.mainExportPreset = presetForSelection(state.settings.mainExportFields, MAIN_EXPORT_PRESETS);
      state.settings.tariffExportPreset = presetForSelection(state.settings.tariffExportFields, TARIFF_EXPORT_PRESETS);
      state.settings.theme = ['system','light','dark'].includes(state.settings.theme) ? state.settings.theme : 'system';
      state.settings.density = ['micro','compact','medium','spacious'].includes(state.settings.density) ? state.settings.density : 'medium';
      state.settings.showServiceInfo = Boolean(state.settings.showServiceInfo);
      state.settings.overviewColumnOrder = COMPANY_COLUMN_ORDERS[state.settings.overviewColumnOrder] ? state.settings.overviewColumnOrder : 'logistics';
      state.settings.comparisonMetrics = sanitizeFieldSelection(state.settings.comparisonMetrics, COMPARISON_METRICS, COMPARISON_PRESETS.sale);
      state.settings.comparisonTariffMode = ['cheapest','fastest','pricePeriod','periodPrice'].includes(state.settings.comparisonTariffMode) ? state.settings.comparisonTariffMode : 'cheapest';
      state.settings.comparisonPeriodMax = validPeriod(state.settings.comparisonPeriodMax) || '';
      state.settings.salesFloorMode = ['strict','lkPrice','ownMargin'].includes(state.settings.salesFloorMode) ? state.settings.salesFloorMode : 'strict';
      state.settings.salesFloorPercent = clampNumber(state.settings.salesFloorPercent ?? state.settings.salesMinMarginPct,10,0,100);
      state.settings.salesBeatMarketPct = clampNumber(state.settings.salesBeatMarketPct,1,0,30);
      state.settings.managerView = ['recommendations','matrix'].includes(state.settings.managerView) ? state.settings.managerView : 'recommendations';
      state.settings.managerBaseCompany = String(state.settings.managerBaseCompany || 'cheapest');
      state.settings.managerTariffMode = ['cheapest','fastest','pricePeriod','periodPrice'].includes(state.settings.managerTariffMode) ? state.settings.managerTariffMode : 'cheapest';
      state.settings.managerPeriodMax = validPeriod(state.settings.managerPeriodMax) || '';
      state.settings.managerMethod = String(state.settings.managerMethod || '');
      state.settings.managerPreset = ['custom','balance','close','margin','lk'].includes(state.settings.managerPreset) ? state.settings.managerPreset : 'custom';
      state.settings.managerFloorMode = ['strict','lkPrice','ownMargin'].includes(state.settings.managerFloorMode) ? state.settings.managerFloorMode : state.settings.salesFloorMode;
      state.settings.managerFloorPercent = clampNumber(state.settings.managerFloorPercent ?? state.settings.managerMinMarginPct ?? state.settings.salesFloorPercent,10,0,100);
      state.settings.managerBeatMarketPct = clampNumber(state.settings.managerBeatMarketPct,state.settings.salesBeatMarketPct,0,30);
      state.settings.matrixDiscountMode = ['current','active'].includes(state.settings.matrixDiscountMode) ? state.settings.matrixDiscountMode : '';
      state.settings.matrixMethodByProject = {kd:'',me:'',ops:'',...(state.settings.matrixMethodByProject||{})};
      delete state.settings.salesMinMarginPct;
      delete state.settings.managerMinMarginPct;
      state.settings.analyticsMethodByProject = {kd:'',me:'',ops:'',...(state.settings.analyticsMethodByProject||{})};
      state.settings.analyticsSelections = {kd:{},me:{},ops:{},...(state.settings.analyticsSelections||{})};
      Object.entries(state.settings.projects).forEach(([id, value]) => {
        value.enabled = value.enabled !== false;
        value.authChecked = Boolean(value.authChecked && value.email && value.password);
        value.inn = sanitizeInn(value.inn);
        const savedExclusions = Array.isArray(value.exclusions) ? value.exclusions : [];
        value.exclusions = companyExclusionsVersion < 2 ? uniqueCompanyNames([...DEFAULT_COMPANY_EXCLUSIONS, ...savedExclusions]) : uniqueCompanyNames(savedExclusions);
        value.bestExclusions = uniqueCompanyNames(Array.isArray(value.bestExclusions) ? value.bestExclusions : []);
        value.bestMethodMode = value.bestMethodMode === 'all' ? 'all' : PROJECTS[id].defaultBestMethod;
      });
      if (!state.settings.saveSecrets) {
        state.settings.tokenDaData = '';
        Object.values(state.settings.projects).forEach(value => { value.password = ''; });
      }
    } catch {
      state.settings = deepClone(DEFAULT_SETTINGS);
    }
  }
  function persistSettings() {
    const toStore = deepClone(state.settings);
    if (!toStore.saveSecrets) {
      toStore.tokenDaData = '';
      Object.values(toStore.projects || {}).forEach(value => { value.password = ''; });
    }
    localStorage.setItem('kd.settings.v2', JSON.stringify(toStore));
    void syncToolkitCredentials();
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
  function projectLegacyClient(credentials = {}) {
    return {
      inn: sanitizeInn(credentials.inn || ''),
      userId: credentials.userId || '',
      userDisplay: credentials.userDisplay || ''
    };
  }
  function projectSectionClient(credentials = {}, section = 'calculatorClient') {
    const legacy = projectLegacyClient(credentials);
    const client = credentials?.[section] && typeof credentials[section] === 'object' ? credentials[section] : {};
    return {
      inn: sanitizeInn(client.inn || legacy.inn),
      userId: client.userId || legacy.userId,
      userDisplay: client.userDisplay || legacy.userDisplay
    };
  }
  async function hydrateToolkitCredentials() {
    const shared = await readToolkitCredentials();
    if (!shared) return false;
    if (PROJECTS[shared.activeProject]) state.settings.activeProject = shared.activeProject;
    if (Object.prototype.hasOwnProperty.call(shared, 'tokenDaData')) state.settings.tokenDaData = shared.tokenDaData || '';
    Object.entries(shared.projects || {}).forEach(([id, credentials]) => {
      if (!PROJECTS[id]) return;
      const p = projectSettings(id);
      p.email = credentials.email || '';
      p.password = credentials.password || '';
      p.authChecked = Boolean(credentials.authChecked && p.email && p.password);
      const client = projectSectionClient(credentials, 'calculatorClient');
      p.inn = client.inn;
      p.userId = client.userId;
      p.userDisplay = client.userDisplay;
    });
    return true;
  }
  async function syncToolkitCredentials() {
    const shared = await readToolkitCredentials() || {};
    shared.activeProject = currentProjectId();
    shared.tokenDaData = state.settings.tokenDaData || '';
    shared.projects = shared.projects || {};
    Object.keys(PROJECTS).forEach(id => {
      const p = projectSettings(id);
      shared.projects[id] = {
        ...(shared.projects[id] || {}),
        email: p.email || '',
        password: state.settings.saveSecrets ? (p.password || '') : '',
        authChecked: Boolean(p.authChecked && p.email && p.password),
        calculatorClient: {
          inn: sanitizeInn(p.inn || ''),
          userId: p.userId || '',
          userDisplay: p.userDisplay || ''
        }
      };
    });
    await writeToolkitCredentials(shared);
  }
  async function refreshToolkitCredentialsFromStorage() {
    const activeBefore = currentProjectId();
    const clientBefore = String(projectSettings(activeBefore).userId || '');
    const changed = await hydrateToolkitCredentials();
    if (!changed) return;
    if (PROJECTS[activeBefore]) state.settings.activeProject = activeBefore;
    const clientAfter = String(projectSettings(activeBefore).userId || '');
    if (clientBefore !== clientAfter) invalidateClientResults(clientAfter);
    if (state.settingsProjectId && PROJECTS[state.settingsProjectId] && els.settingsPanel?.classList.contains('open')) {
      fillSettingsForm();
    }
    renderProjectTabs();
    updateConnectionBadge();
    renderQuickClientPanel();
    refreshSummary();
  }
  function initToolkitStorageSync() {
    const storage = toolkitStorage();
    globalThis.chrome?.storage?.onChanged?.addListener?.((changes, areaName) => {
      if (areaName === 'local' && changes?.[TOOLKIT_CREDENTIALS_KEY]) {
        void refreshToolkitCredentialsFromStorage();
      }
    });
    if (storage) window.addEventListener('focus', () => { void refreshToolkitCredentialsFromStorage(); });
  }
  function cacheKeyAddress(query) { return `address:v2:${currentProjectId()}:${normalize(query)}`; }
  function cacheKeyCalculation(row) {
    const p = projectSettings();
    return ['calc:v15', currentProjectId(), p.userId, row.senderResolved?.placeId || row.senderResolved?.kdId, row.recipientResolved?.placeId || row.recipientResolved?.kdId,
      DEFAULT_CARGO_TYPE, Math.round(parsePositive(row.seats,1)), cargoWeightValue(row.weight), parsePositive(row.length,10), parsePositive(row.width,10), parsePositive(row.height,10),
      p.bestMethodMode, [...(p.exclusions || [])].sort().join(','), [...(p.bestExclusions || [])].sort().join(',')].join('|');
  }
  function cacheElements() {
    Object.assign(els, {
      runtimeLabel:$('#runtimeLabel'), brandMark:$('#brandMark'), activeProjectTitle:$('#activeProjectTitle'), projectTabs:$('#projectTabs'), connectionBadge:$('#connectionBadge'), cacheStatusBtn:$('#cacheStatusBtn'), helpBtn:$('#helpBtn'), openHelpFromSettingsBtn:$('#openHelpFromSettingsBtn'), helpModal:$('#helpModal'), openSettingsBtn:$('#openSettingsBtn'), themeToggleBtn:$('#themeToggleBtn'),
      settingsPanel:$('#settingsPanel'), settingsProjectTabs:$('#settingsProjectTabs'), settingsProjectLabel:$('#settingsProjectLabel'), projectEnabledToggle:$('#projectEnabledToggle'),
      emailInput:$('#emailInput'), passwordInput:$('#passwordInput'), dadataInput:$('#dadataInput'), savePasswordToggle:$('#savePasswordToggle'), innInput:$('#innInput'), findClientBtn:$('#findClientBtn'), clientResult:$('#clientResult'),
      concurrencySelect:$('#concurrencySelect'), debounceSelect:$('#debounceSelect'), bestMethodSelect:$('#bestMethodSelect'), exclusionsList:$('#exclusionsList'), bestExclusionsList:$('#bestExclusionsList'), exclusionsSettingsCard:$('#exclusionsSettingsCard'), refreshPartnerCompaniesBtn:$('#refreshPartnerCompaniesBtn'), partnerCompaniesStatus:$('#partnerCompaniesStatus'), calcTimeoutSelect:$('#calcTimeoutSelect'), calcRetriesSelect:$('#calcRetriesSelect'),
      exportCompanySheetsToggle:$('#exportCompanySheetsToggle'), exportMainCompanyColumnsToggle:$('#exportMainCompanyColumnsToggle'), exportAnalyticsSheetToggle:$('#exportAnalyticsSheetToggle'), companySheetLayoutSelect:$('#companySheetLayoutSelect'),
      mainExportPresetSelect:$('#mainExportPresetSelect'), tariffExportPresetSelect:$('#tariffExportPresetSelect'), mainExportFields:$('#mainExportFields'), tariffExportFields:$('#tariffExportFields'), mainFieldsCount:$('#mainFieldsCount'), tariffFieldsCount:$('#tariffFieldsCount'),
      themeSelect:$('#themeSelect'), densitySelect:$('#densitySelect'), overviewColumnOrderSelect:$('#overviewColumnOrderSelect'), showServiceInfoToggle:$('#showServiceInfoToggle'), saveSettingsBtn:$('#saveSettingsBtn'), clearCacheBtn:$('#clearCacheBtn'), refreshCacheStatsBtn:$('#refreshCacheStatsBtn'), cacheStatsGrid:$('#cacheStatsGrid'),
      addRowBtn:$('#addRowBtn'), pasteBtn:$('#pasteBtn'), fileInput:$('#fileInput'), fileButton:$('.primary-toolbar .file-button'), downloadTemplateBtn:$('#downloadTemplateBtn'), demoBtn:$('#demoBtn'), autoCalcToggle:$('#autoCalcToggle'), calculateAllBtn:$('#calculateAllBtn'), stopBtn:$('#stopBtn'),
      tableBody:$('#tableBody'), dataTable:$('#dataTable'), tableSearchInput:$('#tableSearchInput'), tableStatusFilter:$('#tableStatusFilter'), tableSortSelect:$('#tableSortSelect'), tableFilterCount:$('#tableFilterCount'), resetTableFilterBtn:$('#resetTableFilterBtn'), clearResultsBtn:$('#clearResultsBtn'), clearAllBtn:$('#clearAllBtn'), statusTitle:$('#statusTitle'), statusDetails:$('#statusDetails'), progressBar:$('#progressBar'), countTotal:$('#countTotal'), countDone:$('#countDone'), countErrors:$('#countErrors'), quickInnInput:$('#quickInnInput'), quickFindClientBtn:$('#quickFindClientBtn'), quickClientResult:$('#quickClientResult'),
      companyOverviewBtn:$('#companyOverviewBtn'), ordersBtn:$('#ordersBtn'), ordersModal:$('#ordersModal'), ordersSummary:$('#ordersSummary'), ordersPager:$('#ordersPager'), orderRows:$('#orderRows'), orderFileInput:$('#orderFileInput'), orderFileDrop:$('#orderFileInput')?.closest('.file-drop'), orderDefaultTakeDate:$('#orderDefaultTakeDate'), orderDefaultTimeFrom:$('#orderDefaultTimeFrom'), orderDefaultTimeTo:$('#orderDefaultTimeTo'), orderApplyScheduleBtn:$('#orderApplyScheduleBtn'), orderResultList:$('#orderResultList'), createOrdersBtn:$('#createOrdersBtn'), copyBtn:$('#copyBtn'), downloadCsvBtn:$('#downloadCsvBtn'), downloadXlsxBtn:$('#downloadXlsxBtn'),
      pasteModal:$('#pasteModal'), pasteArea:$('#pasteArea'), pasteHasHeader:$('#pasteHasHeader'), applyPasteBtn:$('#applyPasteBtn'), pasteTemplateBtn:$('#pasteTemplateBtn'),
      tariffsModal:$('#tariffsModal'), tariffsHead:$('#tariffsHead'), tariffsBody:$('#tariffsBody'), tariffsSubtitle:$('#tariffsSubtitle'), toastContainer:$('#toastContainer'), tariffSearchInput:$('#tariffSearchInput'), tariffCompanyFilter:$('#tariffCompanyFilter'), tariffUrgencyFilter:$('#tariffUrgencyFilter'), tariffNameFilter:$('#tariffNameFilter'), tariffMethodFilter:$('#tariffMethodFilter'), tariffCompanyFacetSummary:$('#tariffCompanyFacetSummary'), tariffCompanyFacetOptions:$('#tariffCompanyFacetOptions'), tariffTypeFacetSummary:$('#tariffTypeFacetSummary'), tariffTypeFacetOptions:$('#tariffTypeFacetOptions'), tariffMethodFacetSummary:$('#tariffMethodFacetSummary'), tariffMethodFacetOptions:$('#tariffMethodFacetOptions'), tariffUrgencyFacetSummary:$('#tariffUrgencyFacetSummary'), tariffUrgencyFacetOptions:$('#tariffUrgencyFacetOptions'), tariffNameFacetSummary:$('#tariffNameFacetSummary'), tariffNameFacetOptions:$('#tariffNameFacetOptions'), tariffPriceMin:$('#tariffPriceMin'), tariffPriceMax:$('#tariffPriceMax'), tariffPeriodMax:$('#tariffPeriodMax'), resetTariffFiltersBtn:$('#resetTariffFiltersBtn'), copyTariffsBtn:$('#copyTariffsBtn'), downloadTariffsCsvBtn:$('#downloadTariffsCsvBtn'), downloadTariffsXlsxBtn:$('#downloadTariffsXlsxBtn'), tariffCountMetric:$('#tariffCountMetric'), tariffMinPriceMetric:$('#tariffMinPriceMetric'), tariffFastestMetric:$('#tariffFastestMetric'), advancedTariffViewToggle:$('#advancedTariffViewToggle'),
      companyModal:$('#companyModal'), companyCards:$('#companyCards'), companySelect:$('#companySelect'), companyCompanyFilterDetails:$('#companyCompanyFilterDetails'), companyCompanyFilterSummary:$('#companyCompanyFilterSummary'), companyCompanyFilterOptions:$('#companyCompanyFilterOptions'), companyTariffFilterDetails:$('#companyTariffFilterDetails'), companyTariffFilterSummary:$('#companyTariffFilterSummary'), companyTariffFilterOptions:$('#companyTariffFilterOptions'), companyTypeFilterSummary:$('#companyTypeFilterSummary'), companyTypeFilterOptions:$('#companyTypeFilterOptions'), companyMethodFilterSummary:$('#companyMethodFilterSummary'), companyMethodFilterOptions:$('#companyMethodFilterOptions'), companyUrgencyFilterSummary:$('#companyUrgencyFilterSummary'), companyUrgencyFilterOptions:$('#companyUrgencyFilterOptions'), companyRouteFilterSummary:$('#companyRouteFilterSummary'), companyRouteFilterOptions:$('#companyRouteFilterOptions'), companyRouteFilter:$('#companyRouteFilter'), companyUrgencyFilter:$('#companyUrgencyFilter'), companySearchInput:$('#companySearchInput'), companyMethodFilter:$('#companyMethodFilter'), companyPriceMin:$('#companyPriceMin'), companyPriceMax:$('#companyPriceMax'), companyPeriodMax:$('#companyPeriodMax'), resetCompanyFiltersBtn:$('#resetCompanyFiltersBtn'), companyTariffsTable:$('#companyTariffsTable'), companyTariffsBody:$('#companyTariffsBody'), advancedCompanyViewToggle:$('#advancedCompanyViewToggle'), companyCountMetric:$('#companyCountMetric'), companyRequestsMetric:$('#companyRequestsMetric'), companyMinPriceMetric:$('#companyMinPriceMetric'), companyAvgPriceMetric:$('#companyAvgPriceMetric'), companyFastestMetric:$('#companyFastestMetric'), copyCompanyBtn:$('#copyCompanyBtn'), downloadCompanyCsvBtn:$('#downloadCompanyCsvBtn'), downloadCompanyXlsxBtn:$('#downloadCompanyXlsxBtn'),
      comparisonPresetSelect:$('#comparisonPresetSelect'), comparisonRouteSelect:$('#comparisonRouteSelect'), comparisonMethodSelect:$('#comparisonMethodSelect'), comparisonTariffModeSelect:$('#comparisonTariffModeSelect'), comparisonPeriodMax:$('#comparisonPeriodMax'), comparisonFloorModeSelect:$('#comparisonFloorModeSelect'), comparisonFloorPercentInput:$('#comparisonFloorPercentInput'), salesBeatMarketInput:$('#salesBeatMarketInput'), refreshComparisonBtn:$('#refreshComparisonBtn'), comparisonUpdatedAt:$('#comparisonUpdatedAt'), comparisonMetricFields:$('#comparisonMetricFields'), comparisonMetricCount:$('#comparisonMetricCount'), comparisonScopeNote:$('#comparisonScopeNote'), comparisonCharts:$('#comparisonCharts'), comparisonTariffPicker:$('#comparisonTariffPicker'), comparisonSelectionCount:$('#comparisonSelectionCount'), copyComparisonBtn:$('#copyComparisonBtn'), downloadComparisonXlsxBtn:$('#downloadComparisonXlsxBtn'),
      managerViewSelect:$('#managerViewSelect'), managerRouteFilter:$('#managerRouteFilter'), managerMethodFilter:$('#managerMethodFilter'), managerTariffModeSelect:$('#managerTariffModeSelect'), managerPeriodMax:$('#managerPeriodMax'), managerCompanyFilter:$('#managerCompanyFilter'), managerCompanyFilterLabel:$('#managerCompanyFilterLabel'), managerBaseCompanyFilter:$('#managerBaseCompanyFilter'), managerBaseCompanyLabel:$('#managerBaseCompanyLabel'), managerPresetSelect:$('#managerPresetSelect'), managerPresetLabel:$('#managerPresetLabel'), managerFloorModeSelect:$('#managerFloorModeSelect'), managerFloorModeLabel:$('#managerFloorModeLabel'), managerFloorPercentInput:$('#managerFloorPercentInput'), managerFloorPercentLabel:$('#managerFloorPercentLabel'), managerBeatMarketInput:$('#managerBeatMarketInput'), managerBeatMarketLabel:$('#managerBeatMarketLabel'), refreshManagerBtn:$('#refreshManagerBtn'), managerUpdatedAt:$('#managerUpdatedAt'), managerSummary:$('#managerSummary'), managerTable:$('#managerTable'), managerTableHead:$('#managerTableHead'), managerTableBody:$('#managerTableBody'), copyManagerBtn:$('#copyManagerBtn'), downloadManagerXlsxBtn:$('#downloadManagerXlsxBtn'), companyTariffsHead:$('#companyTariffsHead'), managerTariffPicker:$('#managerTariffPicker'), managerSelectionCount:$('#managerSelectionCount')
    });
  }
  async function init() {
    cacheElements();
    state.cache = new IndexedCache();
    loadSettings();
    await hydrateToolkitCredentials();
    initToolkitStorageSync();
    state.settingsProjectId = currentProjectId();
    restoreTableState();
    applyTheme(); applyDensity();
    renderExportFieldSelectors(); renderComparisonMetricSelector(); renderProjectTabs(); fillSettingsForm(); renderQuickClientPanel(); bindEvents(); renderTable(); refreshSummary();
    state.sessionReady = true;
    await checkRuntime(); updateConnectionBadge(); renderQuickClientPanel();
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.settings.theme === 'system') applyTheme(); });
  }
  function bindEvents() {
    document.addEventListener('click', event => { const button=event.target.closest('[data-toggle-secret]'); if(button) toggleSecretVisibility(button); const expand=event.target.closest('[data-toggle-fullscreen]'); if(expand) toggleModalFullscreen(expand); });
    initGlobalTooltips();
    els.openSettingsBtn.addEventListener('click', () => openSettings('connections'));
    els.cacheStatusBtn.addEventListener('click', () => openSettings('cache'));
    els.helpBtn?.addEventListener('click', openHelpModal);
    els.openHelpFromSettingsBtn?.addEventListener('click', openHelpModal);
    $$('[data-close-help]').forEach(el => el.addEventListener('click', closeHelpModal));
    $$('[data-confirm-cancel]').forEach(el => el.addEventListener('click', () => closeConfirmDialog(false)));
    $('#confirmOkBtn')?.addEventListener('click', () => closeConfirmDialog(true));
    els.themeToggleBtn.addEventListener('click', toggleTheme);
    $$('[data-close-settings]').forEach(el => el.addEventListener('click', closeSettings));
    $$('[data-close-modal]').forEach(el => el.addEventListener('click', closePasteModal));
    $$('[data-close-tariffs]').forEach(el => el.addEventListener('click', closeTariffsModal));
    $$('[data-close-company]').forEach(el => el.addEventListener('click', closeCompanyModal));
    $$('[data-close-orders]').forEach(el => el.addEventListener('click', closeOrdersModal));
    $$('.settings-tab').forEach(button => button.addEventListener('click', () => activateSettingsTab(button.dataset.settingsTab)));
    els.settingsProjectTabs.addEventListener('click', event => { const button = event.target.closest('[data-settings-project]'); if (button) switchSettingsProject(button.dataset.settingsProject); });
    els.projectTabs.addEventListener('click', event => { const button = event.target.closest('[data-project-id]'); if (button) switchProject(button.dataset.projectId); });
    els.saveSettingsBtn.addEventListener('click', saveSettingsFromForm);
    els.mainExportPresetSelect.addEventListener('change', () => applyExportPreset('main', els.mainExportPresetSelect.value));
    els.tariffExportPresetSelect.addEventListener('change', () => applyExportPreset('tariff', els.tariffExportPresetSelect.value));
    els.mainExportFields.addEventListener('change', () => handleExportFieldsChanged('main'));
    els.tariffExportFields.addEventListener('change', () => handleExportFieldsChanged('tariff'));
    $$('[data-fields-action]').forEach(button => button.addEventListener('click', handleFieldsAction));
    els.findClientBtn.addEventListener('click', () => findClientFromForm(false));
    els.refreshPartnerCompaniesBtn?.addEventListener('click', () => refreshPartnerCompanies(true));
    els.exclusionsSettingsCard?.addEventListener('click', event => { handleExclusionActions(event); handleBestExclusionActions(event); });
    const settingsInnSearch = debounceGlobal('inn-search', () => { if (isValidInn(els.innInput.value) && els.emailInput.value.trim() && els.passwordInput.value) findClientFromForm(true); }, 750);
    els.innInput.addEventListener('input', () => { normalizeInnInput(els.innInput); scheduleSettingsAutosave(); settingsInnSearch(); });
    const quickInnSearch = debounceGlobal('quick-inn-search', () => findClientFromQuick(true), 750);
    els.quickInnInput?.addEventListener('input', () => { handleQuickInnInput(); if (isValidInn(els.quickInnInput.value)) quickInnSearch(); });
    els.quickFindClientBtn?.addEventListener('click', () => findClientFromQuick(false));
    els.clearCacheBtn.addEventListener('click', () => clearCaches('all'));
    els.refreshCacheStatsBtn.addEventListener('click', refreshCacheStats);
    $$('[data-cache-clear]').forEach(button => button.addEventListener('click', () => clearCaches(button.dataset.cacheClear)));
    els.addRowBtn.addEventListener('click', () => addRows([createRow()], true));
    els.pasteBtn.addEventListener('click', openPasteModal); els.applyPasteBtn.addEventListener('click', applyPaste); els.fileInput.addEventListener('change', importFile); initFileDropZone(els.fileInput, els.fileButton, importFileObject, () => state.running, 'Сначала остановите пакетный расчёт.');
    els.downloadTemplateBtn.addEventListener('click', downloadImportTemplate); els.pasteTemplateBtn.addEventListener('click', downloadImportTemplate); els.demoBtn.addEventListener('click', insertDemo);
    els.calculateAllBtn.addEventListener('click', calculateAll); els.stopBtn.addEventListener('click', stopCalculation); els.clearResultsBtn.addEventListener('click', clearResults); els.clearAllBtn.addEventListener('click', clearAll);
    els.copyBtn.addEventListener('click', copyResults); els.downloadCsvBtn.addEventListener('click', downloadCsv); els.downloadXlsxBtn.addEventListener('click', downloadXlsx); els.companyOverviewBtn.addEventListener('click', openCompanyModal); els.ordersBtn?.addEventListener('click', openOrdersModal);
    els.orderFileInput?.addEventListener('change', importOrderFile); initFileDropZone(els.orderFileInput, els.orderFileDrop, importOrderFileObject, () => state.running || state.orderView.running, 'Дождитесь завершения расчёта или создания заказов.'); els.orderApplyScheduleBtn?.addEventListener('click', applyOrderScheduleToDrafts); [els.orderDefaultTakeDate,els.orderDefaultTimeFrom,els.orderDefaultTimeTo].filter(Boolean).forEach(input=>input.addEventListener('change', readOrderScheduleDefaults)); els.ordersPager?.addEventListener('click', handleOrderPagerClick); els.orderRows?.addEventListener('input', handleOrderDraftInput); els.orderRows?.addEventListener('change', handleOrderDraftInput); els.createOrdersBtn?.addEventListener('click', createSelectedOrders);
    els.tableBody.addEventListener('input', handleTableInput); els.tableBody.addEventListener('change', handleTableChange); els.tableBody.addEventListener('click', handleTableClick);
    els.tableSearchInput?.addEventListener('input', handleTableFilterChange);
    els.tableStatusFilter?.addEventListener('change', handleTableFilterChange);
    els.tableSortSelect?.addEventListener('change', handleTableFilterChange);
    els.resetTableFilterBtn?.addEventListener('click', resetTableFilter);
    [els.tariffSearchInput,els.tariffCompanyFilter,els.tariffUrgencyFilter,els.tariffNameFilter,els.tariffMethodFilter,els.tariffPriceMin,els.tariffPriceMax,els.tariffPeriodMax].forEach(input => input.addEventListener(input.tagName === 'INPUT' ? 'input' : 'change', renderTariffsView));
    els.resetTariffFiltersBtn.addEventListener('click', resetTariffFilters); els.copyTariffsBtn.addEventListener('click', copyTariffsView); els.downloadTariffsCsvBtn.addEventListener('click', downloadTariffsCsv); els.downloadTariffsXlsxBtn.addEventListener('click', downloadTariffsXlsx);
    els.advancedTariffViewToggle.addEventListener('change', () => { state.tariffView.advanced = els.advancedTariffViewToggle.checked; state.settings.advancedTariffView = state.tariffView.advanced; persistSettings(); applyAdvancedTableMode(els.tariffsModal,state.tariffView.advanced); });
    els.tariffsBody.addEventListener('click', handleTariffsClick);
    [els.companySelect,els.companyRouteFilter,els.companyUrgencyFilter,els.companySearchInput,els.companyMethodFilter,els.companyPriceMin,els.companyPriceMax,els.companyPeriodMax].filter(Boolean).forEach(input => input.addEventListener(input.tagName === 'INPUT' ? 'input' : 'change', renderCompanyView));
    els.resetCompanyFiltersBtn.addEventListener('click', resetCompanyFilters); els.advancedCompanyViewToggle.addEventListener('change', () => { state.companyView.advanced = els.advancedCompanyViewToggle.checked; applyAdvancedTableMode(els.companyModal,state.companyView.advanced); renderCompanyView(); });
    els.copyCompanyBtn.addEventListener('click', copyCompanyView); els.downloadCompanyCsvBtn.addEventListener('click', downloadCompanyCsv); els.downloadCompanyXlsxBtn.addEventListener('click', downloadCompanyXlsx); els.companyCards.addEventListener('click', handleCompanyCardClick); els.companyTariffsBody.addEventListener('click', handleCompanyDetailsClick);
    $$('.company-sort-button').forEach(button => button.addEventListener('click', () => setCompanySort(button.dataset.companySort))); $$('.sort-button').forEach(button => button.addEventListener('click', () => setTariffSort(button.dataset.sort)));
    $$('[data-company-view]').forEach(button => button.addEventListener('click', () => activateCompanyPane(button.dataset.companyView)));
    els.comparisonPresetSelect.addEventListener('change', applyComparisonPreset); els.comparisonMetricFields.addEventListener('change', comparisonMetricsChanged);
    [els.comparisonRouteSelect,els.comparisonTariffModeSelect,els.comparisonPeriodMax,els.comparisonFloorModeSelect,els.comparisonFloorPercentInput,els.salesBeatMarketInput].forEach(input=>input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>markAnalyticsDirty('comparison')));
    els.comparisonMethodSelect?.addEventListener('change',()=>{syncAnalyticsMethod(els.comparisonMethodSelect.value);markAnalyticsDirty('both');});
    els.refreshComparisonBtn?.addEventListener('click',()=>refreshAnalyticsScope('comparison'));
    els.copyComparisonBtn.addEventListener('click', copyComparison); els.downloadComparisonXlsxBtn.addEventListener('click', downloadComparisonXlsx);
    [els.managerRouteFilter,els.managerTariffModeSelect,els.managerPeriodMax,els.managerCompanyFilter,els.managerBaseCompanyFilter].forEach(input=>input?.addEventListener(input.tagName==='SELECT'?'change':'input',()=>markAnalyticsDirty('manager')));
    els.managerMethodFilter?.addEventListener('change',()=>{syncAnalyticsMethod(els.managerMethodFilter.value);markAnalyticsDirty('both');});
    els.managerViewSelect?.addEventListener('change',()=>{renderManagerTable(false);markAnalyticsDirty('manager');});
    [els.managerFloorPercentInput,els.managerBeatMarketInput].forEach(input=>input?.addEventListener('input',()=>{els.managerPresetSelect.value='custom';markAnalyticsDirty('manager');}));
    els.managerFloorModeSelect?.addEventListener('change',()=>{els.managerPresetSelect.value='custom';markAnalyticsDirty('manager');});
    els.managerPresetSelect?.addEventListener('change', applyManagerPreset);
    els.refreshManagerBtn?.addEventListener('click',()=>refreshAnalyticsScope('manager'));
    els.copyManagerBtn.addEventListener('click', copyManager); els.downloadManagerXlsxBtn.addEventListener('click', downloadManagerXlsx);
    els.comparisonTariffPicker?.addEventListener('change',handleAnalyticsPickerChange);els.managerTariffPicker?.addEventListener('change',handleAnalyticsPickerChange);
    $$('[data-analytics-selection-action]').forEach(button=>button.addEventListener('click',()=>applyAnalyticsSelectionAction(button.dataset.analyticsSelectionAction)));
    els.companyCompanyFilterOptions?.addEventListener('change', handleCompanyFacetChange);
    els.companyTariffFilterOptions?.addEventListener('change', handleCompanyFacetChange);
    [els.companyTypeFilterOptions,els.companyMethodFilterOptions,els.companyUrgencyFilterOptions,els.companyRouteFilterOptions].filter(Boolean).forEach(container=>container.addEventListener('change',handleCompanyFacetChange));
    [els.tariffCompanyFacetOptions,els.tariffTypeFacetOptions,els.tariffMethodFacetOptions,els.tariffUrgencyFacetOptions,els.tariffNameFacetOptions].filter(Boolean).forEach(container=>container.addEventListener('change',handleTariffFacetChange));
    $$('[data-company-filter-action]').forEach(button=>button.addEventListener('click',()=>applyCompanyFacetAction(button.dataset.companyFilterAction)));
    $$('[data-tariff-filter-action]').forEach(button=>button.addEventListener('click',()=>applyTariffFacetAction(button.dataset.tariffFilterAction)));
    $$('[data-choice-search-target]').forEach(input=>input.addEventListener('input',()=>filterChoiceOptions(input)));
    $$('.choice-filter').forEach(details=>details.addEventListener('toggle',()=>details.open?requestAnimationFrame(()=>positionChoiceFilterPanel(details)):clearChoiceFilterPanelPosition(details)));
    window.addEventListener('resize',repositionOpenChoiceFilters);document.addEventListener('scroll',repositionOpenChoiceFilters,true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeSettings(); closePasteModal(); closeTariffsModal(); closeCompanyModal(); closeOrdersModal(); closeHelpModal(); closeAnalyticsHelp(); closeConfirmDialog(false); } });
    document.addEventListener('click', event => { document.querySelectorAll('.choice-filter[open]').forEach(details => { if(!details.contains(event.target)) details.removeAttribute('open'); }); });
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', persistCurrentState);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistCurrentState(); });
    bindSettingsAutosave();
  }
  function renderProjectTabs() {
    els.projectTabs.innerHTML = Object.entries(PROJECTS).map(([id, project]) => {
      const p = projectSettings(id);
      const accessReady = Boolean(p.email && p.password && p.authChecked);
      const ready = Boolean(accessReady && p.userId && state.settings.tokenDaData);
      const status = ready ? 'Подключён' : accessReady ? 'Выберите клиента' : 'Доступ не проверен';
      return `<button class="project-tab ${id === currentProjectId() ? 'active' : ''} ${ready ? 'ready' : 'not-ready'}" data-project-id="${id}" data-tip="${escapeHtml(project.label)} · ${status}"><span class="project-dot"></span><span>${escapeHtml(project.shortLabel)}</span></button>`;
    }).join('');
    if (els.activeProjectTitle) els.activeProjectTitle.textContent = projectDef().label;
    if (els.brandMark) els.brandMark.setAttribute('aria-label', 'Калькулятор доставки');
  }
  function switchProject(projectId) {
    if (!PROJECTS[projectId] || projectId === currentProjectId()) return;
    if (state.running) { toast('Сначала остановите пакетный расчёт', 'error'); return; }
    state.projectRows[currentProjectId()] = state.rows;
    persistTableState();
    state.settings.activeProject = projectId;
    state.rows = state.projectRows[projectId] || (state.projectRows[projectId] = [createRow(),createRow(),createRow()]);
    persistSettings(); applyTheme(); renderProjectTabs(); renderTable(); refreshSummary(); updateConnectionBadge(); renderQuickClientPanel();
    scheduleTableAutosave();
    els.statusTitle.textContent = `Проект: ${projectDef().label}`;
    const active = projectSettings(projectId);
    const ready = Boolean(active.email && active.password && active.userId && state.settings.tokenDaData);
    els.statusDetails.textContent = ready ? 'Данные проектов хранятся раздельно.' : 'Подключение ещё не настроено. Откройте настройки проекта.';
    if (!ready) toast(`${projectDef().shortLabel}: настройте подключение перед расчётом`, 'info');
  }
  function invalidateClientResults(clientId = projectSettings().userId) {
    let invalidated = 0;
    state.rows.forEach(row => {
      if (!row.result) return;
      const context = row.result.calculationContext || {};
      if (String(context.projectId || '') === currentProjectId() && String(context.clientId || '') === String(clientId || '')) return;
      row.calcVersion = (row.calcVersion || 0) + 1;
      row.result = null;
      row.error = '';
      row.status = row.senderResolved && row.recipientResolved ? 'ready' : 'idle';
      row.statusText = 'Требуется пересчёт для выбранного клиента';
      invalidated += 1;
    });
    if (!invalidated) return 0;
    persistTableState();
    renderTable();
    refreshSummary();
    els.statusTitle.textContent = 'Клиент изменён';
    els.statusDetails.textContent = `${invalidated} строк нужно проверить для нового клиента. Совпавшие расчёты будут получены из кеша.`;
    return invalidated;
  }
  function activateSettingsTab(name) {
    $$('.settings-tab').forEach(button => button.classList.toggle('active', button.dataset.settingsTab === name));
    $$('.settings-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.settingsPane === name));
    if (name === 'cache') refreshCacheStats();
  }
  function openSettings(tab = 'connections') {
    state.settingsProjectId = currentProjectId(); fillSettingsForm(); activateSettingsTab(tab);
    els.settingsPanel.classList.add('open'); els.settingsPanel.setAttribute('aria-hidden','false');
  }
  function closeSettings() {
    saveSettingsSilently();
    resetModalFullscreen(els.settingsPanel);
    els.settingsPanel.classList.remove('open');
    els.settingsPanel.setAttribute('aria-hidden','true');
  }
  function renderSettingsProjectTabs() {
    els.settingsProjectTabs.innerHTML = Object.entries(PROJECTS).map(([id, project]) => {
      const p = projectSettings(id); const ready = p.userId ? 'подключён' : 'не настроен';
      return `<button class="project-settings-button ${id === state.settingsProjectId ? 'active' : ''}" data-settings-project="${id}">${escapeHtml(project.shortLabel)} <small>${ready}</small></button>`;
    }).join('');
  }
  function captureSettingsProjectForm() {
    const p = projectSettings(state.settingsProjectId);
    const previousAccess = `${p.email || ''}|${p.password || ''}`;
    const previousIdentity = `${p.email || ''}|${p.inn || ''}`;
    const email = els.emailInput.value.trim();
    const password = els.passwordInput.value;
    const inn = normalizeInnInput(els.innInput);
    Object.assign(p, {
      email, password, inn, enabled:true,
      bestMethodMode:els.bestMethodSelect.value === 'all' ? 'all' : 'door', exclusions:$$('#exclusionsList input:checked').map(input => input.value), bestExclusions:$$('#bestExclusionsList input:checked').map(input => input.value)
    });
    if (`${email}|${password}` !== previousAccess) {
      p.authChecked = false;
      p.userId = '';
      p.userDisplay = '';
    } else if (`${email}|${inn}` !== previousIdentity) {
      p.userId = '';
      p.userDisplay = '';
    }
  }
  function switchSettingsProject(projectId) {
    if (!PROJECTS[projectId] || projectId === state.settingsProjectId) return;
    captureSettingsProjectForm(); persistSettings(); state.settingsProjectId = projectId; fillProjectSettingsForm(); renderSettingsProjectTabs(); renderQuickClientPanel();
  }
  function fillProjectSettingsForm() {
    const p = projectSettings(state.settingsProjectId); const project = projectDef(state.settingsProjectId);
    els.settingsProjectLabel.textContent = `${project.label} · ${project.apiLabel}`;
    els.emailInput.value = p.email || ''; els.passwordInput.value = p.password || ''; els.innInput.value = sanitizeInn(p.inn); els.projectEnabledToggle.checked = true;
    els.bestMethodSelect.value = p.bestMethodMode || project.defaultBestMethod;
    els.bestMethodSelect.disabled = false; els.bestMethodSelect.title = '';
    if(els.exclusionsSettingsCard) els.exclusionsSettingsCard.classList.remove('hidden');
    renderExclusions(); renderClientResult(); if (state.settingsProjectId === currentProjectId()) renderQuickClientPanel();
    refreshPartnerCompanies(false);
  }
  function fillSettingsForm() {
    renderSettingsProjectTabs(); fillProjectSettingsForm();
    els.dadataInput.value = state.settings.tokenDaData || ''; els.savePasswordToggle.checked = Boolean(state.settings.saveSecrets);
    els.concurrencySelect.value = String(state.settings.concurrency); els.debounceSelect.value = String(state.settings.debounceMs); els.calcTimeoutSelect.value = String(state.settings.calcTimeoutMs); els.calcRetriesSelect.value = String(state.settings.calcRetries);
    els.exportCompanySheetsToggle.checked = state.settings.exportCompanySheets !== false; els.exportMainCompanyColumnsToggle.checked = Boolean(state.settings.exportMainCompanyColumns); els.exportAnalyticsSheetToggle.checked = Boolean(state.settings.exportAnalyticsSheet); els.companySheetLayoutSelect.value = state.settings.companySheetLayout;
    els.mainExportPresetSelect.value = state.settings.mainExportPreset; els.tariffExportPresetSelect.value = state.settings.tariffExportPreset;
    setCheckedFields(els.mainExportFields,state.settings.mainExportFields); setCheckedFields(els.tariffExportFields,state.settings.tariffExportFields); updateFieldCounts();
    els.themeSelect.value = state.settings.theme; els.densitySelect.value = state.settings.density; if(els.showServiceInfoToggle) els.showServiceInfoToggle.checked = Boolean(state.settings.showServiceInfo); if(els.overviewColumnOrderSelect) els.overviewColumnOrderSelect.value = state.settings.overviewColumnOrder || 'logistics'; resetSecretVisibility();
  }
  function readSettingsForm() {
    captureSettingsProjectForm();
    const mainExportFields = sanitizeFieldSelection(checkedFields(els.mainExportFields),MAIN_EXPORT_FIELDS,MAIN_EXPORT_PRESETS.compact);
    const tariffExportFields = sanitizeFieldSelection(checkedFields(els.tariffExportFields),TARIFF_EXPORT_FIELDS,TARIFF_EXPORT_PRESETS.compact);
    return {
      tokenDaData:els.dadataInput.value.trim(), saveSecrets:els.savePasswordToggle.checked, secretPolicyVersion:2, companyExclusionsVersion:2, concurrency:Number(els.concurrencySelect.value)||3, debounceMs:900,
      calcTimeoutMs:Math.min(180000,Math.max(30000,Number(els.calcTimeoutSelect.value)||120000)), calcRetries:Math.min(3,Math.max(0,Number(els.calcRetriesSelect.value)||0)),
      exportCompanySheets:els.exportCompanySheetsToggle.checked, exportMainCompanyColumns:els.exportMainCompanyColumnsToggle.checked, exportAnalyticsSheet:els.exportAnalyticsSheetToggle.checked, companySheetLayout:els.companySheetLayoutSelect.value === 'long' ? 'long' : 'wide',
      mainExportFields, tariffExportFields, mainExportPreset:presetForSelection(mainExportFields,MAIN_EXPORT_PRESETS), tariffExportPreset:presetForSelection(tariffExportFields,TARIFF_EXPORT_PRESETS),
      theme:['system','light','dark'].includes(els.themeSelect.value)?els.themeSelect.value:'system', density:['micro','compact','medium','spacious'].includes(els.densitySelect.value)?els.densitySelect.value:'medium',
      showServiceInfo:Boolean(els.showServiceInfoToggle?.checked),
      overviewColumnOrder:COMPANY_COLUMN_ORDERS[els.overviewColumnOrderSelect?.value]?els.overviewColumnOrderSelect.value:'logistics'
    };
  }
  function saveSettingsSilently() {
    if (!els.settingsPanel?.classList.contains('open')) return;
    Object.assign(state.settings, readSettingsForm());
    persistSettings();
    applyTheme();
    applyDensity();
    renderSettingsProjectTabs();
    renderClientResult();
    updateConnectionBadge();
    if (state.settingsProjectId === currentProjectId()) renderQuickClientPanel();
  }
  function defaultProjectRows() {
    return Object.fromEntries(Object.keys(PROJECTS).map(id => [id, [createRow(), createRow(), createRow()]]));
  }
  function serializeRow(row) {
    return {
      id: row.id,
      senderQuery: row.senderQuery,
      senderResolved: row.senderResolved || null,
      senderError: row.senderError || '',
      recipientQuery: row.recipientQuery,
      recipientResolved: row.recipientResolved || null,
      recipientError: row.recipientError || '',
      weight: row.weight,
      seats: row.seats,
      length: row.length,
      width: row.width,
      height: row.height,
      status: row.status,
      statusText: row.statusText,
      error: row.error || '',
      orderDraft: row.orderDraft || null,
      result: row.result || null
    };
  }
  function hydrateRow(data = {}) {
    const row = createRow(data);
    row.id = String(data.id || row.id);
    row.senderResolved = data.senderResolved || null;
    row.senderError = data.senderError || '';
    row.recipientResolved = data.recipientResolved || null;
    row.recipientError = data.recipientError || '';
    row.result = data.result || null;
    row.error = data.error || '';
    row.orderDraft = data.orderDraft ? { ...data.orderDraft } : null;
    const allowedStatus = new Set(['idle', 'ready', 'done', 'error', 'resolving-sender', 'resolving-recipient', 'calculating']);
    row.status = allowedStatus.has(data.status) && !/^resolving|calculating/.test(data.status) ? data.status : row.result ? 'done' : row.senderResolved && row.recipientResolved ? 'ready' : 'idle';
    row.statusText = data.statusText || (row.status === 'done' ? cacheStatusText(row.result) : row.status === 'ready' ? 'Готов к расчёту' : row.status === 'error' ? 'Ошибка' : 'Ожидание');
    row.senderVersion = 0;
    row.recipientVersion = 0;
    row.calcVersion = 0;
    row.calcPromise = null;
    return row;
  }
  function rowHasUserData(row) {
    const cargoChanged = row.weight !== '0.1' || row.seats !== '1' || row.length !== '10' || row.width !== '10' || row.height !== '10';
    return Boolean(cargoChanged || row.senderQuery || row.recipientQuery || row.senderResolved || row.recipientResolved || row.result || row.error || row.orderDraft);
  }
  function tableHasUserData(projectRows = state.projectRows) {
    return Object.values(projectRows || {}).some(rows => Array.isArray(rows) && rows.some(rowHasUserData));
  }
  function restoreTableState() {
    state.projectRows = defaultProjectRows();
    try {
      const stored = JSON.parse(localStorage.getItem(TABLE_STATE_KEY) || '{}');
      if (stored && stored.projectRows && typeof stored.projectRows === 'object') {
        Object.keys(PROJECTS).forEach(id => {
          const rows = Array.isArray(stored.projectRows[id]) ? stored.projectRows[id].map(hydrateRow) : [];
          state.projectRows[id] = rows.length ? rows : [createRow(), createRow(), createRow()];
        });
      }
    } catch { /* keep defaults */ }
    state.rows = state.projectRows[currentProjectId()] || (state.projectRows[currentProjectId()] = [createRow(), createRow(), createRow()]);
  }
  function persistTableState() {
    if (!state.projectRows) return;
    state.projectRows[currentProjectId()] = state.rows;
    const payload = {
      version: 1,
      activeProject: currentProjectId(),
      savedAt: new Date().toISOString(),
      projectRows: Object.fromEntries(Object.keys(PROJECTS).map(id => [id, (state.projectRows[id] || []).map(serializeRow)]))
    };
    localStorage.setItem(TABLE_STATE_KEY, JSON.stringify(payload));
  }
  function scheduleTableAutosave(delay = 350) {
    if (!state.sessionReady) return;
    clearTimeout(state.tableSaveTimer);
    state.tableSaveTimer = setTimeout(() => persistCurrentState(), delay);
  }
  function clearSavedTableState(resetCurrent = false) {
    localStorage.removeItem(TABLE_STATE_KEY);
    if (resetCurrent) {
      state.projectRows = defaultProjectRows();
      state.rows = state.projectRows[currentProjectId()];
      renderTable();
      refreshSummary();
      refreshOpenAnalytics();
      scheduleTableAutosave(0);
    }
  }
  function shouldWarnBeforeUnload() {
    return Boolean(state.running || tableHasUserData());
  }
  function handleBeforeUnload(event) {
    persistCurrentState();
    if (!shouldWarnBeforeUnload()) return;
    event.preventDefault();
    event.returnValue = '';
    return '';
  }
  function persistCurrentState() {
    try {
      if (els.settingsPanel?.classList.contains('open')) Object.assign(state.settings, readSettingsForm());
      if (els.quickInnInput && document.activeElement === els.quickInnInput) {
        const p = projectSettings();
        const inn = normalizeInnInput(els.quickInnInput);
        if (p.inn !== inn) {
          p.inn = inn;
          p.userId = '';
          p.userDisplay = '';
        }
      }
      persistSettings();
      persistTableState();
    } catch {
      try { persistSettings(); persistTableState(); } catch { /* localStorage may be unavailable */ }
    }
  }
  function scheduleSettingsAutosave() {
    clearTimeout(scheduleSettingsAutosave.timer);
    scheduleSettingsAutosave.timer = setTimeout(saveSettingsSilently, 250);
  }
  function bindSettingsAutosave() {
    const controls = [
      els.emailInput, els.passwordInput, els.dadataInput, els.savePasswordToggle, els.projectEnabledToggle,
      els.bestMethodSelect, els.concurrencySelect, els.debounceSelect, els.calcTimeoutSelect, els.calcRetriesSelect,
      els.exportCompanySheetsToggle, els.exportMainCompanyColumnsToggle, els.exportAnalyticsSheetToggle, els.companySheetLayoutSelect,
      els.mainExportPresetSelect, els.tariffExportPresetSelect, els.themeSelect, els.densitySelect,
      els.overviewColumnOrderSelect, els.showServiceInfoToggle
    ].filter(Boolean);
    controls.forEach(control => {
      const eventName = control.tagName === 'SELECT' || control.type === 'checkbox' ? 'change' : 'input';
      control.addEventListener(eventName, scheduleSettingsAutosave);
    });
    [els.mainExportFields, els.tariffExportFields, els.exclusionsList, els.bestExclusionsList].filter(Boolean).forEach(container => {
      container.addEventListener('change', scheduleSettingsAutosave);
    });
  }
  function saveSettingsFromForm() {
    Object.assign(state.settings,readSettingsForm()); persistSettings(); applyTheme(); applyDensity(); renderProjectTabs(); updateConnectionBadge(); renderQuickClientPanel(); closeSettings(); toast('Настройки сохранены','success');
    if (els.autoCalcToggle.checked) state.rows.forEach(scheduleAutoCalculation);
  }
  function partnerCompanyNames(projectId = state.settingsProjectId) {
    const project = projectDef(projectId);
    const fromReference = (state.partnerCompanies[projectId] || []).map(company => company.label);
    const fromRows = [];
    (state.projectRows[projectId] || []).forEach(row => visibleTariffs(row.result?.allTariffs).forEach(item => {
      if (item.deliveryCompanyLabel) fromRows.push(item.deliveryCompanyLabel);
    }));
    const selected = projectSettings(projectId).exclusions || [];
    const bestSelected = projectSettings(projectId).bestExclusions || [];
    return uniqueCompanyNames([...fromReference, ...(project.targetCompanies || []), ...DEFAULT_COMPANY_EXCLUSIONS, ...fromRows, ...selected, ...bestSelected])
      .sort((a,b)=>a.localeCompare(b,'ru'));
  }
  function updatePartnerCompaniesStatus(projectId = state.settingsProjectId) {
    if (!els.partnerCompaniesStatus || projectId !== state.settingsProjectId) return;
    const count = (state.partnerCompanies[projectId] || []).length;
    const status = state.partnerCompanyStatus[projectId];
    els.partnerCompaniesStatus.textContent = status || (count ? `Справочник: ${count} ТК` : 'Справочник загрузится после авторизации');
  }
  async function refreshPartnerCompanies(force = false) {
    const projectId = state.settingsProjectId;
    if (els.settingsPanel?.classList.contains('open')) captureSettingsProjectForm();
    const p = projectSettings(projectId);
    if (!p.email || !p.password) {
      state.partnerCompanyStatus[projectId] = 'Введите email и пароль, чтобы загрузить справочник ТК';
      updatePartnerCompaniesStatus(projectId);
      renderExclusions();
      return;
    }
    state.partnerCompanyStatus[projectId] = 'Загружаем справочник ТК…';
    updatePartnerCompaniesStatus(projectId);
    if (els.refreshPartnerCompaniesBtn) els.refreshPartnerCompaniesBtn.disabled = true;
    try {
      const result = await KDBridge.rpc('deliveryCompanies', { projectId, email:p.email, password:p.password, force });
      state.partnerCompanies[projectId] = Array.isArray(result.companies) ? result.companies : [];
      state.partnerCompanyStatus[projectId] = state.partnerCompanies[projectId].length ? `Справочник: ${state.partnerCompanies[projectId].length} ТК` : 'Справочник пуст';
      renderExclusions();
      if (force) toast('Список ТК обновлён', 'success');
    } catch (error) {
      state.partnerCompanyStatus[projectId] = `Не удалось загрузить справочник: ${error.message || error}`;
      renderExclusions();
    } finally {
      if (els.refreshPartnerCompaniesBtn) els.refreshPartnerCompaniesBtn.disabled = false;
      updatePartnerCompaniesStatus(projectId);
    }
  }
  function handleExclusionActions(event) {
    const button = event.target.closest?.('[data-exclusions-action]');
    if (!button) return;
    event.preventDefault();
    const action = button.dataset.exclusionsAction;
    if (action === 'defaults') setCheckedFields(els.exclusionsList, DEFAULT_COMPANY_EXCLUSIONS);
    if (action === 'none') setCheckedFields(els.exclusionsList, []);
    scheduleSettingsAutosave();
  }
  function handleBestExclusionActions(event) {
    const button = event.target.closest?.('[data-best-exclusions-action]');
    if (!button) return;
    event.preventDefault();
    if (button.dataset.bestExclusionsAction === 'none') setCheckedFields(els.bestExclusionsList, []);
    scheduleSettingsAutosave();
  }
  function renderExclusions() {
    const p = projectSettings(state.settingsProjectId);
    const companies = partnerCompanyNames(state.settingsProjectId);
    updatePartnerCompaniesStatus(state.settingsProjectId);
    if (!companies.length) {
      els.exclusionsList.innerHTML = '<span class="settings-note">Список ТК появится после загрузки справочника или первого расчёта.</span>';
      if (els.bestExclusionsList) els.bestExclusionsList.innerHTML = '<span class="settings-note">Список пока пуст.</span>';
      return;
    }
    const selected = new Set(p.exclusions || []);
    els.exclusionsList.innerHTML = companies.map(company => `<label><input type="checkbox" value="${escapeHtml(company)}" ${selected.has(company)?'checked':''}><span>${escapeHtml(company)}</span></label>`).join('');
    const bestSelected = new Set(p.bestExclusions || []);
    if (els.bestExclusionsList) els.bestExclusionsList.innerHTML = companies.map(company => `<label><input type="checkbox" value="${escapeHtml(company)}" ${bestSelected.has(company)?'checked':''}><span>${escapeHtml(company)}</span></label>`).join('');
  }
  function renderClientResult(error = '') {
    const p = projectSettings(state.settingsProjectId);
    if (error) { els.clientResult.className='client-result error'; els.clientResult.textContent=error; return; }
    if (p.userId) { els.clientResult.className='client-result ok'; els.clientResult.textContent=p.userDisplay || 'Контрагент выбран'; }
    else if (p.inn) { els.clientResult.className='client-result error'; els.clientResult.textContent='ИНН введён, но клиент не выбран. Нажмите «Найти».'; }
    else { els.clientResult.className='client-result neutral'; els.clientResult.textContent='Контрагент не выбран'; }
  }
  function flashQuickClientPanel(message = '') {
    const panel = els.quickClientResult?.closest('.quick-client-panel');
    if (message) renderQuickClientPanel(message);
    panel?.classList.remove('attention-flash');
    void panel?.offsetWidth;
    panel?.classList.add('attention-flash');
    setTimeout(() => panel?.classList.remove('attention-flash'), 1300);
    els.quickInnInput?.focus();
  }
  function renderQuickClientPanel(error = '') {
    if (!els.quickClientResult) return;
    const p = projectSettings();
    if (els.quickInnInput && document.activeElement !== els.quickInnInput) els.quickInnInput.value = sanitizeInn(p.inn);
    if (error) {
      els.quickClientResult.className = 'quick-client-result error';
      els.quickClientResult.textContent = error;
      return;
    }
    if (p.userId) {
      els.quickClientResult.className = 'quick-client-result ok';
      els.quickClientResult.textContent = p.userDisplay || 'Контрагент выбран';
    } else if (p.inn) {
      els.quickClientResult.className = 'quick-client-result error';
      els.quickClientResult.textContent = isValidInn(p.inn) ? 'ИНН введён, нажмите «Найти»' : 'ИНН должен быть 10 или 12 цифр';
    } else {
      els.quickClientResult.className = 'quick-client-result neutral';
      els.quickClientResult.textContent = 'Контрагент не выбран';
    }
  }
  function handleQuickInnInput() {
    const p = projectSettings();
    const previous = p.inn || '';
    const inn = normalizeInnInput(els.quickInnInput);
    if (previous !== inn) {
      p.inn = inn;
      p.userId = '';
      p.userDisplay = '';
      if (state.settingsProjectId === currentProjectId() && els.settingsPanel?.classList.contains('open')) {
        els.innInput.value = inn;
        renderClientResult();
      }
      persistSettings();
      updateConnectionBadge();
    }
    renderQuickClientPanel();
  }
  async function findClientFromQuick(silent = false) {
    const p = projectSettings();
    const previousClientId = String(p.userId || '');
    p.inn = sanitizeInn(els.quickInnInput?.value || p.inn);
    if (els.quickInnInput) els.quickInnInput.value = p.inn;
    if (!p.email || !p.password) {
      if (!silent) renderQuickClientPanel('Заполните email и пароль в настройках.');
      persistSettings();
      return;
    }
    if (!isValidInn(p.inn)) {
      if (!silent) renderQuickClientPanel('ИНН должен быть 10 или 12 цифр.');
      persistSettings();
      return;
    }
    els.quickFindClientBtn.disabled = true;
    els.quickFindClientBtn.textContent = 'Поиск…';
    els.quickClientResult.className = 'quick-client-result neutral';
    els.quickClientResult.textContent = 'Ищем контрагента…';
    try {
      const result = await KDBridge.rpc('searchUser', { projectId:currentProjectId(), email:p.email, password:p.password, inn:p.inn });
      p.authChecked = true;
      p.userId = result.id;
      p.userDisplay = result.display;
      if (previousClientId && previousClientId !== String(result.id || '')) invalidateClientResults(result.id);
      persistSettings();
      if (state.settingsProjectId === currentProjectId()) renderClientResult();
      renderQuickClientPanel();
      updateConnectionBadge();
      if (!silent) toast('Контрагент найден', 'success');
    } catch (error) {
      p.userId = '';
      p.userDisplay = '';
      persistSettings();
      renderQuickClientPanel(error.message);
      updateConnectionBadge();
    } finally {
      els.quickFindClientBtn.disabled = false;
      els.quickFindClientBtn.textContent = 'Найти';
    }
  }
  function updateConnectionBadge() {
    const p = projectSettings();
    const accessReady = Boolean(p.email && p.password && p.authChecked);
    const ready = accessReady && state.settings.tokenDaData && p.userId;
    if (els.connectionBadge) {
      els.connectionBadge.className = 'badge hidden';
      els.connectionBadge.setAttribute('aria-hidden', 'true');
      els.connectionBadge.textContent = ready ? 'Настроено' : 'Не настроено';
    }
    renderProjectTabs(); renderQuickClientPanel();
    if (els.calculateAllBtn && !state.running) {
      els.calculateAllBtn.disabled = !ready;
      els.calculateAllBtn.title = ready ? '' : 'Сначала проверьте доступ и выберите клиента';
    }
  }
  async function findClientFromForm(silent = false) {
    captureSettingsProjectForm(); const id=state.settingsProjectId; const p=projectSettings(id);
    const previousClientId=String(p.userId||'');
    if (!p.email || !p.password || !p.inn) { if(!silent) renderClientResult('Заполните email, пароль и ИНН.'); return; }
    if (!isValidInn(p.inn)) { if(!silent) renderClientResult('ИНН должен быть 10 или 12 цифр.'); return; }
    els.findClientBtn.disabled=true; els.findClientBtn.textContent='Поиск…'; els.clientResult.className='client-result neutral'; els.clientResult.textContent='Ищем контрагента…';
    try {
      const result=await KDBridge.rpc('searchUser',{projectId:id,email:p.email,password:p.password,inn:p.inn}); p.authChecked=true; p.userId=result.id; p.userDisplay=result.display; if(id===currentProjectId()&&previousClientId&&previousClientId!==String(result.id||''))invalidateClientResults(result.id); persistSettings(); renderClientResult(); renderSettingsProjectTabs(); updateConnectionBadge(); if(id===currentProjectId())renderQuickClientPanel(); refreshPartnerCompanies(false); if(!silent) toast('Контрагент найден','success');
    } catch(error) { p.userId=''; p.userDisplay=''; persistSettings(); renderClientResult(error.message); updateConnectionBadge(); if(id===currentProjectId())renderQuickClientPanel(error.message); }
    finally { els.findClientBtn.disabled=false; els.findClientBtn.textContent='Найти'; }
  }
  function validateConfigured(show = true) {
    const p=projectSettings(); const missing=[];
    if(!p.email) missing.push('email'); if(!p.password) missing.push('пароль'); if(!p.authChecked) missing.push('проверка доступа'); if(!state.settings.tokenDaData) missing.push('токен DaData'); if(!p.userId) missing.push('клиент по ИНН');
    if(missing.length){
      if(show){
        const message = `Не хватает настроек: ${missing.join(', ')}.`;
        toast(message,'error');
        if (!p.userId || p.inn) flashQuickClientPanel(!p.userId ? 'Выберите клиента: введите ИНН и нажмите «Найти».' : '');
        if (!p.email || !p.password || !p.authChecked || !state.settings.tokenDaData) openSettings('connections');
      }
      return false;
    }
    return true;
  }
  function cacheStatusText(result) {
    if (!result?.cached) return 'Готово';
    const labels = {
      browser: 'кэш браузера',
      calculator: 'кэш калькулятора',
      dadata: 'кэш DaData'
    };
    return `Готово · ${labels[result.cacheSource] || 'кэш'}`;
  }
  function resolvedMarkup(resolved, phase, error) {
    const cls=phase==='loading'?'loading':error?'error':resolved?'ok':''; const text=phase==='loading'?'Поиск…':error||resolved?.placeText||resolved?.kdText||'—';
    const title=resolved?.unrestrictedValue||text; return `<div class="resolved-line ${cls}" title="${escapeHtml(title)}"><span class="dot"></span><span class="cell-ellipsis">${escapeHtml(text)}</span></div>`;
  }
  async function resolveAddressForRow(row,side) {
    const queryField=`${side}Query`,resolvedField=`${side}Resolved`,errorField=`${side}Error`,versionField=`${side}Version`; const query=row[queryField].trim();
    if(query.length<3) return null; if(!state.settings.tokenDaData){ row[errorField]='Настройте токен DaData'; row.status='error'; row.statusText='Нет токена DaData'; updateRowDom(row); return null; }
    const version=++row[versionField]; row[errorField]=''; row.status=side==='sender'?'resolving-sender':'resolving-recipient'; row.statusText=side==='sender'?'Ищем отправителя':'Ищем получателя'; updateRowDom(row);
    try {
      const key=cacheKeyAddress(query); let result=await state.cache.get(key);
      if(!result){ result=await resolveAddressRpc({projectId:currentProjectId(),query,tokenDaData:state.settings.tokenDaData}); await state.cache.set(key,result,7*24*60*60*1000); }
      if(version!==row[versionField]||query!==row[queryField].trim()) return null; row[resolvedField]=result; row[errorField]=''; row.status=row.senderResolved&&row.recipientResolved?'ready':'idle'; row.statusText=row.senderResolved&&row.recipientResolved?'Готов к расчёту':'Ожидание адреса'; updateRowDom(row); scheduleTableAutosave(); scheduleAutoCalculation(row); return result;
    } catch(error){ if(version!==row[versionField]) return null; row[resolvedField]=null; row[errorField]=error.message; row.status='error'; row.statusText='Адрес не найден'; row.error=error.message; updateRowDom(row); scheduleTableAutosave(); return null; }
  }
  async function calculateRow(row,options={}) {
    if(row.calcPromise&&!options.force) return row.calcPromise; if(!validateConfigured(!options.silent)) return null; const validationError=validateRow(row);
    if(validationError){ row.status='error'; row.statusText=validationError; row.error=validationError; updateRowDom(row); return null; }
    const calcVersion=++row.calcVersion; const work=(async()=>{
      try {
        if(!row.senderResolved) await resolveAddressForRow(row,'sender'); if(!row.recipientResolved) await resolveAddressForRow(row,'recipient'); if(!row.senderResolved||!row.recipientResolved) return markUnresolvedCitySkipped(row);
        row.status='calculating'; row.statusText='Расчёт…'; row.error=''; updateRowDom(row); const key=cacheKeyCalculation(row); let result=options.force?null:await state.cache.get(key); const p=projectSettings();
        if(result) result={...result,cached:true,cacheSource:'browser'};
        if(!result){ result=await calculateTariffRpc({projectId:currentProjectId(),email:p.email,password:p.password,userId:p.userId,senderCity:row.senderResolved.placeId||row.senderResolved.kdId,recipientCity:row.recipientResolved.placeId||row.recipientResolved.kdId,cargoType:DEFAULT_CARGO_TYPE,cargoWeight:cargoWeightValue(row.weight),cargoSeats:Math.round(parsePositive(row.seats,1)),cargoLength:parsePositive(row.length,10),cargoWidth:parsePositive(row.width,10),cargoHeight:parsePositive(row.height,10),exclusions:p.exclusions||[],bestExclusions:p.bestExclusions||[],bestMethodMode:p.bestMethodMode,timeoutMs:state.settings.calcTimeoutMs,retries:state.settings.calcRetries,force:Boolean(options.force)}); if(result?.cached&&!result.cacheSource)result={...result,cacheSource:'calculator'}; await state.cache.set(key,result,2*24*60*60*1000); }
        if(calcVersion!==row.calcVersion) return null; result.calculationContext ||= {projectId:currentProjectId(),clientId:String(projectSettings().userId||''),signature:key}; row.result=result; row.status='done'; row.statusText=cacheStatusText(result); row.error=''; updateRowDom(row); scheduleTableAutosave(); refreshOpenAnalytics(); return result;
      } catch(error){ if(calcVersion!==row.calcVersion) return null; row.result=null; row.status='error'; row.statusText='Ошибка расчёта'; row.error=error.message; updateRowDom(row); scheduleTableAutosave(); refreshOpenAnalytics(); if(options.force) toast(error.message,'error'); return null; }
      finally { row.calcPromise=null; }
    })(); row.calcPromise=work; return work;
  }
  function orderEligibleEntries() {
    return state.rows.map((row,index)=>({row,index})).filter(({row})=>row.result?.best&&row.senderResolved&&row.recipientResolved);
  }
  function todayInputDate() {
    const date = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function defaultPickupSchedule() {
    return { takeDate: todayInputDate(), takeTimeFrom: '09:00', takeTimeTo: '18:00' };
  }
  function ensureOrderScheduleDefaults() {
    state.orderView.defaults = { ...defaultPickupSchedule(), ...(state.orderView.defaults || {}) };
    if (!orderDateInputValue(state.orderView.defaults.takeDate)) state.orderView.defaults.takeDate = todayInputDate();
    state.orderView.defaults.takeTimeFrom = orderTimeInputValue(state.orderView.defaults.takeTimeFrom) || '09:00';
    state.orderView.defaults.takeTimeTo = orderTimeInputValue(state.orderView.defaults.takeTimeTo) || '18:00';
    return state.orderView.defaults;
  }
  function orderTimeInputValue(value) {
    const text = String(value ?? '').trim();
    const match = text.match(/^(\d{1,2})(?::|[.\s-])?(\d{2})?$/);
    if (!match) return '';
    const hour = Math.max(0, Math.min(23, Number(match[1]) || 0));
    const minute = match[2] === '30' ? 30 : 0;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
  function fillOrderScheduleDefaults() {
    const defaults = ensureOrderScheduleDefaults();
    if (els.orderDefaultTakeDate) els.orderDefaultTakeDate.value = orderDateInputValue(defaults.takeDate) || todayInputDate();
    if (els.orderDefaultTimeFrom) els.orderDefaultTimeFrom.value = orderTimeInputValue(defaults.takeTimeFrom) || '09:00';
    if (els.orderDefaultTimeTo) els.orderDefaultTimeTo.value = orderTimeInputValue(defaults.takeTimeTo) || '18:00';
  }
  function readOrderScheduleDefaults() {
    const defaults = ensureOrderScheduleDefaults();
    defaults.takeDate = orderDateInputValue(els.orderDefaultTakeDate?.value) || defaults.takeDate;
    defaults.takeTimeFrom = orderTimeInputValue(els.orderDefaultTimeFrom?.value) || defaults.takeTimeFrom;
    defaults.takeTimeTo = orderTimeInputValue(els.orderDefaultTimeTo?.value) || defaults.takeTimeTo;
    return defaults;
  }
  function applyOrderScheduleToDrafts() {
    captureOrderDraftsFromDom();
    const defaults = readOrderScheduleDefaults();
    (state.orderView.drafts || []).forEach(draft => {
      draft.takeDate = defaults.takeDate;
      draft.takeTimeFrom = defaults.takeTimeFrom;
      draft.takeTimeTo = defaults.takeTimeTo;
      const row = state.rows.find(item => item.id === draft.rowId);
      if (row) row.orderDraft = { ...draft };
    });
    renderOrdersModal();
    scheduleTableAutosave(0);
    toast('Дата и время сбора применены ко всем заказам', 'success');
  }
  function orderDateInputValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const normalized = text.replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, '');
    let match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) return `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
    match = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (match) {
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      return `${year}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    }
    return '';
  }
  function formatOrderDateForApi(value) {
    const input = orderDateInputValue(value);
    if (!input) return '';
    const [year, month, day] = input.split('-');
    return `${day}.${month}.${year}`;
  }
  function orderImportText(value) {
    return String(value ?? '').trim();
  }
  function orderImportAddress(city, address) {
    return [orderImportText(city), orderImportText(address)].filter(Boolean).join(' ');
  }
  function findOrderHeaderRow(matrix) {
    return matrix.findIndex(row => {
      const names = row.map(normalizeHeader);
      return names.includes('организация') && names.includes('город') && names.includes('адрес') && names.some(name => name.includes('данные') || name.includes('вид') || name.includes('вес'));
    });
  }
  function detectOrderColumns(header = []) {
    const normalized = header.map(normalizeHeader);
    const find = (aliases, start = 0, end = normalized.length) => {
      const index = normalized.findIndex((name, i) => i >= start && i < end && aliases.some(alias => name === alias || name.includes(alias)));
      return index >= 0 ? index : undefined;
    };
    const fixedTemplate = normalized[0] === 'организация' && normalized[1] === 'город' && normalized[7] === 'организация';
    const columns = fixedTemplate ? {
      senderName:0, senderCity:1, senderAddress:2, senderPostIndex:3, senderPhone:4, senderContact:5, senderInfo:6,
      recipientName:7, recipientCity:8, recipientAddress:9, recipientPostIndex:10, recipientPhone:11, recipientContact:12, recipientInfo:13,
      cargoKind:14, weight:15, width:16, length:17, height:18, seats:19, comment:20, insurance:21, deliveryCompanyHint:22,
      takeDate:find(['дата забора', 'дата сбора', 'take date', 'pickup date', 'дата'],23),
      takeTimeFrom:find(['сбор с', 'забор с', 'take time from', 'pickup from', 'время с'],23),
      takeTimeTo:find(['сбор до', 'забор до', 'take time to', 'pickup to', 'время до'],23)
    } : {
      senderName: find(['отправитель', 'организация отправителя', 'sender']),
      senderCity: find(['город отправителя', 'откуда', 'sender city']),
      senderAddress: find(['адрес отправителя', 'sender address']),
      senderPostIndex: find(['индекс отправителя', 'sender index']),
      senderPhone: find(['телефон отправителя', 'sender phone']),
      senderContact: find(['фио отправителя', 'контакт отправителя', 'sender contact']),
      senderInfo: find(['доп инфо отправителя', 'инфо отправителя']),
      recipientName: find(['получатель', 'организация получателя', 'recipient']),
      recipientCity: find(['город получателя', 'куда', 'recipient city']),
      recipientAddress: find(['адрес получателя', 'recipient address']),
      recipientPostIndex: find(['индекс получателя', 'recipient index']),
      recipientPhone: find(['телефон получателя', 'recipient phone']),
      recipientContact: find(['фио получателя', 'контакт получателя', 'recipient contact']),
      recipientInfo: find(['доп инфо получателя', 'инфо получателя']),
      cargoKind: find(['вид', 'тип груза', 'cargo type']),
      weight: find(['вес', 'weight']),
      width: find(['ширина', 'width']),
      length: find(['длина', 'length']),
      height: find(['высота', 'height']),
      seats: find(['мест', 'seats']),
      comment: find(['доп инфо', 'комментар', 'comment']),
      insurance: find(['страх', 'declared', 'insurance']),
      deliveryCompanyHint: find(['транспортная компания', 'тк', 'delivery company']),
      takeDate: find(['дата забора', 'дата сбора', 'take date', 'pickup date', 'дата']),
      takeTimeFrom: find(['сбор с', 'забор с', 'take time from', 'pickup from', 'время с']),
      takeTimeTo: find(['сбор до', 'забор до', 'take time to', 'pickup to', 'время до'])
    };
    return columns;
  }
  function orderValue(values, columns, key) {
    const index = columns[key];
    return index === undefined ? '' : orderImportText(values[index]);
  }
  function orderDraftFromImport(values, columns) {
    const senderCity = orderValue(values, columns, 'senderCity');
    const senderAddress = orderValue(values, columns, 'senderAddress');
    const recipientCity = orderValue(values, columns, 'recipientCity');
    const recipientAddress = orderValue(values, columns, 'recipientAddress');
    const insurance = orderValue(values, columns, 'insurance');
    const takeDate = orderDateInputValue(orderValue(values, columns, 'takeDate'));
    return {
      selected:true,
      senderName: orderValue(values, columns, 'senderName'),
      senderContact: orderValue(values, columns, 'senderContact'),
      senderPhone: orderValue(values, columns, 'senderPhone'),
      senderPostIndex: orderValue(values, columns, 'senderPostIndex'),
      senderInfo: orderValue(values, columns, 'senderInfo'),
      senderAddress: orderImportAddress(senderCity, senderAddress),
      recipientName: orderValue(values, columns, 'recipientName'),
      recipientContact: orderValue(values, columns, 'recipientContact'),
      recipientPhone: orderValue(values, columns, 'recipientPhone'),
      recipientPostIndex: orderValue(values, columns, 'recipientPostIndex'),
      recipientInfo: orderValue(values, columns, 'recipientInfo'),
      recipientAddress: orderImportAddress(recipientCity, recipientAddress),
      cargoName: orderValue(values, columns, 'cargoKind') || 'Груз',
      declaredValue: insurance,
      comment: orderValue(values, columns, 'comment'),
      deliveryCompanyHint: orderValue(values, columns, 'deliveryCompanyHint'),
      takeDate,
      takeTimeFrom: orderTimeInputValue(orderValue(values, columns, 'takeTimeFrom')),
      takeTimeTo: orderTimeInputValue(orderValue(values, columns, 'takeTimeTo')),
      identityKind:'inn',
      identityValue:'',
      transportType:'1',
      selectedServices:null
    };
  }
  function orderColumnsLookValid(columns) {
    return Boolean(columns && (columns.senderCity !== undefined || columns.senderAddress !== undefined || columns.senderName !== undefined)
      && (columns.recipientCity !== undefined || columns.recipientAddress !== undefined || columns.recipientName !== undefined));
  }
  function orderRowsFromMatrix(matrix) {
    const headerIndex = findOrderHeaderRow(matrix);
    const firstRowColumns = detectOrderColumns(matrix[0] || []);
    const hasHeader = headerIndex >= 0 || orderColumnsLookValid(firstRowColumns);
    const columns = headerIndex >= 0 ? detectOrderColumns(matrix[headerIndex]) : hasHeader ? firstRowColumns : {
      senderAddress:0, recipientAddress:1, weight:2, seats:3, length:4, width:5, height:6,
      senderName:7, senderPhone:8, recipientName:9, recipientPhone:10, comment:11
    };
    const start = headerIndex >= 0 ? headerIndex + 1 : hasHeader ? 1 : 0;
    return matrix.slice(start).filter(values => values.some(value => String(value).trim())).map(values => {
      const draft = orderDraftFromImport(values, columns);
      return createRow({
        sender: draft.senderAddress || orderImportAddress(orderValue(values, columns, 'senderCity'), orderValue(values, columns, 'senderAddress')),
        recipient: draft.recipientAddress || orderImportAddress(orderValue(values, columns, 'recipientCity'), orderValue(values, columns, 'recipientAddress')),
        weight: orderValue(values, columns, 'weight') || '0.1',
        seats: orderValue(values, columns, 'seats') || '1',
        length: orderValue(values, columns, 'length') || '10',
        width: orderValue(values, columns, 'width') || '10',
        height: orderValue(values, columns, 'height') || '10',
        orderDraft: draft
      });
    }).filter(row => row.senderQuery || row.recipientQuery);
  }
  async function importOrderFileObject(file) {
    if (state.running || state.orderView.running) {
      toast('Дождитесь завершения расчёта или создания заказов.', 'error');
      return;
    }
    if (!file) return;
    try {
      let matrix;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type:'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        matrix = XLSX.utils.sheet_to_json(sheet, { header:1, defval:'', raw:false });
      } else {
        matrix = parseTextTable(await file.text());
      }
      const rows = orderRowsFromMatrix(matrix);
      if (!rows.length) throw new Error('В файле не найдено строк заказов');
      removeInitialBlankRows();
      addRows(rows);
      state.orderView.page = 0;
      renderOrdersModal();
      toast(`Импортировано заказов: ${rows.length}. Теперь рассчитайте строки и выберите тарифы.`, 'success');
    } catch (error) {
      toast(`Ошибка импорта заказов: ${error.message || error}`, 'error');
    }
  }
  async function importOrderFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    await importOrderFileObject(file);
  }
  function companyNeedsIdentity(company) {
    const name=normalize(company);
    return name.includes('делов')||name.includes('байкал')||name.includes('пэк')||name.includes('pek');
  }
  function companyNeedsTransport(company) {
    return normalize(company).includes('достависта');
  }
  function orderTariffKey(item) {
    return [
      item?.deliveryCompany ?? '',
      item?.deliveryCompanyLabel ?? '',
      item?.urgencyId ?? '',
      item?.urgencyLabel ?? '',
      item?.tariffId ?? '',
      tariffDisplayName(item),
      item?.deliveryMethod ?? '',
      item?.deliveryType ?? '',
      item?.userPrice ?? ''
    ].join('|');
  }
  function orderTariffsForRow(row) {
    return (Array.isArray(row?.result?.allTariffs) ? row.result.allTariffs : []).filter(item => Number(item.userPrice) > 0 && !item.hasError);
  }
  function orderServiceKey(service, index) {
    return normalize([service?.key, service?.caption, service?.description, service?.price, index].filter(value => value !== undefined && value !== null).join('|')) || `service-${index}`;
  }
  function defaultOrderServiceKeys(item) {
    return servicesList(item,false).map((service,index)=>({service,index,key:orderServiceKey(service,index)})).filter(({service})=>service.required||service.enabled).map(({key})=>key);
  }
  function orderSelectedTariff(draft,row) {
    const tariffs = orderTariffsForRow(row);
    if (!tariffs.length) return null;
    const byKey = tariffs.find(item => orderTariffKey(item) === draft.tariffKey);
    if (byKey) return byKey;
    const hint = normalize(draft.deliveryCompanyHint);
    const byHint = hint ? tariffs.find(item => normalize(item.deliveryCompanyLabel).includes(hint) || hint.includes(normalize(item.deliveryCompanyLabel))) : null;
    if (byHint) return byHint;
    const best = row.result?.best;
    return tariffs.find(item => orderTariffKey(item) === orderTariffKey(best)) || tariffs[0];
  }
  function syncOrderDraftTariff(draft,row,forceServices=false) {
    const selected = orderSelectedTariff(draft,row);
    if (!selected) return null;
    const key = orderTariffKey(selected);
    if (draft.tariffKey !== key) {
      draft.tariffKey = key;
      forceServices = true;
    }
    draft.company = selected.deliveryCompanyLabel || '';
    draft.tariff = tariffDisplayName(selected);
    if (!Array.isArray(draft.selectedServices) || forceServices) draft.selectedServices = defaultOrderServiceKeys(selected);
    return selected;
  }
  function defaultOrderDraft(row,index,existing={}) {
    const saved = { ...(row.orderDraft || {}), ...(existing || {}) };
    const schedule = ensureOrderScheduleDefaults();
    const best=row.result?.best||{};
    const draft = {
      selected: saved.selected !== false,
      rowId: row.id,
      rowIndex:index,
      company: saved.company || best.deliveryCompanyLabel || '',
      tariff: saved.tariff || tariffDisplayName(best),
      tariffKey: saved.tariffKey || '',
      senderName: saved.senderName || '',
      senderContact: saved.senderContact || saved.senderName || '',
      senderPhone: saved.senderPhone || '',
      senderPostIndex: saved.senderPostIndex || '',
      senderInfo: saved.senderInfo || '',
      senderAddress: saved.senderAddress || row.senderQuery || row.senderResolved?.placeText || '',
      recipientName: saved.recipientName || '',
      recipientContact: saved.recipientContact || saved.recipientName || '',
      recipientPhone: saved.recipientPhone || '',
      recipientPostIndex: saved.recipientPostIndex || '',
      recipientInfo: saved.recipientInfo || '',
      recipientAddress: saved.recipientAddress || row.recipientQuery || row.recipientResolved?.placeText || '',
      cargoName: saved.cargoName || 'Груз',
      declaredValue: saved.declaredValue || '',
      takeDate: saved.takeDate || schedule.takeDate,
      takeTimeFrom: saved.takeTimeFrom || schedule.takeTimeFrom,
      takeTimeTo: saved.takeTimeTo || schedule.takeTimeTo,
      comment: saved.comment || '',
      deliveryCompanyHint: saved.deliveryCompanyHint || '',
      identityKind: saved.identityKind || 'inn',
      identityValue: saved.identityValue || '',
      transportType: saved.transportType || '1',
      selectedServices: Object.prototype.hasOwnProperty.call(saved,'selectedServices') && Array.isArray(saved.selectedServices) ? [...saved.selectedServices] : null,
      orderStatus: saved.orderStatus || '',
      orderError: saved.orderError || '',
      orderId: saved.orderId || ''
    };
    syncOrderDraftTariff(draft,row);
    row.orderDraft = { ...draft };
    return {
      ...draft
    };
  }
  function captureOrderDraftsFromDom() {
    if (!els.orderRows) return;
    els.orderRows.querySelectorAll('[data-order-row]').forEach(card=>{
      const draft=state.orderView.drafts.find(item=>item.rowId===card.dataset.orderRow);
      if (!draft) return;
      card.querySelectorAll('[data-order-field]').forEach(input=>{
        draft[input.dataset.orderField]=input.type==='checkbox'?input.checked:input.value;
      });
      const selectedServices = [];
      card.querySelectorAll('[data-order-service]').forEach(input=>{
        if (input.checked) selectedServices.push(input.dataset.orderService);
      });
      draft.selectedServices = selectedServices;
      const row = state.rows.find(item=>item.id===draft.rowId);
      if (row) row.orderDraft = { ...draft };
    });
  }
  function openOrdersModal() {
    const existing=new Map((state.orderView.drafts||[]).map(draft=>[draft.rowId,draft]));
    ensureOrderScheduleDefaults();
    state.orderView.drafts=orderEligibleEntries().map(({row,index})=>defaultOrderDraft(row,index,existing.get(row.id)||{}));
    state.orderView.page = Math.min(state.orderView.page || 0, Math.max(0, Math.ceil(state.orderView.drafts.length / ORDER_DRAFT_PAGE_SIZE) - 1));
    renderOrdersModal();
    els.ordersModal?.classList.add('open');
    els.ordersModal?.setAttribute('aria-hidden','false');
  }
  function closeOrdersModal() {
    captureOrderDraftsFromDom();
    resetModalFullscreen(els.ordersModal);
    els.ordersModal?.classList.remove('open');
    els.ordersModal?.setAttribute('aria-hidden','true');
  }
  function tariffOptionLabel(item) {
    const parts = [item.deliveryCompanyLabel || 'ТК', item.urgencyLabel, tariffDisplayName(item), item.deliveryTypeLabel || item.deliveryMethodLabel, formatTerm(item), moneyOrDash(item.userPrice,{positive:true})].filter(Boolean);
    return parts.join(' · ');
  }
  function orderServicesMarkup(draft,item) {
    const services = servicesList(item,false);
    if (!services.length) return '<div class="order-services-empty">У выбранного тарифа нет рассчитанных услуг.</div>';
    const selected = new Set(draft.selectedServices || []);
    return `<div class="order-services-list">${services.map((service,index)=>{
      const key = orderServiceKey(service,index);
      const checked = selected.has(key) || service.required;
      return `<label class="service-choice"><input type="checkbox" data-order-service="${escapeHtml(key)}" ${checked?'checked':''} ${service.required?'disabled':''}><span><b>${escapeHtml(serviceText(service))}</b><small>${escapeHtml(service.description || (service.required ? 'Обязательная услуга' : service.enabled ? 'Включена в тариф' : 'Можно выбрать перед созданием'))}</small></span></label>`;
    }).join('')}</div>`;
  }
  function orderExtraMarkup(draft,selectedTariff) {
    const parts=[];
    if (companyNeedsIdentity(draft.company)) {
      parts.push(`<label>Документ получателя<select data-order-field="identityKind"><option value="inn" ${draft.identityKind==='inn'?'selected':''}>ИНН</option><option value="passport" ${draft.identityKind==='passport'?'selected':''}>Паспорт</option></select></label>`);
      parts.push(`<label class="wide">ИНН или паспорт<input data-order-field="identityValue" value="${escapeHtml(draft.identityValue)}" placeholder="Для ДЛ, Байкал, ПЭК"></label>`);
    }
    if (companyNeedsTransport(draft.company)) {
      parts.push(`<label>Тип транспорта Достависты<select data-order-field="transportType"><option value="1" ${draft.transportType==='1'?'selected':''}>Легковой / джип / пикап</option><option value="2" ${draft.transportType==='2'?'selected':''}>Каблук</option><option value="3" ${draft.transportType==='3'?'selected':''}>Микроавтобус / портер</option><option value="4" ${draft.transportType==='4'?'selected':''}>Газель</option><option value="5" ${draft.transportType==='5'?'selected':''}>Грузовой автомобиль</option><option value="6" ${draft.transportType==='6'?'selected':''}>Пеший курьер</option><option value="7" ${draft.transportType==='7'?'selected':''}>Легковой автомобиль</option></select></label>`);
    }
    parts.push(`<div class="order-services full"><div class="order-services-title"><b>Услуги тарифа</b><small>${escapeHtml(selectedTariff ? tariffOptionLabel(selectedTariff) : 'Сначала выберите тариф')}</small></div>${selectedTariff ? orderServicesMarkup(draft,selectedTariff) : ''}</div>`);
    return parts.join('');
  }
  function orderDraftCard(draft) {
    const row=state.rows.find(item=>item.id===draft.rowId);
    const selectedTariff=syncOrderDraftTariff(draft,row);
    const tariffs=orderTariffsForRow(row);
    const route=`${row?.senderResolved?.placeText||row?.senderQuery||'—'} → ${row?.recipientResolved?.placeText||row?.recipientQuery||'—'}`;
    const statusClass = draft.orderStatus === 'created' ? 'ready' : draft.orderStatus === 'error' ? 'error' : draft.orderStatus === 'creating' ? 'loading' : '';
    const statusText = draft.orderStatus === 'created' ? `Создано ${draft.orderId || ''}` : draft.orderStatus === 'error' ? 'Ошибка создания' : draft.orderStatus === 'creating' ? 'Создаём…' : 'Готов к созданию';
    return `<article class="order-card" data-order-row="${escapeHtml(draft.rowId)}">
      <div class="order-card-head">
        <label class="switch-line"><input type="checkbox" data-order-field="selected" ${draft.selected?'checked':''}><span>Создать заказ</span></label>
        <div><b>${escapeHtml(draft.company||'ТК не выбрана')} · ${escapeHtml(draft.tariff)}</b><small>${escapeHtml(route)}</small></div>
        <span class="status-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </div>
      <div class="order-form-grid">
        <label class="full">Тариф<select data-order-field="tariffKey">${tariffs.map(item=>`<option value="${escapeHtml(orderTariffKey(item))}" ${orderTariffKey(item)===draft.tariffKey?'selected':''}>${escapeHtml(tariffOptionLabel(item))}</option>`).join('')}</select></label>
        <label>Дата забора<input type="date" data-order-field="takeDate" value="${escapeHtml(orderDateInputValue(draft.takeDate) || todayInputDate())}"></label>
        <label>Сбор с<input type="time" step="1800" data-order-field="takeTimeFrom" value="${escapeHtml(orderTimeInputValue(draft.takeTimeFrom) || '09:00')}"></label>
        <label>Сбор до<input type="time" step="1800" data-order-field="takeTimeTo" value="${escapeHtml(orderTimeInputValue(draft.takeTimeTo) || '18:00')}"></label>
        <label>Отправитель<input data-order-field="senderName" value="${escapeHtml(draft.senderName)}" placeholder="Организация"></label>
        <label>Контакт отправителя<input data-order-field="senderContact" value="${escapeHtml(draft.senderContact)}" placeholder="ФИО"></label>
        <label>Телефон отправителя<input data-order-field="senderPhone" value="${escapeHtml(draft.senderPhone)}" placeholder="+7..."></label>
        <label class="wide">Адрес отправителя<input data-order-field="senderAddress" value="${escapeHtml(draft.senderAddress)}"></label>
        <label>Индекс отправителя<input data-order-field="senderPostIndex" value="${escapeHtml(draft.senderPostIndex)}"></label>
        <label class="wide">Доп. инфо отправителя<input data-order-field="senderInfo" value="${escapeHtml(draft.senderInfo)}"></label>
        <label>Получатель<input data-order-field="recipientName" value="${escapeHtml(draft.recipientName)}" placeholder="Организация"></label>
        <label>Контакт получателя<input data-order-field="recipientContact" value="${escapeHtml(draft.recipientContact)}" placeholder="ФИО"></label>
        <label>Телефон получателя<input data-order-field="recipientPhone" value="${escapeHtml(draft.recipientPhone)}" placeholder="+7..."></label>
        <label class="wide">Адрес получателя<input data-order-field="recipientAddress" value="${escapeHtml(draft.recipientAddress)}"></label>
        <label>Индекс получателя<input data-order-field="recipientPostIndex" value="${escapeHtml(draft.recipientPostIndex)}"></label>
        <label class="wide">Доп. инфо получателя<input data-order-field="recipientInfo" value="${escapeHtml(draft.recipientInfo)}"></label>
        <label>Содержимое<input data-order-field="cargoName" value="${escapeHtml(draft.cargoName)}"></label>
        <label>Страхование / ценность<input data-order-field="declaredValue" inputmode="decimal" value="${escapeHtml(draft.declaredValue)}"></label>
        <label class="wide">Комментарий<input data-order-field="comment" value="${escapeHtml(draft.comment)}"></label>
        ${orderExtraMarkup(draft,selectedTariff)}
      </div>
      ${draft.orderError ? `<div class="order-error">${escapeHtml(draft.orderError)}</div>` : ''}
    </article>`;
  }
  function renderOrdersPager(totalPages) {
    if (!els.ordersPager) return;
    if (totalPages <= 1) { els.ordersPager.innerHTML = ''; return; }
    const page = state.orderView.page || 0;
    els.ordersPager.innerHTML = `<button type="button" class="button mini secondary" data-order-page="prev" ${page<=0?'disabled':''}>Назад</button><span>${page+1} / ${totalPages}</span><button type="button" class="button mini secondary" data-order-page="next" ${page>=totalPages-1?'disabled':''}>Дальше</button>`;
  }
  function handleOrderPagerClick(event) {
    const button = event.target.closest('[data-order-page]');
    if (!button) return;
    captureOrderDraftsFromDom();
    const totalPages = Math.max(1, Math.ceil((state.orderView.drafts || []).length / ORDER_DRAFT_PAGE_SIZE));
    if (button.dataset.orderPage === 'prev') state.orderView.page = Math.max(0, (state.orderView.page || 0) - 1);
    if (button.dataset.orderPage === 'next') state.orderView.page = Math.min(totalPages - 1, (state.orderView.page || 0) + 1);
    renderOrdersModal();
  }
  function renderOrdersModal() {
    fillOrderScheduleDefaults();
    const drafts=state.orderView.drafts||[];
    const totalPages = Math.max(1, Math.ceil(drafts.length / ORDER_DRAFT_PAGE_SIZE));
    state.orderView.page = Math.min(Math.max(0,state.orderView.page||0), totalPages - 1);
    const from = drafts.length ? state.orderView.page * ORDER_DRAFT_PAGE_SIZE + 1 : 0;
    const to = Math.min(drafts.length, (state.orderView.page + 1) * ORDER_DRAFT_PAGE_SIZE);
    if (els.ordersSummary) els.ordersSummary.textContent = drafts.length ? `Готово к созданию: ${drafts.length} строк · показаны ${from}-${to}` : 'Нет рассчитанных строк с распознанными городами.';
    if (els.createOrdersBtn) els.createOrdersBtn.disabled = !drafts.length || state.orderView.running;
    if (els.createOrdersBtn) els.createOrdersBtn.textContent = state.orderView.running ? 'Создаём…' : 'Создать заказы';
    const pageDrafts = drafts.slice(state.orderView.page * ORDER_DRAFT_PAGE_SIZE, (state.orderView.page + 1) * ORDER_DRAFT_PAGE_SIZE);
    if (els.orderRows) els.orderRows.innerHTML = pageDrafts.length ? pageDrafts.map(orderDraftCard).join('') : '<div class="empty-state">Импортируйте заказы, распознайте адреса и выполните расчёт. После этого здесь появится выбор тарифов и услуг.</div>';
    renderOrdersPager(totalPages);
    renderOrderResults();
  }
  function renderOrderResults() {
    const items=state.orderView.created||[];
    if (!els.orderResultList) return;
    els.orderResultList.innerHTML = items.length ? items.map(item=>`<div class="order-result-item"><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.message||'')}</small></div><span class="status-pill ${item.ok?'ready':'error'}">${escapeHtml(item.ok?'Создан':'Ошибка')}</span></div>`).join('') : '<div class="empty-state">После отправки здесь появятся номера заявок и статусы.</div>';
  }
  function handleOrderDraftInput(event) {
    const input=event.target.closest('[data-order-field]');
    if(!input) return;
    const rowId=input.closest('[data-order-row]')?.dataset.orderRow;
    const draft=state.orderView.drafts.find(item=>item.rowId===rowId);
    if(!draft) return;
    draft[input.dataset.orderField]=input.type==='checkbox'?input.checked:input.value;
    const row=state.rows.find(item=>item.id===rowId);
    if (input.dataset.orderField === 'tariffKey') {
      draft.selectedServices = [];
      syncOrderDraftTariff(draft,row,true);
      if (row) row.orderDraft = { ...draft };
      renderOrdersModal();
      return;
    }
    if (input.dataset.orderField !== 'selected') {
      draft.orderStatus = draft.orderStatus === 'created' ? '' : draft.orderStatus;
      draft.orderError = '';
    }
    if (row) row.orderDraft = { ...draft };
    scheduleTableAutosave();
  }
  function orderServiceAttribute(service) {
    const text = normalize([service?.key, service?.caption, service?.description].join(' '));
    if (text.includes('страх')) return 'service_insurance';
    if (text.includes('забор')) return 'service_pickup';
    if (text.includes('достав')) return 'service_delivery';
    if (text.includes('личн')) return 'service_personal_delivery';
    if (text.includes('сопровод') && text.includes('возврат')) return 'return_accompanying_documents';
    if (text.includes('сопровод')) return 'cargo_accompanying_documents';
    if (text.includes('обреш')) return 'cargo_wood_frame';
    if (text.includes('амортиз')) return 'cargo_wood_frame_amortization';
    if (text.includes('палет')) return 'cargo_packaging_pallet_board';
    if (text.includes('пузыр')) return 'cargo_packaging_bubble_wrap';
    if (text.includes('упаков')) return 'cargo_additional_packaging';
    return '';
  }
  function selectedOrderServices(draft,item) {
    const selected = new Set(draft.selectedServices || []);
    return servicesList(item,false).map((service,index)=>({service,index,key:orderServiceKey(service,index)})).filter(({service,key})=>service.required||selected.has(key));
  }
  function orderTimeParts(value) {
    const time = orderTimeInputValue(value);
    if (!time) return null;
    const [hour, minute] = time.split(':').map(Number);
    return { hour, minute: minute === 30 ? 30 : 0 };
  }
  function applyOrderScheduleAttributes(attrs,draft) {
    attrs.take_date = formatOrderDateForApi(draft.takeDate);
    const from = orderTimeParts(draft.takeTimeFrom);
    const to = orderTimeParts(draft.takeTimeTo);
    if (from) {
      attrs.take_time_from = from.hour;
      attrs.take_time_from_minutes = from.minute;
    }
    if (to) {
      attrs.take_time_to = to.hour;
      attrs.take_time_to_minutes = to.minute;
    }
  }
  function applyOrderServiceAttributes(attrs,draft,item) {
    selectedOrderServices(draft,item).forEach(({service})=>{
      const attribute = orderServiceAttribute(service);
      if (attribute) attrs[attribute] = 1;
    });
    if (Number(parseInputNumber(draft.declaredValue)) > 0) attrs.service_insurance = 1;
    attrs.services_text = selectedOrderServices(draft,item).map(({service})=>serviceText(service)).join('; ');
  }
  function validateOrderDraft(draft,row,item) {
    const required = [
      ['Тариф', item],
      ['Город отправителя', row?.senderResolved],
      ['Город получателя', row?.recipientResolved],
      ['Адрес отправителя', draft.senderAddress],
      ['Адрес получателя', draft.recipientAddress],
      ['Отправитель', draft.senderName],
      ['Контакт отправителя', draft.senderContact || draft.senderName],
      ['Телефон отправителя', draft.senderPhone],
      ['Получатель', draft.recipientName],
      ['Контакт получателя', draft.recipientContact || draft.recipientName],
      ['Телефон получателя', draft.recipientPhone]
    ].filter(([,value])=>!value);
    if (required.length) return `Заполните: ${required.map(([label])=>label).join(', ')}`;
    if (companyNeedsIdentity(draft.company) && !draft.identityValue) return 'Для выбранной ТК укажите ИНН или паспорт получателя';
    if (companyNeedsTransport(draft.company) && !draft.transportType) return 'Для Достависты выберите тип транспорта';
    return '';
  }
  function buildOrderAttributes(draft,row) {
    const item=syncOrderDraftTariff(draft,row) || row.result?.best || {};
    const attrs={
      status: 1,
      delivery_method: 1,
      user_id: projectSettings().userId,
      sender_city: row.senderResolved?.placeId||row.senderResolved?.kdId,
      recipient_city: row.recipientResolved?.placeId||row.recipientResolved?.kdId,
      sender_address: draft.senderAddress,
      recipient_address: draft.recipientAddress,
      sender: draft.senderName,
      sender_contact: draft.senderContact || draft.senderName,
      sender_phone: draft.senderPhone,
      sender_post_index: draft.senderPostIndex,
      sender_info: draft.senderInfo,
      recipient: draft.recipientName,
      recipient_contact: draft.recipientContact || draft.recipientName,
      recipient_phone: draft.recipientPhone,
      recipient_post_index: draft.recipientPostIndex,
      recipient_info: draft.recipientInfo,
      sender_name: draft.senderName,
      recipient_name: draft.recipientName,
      cargo_name: draft.cargoName,
      cargo_description: draft.cargoName,
      cargo_type: '4aab1fc6-fc2b-473a-8728-58bcd4ff79ba',
      cargo_seats_number: Math.round(parsePositive(row.seats,1)),
      cargo_weight: cargoWeightValue(row.weight),
      cargo_length: parsePositive(row.length,10),
      cargo_width: parsePositive(row.width,10),
      cargo_height: parsePositive(row.height,10),
      declared_value: draft.declaredValue,
      declared_value_rate: draft.declaredValue,
      insurance_price: draft.declaredValue,
      comment: draft.comment,
      deliveryCompany: item.deliveryCompany,
      delivery_company: item.deliveryCompany,
      tariff_id: item.tariffId,
      tariff_name: item.tariffName||item.tariffCaption,
      tariff_caption: item.tariffCaption,
      urgency_id: item.urgencyId,
      delivery_type: item.deliveryType,
      tariff_delivery_method: item.deliveryMethod
    };
    applyOrderScheduleAttributes(attrs,draft);
    applyOrderServiceAttributes(attrs,draft,item);
    if (companyNeedsIdentity(draft.company)) {
      attrs.identity_kind=draft.identityKind;
      attrs.identity_value=draft.identityValue;
      if (draft.identityKind === 'passport') attrs.recipient_passport_number = draft.identityValue;
      else attrs.recipient_inn = draft.identityValue;
    }
    if (companyNeedsTransport(draft.company)) attrs.dostavista_delivery_type=draft.transportType;
    return attrs;
  }
  async function runOrderBatch(drafts, concurrency, worker) {
    let cursor = 0;
    const workers = Array.from({length:Math.min(concurrency,drafts.length)}, async()=>{
      while (cursor < drafts.length && state.orderView.running) {
        const index = cursor++;
        await worker(drafts[index], index);
      }
    });
    await Promise.all(workers);
  }
  async function createSelectedOrders() {
    captureOrderDraftsFromDom();
    const drafts=(state.orderView.drafts||[]).filter(draft=>draft.selected);
    if(!drafts.length){ toast('Выберите строки для создания заказов','error'); return; }
    const p=projectSettings();
    state.orderView.running=true; renderOrdersModal();
    const concurrency = Math.min(MAX_CALCULATION_RPC_CONCURRENCY, Math.max(1, Number(state.settings.concurrency) || 3));
    let successCount = 0;
    let errorCount = 0;
    for (let offset=0; offset<drafts.length && state.orderView.running; offset+=ORDER_DRAFT_PAGE_SIZE) {
      const chunk = drafts.slice(offset, offset + ORDER_DRAFT_PAGE_SIZE);
      state.orderView.page = Math.floor(Math.max(0, state.orderView.drafts.indexOf(chunk[0])) / ORDER_DRAFT_PAGE_SIZE);
      renderOrdersModal();
      await runOrderBatch(chunk, concurrency, async draft=>{
        const row=state.rows.find(item=>item.id===draft.rowId);
        const item=row ? syncOrderDraftTariff(draft,row) : null;
        const title=`${draft.company||'ТК'} · строка ${draft.rowIndex+1}`;
        const validationError = validateOrderDraft(draft,row,item);
        draft.orderStatus='creating'; draft.orderError='';
        if (row) row.orderDraft = { ...draft };
        renderOrderResults();
        if (validationError) {
          draft.orderStatus='error'; draft.orderError=validationError; errorCount += 1;
          state.orderView.created.unshift({ok:false,title,message:validationError});
          if (row) row.orderDraft = { ...draft };
          return;
        }
        try {
          const result=await KDBridge.rpc('createOrder',{projectId:currentProjectId(),email:p.email,password:p.password,attributes:buildOrderAttributes(draft,row),maxConcurrentOrders:concurrency});
          const id=result.id||result.orderId||result.requestId||result.data?.id||result.attributes?.id||result.raw?.id||'без номера';
          draft.orderStatus='created'; draft.orderId=id; draft.orderError=''; successCount += 1;
          state.orderView.created.unshift({ok:true,title,message:`Заявка ${id}`});
        } catch(error) {
          draft.orderStatus='error'; draft.orderError=error.message||String(error); errorCount += 1;
          state.orderView.created.unshift({ok:false,title,message:draft.orderError});
        }
        if (row) row.orderDraft = { ...draft };
        renderOrderResults();
      });
      renderOrdersModal();
      scheduleTableAutosave(0);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    state.orderView.running=false; renderOrdersModal(); toast(`Создание завершено: ${successCount} успешно, ${errorCount} ошибок`, errorCount ? 'error' : 'success');
  }
  function tariffDisplayName(item) {
    return String(item?.tariffCaption || item?.tariffName || '').trim() || '—';
  }
  function tariffUrgencyLabel(item) {
    return String(item?.urgencyLabel || '').trim() || '—';
  }
  function usesUrgencyView(projectId = currentProjectId()) { return projectDef(projectId).sortStrategy === 'urgency'; }
  function formatTerm(item) {
    const min=Number(item?.minPeriod),max=Number(item?.maxPeriod),hasMin=Number.isFinite(min)&&min>0,hasMax=Number.isFinite(max)&&max>0;
    if(hasMin&&hasMax&&min!==max)return`${min}–${max} дн.`;if(hasMax)return`${max} дн.`;if(hasMin)return`от ${min} дн.`;return'По запросу';
  }
  function validPeriod(value) { const number=Number(value); return Number.isFinite(number)&&number>0?number:null; }
  function optionalNumeric(value, options = {}) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    if (options.positive && number <= 0) return null;
    if (options.nonNegative && number < 0) return null;
    return number;
  }
  function hasOptionalNumber(value, options = {}) { return optionalNumeric(value, options) !== null; }
  function ceilingMoney(value, options = {}) {
    const number = optionalNumeric(value, options);
    return number === null ? null : Math.ceil(number);
  }
  function moneyOrDash(value, options = {}) {
    const number = optionalNumeric(value, options);
    return number === null ? '—' : `${formatValue(number)} ₽`;
  }
  function percentOrDash(value) {
    const number = optionalNumeric(value);
    return number === null ? '—' : `${formatValue(round2(number))}%`;
  }
  function tariffPriceModel(item) {
    const userPrice = optionalNumeric(item?.userPrice, { positive:true });
    const userPriceWithoutDiscount = optionalNumeric(item?.userPriceWithoutDiscount, { positive:true });
    const inputPrice = ceilingMoney(item?.inputPrice, { nonNegative:true });
    const minPrice = optionalNumeric(item?.minPrice, { positive:true });
    const inputPricePercent = optionalNumeric(item?.inputPricePercent, { nonNegative:true });
    const minPricePercent = optionalNumeric(item?.minPricePercent, { nonNegative:true });
    const retailPrice = optionalNumeric(item?.retailPrice, { positive:true });
    const activeDiscountPct = optionalNumeric(item?.activeDiscount, { nonNegative:true });
    const clientDiscountPct = userPrice !== null && userPriceWithoutDiscount !== null && userPriceWithoutDiscount > 0
      ? (userPriceWithoutDiscount - userPrice) / userPriceWithoutDiscount * 100 : null;
    const retailDiscountPct = userPrice !== null && retailPrice !== null && retailPrice > 0
      ? (retailPrice - userPrice) / retailPrice * 100 : null;
    const marginRub = userPrice !== null && inputPrice !== null ? userPrice - inputPrice : null;
    const marginPct = marginRub !== null && userPrice > 0 ? marginRub / userPrice * 100 : null;
    return { userPrice, userPriceWithoutDiscount, inputPrice, inputPricePercent, minPrice, minPricePercent, retailPrice, activeDiscountPct, clientDiscountPct, retailDiscountPct, marginRub, marginPct };
  }
  const HIDDEN_COMPANIES = new Set(['достависта','яндекс доставка','яндекс.доставка','пешкарики']);
  function isHiddenCompanyName(value) { const name=normalize(value);return HIDDEN_COMPANIES.has(name)||name.includes('достависта')||name.includes('пешкар')||(name.includes('яндекс')&&name.includes('достав')); }
  function visibleTariffs(items) { return (Array.isArray(items)?items:[]).filter(item=>!isHiddenCompanyName(item?.deliveryCompanyLabel)); }
  function hasMetricValue(value) { return typeof value==='number' && Number.isFinite(value); }
  function isPeriodMetric(metric) { return metric?.key==='bestPeriod'||metric?.key==='avgPeriod'||metric?.unit==='дн.'; }




  /* ===== v1.6 exports, views and analytics ===== */
  function getExportCompanies() {
    const found=new Set(); state.rows.forEach(row=>visibleTariffs(row.result?.allTariffs).forEach(item=>{ if(item.deliveryCompanyLabel) found.add(item.deliveryCompanyLabel); }));
    const order=projectDef().targetCompanies||[]; return [...order.filter(name=>found.has(name)),...[...found].filter(name=>!order.includes(name)).sort((a,b)=>a.localeCompare(b,'ru'))];
  }
  function periodExportValue(value) { const period=validPeriod(value); return period===null?'По запросу':period; }
  function mainFieldValue(key,row,index) {
    const best=row.result?.best||{}; const values={
      requestNo:index+1,senderQuery:row.senderQuery,senderKd:row.senderResolved?.placeText||row.senderResolved?.kdText||'',recipientQuery:row.recipientQuery,recipientKd:row.recipientResolved?.placeText||row.recipientResolved?.kdText||'',
      weight:parsePositive(row.weight,.1),seats:Math.round(parsePositive(row.seats,1)),length:parsePositive(row.length,10),width:parsePositive(row.width,10),height:parsePositive(row.height,10),status:row.statusText,error:row.error||'',
      bestCompany:best.deliveryCompanyLabel||'',bestUrgency:best.urgencyLabel||'',bestTariff:tariffDisplayName(best),bestMethod:best.deliveryTypeLabel||best.deliveryMethodLabel||'',bestMaxPeriod:periodExportValue(best.maxPeriod),bestPrice:safeNumber(best.userPrice),bestInput:safeNumber(best.inputPrice),bestRetail:safeNumber(best.retailPrice),bestDiscount:safeNumber(best.discount)
    }; return values[key]??'';
  }
  function tariffFieldValue(key,item,row,index) {
    const values={
      requestNo:index+1,senderQuery:row.senderQuery,senderKd:row.senderResolved?.placeText||row.senderResolved?.kdText||'',recipientQuery:row.recipientQuery,recipientKd:row.recipientResolved?.placeText||row.recipientResolved?.kdText||'',
      weight:parsePositive(row.weight,.1),seats:Math.round(parsePositive(row.seats,1)),length:parsePositive(row.length,10),width:parsePositive(row.width,10),height:parsePositive(row.height,10),
      company:item?.deliveryCompanyLabel||'',urgency:item?.urgencyLabel||'',tariffCaption:item?tariffDisplayName(item):'',method:item?.deliveryTypeLabel||item?.deliveryMethodLabel||'',maxPeriod:periodExportValue(item?.maxPeriod),
      userPrice:safeNumber(item?.userPrice),userPriceWithoutDiscount:safeNumber(item?.userPriceWithoutDiscount),inputPrice:safeNumber(ceilingMoney(item?.inputPrice,{nonNegative:true})),inputPricePercent:safeNumber(item?.inputPricePercent),retailPrice:safeNumber(item?.retailPrice),servicesPrice:safeNumber(ceilingMoney(item?.servicesPrice,{nonNegative:true})),activeDiscount:safeNumber(item?.activeDiscount),discountPercent:safeNumber(item?.discountPercent),calculatedDiscount:safeNumber(item?.discount),minPrice:safeNumber(item?.minPrice),minPricePercent:safeNumber(item?.minPricePercent),returnAllowed:item?.returnServiceAllowed?'Да':'Нет',returnPrice:safeNumber(ceilingMoney(item?.returnServicePrice,{nonNegative:true})),includedServices:servicesSummary(item,true),allServices:servicesSummary(item,false)
    }; return values[key]??'';
  }
  function buildCompanySummaryAoa() {
    const groups=new Map(); state.rows.forEach((row,rowIndex)=>visibleTariffs(row.result?.allTariffs).forEach(item=>{ const name=item.deliveryCompanyLabel||'Неизвестная ТК'; if(!groups.has(name)) groups.set(name,{tariffs:[],requests:new Set()}); groups.get(name).tariffs.push(item); groups.get(name).requests.add(rowIndex); }));
    const headers=['ТК','Запросов','Тарифов','Мин. цена','Средняя цена','Макс. цена','Лучший макс. срок','Средний макс. срок','Типов доставки'];
    const rows=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru')).map(([name,group])=>{ const prices=group.tariffs.map(item=>Number(item.userPrice)).filter(v=>Number.isFinite(v)&&v>0); const periods=group.tariffs.map(item=>validPeriod(item.maxPeriod)).filter(v=>v!==null); const methods=new Set(group.tariffs.map(item=>item.deliveryTypeLabel||item.deliveryMethodLabel).filter(Boolean)); return [name,group.requests.size,group.tariffs.length,prices.length?Math.min(...prices):'',prices.length?round2(avg(prices)):'',prices.length?Math.max(...prices):'',periods.length?Math.min(...periods):'По запросу',periods.length?round2(avg(periods)):'По запросу',[...methods].join('; ')]; });
    return [headers,...rows];
  }
  function filePrefix() { return projectDef().shortLabel.replace(/\s+/g,'_'); }
  function fileName(extension) { const d=new Date(); const stamp=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); return `${filePrefix()}_массовый_расчёт_${stamp}.${extension}`; }
  function tariffFileName(row,extension) { const route=`${row.senderQuery}_${row.recipientQuery}`.replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,70); return `${filePrefix()}_тарифы_${route||'строка'}.${extension}`; }
  function companyFileName(extension) { const company=(els.companySelect.value||'все_ТК').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,60); return `${filePrefix()}_обзор_${company}.${extension}`; }
  function downloadImportTemplate() {
    const workbook=XLSX.utils.book_new(); const data=[['Откуда','Куда','Вес, кг','Мест','Длина, см','Ширина, см','Высота, см'],['Москва','Санкт-Петербург',2.5,1,30,20,15],['Казань, ул. Баумана, 1','Екатеринбург',8,2,40,30,25]];
    XLSX.utils.book_append_sheet(workbook,makeWorksheet(data,34),'Импорт'); const instructions=[['Шаблон массового расчёта'],['Обязательные столбцы','Откуда и Куда'],['Необязательные','Вес, Мест, Длина, Ширина, Высота'],['По умолчанию','0,1 кг; 1 место; 10×10×10 см'],['Проекты','Один файл можно импортировать в любую вкладку проекта.'],['Адреса','Можно указывать город или полный адрес.'],['Форматы','XLSX, XLS, CSV, TSV, TXT']];
    XLSX.utils.book_append_sheet(workbook,makeWorksheet(instructions,80),'Инструкция'); XLSX.writeFile(workbook,'Шаблон_массового_расчёта.xlsx',{compression:true}); toast('Шаблон импорта скачан','success');
  }
  function downloadXlsx() {
    const main=buildExportAoa(); if(main.length<2){toast('Нет данных для скачивания','error');return;} const workbook=XLSX.utils.book_new(),used=new Set();
    XLSX.utils.book_append_sheet(workbook,makeWorksheet(main),safeSheetName('Расчёт',used)); const summary=buildCompanySummaryAoa(); if(summary.length>1) XLSX.utils.book_append_sheet(workbook,makeWorksheet(summary),safeSheetName('Сводка ТК',used));
    const allTariffs=buildAllTariffsAoa(); if(allTariffs.length>1) XLSX.utils.book_append_sheet(workbook,makeWorksheet(allTariffs,55),safeSheetName('Все тарифы',used));
    if(state.settings.exportAnalyticsSheet){ const recommendations=managerRecommendationsAoa(buildManagerRows()),matrix=managerMatrixAoa(),comparison=comparisonAoa(); if(recommendations.length>1) XLSX.utils.book_append_sheet(workbook,makeWorksheet(recommendations,45),safeSheetName('Рекомендации',used)); if(matrix.length>1) XLSX.utils.book_append_sheet(workbook,makeWorksheet(matrix,32),safeSheetName('Матрица ТК',used)); if(comparison.length>1) XLSX.utils.book_append_sheet(workbook,makeWorksheet(comparison,38),safeSheetName('Сравнение ТК',used)); }
    if(state.settings.exportCompanySheets){ getExportCompanies().forEach(company=>{ if(state.settings.companySheetLayout==='long'){ const aoa=buildAllTariffsAoa(state.rows,company); if(aoa.length>1) XLSX.utils.book_append_sheet(workbook,makeWorksheet(aoa,55),safeSheetName(company,used)); } else { const model=buildCompanyWideModel(company); if(model.aoa.length>2&&model.aoa[0].length) XLSX.utils.book_append_sheet(workbook,makeWideCompanyWorksheet(model,48),safeSheetName(company,used)); } }); }
    XLSX.writeFile(workbook,fileName('xlsx'),{compression:true});
  }

  function tariffFacetValues(tariffs, facet) {
    const selected={
      company:els.tariffCompanyFilter?.value||'',
      urgency:els.tariffUrgencyFilter?.value||'',
      tariff:els.tariffNameFilter?.value||'',
      method:els.tariffMethodFilter?.value||''
    };
    return [...new Set(tariffs.filter(item=>{
      if(facet!=='company'&&selected.company&&item.deliveryCompanyLabel!==selected.company)return false;
      if(facet!=='urgency'&&selected.urgency&&String(item.urgencyLabel||'')!==selected.urgency)return false;
      if(facet!=='tariff'&&selected.tariff&&tariffDisplayName(item)!==selected.tariff)return false;
      if(facet!=='method'&&selected.method&&(item.deliveryTypeLabel||item.deliveryMethodLabel||'')!==selected.method)return false;
      return true;
    }).map(item=>facet==='company'?item.deliveryCompanyLabel:facet==='urgency'?String(item.urgencyLabel||'').trim():facet==='tariff'?tariffDisplayName(item):(item.deliveryTypeLabel||item.deliveryMethodLabel||'')).filter(Boolean))];
  }
  function updateTariffFacetFilters(tariffs=visibleTariffs(activeTariffRow()?.result?.allTariffs)) {
    const facets=[
      [els.tariffCompanyFilter,'company','Все рассчитанные ТК',(a,b)=>a.localeCompare(b,'ru')],
      [els.tariffUrgencyFilter,'urgency','Все рассчитанные срочности',(a,b)=>urgencyRankLocal(a)-urgencyRankLocal(b)||a.localeCompare(b,'ru')],
      [els.tariffNameFilter,'tariff','Все рассчитанные тарифы',(a,b)=>a.localeCompare(b,'ru')],
      [els.tariffMethodFilter,'method','Все рассчитанные методы',(a,b)=>a.localeCompare(b,'ru')]
    ];
    facets.forEach(([select,key,label,sort])=>{
      if(!select)return;
      const previous=select.value;
      const values=tariffFacetValues(tariffs,key).sort(sort);
      select.innerHTML=`<option value="">${escapeHtml(label)}</option>`+values.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      select.value=values.includes(previous)?previous:'';
    });
  }
  function openTariffs(row) {
    const tariffs=visibleTariffs(row.result?.allTariffs); if(!tariffs.length)return;
    state.activeTariffRowId=row.id; state.tariffView.sortKey='calculatorOrder'; state.tariffView.sortDir='asc'; state.tariffView.advanced=Boolean(state.settings.advancedTariffView);
    els.advancedTariffViewToggle.checked=state.tariffView.advanced; applyAdvancedTableMode(els.tariffsModal,state.tariffView.advanced);
    els.tariffsSubtitle.textContent=`${row.senderQuery} → ${row.recipientQuery} · ${tariffs.length} тарифов`;
    resetTariffFilters(false); updateTariffFacetFilters(tariffs); renderTariffsView();
    els.tariffsModal.classList.add('open'); els.tariffsModal.setAttribute('aria-hidden','false');
  }
  function resetTariffFilters(render=true) {
    [els.tariffSearchInput,els.tariffPriceMin,els.tariffPriceMax,els.tariffPeriodMax].forEach(input=>{if(input)input.value='';});
    [els.tariffCompanyFilter,els.tariffUrgencyFilter,els.tariffNameFilter,els.tariffMethodFilter].filter(Boolean).forEach(select=>select.value='');
    state.tariffView.sortKey='calculatorOrder'; state.tariffView.sortDir='asc';
    updateTariffFacetFilters(); if(render)renderTariffsView();
  }
  function filteredTariffs() {
    const row=activeTariffRow(); if(!row)return[];
    const query=normalize(els.tariffSearchInput.value),company=els.tariffCompanyFilter.value,urgency=els.tariffUrgencyFilter?.value||'',tariffName=els.tariffNameFilter?.value||'',method=els.tariffMethodFilter.value,priceMin=numericFilterValue(els.tariffPriceMin),priceMax=numericFilterValue(els.tariffPriceMax),periodMax=numericFilterValue(els.tariffPeriodMax);
    const filtered=visibleTariffs(row.result?.allTariffs).filter(item=>{
      const search=normalize([item.deliveryCompanyLabel,tariffDisplayName(item),item.urgencyLabel,item.deliveryMethodLabel,item.deliveryTypeLabel].join(' '));
      const price=optionalNumeric(item.userPrice,{positive:true}),period=validPeriod(item.maxPeriod);
      return(!query||search.includes(query))&&(!company||item.deliveryCompanyLabel===company)&&(!urgency||String(item.urgencyLabel||'')===urgency)&&(!tariffName||tariffDisplayName(item)===tariffName)&&(!method||(item.deliveryTypeLabel||item.deliveryMethodLabel)===method)
        &&(priceMin===null||(price!==null&&price>=priceMin))&&(priceMax===null||(price!==null&&price<=priceMax))&&(periodMax===null||(period!==null&&period<=periodMax));
    });
    const direction=state.tariffView.sortDir==='desc'?-1:1,key=state.tariffView.sortKey;
    filtered.sort((a,b)=>{
      if(key==='calculatorOrder')return((Number(a.calculatorOrder)||0)-(Number(b.calculatorOrder)||0))*direction;
      if(key==='maxPeriod')return((validPeriod(a.maxPeriod)??Infinity)-(validPeriod(b.maxPeriod)??Infinity))*direction;
      const av=a[key],bv=b[key];
      if(['userPrice','inputPrice','retailPrice','discount'].includes(key)){const an=optionalNumeric(av),bn=optionalNumeric(bv);return((an??Infinity)-(bn??Infinity))*direction;}
      return String(av||'').localeCompare(String(bv||''),'ru')*direction;
    });
    return filtered;
  }
  function tariffTableColumns() {
    return [
      {key:'company',label:'ТК',sort:'deliveryCompanyLabel'},
      ...(usesUrgencyView()?[{key:'urgency',label:'Срочность',sort:'urgencyLabel'}]:[]),
      {key:'tariff',label:'Тариф',sort:'tariffCaption'},
      {key:'method',label:'Тип доставки',sort:'deliveryMethodLabel'},
      {key:'period',label:'Макс. срок',sort:'maxPeriod'},
      {key:'price',label:'Цена',sort:'userPrice'},
      {key:'input',label:'Вход',sort:'inputPrice',advanced:true},
      {key:'retail',label:'Розница',sort:'retailPrice',advanced:true},
      {key:'discount',label:'Скидка',sort:'discount',advanced:true},
      {key:'services',label:'Услуги',advanced:true},
      {key:'details',label:''}
    ];
  }
  function renderTariffsHeader() {
    const columns=tariffTableColumns();
    els.tariffsHead.innerHTML=`<tr>${columns.map(col=>`<th class="${col.advanced?'advanced-column':''} ${col.key==='urgency'?'urgency-cell':''}">${col.sort?`<button class="sort-button" data-sort="${col.sort}">${escapeHtml(col.label)}</button>`:escapeHtml(col.label)}</th>`).join('')}</tr>`;
    els.tariffsHead.querySelectorAll('.sort-button').forEach(button=>button.addEventListener('click',()=>setTariffSort(button.dataset.sort)));
  }
  function tariffTableCell(column,item,index,isBest,totalServices,requiredCount) {
    const cells={
      company:`<td><div class="tariff-company">${item.deliveryCompanyIcon?`<img src="${escapeHtml(item.deliveryCompanyIcon)}" alt="">`:''}<span>${escapeHtml(item.deliveryCompanyLabel||'—')}</span></div></td>`,
      urgency:`<td class="urgency-cell"><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(item))}</span></td>`,
      tariff:`<td class="tariff-description"><b>${escapeHtml(tariffDisplayName(item))}</b>${isBest?' <span class="tariff-tag best-tag">лучший</span>':''}</td>`,
      method:`<td>${escapeHtml(item.deliveryTypeLabel||item.deliveryMethodLabel||'—')}</td>`,
      period:`<td>${escapeHtml(formatTerm(item))}</td>`,
      price:`<td><b>${escapeHtml(formatValue(item.userPrice))} ₽</b></td>`,
      input:`<td class="advanced-column">${escapeHtml(moneyOrDash(item.inputPrice,{nonNegative:true}))}</td>`,
      retail:`<td class="advanced-column">${escapeHtml(moneyOrDash(item.retailPrice,{positive:true}))}</td>`,
      discount:`<td class="advanced-column">${escapeHtml(percentOrDash(item.discount))}</td>`,
      services:`<td class="tariff-services advanced-column">${totalServices?`${totalServices} шт.${requiredCount?` · ${requiredCount} обяз.`:''}`:'—'}</td>`,
      details:`<td><button class="button ghost compact-detail" data-tariff-details="${index}">Подробнее</button></td>`
    };
    return cells[column.key]||'';
  }
  function renderTariffsView() {
    const row=activeTariffRow(); if(!row)return; updateTariffFacetFilters(visibleTariffs(row.result?.allTariffs)); const tariffs=filteredTariffs(); state.tariffView.filtered=tariffs; renderTariffsHeader();
    const prices=tariffs.map(i=>Number(i.userPrice)).filter(v=>Number.isFinite(v)&&v>0),periods=tariffs.map(i=>validPeriod(i.maxPeriod)).filter(v=>v!==null);
    els.tariffCountMetric.textContent=`${tariffs.length} из ${visibleTariffs(row.result?.allTariffs).length}`; els.tariffMinPriceMetric.textContent=prices.length?`${formatValue(Math.min(...prices))} ₽`:'—'; els.tariffFastestMetric.textContent=periods.length?`${Math.min(...periods)} дн.`:'По запросу';
    els.tariffsHead.querySelectorAll('.sort-button').forEach(button=>{button.classList.toggle('active',button.dataset.sort===state.tariffView.sortKey);button.classList.toggle('asc',button.dataset.sort===state.tariffView.sortKey&&state.tariffView.sortDir==='asc');button.classList.toggle('desc',button.dataset.sort===state.tariffView.sortKey&&state.tariffView.sortDir==='desc');});
    const columns=tariffTableColumns();
    if(!tariffs.length){els.tariffsBody.innerHTML=`<tr><td colspan="${columns.length}" class="empty-tariffs">По заданным фильтрам тарифы не найдены.</td></tr>`;return;}
    const best=row.result?.best;
    els.tariffsBody.innerHTML=tariffs.map((item,index)=>{const isBest=best&&item.deliveryCompanyLabel===best.deliveryCompanyLabel&&item.tariffCaption===best.tariffCaption&&String(item.urgencyLabel||'')===String(best.urgencyLabel||'')&&Number(item.userPrice)===Number(best.userPrice);const requiredCount=servicesList(item,true).length,totalServices=servicesList(item,false).length;return `<tr>${columns.map(column=>tariffTableCell(column,item,index,isBest,totalServices,requiredCount)).join('')}</tr><tr class="tariff-details-row hidden" data-details-row="${index}"><td colspan="${columns.length}">${tariffDetailsMarkup(item)}</td></tr>`;}).join('');
  }
  function tariffDetailsMarkup(item) {
    const services=servicesList(item,false).map(service=>`<span class="tariff-tag" title="${escapeHtml(service.description||'')}">${escapeHtml(serviceText(service))}${service.required?' · обязательно':service.enabled?' · включено':''}</span>`).join('')||'<span class="tariff-tag">Нет дополнительных услуг</span>';
    const price=tariffPriceModel(item),priceLines=[],metricLines=[];
    if(price.userPrice!==null)priceLines.push(`<p><span>Цена клиента</span><strong>${escapeHtml(moneyOrDash(price.userPrice,{positive:true}))}</strong></p>`);
    if(price.userPriceWithoutDiscount!==null)priceLines.push(`<p><span>Цена без скидки</span><strong>${escapeHtml(moneyOrDash(price.userPriceWithoutDiscount,{positive:true}))}</strong></p>`);
    if(price.inputPrice!==null)priceLines.push(`<p><span>Вход</span><strong>${escapeHtml(moneyOrDash(price.inputPrice,{nonNegative:true}))}</strong>${price.inputPricePercent===null?'':`<small>${escapeHtml(percentOrDash(price.inputPricePercent))}</small>`}</p>`);
    if(price.minPrice!==null)priceLines.push(`<p><span>Минимально допустимая</span><strong>${escapeHtml(moneyOrDash(price.minPrice,{positive:true}))}</strong>${price.minPricePercent===null?'':`<small>${escapeHtml(percentOrDash(price.minPricePercent))}</small>`}</p>`);
    if(price.retailPrice!==null)priceLines.push(`<p><span>Розница</span><strong>${escapeHtml(moneyOrDash(price.retailPrice,{positive:true}))}</strong></p>`);
    if(price.marginRub!==null)metricLines.push(`<p>Маржа: <strong>${escapeHtml(formatValue(round2(price.marginRub)))} ₽</strong></p>`);
    if(price.marginPct!==null)metricLines.push(`<p>Маржа: <strong>${escapeHtml(formatValue(round2(price.marginPct)))}%</strong></p>`);
    if(price.clientDiscountPct!==null)metricLines.push(`<p>Персональная скидка клиента: <strong>${escapeHtml(formatValue(round2(price.clientDiscountPct)))}%</strong></p>`);
    if(price.activeDiscountPct!==null)metricLines.push(`<p>Активная скидка ЛК: <strong>${escapeHtml(formatValue(round2(price.activeDiscountPct)))}%</strong></p>`);
    if(price.retailDiscountPct!==null)metricLines.push(`<p>Скидка от розницы: <strong>${escapeHtml(formatValue(round2(price.retailDiscountPct)))}%</strong></p>`);
    const blocks=[`<div class="tariff-detail-block"><h4>Максимальный срок</h4><p><strong>${escapeHtml(formatTerm(item))}</strong></p></div>`];
    if(priceLines.length)blocks.push(`<div class="tariff-detail-block tariff-price-block"><h4>Цены</h4>${priceLines.join('')}</div>`);
    if(metricLines.length)blocks.push(`<div class="tariff-detail-block"><h4>Показатели</h4>${metricLines.join('')}</div>`);
    if(item.returnServiceAllowed)blocks.push(`<div class="tariff-detail-block"><h4>Возврат</h4><p>Разрешён${hasOptionalNumber(item.returnServicePrice,{nonNegative:true})?` · ${escapeHtml(moneyOrDash(item.returnServicePrice,{nonNegative:true}))}`:''}</p></div>`);
    blocks.push(`<div class="tariff-detail-block tariff-detail-wide"><h4>Услуги</h4>${services}</div>`);
    return `<div class="tariff-details">${blocks.join('')}</div>`;
  }
  function routeKey(row) { return `${row.senderQuery} → ${row.recipientQuery}`; }
  function routeOptions() { return [...new Set(state.rows.filter(row=>row.senderQuery&&row.recipientQuery&&row.result).map(routeKey))].sort((a,b)=>a.localeCompare(b,'ru')); }
  function openCompanyModal() {
    const records=allCompanyRecords();if(!records.length){toast('Сначала выполните хотя бы один расчёт','error');return;}
    const companies=[...new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК'))].sort((a,b)=>a.localeCompare(b,'ru')),methods=analyticsMethodList(),routes=routeOptions();
    const companyOptions='<option value="">Все ТК</option>'+companies.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(''),routeOptionsHtml='<option value="">Все направления</option>'+routes.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(''),companyMethodOptions='<option value="">Все типы доставки</option>'+methods.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    els.companySelect.innerHTML=companyOptions;els.managerCompanyFilter.innerHTML=companyOptions;els.managerBaseCompanyFilter.innerHTML='<option value="cheapest">Самая низкая цена в строке</option>'+companies.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    els.companyRouteFilter.innerHTML=routeOptionsHtml;els.comparisonRouteSelect.innerHTML=routeOptionsHtml;els.managerRouteFilter.innerHTML=routeOptionsHtml;els.companyMethodFilter.innerHTML=companyMethodOptions;populateAnalyticsMethodSelects(methods);
    els.managerViewSelect.value=state.settings.managerView||'recommendations';els.managerBaseCompanyFilter.value=[...els.managerBaseCompanyFilter.options].some(option=>option.value===state.settings.managerBaseCompany)?state.settings.managerBaseCompany:'cheapest';
    els.comparisonTariffModeSelect.value=state.settings.comparisonTariffMode||'cheapest';els.comparisonPeriodMax.value=state.settings.comparisonPeriodMax||'';
    els.managerTariffModeSelect.value=state.settings.managerTariffMode||'cheapest';els.managerPeriodMax.value=state.settings.managerPeriodMax||'';
    els.managerPresetSelect.value=state.settings.managerPreset||'custom';els.managerFloorModeSelect.value=state.settings.managerFloorMode||'strict';els.managerFloorPercentInput.value=String(state.settings.managerFloorPercent??10);els.managerBeatMarketInput.value=String(state.settings.managerBeatMarketPct||1);els.comparisonFloorModeSelect.value=state.settings.salesFloorMode||'strict';els.comparisonFloorPercentInput.value=String(state.settings.salesFloorPercent??10);els.salesBeatMarketInput.value=String(state.settings.salesBeatMarketPct||1);
    syncAnalyticsMethod(analyticsMethod());setComparisonMetrics(state.settings.comparisonMetrics);renderAnalyticsTariffPickers();
    state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';state.companyView.advanced=false;els.advancedCompanyViewToggle.checked=false;applyAdvancedTableMode(els.companyModal,false);resetCompanyFilters(false);renderCompanyCards(records);renderCompanyView();
    renderComparison(true);renderManagerTable(true);analyticsPendingScopes.clear();activateCompanyPane('tariffs');els.companyModal.classList.add('open');els.companyModal.setAttribute('aria-hidden','false');
  }
  function resetCompanyFilters(render=true){ els.companySelect.value='';els.companyRouteFilter.value='';els.companySearchInput.value='';els.companyMethodFilter.value='';els.companyPriceMin.value='';els.companyPriceMax.value='';els.companyPeriodMax.value='';state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';if(render)renderCompanyView(); }
  function filteredCompanyRecords() {
    const company=els.companySelect.value,route=els.companyRouteFilter.value,query=normalize(els.companySearchInput.value),method=els.companyMethodFilter.value,priceMin=numericFilterValue(els.companyPriceMin),priceMax=numericFilterValue(els.companyPriceMax),periodMax=numericFilterValue(els.companyPeriodMax);
    const records=allCompanyRecords().filter(({row,item})=>{ const search=normalize([item.tariffCaption,item.urgencyLabel,item.deliveryMethodLabel,item.deliveryTypeLabel].join(' ')); const price=Number(item.userPrice),period=validPeriod(item.maxPeriod); return(!company||item.deliveryCompanyLabel===company)&&(!route||routeKey(row)===route)&&(!query||search.includes(query))&&(!method||(item.deliveryTypeLabel||item.deliveryMethodLabel)===method)&&(priceMin===null||price>=priceMin)&&(priceMax===null||price<=priceMax)&&(periodMax===null||(period!==null&&period<=periodMax)); });
    const direction=state.companyView.sortDir==='desc'?-1:1,key=state.companyView.sortKey; records.sort((a,b)=>{let av,bv;if(key==='requestNo'){av=a.rowIndex;bv=b.rowIndex;}else if(key==='route'){av=routeKey(a.row);bv=routeKey(b.row);}else{av=a.item[key];bv=b.item[key];}if(key==='maxPeriod'){return((validPeriod(av)??Infinity)-(validPeriod(bv)??Infinity))*direction;}if(['requestNo','userPrice','inputPrice','retailPrice','discount'].includes(key))return((Number(av)||0)-(Number(bv)||0))*direction;return String(av||'').localeCompare(String(bv||''),'ru')*direction;});return records;
  }
  function companyColumnOrder() { const order=[...(COMPANY_COLUMN_ORDERS[state.settings.overviewColumnOrder] || COMPANY_COLUMN_ORDERS.logistics)]; if(usesUrgencyView()&&!order.includes('urgency')) order.splice(Math.max(0,order.indexOf('tariff')),0,'urgency'); return order; }
  function companyColumnMeta(key) {
    return {
      requestNo:{label:'№ запроса',sort:'requestNo'}, route:{label:'Маршрут',sort:'route'}, cargo:{label:'Груз',advanced:true},
      company:{label:'ТК',sort:'deliveryCompanyLabel'}, urgency:{label:'Срочность',sort:'urgencyLabel'}, tariff:{label:'Тариф',sort:'tariffCaption'}, method:{label:'Тип доставки',sort:'deliveryMethodLabel'},
      period:{label:'Макс. срок',sort:'maxPeriod'}, price:{label:'Цена',sort:'userPrice'}, input:{label:'Вход',advanced:true}, retail:{label:'Розница',advanced:true}, details:{label:''}
    }[key];
  }
  function renderCompanyHeader() {
    const order=companyColumnOrder();
    els.companyTariffsHead.innerHTML=`<tr>${order.map(key=>{const meta=companyColumnMeta(key);const cls=meta.advanced?'advanced-column':'';return `<th class="${cls}">${meta.sort?`<button class="company-sort-button" data-company-sort="${meta.sort}">${meta.label}</button>`:meta.label}</th>`;}).join('')}</tr>`;
    $$('.company-sort-button').forEach(button=>button.addEventListener('click',()=>setCompanySort(button.dataset.companySort)));
  }
  function companyCellMarkup(key,record,index) {
    const {row,rowIndex,item}=record;
    const cargo=`${formatValue(parsePositive(row.weight,.1))} кг · ${Math.round(parsePositive(row.seats,1))} м. · ${formatValue(parsePositive(row.length,10))}×${formatValue(parsePositive(row.width,10))}×${formatValue(parsePositive(row.height,10))}`;
    const cells={
      requestNo:`<td>${rowIndex+1}</td>`,
      route:`<td class="route-cell"><div class="route-points"><div class="route-point"><span>Откуда</span><b>${escapeHtml(row.senderQuery||'—')}</b></div><span>→</span><div class="route-point"><span>Куда</span><b>${escapeHtml(row.recipientQuery||'—')}</b></div></div></td>`,
      cargo:`<td class="advanced-column cargo-cell">${escapeHtml(cargo)}</td>`,
      company:`<td><div class="tariff-company">${item.deliveryCompanyIcon?`<img src="${escapeHtml(item.deliveryCompanyIcon)}" alt="">`:''}<span>${escapeHtml(item.deliveryCompanyLabel||'—')}</span></div></td>`,
      urgency:`<td class="urgency-cell"><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(item))}</span></td>`,
      tariff:`<td><b>${escapeHtml(tariffDisplayName(item))}</b></td>`,
      method:`<td>${escapeHtml(item.deliveryTypeLabel||item.deliveryMethodLabel||'—')}</td>`,
      period:`<td>${escapeHtml(formatTerm(item))}</td>`,
      price:`<td><b>${escapeHtml(formatValue(item.userPrice))} ₽</b></td>`,
      input:`<td class="advanced-column">${escapeHtml(moneyOrDash(item.inputPrice,{nonNegative:true}))}</td>`,
      retail:`<td class="advanced-column">${escapeHtml(moneyOrDash(item.retailPrice,{positive:true}))}</td>`,
      details:`<td><button class="button ghost compact-detail" data-company-details="${index}">Подробнее</button></td>`
    };
    return cells[key]||'';
  }
  function renderCompanyView() {
    const records=filteredCompanyRecords();state.companyView.filtered=records;renderCompanyCards();renderCompanyHeader();
    const prices=records.map(r=>Number(r.item.userPrice)).filter(v=>Number.isFinite(v)&&v>0),periods=records.map(r=>validPeriod(r.item.maxPeriod)).filter(v=>v!==null),requests=new Set(records.map(r=>r.rowIndex));els.companyCountMetric.textContent=String(records.length);els.companyRequestsMetric.textContent=String(requests.size);els.companyMinPriceMetric.textContent=prices.length?`${formatValue(Math.min(...prices))} ₽`:'—';els.companyAvgPriceMetric.textContent=prices.length?`${formatValue(round2(avg(prices)))} ₽`:'—';els.companyFastestMetric.textContent=periods.length?`${Math.min(...periods)} дн.`:'По запросу';
    $$('.company-sort-button').forEach(button=>{button.classList.toggle('active',button.dataset.companySort===state.companyView.sortKey);button.classList.toggle('asc',button.dataset.companySort===state.companyView.sortKey&&state.companyView.sortDir==='asc');button.classList.toggle('desc',button.dataset.companySort===state.companyView.sortKey&&state.companyView.sortDir==='desc');});
    const colCount=companyColumnOrder().length;
    if(!records.length){els.companyTariffsBody.innerHTML=`<tr><td colspan="${colCount}" class="empty-tariffs">По заданным фильтрам тарифы не найдены.</td></tr>`;return;}
    els.companyTariffsBody.innerHTML=records.map((record,index)=>`<tr>${companyColumnOrder().map(key=>companyCellMarkup(key,record,index)).join('')}</tr><tr class="tariff-details-row hidden" data-company-details-row="${index}"><td colspan="${colCount}">${tariffDetailsMarkup(record.item)}</td></tr>`).join('');
  }
  function activateCompanyPane(name) { state.companyView.pane=name;$$('[data-company-view]').forEach(b=>b.classList.toggle('active',b.dataset.companyView===name));$$('[data-company-pane]').forEach(p=>p.classList.toggle('active',p.dataset.companyPane===name));if(name==='compare'&&!state.analyticsDirty.comparison)renderComparison(false);if(name==='manager'&&!state.analyticsDirty.manager)renderManagerTable(false); }

  function round2(value){return Math.round((Number(value)||0)*100)/100;}
  function clampNumber(value,fallback,min,max){const number=Number(value);const safe=Number.isFinite(number)?number:fallback;return Math.min(max,Math.max(min,safe));}
  function avg(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
  function marginMetrics(item){const price=optionalNumeric(item?.userPrice,{positive:true}),input=optionalNumeric(item?.inputPrice,{nonNegative:true});if(price===null||input===null)return{marginRub:null,marginPct:null};const marginRub=price-input;return{marginRub,marginPct:marginRub/price*100};}
  function salesParams(preset='custom', source='comparison') {
    const modeSelect=source==='manager'?els.managerFloorModeSelect:els.comparisonFloorModeSelect;
    const percentInput=source==='manager'?els.managerFloorPercentInput:els.comparisonFloorPercentInput;
    const beatInput=source==='manager'?els.managerBeatMarketInput:els.salesBeatMarketInput;
    const fallbackMode=source==='manager'?state.settings.managerFloorMode:state.settings.salesFloorMode;
    const fallbackPercent=source==='manager'?state.settings.managerFloorPercent:state.settings.salesFloorPercent;
    const fallbackBeat=source==='manager'?state.settings.managerBeatMarketPct:state.settings.salesBeatMarketPct;
    if(preset==='close')return{floorMode:'strict',floorPercent:5,beat:2};
    if(preset==='balance')return{floorMode:'strict',floorPercent:10,beat:1};
    if(preset==='margin')return{floorMode:'ownMargin',floorPercent:15,beat:0};
    if(preset==='lk')return{floorMode:'lkPrice',floorPercent:0,beat:0};
    return {
      floorMode:modeSelect?.value||fallbackMode||'strict',
      floorPercent:clampNumber(percentInput?.value,Number.isFinite(Number(fallbackPercent))?Number(fallbackPercent):10,0,99),
      beat:clampNumber(beatInput?.value,Number.isFinite(Number(fallbackBeat))?Number(fallbackBeat):1,0,30)
    };
  }
  function analyticsMethodList(){return[...new Set(allCompanyRecords().map(({item})=>item.deliveryTypeLabel||item.deliveryMethodLabel||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));}
  function analyticsMethod(){
    const projectId=currentProjectId(),methods=analyticsMethodList(),stored=state.settings.analyticsMethodByProject?.[projectId]||'';
    if(methods.includes(stored))return stored;
    const preferred=methods.find(method=>normalize(method).includes('дверь')&&normalize(method).split('дверь').length>2)||methods[0]||'';
    state.settings.analyticsMethodByProject[projectId]=preferred;return preferred;
  }
  function populateAnalyticsMethodSelects(methods=analyticsMethodList()){
    const selected=analyticsMethod();
    const html=methods.length?methods.map(method=>`<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`).join(''):'<option value="">Нет методов</option>';
    [els.comparisonMethodSelect,els.managerMethodFilter].forEach(select=>{if(!select)return;select.innerHTML=html;select.value=methods.includes(selected)?selected:(methods[0]||'');});
  }
  function syncAnalyticsMethod(method){
    const methods=analyticsMethodList(),safe=methods.includes(method)?method:(methods[0]||'');
    state.settings.analyticsMethodByProject[currentProjectId()]=safe;
    [els.comparisonMethodSelect,els.managerMethodFilter].forEach(select=>{if(select&&[...select.options].some(option=>option.value===safe))select.value=safe;});
    normalizeAnalyticsSelections(safe);renderAnalyticsTariffPickers();persistSettings();return safe;
  }
  function tariffSignature(item){return[normalize(item?.urgencyLabel),normalize(item?.tariffCaption||item?.tariffName),normalize(item?.deliveryTypeLabel||item?.deliveryMethodLabel)].join('|');}
  function analyticsCatalog(method=analyticsMethod()){
    const catalog=new Map();
    state.rows.forEach((row,rowIndex)=>visibleTariffs(row.result?.allTariffs).forEach(item=>{
      const itemMethod=item.deliveryTypeLabel||item.deliveryMethodLabel||'';if(method&&itemMethod!==method)return;
      const company=item.deliveryCompanyLabel||'Неизвестная ТК',key=tariffSignature(item);
      if(!catalog.has(company))catalog.set(company,new Map());
      const map=catalog.get(company);if(!map.has(key))map.set(key,{key,item,count:0,routes:new Set()});
      const record=map.get(key);record.count+=1;record.routes.add(rowIndex);
    }));
    return catalog;
  }
  function analyticsSelectionStore(method=analyticsMethod()){
    const projectId=currentProjectId();state.settings.analyticsSelections[projectId]||={};state.settings.analyticsSelections[projectId][method]||={};return state.settings.analyticsSelections[projectId][method];
  }
  function normalizeAnalyticsSelections(method=analyticsMethod()){
    const catalog=analyticsCatalog(method),store=analyticsSelectionStore(method);
    catalog.forEach((tariffs,company)=>{
      const available=[...tariffs.keys()],saved=store[company];
      if(!saved||typeof saved!=='object')store[company]={enabled:true,tariffs:[...available]};
      else{
        saved.enabled=saved.enabled!==false;
        saved.tariffs=Array.isArray(saved.tariffs)?saved.tariffs.filter(key=>available.includes(key)):[];
        if(saved.enabled&&!saved.tariffs.length&&available.length)saved.tariffs=[available[0]];
      }
    });
    Object.keys(store).forEach(company=>{if(!catalog.has(company))delete store[company];});
    return{catalog,store};
  }
  function analyticsSelectionSummary(method=analyticsMethod()){
    const {catalog,store}=normalizeAnalyticsSelections(method);let companies=0,tariffs=0;
    catalog.forEach((_,company)=>{const selected=store[company];if(selected?.enabled){companies+=1;tariffs+=selected.tariffs.length;}});return{companies,tariffs};
  }
  function analyticsTariffOptionMarkup(record,company,selected){
    const item=record.item,urgency=String(item.urgencyLabel||'').trim(),tariff=tariffDisplayName(item),checked=selected.tariffs.includes(record.key);
    return`<label class="analytics-tariff-option"><input type="checkbox" data-analytics-company="${escapeHtml(company)}" data-analytics-tariff="${escapeHtml(record.key)}" ${checked?'checked':''} ${selected.enabled?'':'disabled'}><span class="analytics-tariff-copy">${urgency?`<span>${escapeHtml(urgency)}</span>`:''}<b>${escapeHtml(tariff)}</b><small>${record.routes.size} маршрут(ов) · ${record.count} предлож.</small></span></label>`;
  }
  function analyticsPickerMarkup(method=analyticsMethod()){
    const {catalog,store}=normalizeAnalyticsSelections(method);
    if(!catalog.size)return'<div class="empty-state">Для выбранного типа доставки нет рассчитанных тарифов.</div>';
    return[...catalog.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru')).map(([company,tariffs])=>{const selected=store[company],records=[...tariffs.values()].sort((a,b)=>urgencyRankLocal(a.item.urgencyLabel)-urgencyRankLocal(b.item.urgencyLabel)||tariffDisplayName(a.item).localeCompare(tariffDisplayName(b.item),'ru'));return`<section class="analytics-company-picker ${selected.enabled?'':'disabled'}"><label class="analytics-company-head"><input type="checkbox" data-analytics-company-enabled="${escapeHtml(company)}" ${selected.enabled?'checked':''}><b>${escapeHtml(company)}</b><small>${selected.tariffs.length}/${records.length}</small></label><div class="analytics-company-options">${records.map(record=>analyticsTariffOptionMarkup(record,company,selected)).join('')}</div></section>`;}).join('');
  }
  function urgencyRankLocal(label){const value=normalize(label);if(!value)return 90;if(value.includes('сверхсроч')||value.includes('super'))return 0;if(value.includes('сроч'))return 10;if(value.includes('экспресс')||value.includes('express'))return 20;if(value.includes('стандарт'))return 30;if(value.includes('эконом'))return 40;return 60;}
  function renderAnalyticsTariffPickers(){
    const method=analyticsMethod(),markup=analyticsPickerMarkup(method),summary=analyticsSelectionSummary(method),text=`(${summary.companies} ТК · ${summary.tariffs} тарифов · ${method||'нет типа доставки'})`;
    if(els.comparisonTariffPicker)els.comparisonTariffPicker.innerHTML=markup;
    if(els.managerTariffPicker)els.managerTariffPicker.innerHTML=markup;
    if(els.comparisonSelectionCount)els.comparisonSelectionCount.textContent=text;
    if(els.managerSelectionCount)els.managerSelectionCount.textContent=text;
    const {catalog,store}=normalizeAnalyticsSelections(method);
    const enabledCompanies=[...catalog.keys()].filter(company=>store[company]?.enabled).sort((a,b)=>a.localeCompare(b,'ru'));
    if(els.managerCompanyFilter){const previous=els.managerCompanyFilter.value;els.managerCompanyFilter.innerHTML='<option value="">Все выбранные ТК</option>'+enabledCompanies.map(company=>`<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');els.managerCompanyFilter.value=enabledCompanies.includes(previous)?previous:'';}
    if(els.managerBaseCompanyFilter){const previous=els.managerBaseCompanyFilter.value;els.managerBaseCompanyFilter.innerHTML='<option value="cheapest">Минимальная цена среди выбранных ТК</option>'+enabledCompanies.map(company=>`<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');els.managerBaseCompanyFilter.value=previous==='cheapest'||enabledCompanies.includes(previous)?previous:'cheapest';}
  }
  function markAnalyticsDirty(scope='both'){
    if(scope==='both'||scope==='comparison'){state.analyticsDirty.comparison=true;if(els.comparisonUpdatedAt){els.comparisonUpdatedAt.textContent='Настройки изменены — нажмите «Обновить графики»';els.comparisonUpdatedAt.classList.add('analytics-dirty');}}
    if(scope==='both'||scope==='manager'){state.analyticsDirty.manager=true;if(els.managerUpdatedAt){els.managerUpdatedAt.textContent='Настройки изменены — нажмите «Обновить аналитику»';els.managerUpdatedAt.classList.add('analytics-dirty');}}
  }
  function handleAnalyticsPickerChange(event){
    const method=analyticsMethod(),{catalog,store}=normalizeAnalyticsSelections(method),enabledInput=event.target.closest('[data-analytics-company-enabled]'),tariffInput=event.target.closest('[data-analytics-tariff]');
    if(enabledInput){const company=enabledInput.dataset.analyticsCompanyEnabled;if(store[company]){store[company].enabled=enabledInput.checked;if(enabledInput.checked&&!store[company].tariffs.length){const first=[...catalog.get(company).keys()][0];if(first)store[company].tariffs=[first];}}}
    if(tariffInput){const company=tariffInput.dataset.analyticsCompany,key=tariffInput.dataset.analyticsTariff,selected=store[company];if(!selected)return;const next=new Set(selected.tariffs);if(tariffInput.checked)next.add(key);else next.delete(key);if(selected.enabled&&!next.size){tariffInput.checked=true;toast('Для включённой ТК нужно оставить минимум один тариф','error');return;}selected.tariffs=[...next];if(tariffInput.checked)selected.enabled=true;}
    persistSettings();renderAnalyticsTariffPickers();markAnalyticsDirty('both');
  }
  function selectAnalyticsTariff(items,mode='cheapest'){
    const candidates=[...items].filter(item=>Number(item.userPrice)>0);if(!candidates.length)return null;
    candidates.sort((a,b)=>{const priceA=Number(a.userPrice)||Infinity,priceB=Number(b.userPrice)||Infinity,periodA=validPeriod(a.maxPeriod)??Infinity,periodB=validPeriod(b.maxPeriod)??Infinity,order=(Number(a.calculatorOrder)||0)-(Number(b.calculatorOrder)||0);if(mode==='fastest'||mode==='periodPrice')return periodA-periodB||priceA-priceB||order;return priceA-priceB||periodA-periodB||order;});return candidates[0];
  }
  function applyAnalyticsSelectionAction(action){
    const method=analyticsMethod(),{catalog,store}=normalizeAnalyticsSelections(method),mode=state.companyView.pane==='manager'?(els.managerTariffModeSelect?.value||'cheapest'):(els.comparisonTariffModeSelect?.value||'cheapest');
    catalog.forEach((tariffs,company)=>{const keys=[...tariffs.keys()];if(action==='clear'){store[company]={enabled:false,tariffs:keys.slice(0,1)};}else if(action==='all'){store[company]={enabled:true,tariffs:keys};}else{const chosen=selectAnalyticsTariff([...tariffs.values()].map(record=>record.item),mode),key=chosen?tariffSignature(chosen):keys[0];store[company]={enabled:true,tariffs:key?[key]:keys.slice(0,1)};}});
    persistSettings();renderAnalyticsTariffPickers();markAnalyticsDirty('both');toast(action==='all'?'Выбраны все тарифы':action==='clear'?'Все ТК исключены':'Для каждой ТК выбран один лучший тариф','success');
  }
  function selectedAnalyticsConfig(method=analyticsMethod()){const {store}=normalizeAnalyticsSelections(method);return store;}
  function bestRouteCompanyRecords(filters={}){
    const routeFilter=filters.route||'',method=filters.method||analyticsMethod(),mode=filters.tariffMode||'cheapest',periodMax=validPeriod(filters.periodMax),selection=selectedAnalyticsConfig(method),result=[];
    state.rows.forEach((row,rowIndex)=>{if(!row.result||!row.senderQuery||!row.recipientQuery)return;const route=routeKey(row);if(routeFilter&&route!==routeFilter)return;const grouped=new Map();visibleTariffs(row.result.allTariffs).forEach(item=>{const itemMethod=item.deliveryTypeLabel||item.deliveryMethodLabel||'';if(itemMethod!==method)return;const period=validPeriod(item.maxPeriod);if(periodMax!==null&&(period===null||period>periodMax))return;const price=Number(item.userPrice);if(!(price>0))return;const company=item.deliveryCompanyLabel||'Неизвестная ТК',config=selection[company];if(!config?.enabled||!config.tariffs.includes(tariffSignature(item)))return;if(!grouped.has(company))grouped.set(company,[]);grouped.get(company).push(item);});const selected=new Map();grouped.forEach((items,company)=>{const item=selectAnalyticsTariff(items,mode);if(item)selected.set(company,item);});const prices=[...selected.values()].map(item=>Number(item.userPrice)).filter(value=>value>0);selected.forEach((item,company)=>{const others=[...selected.entries()].filter(([name])=>name!==company).map(([,entry])=>Number(entry.userPrice)).filter(value=>value>0);result.push({row,rowIndex,route,company,item,marketMin:others.length?Math.min(...others):null,routeMarketMin:prices.length?Math.min(...prices):null});});});return result;
  }
  function priceFloorModel(model, params) {
    const ownMarginFloor=model.inputPrice!==null&&params.floorPercent<100?model.inputPrice/(1-params.floorPercent/100):null;
    const lkPriceFloor=model.minPrice;
    const lkPercentFloor=model.userPriceWithoutDiscount!==null&&model.minPricePercent!==null?model.userPriceWithoutDiscount*model.minPricePercent/100:null;
    const customPercentFloor=model.userPriceWithoutDiscount!==null?model.userPriceWithoutDiscount*params.floorPercent/100:null;
    const candidates=[];
    if(params.floorMode==='strict'){
      if(lkPriceFloor!==null)candidates.push({value:lkPriceFloor,label:'Минимум ЛК'});
      if(lkPercentFloor!==null)candidates.push({value:lkPercentFloor,label:'Минимальный процент ЛК'});
      if(ownMarginFloor!==null)candidates.push({value:ownMarginFloor,label:`Своя маржа ${formatValue(params.floorPercent)}%`});
    }else if(params.floorMode==='lkPrice'&&lkPriceFloor!==null)candidates.push({value:lkPriceFloor,label:'Минимум ЛК'});
    else if(params.floorMode==='lkPercent'&&lkPercentFloor!==null)candidates.push({value:lkPercentFloor,label:'Минимальный процент ЛК'});
    else if(params.floorMode==='customPercent'&&customPercentFloor!==null)candidates.push({value:customPercentFloor,label:`Свой минимум ${formatValue(params.floorPercent)}%`});
    else if(params.floorMode==='ownMargin'&&ownMarginFloor!==null)candidates.push({value:ownMarginFloor,label:`Своя маржа ${formatValue(params.floorPercent)}%`});
    if(!candidates.length)return{floorPrice:null,floorSource:'Нет данных для выбранного правила'};
    candidates.sort((a,b)=>b.value-a.value);
    return{floorPrice:candidates[0].value,floorSource:candidates[0].label};
  }
  function enrichSalesRecord(record, params) {
    const model=tariffPriceModel(record.item),price=model.userPrice;
    const marketGap=price!==null&&record.marketMin&&record.marketMin>0?(price-record.marketMin)/record.marketMin*100:null;
    const {floorPrice,floorSource}=priceFloorModel(model,params);
    const marketTarget=record.marketMin&&record.marketMin>0?record.marketMin*(1-params.beat/100):null;
    const currentBelowFloor=price!==null&&floorPrice!==null&&price<floorPrice;
    const safeDiscount=price!==null&&floorPrice!==null&&!currentBelowFloor?Math.max(0,(price-floorPrice)/price*100):currentBelowFloor?0:null;
    let recommendedPrice=null,recommendedDiscount=null,recommendationStatus='';
    if(price===null)recommendationStatus='Нет цены клиента';
    else if(floorPrice===null)recommendationStatus='Недостаточно данных для нижней границы';
    else if(currentBelowFloor){recommendedPrice=floorPrice;recommendationStatus='Цена ниже выбранной границы';}
    else{
      const target=marketTarget===null?price:Math.min(price,marketTarget);
      recommendedPrice=Math.max(floorPrice,target);
      recommendedDiscount=(price-recommendedPrice)/price*100;
      recommendationStatus=marketTarget===null?'Нет сопоставимой цены другой ТК':'Рекомендация рассчитана';
    }
    return {...record,price,priceWithoutDiscount:model.userPriceWithoutDiscount,input:model.inputPrice,inputPercent:model.inputPricePercent,
      minAllowedPrice:model.minPrice,minAllowedPercent:model.minPricePercent,retail:model.retailPrice,activeDiscount:model.activeDiscountPct,
      margin:model.marginRub,marginPct:model.marginPct,clientDiscount:model.clientDiscountPct,retailDiscount:model.retailDiscountPct,
      marketGap,marketTarget,floorPrice,floorSource,currentBelowFloor,safeDiscount,recommendedPrice,recommendedDiscount,recommendationStatus};
  }
  function averageOrNull(values){const list=values.filter(value=>Number.isFinite(value));return list.length?list.reduce((a,b)=>a+b,0)/list.length:null;}
  function comparisonFilters(){return{route:els.comparisonRouteSelect?.value||'',method:analyticsMethod(),tariffMode:els.comparisonTariffModeSelect?.value||'cheapest',periodMax:els.comparisonPeriodMax?.value||''};}
  function comparisonStats() {
    const params=salesParams('custom','comparison'),filters=comparisonFilters(),records=bestRouteCompanyRecords(filters).map(record=>enrichSalesRecord(record,params));
    const scopeRows=state.rows.map((row,rowIndex)=>({row,rowIndex})).filter(({row})=>row.result&&(!filters.route||routeKey(row)===filters.route)&&visibleTariffs(row.result.allTariffs).some(item=>(item.deliveryTypeLabel||item.deliveryMethodLabel||'')===filters.method));
    const groups=new Map();records.forEach(record=>{if(!groups.has(record.company))groups.set(record.company,[]);groups.get(record.company).push(record);});
    return [...groups.entries()].map(([company,items])=>{
      const values=key=>items.map(item=>item[key]).filter(value=>Number.isFinite(value));
      const prices=values('price'),periods=items.map(item=>validPeriod(item.item.maxPeriod)).filter(value=>value!==null);
      const services=items.map(item=>optionalNumeric(item.item.servicesPrice,{nonNegative:true})).filter(value=>value!==null);
      const wins=items.filter(item=>item.routeMarketMin&&item.price!==null&&Math.abs(item.price-item.routeMarketMin)<0.01).length;
      const coverage=key=>items.length?items.filter(item=>item[key]!==null&&Number.isFinite(item[key])).length/items.length*100:null;
      return {
        company,
        minPrice:prices.length?Math.min(...prices):null,
        avgPrice:averageOrNull(prices),
        maxPrice:prices.length?Math.max(...prices):null,
        avgPriceWithoutDiscount:averageOrNull(values('priceWithoutDiscount')),
        avgInput:averageOrNull(values('input')),
        avgMinAllowedPrice:averageOrNull(values('minAllowedPrice')),
        avgRetail:averageOrNull(values('retail')),
        bestPeriod:periods.length?Math.min(...periods):null,
        avgPeriod:averageOrNull(periods),
        avgMarginRub:averageOrNull(values('margin')),
        avgMarginPct:averageOrNull(values('marginPct')),
        avgRetailDiscount:averageOrNull(values('retailDiscount')),
        avgClientDiscount:averageOrNull(values('clientDiscount')),
        avgActiveDiscount:averageOrNull(values('activeDiscount')),
        marketGapPct:averageOrNull(values('marketGap')),
        safeDiscountPct:averageOrNull(values('safeDiscount')),
        recommendedPrice:averageOrNull(values('recommendedPrice')),
        recommendedDiscountPct:averageOrNull(values('recommendedDiscount')),
        avgServicesPrice:averageOrNull(services),
        winRatePct:items.length?wins/items.length*100:null,
        offersCount:items.length,
        coveragePct:scopeRows.length?new Set(items.map(item=>item.rowIndex)).size/scopeRows.length*100:null,
        records:items
      };
    });
  }
  function renderComparisonMetricSelector(){els.comparisonMetricFields.innerHTML=COMPARISON_METRICS.map(metric=>`<label data-tip="${escapeHtml(metric.tip)}"><input type="checkbox" value="${metric.key}"><span>${escapeHtml(metric.label)}</span></label>`).join('');setComparisonMetrics(state.settings.comparisonMetrics);}
  function setComparisonMetrics(keys){const selected=new Set(keys);els.comparisonMetricFields?.querySelectorAll('input').forEach(input=>{input.checked=selected.has(input.value);});if(els.comparisonMetricCount)els.comparisonMetricCount.textContent=`(${selected.size})`;}
  function selectedComparisonMetrics(){return[...els.comparisonMetricFields.querySelectorAll('input:checked')].map(input=>input.value);}
  function applyComparisonPreset(){const preset=els.comparisonPresetSelect.value;if(preset!=='custom')setComparisonMetrics(COMPARISON_PRESETS[preset]||COMPARISON_PRESETS.sale);comparisonMetricsChanged();}
  function comparisonMetricsChanged(){const selected=selectedComparisonMetrics();state.settings.comparisonMetrics=selected.length?selected:[...COMPARISON_PRESETS.sale];els.comparisonMetricCount.textContent=`(${state.settings.comparisonMetrics.length})`;els.comparisonPresetSelect.value=Object.entries(COMPARISON_PRESETS).find(([,keys])=>[...keys].sort().join('|')===[...state.settings.comparisonMetrics].sort().join('|'))?.[0]||'custom';persistSettings();markAnalyticsDirty('comparison');}
  function formatMetric(metric,value){if(!hasMetricValue(value))return isPeriodMetric(metric)?'По запросу':'—';const rounded=round2(value);return metric.unit==='₽'?`${formatValue(rounded)} ₽`:metric.unit==='%'?`${formatValue(rounded)}%`:metric.unit==='дн.'?`${formatValue(rounded)} дн.`:`${formatValue(rounded)} ${metric.unit}`;}
  function analyticsTimestamp(){return new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  function renderComparisonLegacy(markUpdated=false){
    if(!els.comparisonCharts)return;const method=syncAnalyticsMethod(els.comparisonMethodSelect?.value||analyticsMethod());
    state.settings.salesFloorMode=els.comparisonFloorModeSelect?.value||'strict';state.settings.salesFloorPercent=clampNumber(els.comparisonFloorPercentInput?.value,10,0,100);state.settings.salesBeatMarketPct=clampNumber(els.salesBeatMarketInput.value,1,0,30);state.settings.comparisonTariffMode=els.comparisonTariffModeSelect.value;state.settings.comparisonPeriodMax=validPeriod(els.comparisonPeriodMax.value)||'';persistSettings();
    const stats=comparisonStats(),keys=selectedComparisonMetrics(),calculatedRows=state.rows.filter(row=>row.result).length,selection=analyticsSelectionSummary(method);els.comparisonScopeNote.textContent=`Источник: ${calculatedRows} расчётов проекта ${projectDef().shortLabel} · ${method||'нет типа доставки'} · ${stats.length} ТК в графиках · ${selection.tariffs} выбранных тарифов`;
    if(markUpdated&&els.comparisonUpdatedAt){els.comparisonUpdatedAt.textContent=`Обновлено ${analyticsTimestamp()}`;els.comparisonUpdatedAt.classList.remove('analytics-dirty');els.comparisonUpdatedAt.closest('.analytics-auto-status')?.classList.remove('updating');els.comparisonUpdatedAt.closest('.analytics-auto-status')?.classList.add('updated');state.analyticsDirty.comparison=false;}
    if(!stats.length){els.comparisonCharts.innerHTML='<div class="empty-state">Нет данных для выбранных ТК, тарифов, метода и ограничений.</div>';return;}
    els.comparisonCharts.innerHTML=keys.map(key=>{const metric=COMPARISON_METRICS.find(item=>item.key===key);if(!metric)return'';const allRows=stats.map(stat=>({company:stat.company,value:stat[key]})),rows=allRows.filter(row=>hasMetricValue(row.value)),onRequest=isPeriodMetric(metric)?allRows.filter(row=>!hasMetricValue(row.value)):[];if(!rows.length&&!onRequest.length)return`<section class="comparison-chart-card"><h4>${escapeHtml(metric.label)} <span class="help" data-tip="${escapeHtml(metric.tip)}">?</span></h4><div class="empty-state">Нет данных</div></section>`;rows.sort((a,b)=>(metric.lowerBetter?a.value-b.value:b.value-a.value));const values=rows.map(row=>row.value),min=Math.min(...values),max=Math.max(...values),numeric=rows.map((row,index)=>{const width=max===min?100:18+82*(row.value-min)/(max-min);return`<div class="chart-row ${index===0?'best':''}"><div class="chart-label" title="${escapeHtml(row.company)}">${escapeHtml(row.company)}</div><div class="chart-track"><div class="chart-bar" style="width:${Math.max(3,width)}%"></div></div><div class="chart-value">${escapeHtml(formatMetric(metric,row.value))}</div></div>`;}).join(''),request=onRequest.map(row=>`<div class="chart-row on-request"><div class="chart-label">${escapeHtml(row.company)}</div><div class="chart-track"><div class="chart-bar"></div></div><div class="chart-value">По запросу</div></div>`).join('');return`<section class="comparison-chart-card"><h4>${escapeHtml(metric.label)} <span class="help" data-tip="${escapeHtml(metric.tip)}">?</span></h4><p>${escapeHtml(metric.tip)}</p>${numeric}${request}</section>`;}).join('');
  }
  function refreshComparisonAnalytics(showToast=false){renderComparison(true);if(showToast){const summary=analyticsSelectionSummary();toast(`Графики обновлены: ${state.rows.filter(row=>row.result).length} расчётов, ${summary.companies} ТК, ${summary.tariffs} тарифов`,'success');}}
  function comparisonAoa(){const stats=comparisonStats(),metrics=selectedComparisonMetrics().map(key=>COMPARISON_METRICS.find(metric=>metric.key===key)).filter(Boolean);return[['ТК',...metrics.map(metric=>metric.label)],...stats.map(stat=>[stat.company,...metrics.map(metric=>hasMetricValue(stat[metric.key])?round2(stat[metric.key]):isPeriodMetric(metric)?'По запросу':'')])];}
  async function copyComparison(){return copyAoa(comparisonAoa(),'Сравнение ТК скопировано');}
  function downloadComparisonXlsx(){const aoa=comparisonAoa();if(aoa.length<2){toast('Нет данных','error');return;}const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,makeWorksheet(aoa,38),'Сравнение ТК');XLSX.writeFile(workbook,`${filePrefix()}_сравнение_ТК.xlsx`,{compression:true});}
  function managerFilters(){return{route:els.managerRouteFilter?.value||'',method:analyticsMethod(),tariffMode:els.managerTariffModeSelect?.value||'cheapest',periodMax:els.managerPeriodMax?.value||''};}
  function applyManagerPreset(){
    const preset=els.managerPresetSelect.value,params=salesParams(preset,'manager');
    if(preset!=='custom'){
      els.managerFloorModeSelect.value=params.floorMode;
      els.managerFloorPercentInput.value=String(params.floorPercent);
      els.managerBeatMarketInput.value=String(params.beat);
    }
    markAnalyticsDirty('manager');
  }
  function buildManagerRows(presetOverride=''){const preset=presetOverride||els.managerPresetSelect?.value||'custom',params=salesParams(preset,'manager');return bestRouteCompanyRecords(managerFilters()).map(record=>enrichSalesRecord(record,params)).filter(record=>!els.managerCompanyFilter?.value||record.company===els.managerCompanyFilter.value).sort((a,b)=>a.route.localeCompare(b.route,'ru')||a.price-b.price);}
  function managerSalesColumns(rows=buildManagerRows()) {
    const any=key=>rows.some(record=>record[key]!==null&&record[key]!==undefined&&Number.isFinite(Number(record[key])));
    return [
      {key:'route',label:'Маршрут'}, {key:'cargo',label:'Груз'}, {key:'company',label:'ТК'},
      ...(usesUrgencyView()?[{key:'urgency',label:'Срочность'}]:[]),
      {key:'tariff',label:'Тариф'}, {key:'method',label:'Тип доставки'},
      {key:'period',label:'Макс. срок',tip:'Используется только максимальный срок. Нулевой срок отображается как «По запросу».'},
      {key:'price',label:'Цена клиента',tip:'Фактическая цена для клиента.'},
      ...(any('priceWithoutDiscount')?[{key:'priceWithoutDiscount',label:'Без скидки',tip:'Цена до текущей клиентской скидки.'}]:[]),
      ...(any('clientDiscount')?[{key:'clientDiscount',label:'Персональная скидка клиента',tip:'Дополнительная скидка конкретного клиента. 0% означает, что персональной скидки нет; активная скидка ЛК может быть ненулевой.'}]:[]),
      ...(any('activeDiscount')?[{key:'activeDiscount',label:'Активная скидка ЛК',tip:'Скидка, переданная личным кабинетом.'}]:[]),
      ...(any('input')?[{key:'input',label:'Вход',tip:'Себестоимость тарифа.'},{key:'marginPct',label:'Маржа, %',tip:'Доля разницы между ценой клиента и входом в цене клиента.'}]:[]),
      ...(any('minAllowedPrice')?[{key:'minAllowedPrice',label:'Мин. допустимая',tip:'Минимальная цена, переданная личным кабинетом.'}]:[]),
      ...(any('retail')?[{key:'retail',label:'Розница',tip:'Розничная цена.'},{key:'retailDiscount',label:'Скидка от розницы',tip:'Разница между розницей и ценой клиента.'}]:[]),
      {key:'marketMin',label:'Лучшая альтернатива',tip:'Лучшая цена другой выбранной ТК на том же маршруте и методе.'},
      {key:'marketGap',label:'Отклонение',tip:'Насколько текущая цена выше или ниже лучшей альтернативы.'},
      {key:'floorPrice',label:'Нижняя граница',tip:'Цена, ниже которой рекомендация не опускается по выбранному правилу.'},
      {key:'safeDiscount',label:'Запас для скидки',tip:'Сколько процентов можно снизить до нижней границы.'},
      {key:'recommendedPrice',label:'Рекомендованная цена',tip:'Цена с учётом рынка и нижней границы.'},
      {key:'recommendedDiscount',label:'Рекомендованная скидка',tip:'Снижение от текущей цены до рекомендуемой.'},
      {key:'status',label:'Вывод'}
    ];
  }
  function managerExportValue(record,key){
    const values={route:record.route,cargo:`${parsePositive(record.row.weight,.1)} кг · ${Math.round(parsePositive(record.row.seats,1))} м. · ${parsePositive(record.row.length,10)}×${parsePositive(record.row.width,10)}×${parsePositive(record.row.height,10)}`,
      company:record.company,urgency:record.item.urgencyLabel||'',tariff:tariffDisplayName(record.item),method:record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'',period:periodExportValue(record.item.maxPeriod),
      price:record.price,priceWithoutDiscount:record.priceWithoutDiscount,clientDiscount:record.clientDiscount,activeDiscount:record.activeDiscount,input:record.input,marginPct:record.marginPct,
      minAllowedPrice:record.minAllowedPrice,retail:record.retail,retailDiscount:record.retailDiscount,marketMin:record.marketMin,marketGap:record.marketGap,floorPrice:record.floorPrice,
      safeDiscount:record.safeDiscount,recommendedPrice:record.recommendedPrice,recommendedDiscount:record.recommendedDiscount,status:record.recommendationStatus};
    const value=values[key];return typeof value==='number'&&Number.isFinite(value)?round2(value):(value??'');
  }
  function managerRecommendationsAoa(rows=buildManagerRows()) {
    const columns=managerSalesColumns(rows);
    if(!columns.length)return[];
    return [columns.map(column=>column.label),...rows.map(record=>columns.map(column=>managerExportValue(record,column.key)))];
  }
  function managerMatrixModel(){const records=bestRouteCompanyRecords(managerFilters()),companies=[...new Set(records.map(record=>record.company))].sort((a,b)=>a.localeCompare(b,'ru')),groups=new Map();records.forEach(record=>{if(!groups.has(record.rowIndex))groups.set(record.rowIndex,{rowIndex:record.rowIndex,row:record.row,route:record.route,items:new Map()});groups.get(record.rowIndex).items.set(record.company,record.item);});return{companies,rows:[...groups.values()].sort((a,b)=>a.route.localeCompare(b.route,'ru')||a.rowIndex-b.rowIndex),selectedBase:els.managerBaseCompanyFilter?.value||'cheapest'};}
  function managerMatrixAoa(model=managerMatrixModel()){const headers=['Маршрут','Вес, кг','Мест','Габариты, см'];model.companies.forEach(company=>headers.push(`${company} — срочность`,`${company} — тариф`,`${company} — цена`,`${company} — отклонение, %`,`${company} — макс. срок`));const rows=model.rows.map(group=>{const prices=model.companies.map(company=>Number(group.items.get(company)?.userPrice)).filter(value=>Number.isFinite(value)&&value>0),baseItem=model.selectedBase==='cheapest'?null:group.items.get(model.selectedBase),basePrice=model.selectedBase==='cheapest'?(prices.length?Math.min(...prices):null):(Number(baseItem?.userPrice)>0?Number(baseItem.userPrice):null),values=[group.route,parsePositive(group.row.weight,.1),Math.round(parsePositive(group.row.seats,1)),`${parsePositive(group.row.length,10)}×${parsePositive(group.row.width,10)}×${parsePositive(group.row.height,10)}`];model.companies.forEach(company=>{const item=group.items.get(company),price=Number(item?.userPrice),pct=item&&price>0&&basePrice?round2((price-basePrice)/basePrice*100):'';values.push(item?.urgencyLabel||'',item?tariffDisplayName(item):'',item&&price>0?round2(price):'',pct,item?periodExportValue(item.maxPeriod):'');});return values;});return[headers,...rows];}
  function managerAoa(rows){if(Array.isArray(rows))return managerRecommendationsAoa(rows);return els.managerViewSelect?.value==='matrix'?managerMatrixAoa():managerRecommendationsAoa();}
  function managerCellMarkup(record,key){
    const gapClass=record.marketGap===null?'':record.marketGap<=0?'status-good':record.marketGap<=5?'status-warn':'status-bad';
    const cells={
      route:`<td class="route-cell">${escapeHtml(record.route)}</td>`,
      cargo:`<td>${escapeHtml(`${formatValue(parsePositive(record.row.weight,.1))} кг · ${Math.round(parsePositive(record.row.seats,1))} м. · ${formatValue(parsePositive(record.row.length,10))}×${formatValue(parsePositive(record.row.width,10))}×${formatValue(parsePositive(record.row.height,10))}`)}</td>`,
      company:`<td>${escapeHtml(record.company)}</td>`, urgency:`<td><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(record.item))}</span></td>`,
      tariff:`<td>${escapeHtml(tariffDisplayName(record.item))}</td>`, method:`<td>${escapeHtml(record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'—')}</td>`, period:`<td>${escapeHtml(formatTerm(record.item))}</td>`,
      price:`<td><b>${escapeHtml(moneyOrDash(record.price,{positive:true}))}</b></td>`, priceWithoutDiscount:`<td>${escapeHtml(moneyOrDash(record.priceWithoutDiscount,{positive:true}))}</td>`,
      clientDiscount:`<td>${escapeHtml(percentOrDash(record.clientDiscount))}</td>`, activeDiscount:`<td>${escapeHtml(percentOrDash(record.activeDiscount))}</td>`,
      input:`<td>${escapeHtml(moneyOrDash(record.input,{nonNegative:true}))}</td>`, marginPct:`<td>${escapeHtml(percentOrDash(record.marginPct))}</td>`,
      minAllowedPrice:`<td>${escapeHtml(moneyOrDash(record.minAllowedPrice,{positive:true}))}</td>`, retail:`<td>${escapeHtml(moneyOrDash(record.retail,{positive:true}))}</td>`, retailDiscount:`<td>${escapeHtml(percentOrDash(record.retailDiscount))}</td>`,
      marketMin:`<td>${escapeHtml(moneyOrDash(record.marketMin,{positive:true}))}</td>`, marketGap:`<td class="${gapClass}">${escapeHtml(percentOrDash(record.marketGap))}</td>`,
      floorPrice:`<td>${record.floorPrice===null?'—':`${escapeHtml(formatValue(round2(record.floorPrice)))} ₽`}<small class="cell-note">${escapeHtml(record.floorSource||'')}</small></td>`,
      safeDiscount:`<td>${escapeHtml(percentOrDash(record.safeDiscount))}</td>`, recommendedPrice:`<td><b>${record.recommendedPrice===null?'—':`${escapeHtml(formatValue(round2(record.recommendedPrice)))} ₽`}</b></td>`,
      recommendedDiscount:`<td>${escapeHtml(percentOrDash(record.recommendedDiscount))}</td>`, status:`<td><span class="recommendation-status ${record.recommendedPrice===null?'warn':'ok'}">${escapeHtml(record.recommendationStatus)}</span></td>`
    };
    return cells[key]||'<td>—</td>';
  }
  function renderManagerRecommendations() {
    const rows=buildManagerRows(),calculatedRows=state.rows.filter(row=>row.result).length;
    const cards=[['Источник',`${calculatedRows} расчётов`],['Маршрутов',String(new Set(rows.map(record=>record.rowIndex)).size)],['ТК',String(new Set(rows.map(record=>record.company)).size)],
      ['Средняя персональная скидка клиента',percentOrDash(averageOrNull(rows.map(record=>record.clientDiscount)))],['Средняя активная скидка',percentOrDash(averageOrNull(rows.map(record=>record.activeDiscount)))],
      ['Средняя скидка от розницы',percentOrDash(averageOrNull(rows.map(record=>record.retailDiscount)))],
      ['Средняя маржа',percentOrDash(averageOrNull(rows.map(record=>record.marginPct)))],['Среднее отклонение от рынка',percentOrDash(averageOrNull(rows.map(record=>record.marketGap)))],
      ['Средний запас для скидки',percentOrDash(averageOrNull(rows.map(record=>record.safeDiscount)))]].filter(([,value])=>value!=='—');
    els.managerSummary.innerHTML=cards.map(([label,value])=>`<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');
    const columns=managerSalesColumns(rows);
    els.managerTableHead.innerHTML=`<tr>${columns.map(column=>`<th${column.tip?` data-tip="${escapeHtml(column.tip)}"`:''}>${escapeHtml(column.label)}</th>`).join('')}</tr>`;
    if(!rows.length){els.managerTableBody.innerHTML=`<tr><td colspan="${columns.length}" class="empty-tariffs">Нет данных по текущим расчётам и выбранным ТК/тарифам.</td></tr>`;return;}
    els.managerTableBody.innerHTML=rows.map(record=>`<tr>${columns.map(column=>managerCellMarkup(record,column.key)).join('')}</tr>`).join('');
  }
  function renderManagerMatrix(){const model=managerMatrixModel(),spreads=[],wins=new Map(),useUrgency=usesUrgencyView();model.rows.forEach(group=>{const entries=model.companies.map(company=>({company,price:Number(group.items.get(company)?.userPrice)})).filter(entry=>Number.isFinite(entry.price)&&entry.price>0);if(entries.length){const min=Math.min(...entries.map(entry=>entry.price)),max=Math.max(...entries.map(entry=>entry.price));if(min>0)spreads.push((max-min)/min*100);entries.filter(entry=>entry.price===min).forEach(entry=>wins.set(entry.company,(wins.get(entry.company)||0)+1));}});const leader=[...wins.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ru'))[0];els.managerSummary.innerHTML=`<div class="metric"><span>Источник</span><b>${state.rows.filter(row=>row.result).length} расчётов</b></div><div class="metric"><span>Маршрутов</span><b>${model.rows.length}</b></div><div class="metric"><span>ТК</span><b>${model.companies.length}</b></div><div class="metric"><span>Средний разброс цен</span><b>${spreads.length?`${formatValue(round2(averageOrNull(spreads)))}%`:'—'}</b></div><div class="metric"><span>Чаще дешевле</span><b>${leader?`${escapeHtml(leader[0])} · ${leader[1]}`:'—'}</b></div>`;const baseLabel=model.selectedBase==='cheapest'?'к минимуму':`к ${model.selectedBase}`,perCompany=useUrgency?5:4;els.managerTableHead.innerHTML=`<tr><th rowspan="2">Маршрут</th><th rowspan="2">Вес</th><th rowspan="2">Мест</th><th rowspan="2">Габариты</th>${model.companies.map(company=>`<th colspan="${perCompany}">${escapeHtml(company)}</th>`).join('')}</tr><tr>${model.companies.map(()=>`${useUrgency?'<th>Срочность</th>':''}<th>Тариф</th><th>Цена</th><th data-tip="(Цена ТК − базовая цена) / базовая цена × 100">Δ ${escapeHtml(baseLabel)}, %</th><th data-tip="Только максимальный срок; 0 отображается как «По запросу»">Макс. срок</th>`).join('')}</tr>`;if(!model.rows.length){els.managerTableBody.innerHTML=`<tr><td colspan="${4+model.companies.length*perCompany}" class="empty-tariffs">Нет данных по текущим расчётам и выбранным ТК/тарифам.</td></tr>`;return;}els.managerTableBody.innerHTML=model.rows.map(group=>{const prices=model.companies.map(company=>Number(group.items.get(company)?.userPrice)).filter(value=>Number.isFinite(value)&&value>0),baseItem=model.selectedBase==='cheapest'?null:group.items.get(model.selectedBase),basePrice=model.selectedBase==='cheapest'?(prices.length?Math.min(...prices):null):(Number(baseItem?.userPrice)>0?Number(baseItem.userPrice):null),cells=model.companies.map(company=>{const item=group.items.get(company),price=Number(item?.userPrice);if(!item||!(price>0))return`${useUrgency?'<td>—</td>':''}<td>—</td><td>—</td><td>—</td><td>—</td>`;const pct=basePrice?(price-basePrice)/basePrice*100:null,cls=pct===null?'':pct<=0?'status-good':pct<=5?'status-warn':'status-bad';return`${useUrgency?`<td><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(item))}</span></td>`:''}<td>${escapeHtml(tariffDisplayName(item))}</td><td><b>${escapeHtml(formatValue(price))} ₽</b></td><td class="${cls}">${pct===null?'—':`${escapeHtml(formatValue(round2(pct)))}%`}</td><td>${escapeHtml(formatTerm(item))}</td>`;}).join('');return`<tr><td>${escapeHtml(group.route)}</td><td>${escapeHtml(formatValue(parsePositive(group.row.weight,.1)))}</td><td>${Math.round(parsePositive(group.row.seats,1))}</td><td>${escapeHtml(`${formatValue(parsePositive(group.row.length,10))}×${formatValue(parsePositive(group.row.width,10))}×${formatValue(parsePositive(group.row.height,10))}`)}</td>${cells}</tr>`;}).join('');}
  function renderManagerTable(markUpdated=false){if(!els.managerTableBody)return;syncAnalyticsMethod(els.managerMethodFilter?.value||analyticsMethod());const matrix=els.managerViewSelect?.value==='matrix';els.managerCompanyFilterLabel?.classList.toggle('hidden',matrix);els.managerPresetLabel?.classList.toggle('hidden',matrix);els.managerFloorModeLabel?.classList.toggle('hidden',matrix);els.managerFloorPercentLabel?.classList.toggle('hidden',matrix);els.managerBeatMarketLabel?.classList.toggle('hidden',matrix);els.managerBaseCompanyLabel?.classList.toggle('hidden',!matrix);state.settings.managerView=matrix?'matrix':'recommendations';state.settings.managerBaseCompany=els.managerBaseCompanyFilter?.value||'cheapest';state.settings.managerTariffMode=els.managerTariffModeSelect?.value||'cheapest';state.settings.managerPeriodMax=validPeriod(els.managerPeriodMax?.value)||'';state.settings.managerMethod=analyticsMethod();state.settings.managerPreset=els.managerPresetSelect?.value||'custom';state.settings.managerFloorMode=els.managerFloorModeSelect?.value||'strict';state.settings.managerFloorPercent=clampNumber(els.managerFloorPercentInput?.value,10,0,100);state.settings.managerBeatMarketPct=clampNumber(els.managerBeatMarketInput?.value,1,0,30);persistSettings();if(matrix)renderManagerMatrix();else renderManagerRecommendations();if(markUpdated&&els.managerUpdatedAt){els.managerUpdatedAt.textContent=`Обновлено ${analyticsTimestamp()}`;els.managerUpdatedAt.classList.remove('analytics-dirty');els.managerUpdatedAt.closest('.analytics-auto-status')?.classList.remove('updating');els.managerUpdatedAt.closest('.analytics-auto-status')?.classList.add('updated');state.analyticsDirty.manager=false;}}
  function refreshManagerAnalytics(showToast=false){renderManagerTable(true);if(showToast){const summary=analyticsSelectionSummary();toast(`Аналитика обновлена: ${state.rows.filter(row=>row.result).length} расчётов, ${summary.companies} ТК, ${summary.tariffs} тарифов`,'success');}}
  async function copyManager(){return copyAoa(managerAoa(),els.managerViewSelect?.value==='matrix'?'Матрица ТК скопирована':'Аналитическая таблица скопирована');}
  function downloadManagerXlsx(){const recommendations=managerRecommendationsAoa(),matrix=managerMatrixAoa(),comparison=comparisonAoa();if(recommendations.length<2&&matrix.length<2){toast('Нет данных','error');return;}const workbook=XLSX.utils.book_new();if(recommendations.length>1)XLSX.utils.book_append_sheet(workbook,makeWorksheet(recommendations,45),'Рекомендации');if(matrix.length>1)XLSX.utils.book_append_sheet(workbook,makeWorksheet(matrix,30),'Матрица ТК');if(comparison.length>1)XLSX.utils.book_append_sheet(workbook,makeWorksheet(comparison,38),'Сравнение ТК');XLSX.writeFile(workbook,`${filePrefix()}_аналитика.xlsx`,{compression:true});}

  function companyFilterTariffKey(item) {
    return `${normalize(item?.deliveryCompanyLabel)}::${tariffSignature(item)}`;
  }
  function setSelectOptions(select, values, allLabel, preserve = true) {
    if (!select) return;
    const previous = preserve ? select.value : '';
    select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    select.value = values.includes(previous) ? previous : '';
  }
  function populateCompanyFacetFilters(records = allCompanyRecords(), resetSelection = false) {
    const companies=[...new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК'))].sort((a,b)=>a.localeCompare(b,'ru'));
    const allTariffMap=new Map();
    records.forEach(record=>{
      const key=companyFilterTariffKey(record.item);
      if(!allTariffMap.has(key))allTariffMap.set(key,{key,company:record.item.deliveryCompanyLabel||'Неизвестная ТК',urgency:String(record.item.urgencyLabel||'').trim(),tariff:tariffDisplayName(record.item),method:record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||''});
    });
    const tariffKeys=new Set(allTariffMap.keys());
    if(resetSelection||!state.companyView.filtersReady){state.companyView.selectedCompanies=new Set(companies);state.companyView.selectedTariffs=new Set(tariffKeys);state.companyView.filtersReady=true;}
    else{
      state.companyView.selectedCompanies=new Set([...state.companyView.selectedCompanies].filter(value=>companies.includes(value)));
      state.companyView.selectedTariffs=new Set([...state.companyView.selectedTariffs].filter(value=>tariffKeys.has(value)));
    }
    els.companyCompanyFilterOptions.innerHTML=companies.map(company=>`<label><input type="checkbox" data-company-facet="company" value="${escapeHtml(company)}" ${state.companyView.selectedCompanies.has(company)?'checked':''}><span>${escapeHtml(company)}</span></label>`).join('')||'<div class="empty-state">Нет ТК</div>';
    const visibleTariffOptions=[...allTariffMap.values()].filter(item=>state.companyView.selectedCompanies.has(item.company));
    els.companyTariffFilterOptions.innerHTML=visibleTariffOptions.sort((a,b)=>a.company.localeCompare(b.company,'ru')||urgencyRankLocal(a.urgency)-urgencyRankLocal(b.urgency)||a.tariff.localeCompare(b.tariff,'ru')).map(item=>{
      const title=[item.company,item.urgency,item.tariff,item.method].filter(Boolean).join(' · ');
      return `<label><input type="checkbox" data-company-facet="tariff" value="${escapeHtml(item.key)}" ${state.companyView.selectedTariffs.has(item.key)?'checked':''}><span title="${escapeHtml(title)}"><b>${escapeHtml(item.company)}</b>${item.urgency?`<small>${escapeHtml(item.urgency)}</small>`:''}<span>${escapeHtml(item.tariff)}</span><small>${escapeHtml(item.method)}</small></span></label>`;
    }).join('')||'<div class="choice-filter-empty">Сначала выберите хотя бы одну ТК.</div>';
    updateCompanyFacetSummaries(companies.length, visibleTariffOptions.length);
    const available=records.filter(record=>state.companyView.selectedCompanies.has(record.item.deliveryCompanyLabel||'Неизвестная ТК')&&state.companyView.selectedTariffs.has(companyFilterTariffKey(record.item)));
    setSelectOptions(els.companyRouteFilter,[...new Set(available.map(record=>routeKey(record.row)))].sort((a,b)=>a.localeCompare(b,'ru')),'Все рассчитанные направления');
    setSelectOptions(els.companyUrgencyFilter,[...new Set(available.map(record=>String(record.item.urgencyLabel||'').trim()).filter(Boolean))].sort((a,b)=>urgencyRankLocal(a)-urgencyRankLocal(b)||a.localeCompare(b,'ru')),'Все рассчитанные срочности');
    setSelectOptions(els.companyMethodFilter,[...new Set(available.map(record=>record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')),'Все рассчитанные методы');
  }
  function updateCompanyFacetSummaries(totalCompanies=null,totalVisibleTariffs=null) {
    const allRecords=allCompanyRecords();
    const companies=totalCompanies??new Set(allRecords.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК')).size;
    const tariffs=totalVisibleTariffs??new Set(allRecords.filter(record=>state.companyView.selectedCompanies.has(record.item.deliveryCompanyLabel||'Неизвестная ТК')).map(record=>companyFilterTariffKey(record.item))).size;
    const selectedCompanies=state.companyView.selectedCompanies.size;
    const selectedTariffs=new Set([...state.companyView.selectedTariffs].filter(key=>allRecords.some(record=>state.companyView.selectedCompanies.has(record.item.deliveryCompanyLabel||'Неизвестная ТК')&&companyFilterTariffKey(record.item)===key))).size;
    if(els.companyCompanyFilterSummary)els.companyCompanyFilterSummary.textContent=selectedCompanies===companies?`Все · ${companies}`:`${selectedCompanies} из ${companies}`;
    if(els.companyTariffFilterSummary)els.companyTariffFilterSummary.textContent=selectedTariffs===tariffs?`Все · ${tariffs}`:`${selectedTariffs} из ${tariffs}`;
  }
  function handleCompanyFacetChange(event) {
    const input=event.target.closest('input[data-company-facet]');if(!input)return;
    if(input.dataset.companyFacet==='company'){
      const company=input.value;
      if(input.checked){
        state.companyView.selectedCompanies.add(company);
        allCompanyRecords().filter(record=>(record.item.deliveryCompanyLabel||'Неизвестная ТК')===company).forEach(record=>state.companyView.selectedTariffs.add(companyFilterTariffKey(record.item)));
      }else state.companyView.selectedCompanies.delete(company);
    }else{
      if(input.checked)state.companyView.selectedTariffs.add(input.value);else state.companyView.selectedTariffs.delete(input.value);
    }
    populateCompanyFacetFilters(allCompanyRecords(),false);renderCompanyView();
  }
  function applyCompanyFacetAction(action) {
    const records=allCompanyRecords();
    if(action==='companies-all')state.companyView.selectedCompanies=new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК'));
    if(action==='companies-none')state.companyView.selectedCompanies.clear();
    if(action==='tariffs-all')state.companyView.selectedTariffs=new Set(records.filter(record=>state.companyView.selectedCompanies.has(record.item.deliveryCompanyLabel||'Неизвестная ТК')).map(record=>companyFilterTariffKey(record.item)));
    if(action==='tariffs-none')state.companyView.selectedTariffs.clear();
    populateCompanyFacetFilters(records,false);renderCompanyView();
  }
  function openCompanyModal() {
    const records = allCompanyRecords();
    if (!records.length) { toast('Сначала выполните хотя бы один расчёт','error'); return; }
    const companies=[...new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК'))].sort((a,b)=>a.localeCompare(b,'ru'));
    const methods=analyticsMethodList(),routes=routeOptions();
    const companyOptions='<option value="">Все ТК</option>'+companies.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    const routeOptionsHtml='<option value="">Все направления</option>'+routes.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    els.companySelect.innerHTML=companyOptions;els.managerCompanyFilter.innerHTML=companyOptions;els.managerBaseCompanyFilter.innerHTML='<option value="cheapest">Самая низкая цена в строке</option>'+companies.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    els.comparisonRouteSelect.innerHTML=routeOptionsHtml;els.managerRouteFilter.innerHTML=routeOptionsHtml;populateAnalyticsMethodSelects(methods);
    els.managerViewSelect.value=state.settings.managerView||'recommendations';els.managerBaseCompanyFilter.value=[...els.managerBaseCompanyFilter.options].some(option=>option.value===state.settings.managerBaseCompany)?state.settings.managerBaseCompany:'cheapest';
    els.comparisonTariffModeSelect.value=state.settings.comparisonTariffMode||'cheapest';els.comparisonPeriodMax.value=state.settings.comparisonPeriodMax||'';
    els.managerTariffModeSelect.value=state.settings.managerTariffMode||'cheapest';els.managerPeriodMax.value=state.settings.managerPeriodMax||'';
    els.managerPresetSelect.value=state.settings.managerPreset||'custom';els.managerFloorModeSelect.value=state.settings.managerFloorMode||'strict';els.managerFloorPercentInput.value=String(state.settings.managerFloorPercent??10);els.managerBeatMarketInput.value=String(state.settings.managerBeatMarketPct||1);els.comparisonFloorModeSelect.value=state.settings.salesFloorMode||'strict';els.comparisonFloorPercentInput.value=String(state.settings.salesFloorPercent??10);els.salesBeatMarketInput.value=String(state.settings.salesBeatMarketPct||1);
    syncAnalyticsMethod(analyticsMethod());setComparisonMetrics(state.settings.comparisonMetrics);renderAnalyticsTariffPickers();
    state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';state.companyView.advanced=false;els.advancedCompanyViewToggle.checked=false;applyAdvancedTableMode(els.companyModal,false);
    resetCompanyFilters(false);populateCompanyFacetFilters(records,true);renderCompanyCards(records);renderCompanyView();
    renderComparison(true);renderManagerTable(true);analyticsPendingScopes.clear();activateCompanyPane('tariffs');els.companyModal.classList.add('open');els.companyModal.setAttribute('aria-hidden','false');
  }
  function resetCompanyFilters(render=true) {
    els.companySelect.value='';els.companyRouteFilter.value='';els.companyUrgencyFilter.value='';els.companySearchInput.value='';els.companyMethodFilter.value='';els.companyPriceMin.value='';els.companyPriceMax.value='';els.companyPeriodMax.value='';state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';
    populateCompanyFacetFilters(allCompanyRecords(),true);if(render)renderCompanyView();
  }
  function filteredCompanyRecords() {
    const route=els.companyRouteFilter.value,urgency=els.companyUrgencyFilter?.value||'',query=normalize(els.companySearchInput.value),method=els.companyMethodFilter.value,priceMin=numericFilterValue(els.companyPriceMin),priceMax=numericFilterValue(els.companyPriceMax),periodMax=numericFilterValue(els.companyPeriodMax);
    const records=allCompanyRecords().filter(({row,item})=>{
      const company=item.deliveryCompanyLabel||'Неизвестная ТК',key=companyFilterTariffKey(item),search=normalize([company,item.tariffCaption,item.tariffName,item.urgencyLabel,item.deliveryMethodLabel,item.deliveryTypeLabel].join(' ')),price=optionalNumeric(item.userPrice,{positive:true}),period=validPeriod(item.maxPeriod);
      return state.companyView.selectedCompanies.has(company)&&state.companyView.selectedTariffs.has(key)&&(!route||routeKey(row)===route)&&(!urgency||String(item.urgencyLabel||'')===urgency)&&(!query||search.includes(query))&&(!method||(item.deliveryTypeLabel||item.deliveryMethodLabel)===method)&&(priceMin===null||(price!==null&&price>=priceMin))&&(priceMax===null||(price!==null&&price<=priceMax))&&(periodMax===null||(period!==null&&period<=periodMax));
    });
    const direction=state.companyView.sortDir==='desc'?-1:1,key=state.companyView.sortKey;records.sort((a,b)=>{let av,bv;if(key==='requestNo'){av=a.rowIndex;bv=b.rowIndex;}else if(key==='route'){av=routeKey(a.row);bv=routeKey(b.row);}else{av=a.item[key];bv=b.item[key];}if(key==='maxPeriod')return((validPeriod(av)??Infinity)-(validPeriod(bv)??Infinity))*direction;if(['requestNo','userPrice','inputPrice','retailPrice','discount'].includes(key)){const an=optionalNumeric(av),bn=optionalNumeric(bv);return((an??Infinity)-(bn??Infinity))*direction;}return String(av||'').localeCompare(String(bv||''),'ru')*direction;});return records;
  }
  function renderCompanyCards(records = allCompanyRecords()) {
    const groups=new Map();records.forEach(record=>{const name=record.item.deliveryCompanyLabel||'Неизвестная ТК';if(!groups.has(name))groups.set(name,{count:0,prices:[],requests:new Set()});const group=groups.get(name);group.count+=1;const price=optionalNumeric(record.item.userPrice,{positive:true});if(price!==null)group.prices.push(price);group.requests.add(record.rowIndex);});
    els.companyCards.innerHTML=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru')).map(([name,group])=>{const min=group.prices.length?Math.min(...group.prices):null,active=state.companyView.selectedCompanies.has(name);return`<button class="company-card ${active?'active':'muted'}" data-company-card="${escapeHtml(name)}" data-tip="Нажмите, чтобы оставить только эту ТК; повторное нажатие вернёт все ТК"><span>${escapeHtml(name)}</span><b>${group.count} тарифов</b><small>${group.requests.size} запросов · ${min===null?'цена не передана':`от ${escapeHtml(formatValue(min))} ₽`}</small></button>`;}).join('');
  }
  function handleCompanyCardClick(event) {
    const card=event.target.closest('[data-company-card]');if(!card)return;
    const company=card.dataset.companyCard,records=allCompanyRecords(),all=[...new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК'))];
    if(state.companyView.selectedCompanies.size===1&&state.companyView.selectedCompanies.has(company))state.companyView.selectedCompanies=new Set(all);else state.companyView.selectedCompanies=new Set([company]);
    records.filter(record=>state.companyView.selectedCompanies.has(record.item.deliveryCompanyLabel||'Неизвестная ТК')).forEach(record=>state.companyView.selectedTariffs.add(companyFilterTariffKey(record.item)));
    populateCompanyFacetFilters(records,false);renderCompanyView();
  }
  function companyFileName(extension) {
    const companies=[...state.companyView.selectedCompanies];const label=companies.length===1?companies[0]:companies.length?`${companies.length}_ТК`:'без_ТК';return `${filePrefix()}_обзор_${label.replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,60)}.${extension}`;
  }

  let analyticsAutoRefreshTimer = null;
  const analyticsPendingScopes = new Set();
  function markAnalyticsDirty(scope='both') {
    const updateStatus=(element,text)=>{if(!element)return;element.textContent=text;element.classList.add('analytics-dirty');const box=element.closest('.analytics-auto-status');box?.classList.add('updating');box?.classList.remove('updated');};
    if(scope==='both'||scope==='comparison'){state.analyticsDirty.comparison=true;analyticsPendingScopes.add('comparison');updateStatus(els.comparisonUpdatedAt,'Перестраиваем…');}
    if(scope==='both'||scope==='manager'){state.analyticsDirty.manager=true;analyticsPendingScopes.add('manager');updateStatus(els.managerUpdatedAt,'Пересчитываем…');}
    clearTimeout(analyticsAutoRefreshTimer);
    analyticsAutoRefreshTimer=setTimeout(()=>{
      if(!els.companyModal?.classList.contains('open'))return;
      const refreshComparison=analyticsPendingScopes.has('comparison');
      const refreshManager=analyticsPendingScopes.has('manager');
      analyticsPendingScopes.clear();
      if(refreshComparison)renderComparison(true);
      if(refreshManager)renderManagerTable(true);
      const summary=analyticsSelectionSummary(),parts=[];
      if(refreshComparison)parts.push('графики');if(refreshManager)parts.push('таблица');
      if(parts.length)toast(`${parts.join(' и ')} обновлены · ${summary.companies} ТК · ${summary.tariffs} тарифов`,'success');
    },520);
  }


  /* ===== v1.9 urgency-aware XLSX exports ===== */
  function exportUrgencyLabel(item) {
    return String(item?.urgencyLabel || '').trim() || 'Без срочности';
  }
  function sortUrgencyExportRecords(records) {
    return [...records].sort((a,b)=>{
      const ai=a.item||a, bi=b.item||b;
      return urgencyRankLocal(exportUrgencyLabel(ai))-urgencyRankLocal(exportUrgencyLabel(bi))
        || exportUrgencyLabel(ai).localeCompare(exportUrgencyLabel(bi),'ru')
        || tariffDisplayName(ai).localeCompare(tariffDisplayName(bi),'ru')
        || String(ai.deliveryTypeLabel||ai.deliveryMethodLabel||'').localeCompare(String(bi.deliveryTypeLabel||bi.deliveryMethodLabel||''),'ru')
        || (optionalNumeric(ai.userPrice,{positive:true})??Infinity)-(optionalNumeric(bi.userPrice,{positive:true})??Infinity)
        || (Number(ai.calculatorOrder)||0)-(Number(bi.calculatorOrder)||0);
    });
  }
  function buildUrgencyGroupedTariffsAoa(records, fields = selectedTariffFields()) {
    const groups=new Map();
    sortUrgencyExportRecords(records).forEach(record=>{
      const label=exportUrgencyLabel(record.item);
      if(!groups.has(label))groups.set(label,[]);
      groups.get(label).push(record);
    });
    const aoa=[];
    groups.forEach((items,label)=>{
      aoa.push([`Срочность: ${label}`]);
      aoa.push(fields.map(field=>field.label));
      items.forEach(({row,rowIndex,item})=>aoa.push(fields.map(field=>tariffFieldValue(field.key,item,row,rowIndex))));
      aoa.push([]);
    });
    if(aoa.length&&aoa.at(-1).length===0)aoa.pop();
    return aoa;
  }
  function makeGroupedTariffsWorksheet(aoa,maxWidth=55){
    const worksheet=XLSX.utils.aoa_to_sheet(aoa);
    const maxColumns=Math.max(0,...aoa.map(row=>row.length));
    worksheet['!freeze']={xSplit:0,ySplit:0};
    worksheet['!cols']=Array.from({length:maxColumns},(_,index)=>({wch:Math.min(maxWidth,Math.max(10,...aoa.slice(0,160).map(row=>String(row[index]??'').length+2)))}));
    const merges=[];
    aoa.forEach((row,rowIndex)=>{if(row.length===1&&String(row[0]||'').startsWith('Срочность:')&&maxColumns>1)merges.push({s:{r:rowIndex,c:0},e:{r:rowIndex,c:maxColumns-1}});});
    if(merges.length)worksheet['!merges']=merges;
    return worksheet;
  }
  function buildTariffsAoaForRow(row, tariffs = row.result?.allTariffs || []) {
    const rowIndex=Math.max(0,state.rows.indexOf(row)),fields=selectedTariffFields();
    const records=visibleTariffs(tariffs).map(item=>({row,rowIndex,item}));
    return usesUrgencyView()?buildUrgencyGroupedTariffsAoa(records,fields):[fields.map(field=>field.label),...records.map(({item})=>fields.map(field=>tariffFieldValue(field.key,item,row,rowIndex)))];
  }
  function buildCompanyWideModel(company) {
    const selected=selectedTariffFields();
    let requestFields=selected.filter(field=>field.scope==='request');
    let tariffFields=selected.filter(field=>field.scope==='tariff'&&field.key!=='company'&&field.key!=='urgency');
    if(!requestFields.length)requestFields=selectedDefinitions(TARIFF_EXPORT_FIELDS,['requestNo','senderQuery','recipientQuery']);
    if(!tariffFields.length)tariffFields=selectedDefinitions(TARIFF_EXPORT_FIELDS,['tariffCaption','method','maxPeriod','userPrice']);
    const records=flattenTariffs(state.rows,company),variantsMap=new Map();
    records.forEach(({item})=>{const key=`${exportUrgencyLabel(item)}::${tariffVariantKey(item)}`;if(!variantsMap.has(key))variantsMap.set(key,item);});
    const variants=[...variantsMap.entries()].sort((a,b)=>urgencyRankLocal(exportUrgencyLabel(a[1]))-urgencyRankLocal(exportUrgencyLabel(b[1]))||exportUrgencyLabel(a[1]).localeCompare(exportUrgencyLabel(b[1]),'ru')||tariffDisplayName(a[1]).localeCompare(tariffDisplayName(b[1]),'ru')||(Number(a[1].deliveryMethod)||0)-(Number(b[1].deliveryMethod)||0));
    const urgencyMode=usesUrgencyView(),headerRows=urgencyMode?3:2,row0=[],row1=[],row2=[];
    if(requestFields.length){row0.push('Запрос',...new Array(requestFields.length-1).fill(''));if(urgencyMode)row1.push(...new Array(requestFields.length).fill(''));(urgencyMode?row2:row1).push(...requestFields.map(field=>field.label));}
    if(urgencyMode){
      const urgencyGroups=new Map();variants.forEach(([key,item])=>{const label=exportUrgencyLabel(item);if(!urgencyGroups.has(label))urgencyGroups.set(label,[]);urgencyGroups.get(label).push([key,item]);});
      urgencyGroups.forEach((group,label)=>{
        const span=group.length*tariffFields.length;row0.push(label,...new Array(Math.max(0,span-1)).fill(''));
        group.forEach(([,item])=>{const title=`${tariffDisplayName(item)} (${item.deliveryTypeLabel||item.deliveryMethodLabel||'метод'})`;row1.push(title,...new Array(Math.max(0,tariffFields.length-1)).fill(''));row2.push(...tariffFields.map(field=>field.label));});
      });
    }else{
      variants.forEach(([,item])=>{const title=`${tariffDisplayName(item)} (${item.deliveryTypeLabel||item.deliveryMethodLabel||'метод'})`;row0.push(title,...new Array(Math.max(0,tariffFields.length-1)).fill(''));row1.push(...tariffFields.map(field=>field.label));});
    }
    const dataRows=state.rows.filter(row=>row.senderQuery||row.recipientQuery||row.result).map((row,fallbackIndex)=>{
      const rowIndex=state.rows.indexOf(row),values=requestFields.map(field=>tariffFieldValue(field.key,null,row,rowIndex>=0?rowIndex:fallbackIndex)),map=new Map();
      visibleTariffs(row.result?.allTariffs).filter(item=>item.deliveryCompanyLabel===company).forEach(item=>{const key=`${exportUrgencyLabel(item)}::${tariffVariantKey(item)}`,current=map.get(key),price=optionalNumeric(item.userPrice,{positive:true}),currentPrice=optionalNumeric(current?.userPrice,{positive:true});if(!current||((price??Infinity)<(currentPrice??Infinity)))map.set(key,item);});
      variants.forEach(([key])=>{const item=map.get(key);values.push(...tariffFields.map(field=>item?tariffFieldValue(field.key,item,row,rowIndex):''));});return values;
    });
    const merges=[];
    if(requestFields.length>1)merges.push({s:{r:0,c:0},e:{r:0,c:requestFields.length-1}});
    let col=requestFields.length;
    if(urgencyMode){
      const urgencyGroups=[];let current=null;variants.forEach(([,item])=>{const label=exportUrgencyLabel(item);if(!current||current.label!==label){current={label,count:0};urgencyGroups.push(current);}current.count+=1;});
      urgencyGroups.forEach(group=>{const span=group.count*tariffFields.length;if(span>1)merges.push({s:{r:0,c:col},e:{r:0,c:col+span-1}});for(let i=0;i<group.count;i++){if(tariffFields.length>1)merges.push({s:{r:1,c:col+i*tariffFields.length},e:{r:1,c:col+(i+1)*tariffFields.length-1}});}col+=span;});
    }else variants.forEach(()=>{if(tariffFields.length>1)merges.push({s:{r:0,c:col},e:{r:0,c:col+tariffFields.length-1}});col+=tariffFields.length;});
    return{aoa:[row0,...(urgencyMode?[row1,row2]:[row1]),...dataRows],merges,freezeColumns:requestFields.length,headerRows};
  }
  function makeWideCompanyWorksheet(model,maxWidth=48){
    const worksheet=makeWorksheet(model.aoa,maxWidth,{headerRow:model.headerRows-1,freezeRows:model.headerRows,freezeColumns:model.freezeColumns});worksheet['!merges']=model.merges;return worksheet;
  }
  function buildAllTariffsExportAoa(rows=state.rows,companyFilter='',flattened=null){
    const fields=selectedTariffFields(),records=flattened||flattenTariffs(rows,companyFilter);
    return usesUrgencyView()?buildUrgencyGroupedTariffsAoa(records,fields):[fields.map(field=>field.label),...records.map(({row,rowIndex,item})=>fields.map(field=>tariffFieldValue(field.key,item,row,rowIndex)))];
  }
  function companyViewAoa(){return buildAllTariffsExportAoa(state.rows,'',state.companyView.filtered);}
  function downloadTariffsXlsx(){
    const row=activeTariffRow();if(!row||!state.tariffView.filtered.length){toast('Нет тарифов для скачивания','error');return;}
    const workbook=XLSX.utils.book_new(),aoa=buildTariffsAoaForRow(row,state.tariffView.filtered);XLSX.utils.book_append_sheet(workbook,usesUrgencyView()?makeGroupedTariffsWorksheet(aoa,55):makeWorksheet(aoa,55),'Тарифы');XLSX.writeFile(workbook,tariffFileName(row,'xlsx'),{compression:true});
  }
  function downloadCompanyXlsx(){
    const aoa=companyViewAoa();if(!aoa.length){toast('Нет тарифов для скачивания','error');return;}
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,usesUrgencyView()?makeGroupedTariffsWorksheet(aoa,55):makeWorksheet(aoa,55),'Тарифы');XLSX.writeFile(workbook,companyFileName('xlsx'),{compression:true});
  }
  function downloadXlsx(){
    const main=buildExportAoa();if(main.length<2){toast('Нет данных для скачивания','error');return;}
    const workbook=XLSX.utils.book_new(),used=new Set();XLSX.utils.book_append_sheet(workbook,makeWorksheet(main),safeSheetName('Расчёт',used));
    const summary=buildCompanySummaryAoa();if(summary.length>1)XLSX.utils.book_append_sheet(workbook,makeWorksheet(summary),safeSheetName('Сводка ТК',used));
    const records=flattenTariffs(),allTariffs=buildAllTariffsExportAoa();if(records.length)XLSX.utils.book_append_sheet(workbook,usesUrgencyView()?makeGroupedTariffsWorksheet(allTariffs,55):makeWorksheet(allTariffs,55),safeSheetName('Все тарифы',used));
    if(state.settings.exportAnalyticsSheet){const recommendations=managerRecommendationsAoa(buildManagerRows()),matrix=managerMatrixAoa(),comparison=comparisonAoa();if(recommendations.length>1)XLSX.utils.book_append_sheet(workbook,makeWorksheet(recommendations,45),safeSheetName('Рекомендации',used));if(matrix.length>1)XLSX.utils.book_append_sheet(workbook,makeWorksheet(matrix,32),safeSheetName('Матрица ТК',used));if(comparison.length>1)XLSX.utils.book_append_sheet(workbook,makeWorksheet(comparison,38),safeSheetName('Сравнение ТК',used));}
    if(state.settings.exportCompanySheets)getExportCompanies().forEach(company=>{if(state.settings.companySheetLayout==='long'){const companyRecords=flattenTariffs(state.rows,company),aoa=buildAllTariffsExportAoa(state.rows,company,companyRecords);if(companyRecords.length)XLSX.utils.book_append_sheet(workbook,usesUrgencyView()?makeGroupedTariffsWorksheet(aoa,55):makeWorksheet(aoa,55),safeSheetName(company,used));}else{const model=buildCompanyWideModel(company);if(model.aoa.length>model.headerRows&&model.aoa[0].length)XLSX.utils.book_append_sheet(workbook,makeWideCompanyWorksheet(model,48),safeSheetName(company,used));}});
    XLSX.writeFile(workbook,fileName('xlsx'),{compression:true});
  }

  /* ===== v2.1 calculated multi-select facets ===== */
  const FACET_EMPTY_KEY='__facet_empty__';
  const TARIFF_FACETS=['company','type','urgency','tariff'];
  const COMPANY_FACETS=['company','type','urgency','tariff','route'];
  function facetText(value,fallback){const text=String(value??'').trim();return text||fallback;}
  function tariffFacetKey(item,facet){
    if(facet==='company')return facetText(item?.deliveryCompanyLabel,'Неизвестная ТК');
    if(facet==='type')return facetText(item?.deliveryTypeLabel,'Не указан');
    if(facet==='method')return facetText(item?.deliveryMethodLabel,'Не указан');
    if(facet==='urgency')return facetText(item?.urgencyLabel,'Без срочности');
    if(facet==='tariff')return companyFilterTariffKey(item);
    return FACET_EMPTY_KEY;
  }
  function tariffFacetLabel(item,facet){
    if(facet==='tariff')return tariffDisplayName(item);
    return tariffFacetKey(item,facet);
  }
  function tariffFacetMeta(item,facet){
    if(facet!=='tariff')return '';
    return [facetText(item?.deliveryCompanyLabel,'Неизвестная ТК'),facetText(item?.urgencyLabel,''),facetText(item?.deliveryTypeLabel,''),facetText(item?.deliveryMethodLabel,'')].filter(Boolean).join(' · ');
  }
  function tariffFacetSet(facet){return state.tariffView.facets[facet];}
  function tariffMatchesFacetSelection(item,exceptFacet=null,strict=false){
    for(const facet of TARIFF_FACETS){
      if(facet===exceptFacet||!state.tariffView.touchedFacets?.has(facet))continue;
      const set=tariffFacetSet(facet);if(!set?.size||!set.has(tariffFacetKey(item,facet)))return false;
    }
    return true;
  }
  function tariffFacetCatalog(tariffs,facet){
    const map=new Map();
    tariffs.filter(item=>tariffMatchesFacetSelection(item,facet,false)).forEach(item=>{
      const key=tariffFacetKey(item,facet),label=tariffFacetLabel(item,facet),meta=tariffFacetMeta(item,facet);
      if(!map.has(key))map.set(key,{key,label,meta,count:0});
      map.get(key).count+=1;
    });
    const values=[...map.values()];
    values.sort((a,b)=>facet==='urgency'?(urgencyRankLocal(a.label)-urgencyRankLocal(b.label)||a.label.localeCompare(b.label,'ru')):facet==='tariff'?(a.meta.localeCompare(b.meta,'ru')||a.label.localeCompare(b.label,'ru')):a.label.localeCompare(b.label,'ru'));
    return values;
  }
  function initializeTariffFacets(tariffs){
    state.tariffView.facets={company:new Set(),type:new Set(),method:new Set(),urgency:new Set(),tariff:new Set()};state.tariffView.touchedFacets=new Set();
    TARIFF_FACETS.forEach(facet=>state.tariffView.facets[facet]=new Set(tariffFacetCatalog(tariffs,facet).map(option=>option.key)));
    state.tariffView.filtersReady=true;
  }
  function pruneTariffFacets(tariffs){
    for(let pass=0;pass<4;pass++){let changed=false;for(const facet of TARIFF_FACETS){const available=new Set(tariffFacetCatalog(tariffs,facet).map(option=>option.key)),current=tariffFacetSet(facet),next=state.tariffView.touchedFacets.has(facet)?new Set([...current].filter(key=>available.has(key))):new Set(available);if(next.size!==current.size||[...next].some(key=>!current.has(key))){state.tariffView.facets[facet]=next;changed=true;}}if(!changed)break;}
  }
  function facetOptionMarkup(scope,facet,option,checked){
    const search=normalize([option.label,option.meta].join(' '));
    const companyMeta=facet==='tariff'&&option.meta?String(option.meta).split(' · ')[0]:'';
    const labelMarkup=facet==='tariff'?`<span class="facet-label" title="${escapeHtml([option.label,option.meta].filter(Boolean).join(' · '))}">${companyMeta?`<b>${escapeHtml(companyMeta)}</b>`:''}<span>${escapeHtml(option.label)}</span></span>`:`<span class="facet-label" title="${escapeHtml(option.label)}">${escapeHtml(option.label)}</span>`;
    return `<label data-choice-text="${escapeHtml(search)}"><input type="checkbox" data-${scope}-facet="${escapeHtml(facet)}" value="${escapeHtml(option.key)}" ${checked?'checked':''}>${labelMarkup}<small class="facet-meta">${option.meta?`${escapeHtml(option.meta)} · `:''}${option.count}</small></label>`;
  }
  function facetSummaryText(selected,available){
    if(!selected)return 'Ничего не выбрано';
    if(selected===available)return `Все · ${available}`;
    return `${selected} из ${available}`;
  }
  function updateTariffFacetFilters(tariffs=visibleTariffs(activeTariffRow()?.result?.allTariffs)){
    if(!state.tariffView.filtersReady)initializeTariffFacets(tariffs);
    const refs={
      company:[els.tariffCompanyFacetOptions,els.tariffCompanyFacetSummary],
      type:[els.tariffTypeFacetOptions,els.tariffTypeFacetSummary],
      method:[els.tariffMethodFacetOptions,els.tariffMethodFacetSummary],
      urgency:[els.tariffUrgencyFacetOptions,els.tariffUrgencyFacetSummary],
      tariff:[els.tariffNameFacetOptions,els.tariffNameFacetSummary]
    };
    TARIFF_FACETS.forEach(facet=>{
      const [container,summary]=refs[facet]||[];if(!container)return;
      const options=tariffFacetCatalog(tariffs,facet),set=tariffFacetSet(facet),availableKeys=new Set(options.map(option=>option.key));
      const selected=[...set].filter(key=>availableKeys.has(key)).length;
      container.innerHTML=options.length?options.map(option=>facetOptionMarkup('tariff',facet,option,set.has(option.key))).join(''):'<div class="choice-filter-empty">Нет вариантов для текущего сочетания фильтров.</div>';
      if(summary){summary.textContent=facetSummaryText(selected,options.length);summary.classList.toggle('is-empty',selected===0);}
    });
    const compat={company:els.tariffCompanyFilter,urgency:els.tariffUrgencyFilter,tariff:els.tariffNameFilter,type:els.tariffMethodFilter};
    Object.entries(compat).forEach(([facet,select])=>{if(!select)return;const options=tariffFacetCatalog(tariffs,facet);select.innerHTML='<option value=""></option>'+options.map(option=>`<option value="${escapeHtml(facet==='tariff'?option.label:option.key)}">${escapeHtml(option.label)}</option>`).join('');});
    document.querySelectorAll('#tariffsModal [data-choice-search-target]').forEach(filterChoiceOptions);
  }
  function handleTariffFacetChange(event){
    const input=event.target.closest('input[data-tariff-facet]');if(!input)return;
    const facet=input.dataset.tariffFacet,set=tariffFacetSet(facet);if(!set)return;const items=visibleTariffs(activeTariffRow()?.result?.allTariffs);state.tariffView.touchedFacets.add(facet);
    if(input.checked)set.add(input.value);else set.delete(input.value);
    pruneTariffFacets(items);renderTariffsView();
  }
  function applyTariffFacetAction(action){
    const match=String(action||'').match(/^(company|type|method|urgency|tariff)-(all|none|invert)$/);if(!match)return;
    const [,facet,operation]=match,items=visibleTariffs(activeTariffRow()?.result?.allTariffs),available=tariffFacetCatalog(items,facet),keys=available.map(option=>option.key),set=tariffFacetSet(facet);
    if(operation==='all'){state.tariffView.touchedFacets.delete(facet);state.tariffView.facets[facet]=new Set(keys);}
    if(operation==='none'){state.tariffView.touchedFacets.add(facet);state.tariffView.facets[facet]=new Set();}
    if(operation==='invert'){state.tariffView.touchedFacets.add(facet);state.tariffView.facets[facet]=new Set(keys.filter(key=>!set.has(key)));}
    pruneTariffFacets(items);renderTariffsView();
  }
  function filterChoiceOptions(input){
    const container=document.getElementById(input.dataset.choiceSearchTarget||'');if(!container)return;
    const query=normalize(input.value);container.querySelectorAll('label[data-choice-text]').forEach(label=>label.classList.toggle('is-filtered-out',Boolean(query)&&!String(label.dataset.choiceText||'').includes(query)));
  }
  function positionChoiceFilterPanel(details){
    const summary=details?.querySelector(':scope > summary'),panel=details?.querySelector(':scope > .choice-filter-panel');if(!details?.open||!summary||!panel)return;
    panel.classList.add('is-floating');const rect=summary.getBoundingClientRect(),pad=10,gap=6,preferred=Math.min(430,Math.max(220,window.innerHeight*.62));let width=Math.min(390,window.innerWidth-pad*2),left=Math.min(Math.max(pad,rect.left),Math.max(pad,window.innerWidth-width-pad));const below=window.innerHeight-rect.bottom-gap-pad,above=rect.top-gap-pad;let top,maxHeight;if(below>=Math.min(260,preferred)||below>=above){top=rect.bottom+gap;maxHeight=Math.max(160,Math.min(preferred,below));}else{maxHeight=Math.max(160,Math.min(preferred,above));top=Math.max(pad,rect.top-gap-maxHeight);}panel.style.left=`${Math.round(left)}px`;panel.style.top=`${Math.round(top)}px`;panel.style.width=`${Math.round(width)}px`;panel.style.maxHeight=`${Math.round(maxHeight)}px`;
  }
  function clearChoiceFilterPanelPosition(details){const panel=details?.querySelector(':scope > .choice-filter-panel');if(!panel)return;panel.classList.remove('is-floating');['left','top','width','maxHeight'].forEach(prop=>panel.style[prop]='');}
  function repositionOpenChoiceFilters(){document.querySelectorAll('.choice-filter[open]').forEach(positionChoiceFilterPanel);}

  function openTariffs(row){
    const tariffs=visibleTariffs(row.result?.allTariffs);if(!tariffs.length)return;
    state.activeTariffRowId=row.id;state.tariffView.sortKey='calculatorOrder';state.tariffView.sortDir='asc';state.tariffView.advanced=Boolean(state.settings.advancedTariffView);state.tariffView.filtersReady=false;
    els.advancedTariffViewToggle.checked=state.tariffView.advanced;applyAdvancedTableMode(els.tariffsModal,state.tariffView.advanced);
    els.tariffsSubtitle.textContent=`${row.senderQuery} → ${row.recipientQuery} · ${tariffs.length} тарифов`;
    resetTariffFilters(false);renderTariffsView();els.tariffsModal.classList.add('open');els.tariffsModal.setAttribute('aria-hidden','false');
  }
  function resetTariffFilters(render=true){
    [els.tariffSearchInput,els.tariffPriceMin,els.tariffPriceMax,els.tariffPeriodMax].forEach(input=>{if(input)input.value='';});
    document.querySelectorAll('#tariffsModal [data-choice-search-target]').forEach(input=>{input.value='';filterChoiceOptions(input);});
    state.tariffView.sortKey='calculatorOrder';state.tariffView.sortDir='asc';state.tariffView.filtersReady=false;initializeTariffFacets(visibleTariffs(activeTariffRow()?.result?.allTariffs));
    if(render)renderTariffsView();else updateTariffFacetFilters();
  }
  function filteredTariffs(){
    const row=activeTariffRow();if(!row)return[];
    const query=normalize(els.tariffSearchInput.value),priceMin=numericFilterValue(els.tariffPriceMin),priceMax=numericFilterValue(els.tariffPriceMax),periodMax=numericFilterValue(els.tariffPeriodMax);
    const filtered=visibleTariffs(row.result?.allTariffs).filter(item=>{
      const search=normalize([item.deliveryCompanyLabel,tariffDisplayName(item),item.urgencyLabel,item.deliveryMethodLabel,item.deliveryTypeLabel].join(' ')),price=optionalNumeric(item.userPrice,{positive:true}),period=validPeriod(item.maxPeriod);
      return tariffMatchesFacetSelection(item,null,true)&&(!query||search.includes(query))&&(priceMin===null||(price!==null&&price>=priceMin))&&(priceMax===null||(price!==null&&price<=priceMax))&&(periodMax===null||(period!==null&&period<=periodMax));
    });
    const direction=state.tariffView.sortDir==='desc'?-1:1,key=state.tariffView.sortKey;
    filtered.sort((a,b)=>{if(key==='calculatorOrder')return((Number(a.calculatorOrder)||0)-(Number(b.calculatorOrder)||0))*direction;if(key==='maxPeriod')return((validPeriod(a.maxPeriod)??Infinity)-(validPeriod(b.maxPeriod)??Infinity))*direction;const av=a[key],bv=b[key];if(['userPrice','inputPrice','retailPrice','discount'].includes(key)){const an=optionalNumeric(av),bn=optionalNumeric(bv);return((an??Infinity)-(bn??Infinity))*direction;}return String(av||'').localeCompare(String(bv||''),'ru')*direction;});
    return filtered;
  }

  function companyFacetSet(facet){
    return {company:state.companyView.selectedCompanies,type:state.companyView.selectedTypes,method:state.companyView.selectedMethods,urgency:state.companyView.selectedUrgencies,tariff:state.companyView.selectedTariffs,route:state.companyView.selectedRoutes}[facet];
  }
  function setCompanyFacetSet(facet,value){
    const map={company:'selectedCompanies',type:'selectedTypes',method:'selectedMethods',urgency:'selectedUrgencies',tariff:'selectedTariffs',route:'selectedRoutes'};state.companyView[map[facet]]=value;
  }
  function companyFacetKey(record,facet){
    const item=record.item;
    if(facet==='company')return facetText(item?.deliveryCompanyLabel,'Неизвестная ТК');
    if(facet==='type')return facetText(item?.deliveryTypeLabel,'Не указан');
    if(facet==='method')return facetText(item?.deliveryMethodLabel,'Не указан');
    if(facet==='urgency')return facetText(item?.urgencyLabel,'Без срочности');
    if(facet==='tariff')return companyFilterTariffKey(item);
    if(facet==='route')return routeKey(record.row);
    return FACET_EMPTY_KEY;
  }
  function companyFacetLabel(record,facet){return facet==='tariff'?tariffDisplayName(record.item):companyFacetKey(record,facet);}
  function companyFacetMeta(record,facet){
    if(facet==='tariff')return [facetText(record.item?.deliveryCompanyLabel,'Неизвестная ТК'),facetText(record.item?.urgencyLabel,''),facetText(record.item?.deliveryTypeLabel,''),facetText(record.item?.deliveryMethodLabel,'')].filter(Boolean).join(' · ');
    return '';
  }
  function companyRecordMatchesFacets(record,exceptFacet=null,strict=false){
    for(const facet of COMPANY_FACETS){if(facet===exceptFacet||!state.companyView.touchedFacets?.has(facet))continue;const set=companyFacetSet(facet);if(!set?.size||!set.has(companyFacetKey(record,facet)))return false;}return true;
  }
  function companyFacetCatalog(records,facet){
    const map=new Map();records.filter(record=>companyRecordMatchesFacets(record,facet,false)).forEach(record=>{const key=companyFacetKey(record,facet),label=companyFacetLabel(record,facet),meta=companyFacetMeta(record,facet);if(!map.has(key))map.set(key,{key,label,meta,count:0});map.get(key).count+=1;});
    const values=[...map.values()];values.sort((a,b)=>facet==='urgency'?(urgencyRankLocal(a.label)-urgencyRankLocal(b.label)||a.label.localeCompare(b.label,'ru')):facet==='tariff'?(a.meta.localeCompare(b.meta,'ru')||a.label.localeCompare(b.label,'ru')):a.label.localeCompare(b.label,'ru'));return values;
  }
  function initializeCompanyFacets(records){
    setCompanyFacetSet('company',new Set());setCompanyFacetSet('type',new Set());setCompanyFacetSet('method',new Set());setCompanyFacetSet('urgency',new Set());setCompanyFacetSet('tariff',new Set());setCompanyFacetSet('route',new Set());state.companyView.touchedFacets=new Set();
    COMPANY_FACETS.forEach(facet=>setCompanyFacetSet(facet,new Set(companyFacetCatalog(records,facet).map(option=>option.key))));state.companyView.filtersReady=true;
  }
  function pruneCompanyFacets(records){
    for(let pass=0;pass<5;pass++){let changed=false;for(const facet of COMPANY_FACETS){const available=new Set(companyFacetCatalog(records,facet).map(option=>option.key)),current=companyFacetSet(facet),next=state.companyView.touchedFacets.has(facet)?new Set([...current].filter(key=>available.has(key))):new Set(available);if(next.size!==current.size||[...next].some(key=>!current.has(key))){setCompanyFacetSet(facet,next);changed=true;}}if(!changed)break;}
  }
  function populateCompanyFacetFilters(records=allCompanyRecords(),resetSelection=false){
    if(resetSelection||!state.companyView.filtersReady)initializeCompanyFacets(records);
    const refs={company:[els.companyCompanyFilterOptions,els.companyCompanyFilterSummary],type:[els.companyTypeFilterOptions,els.companyTypeFilterSummary],method:[els.companyMethodFilterOptions,els.companyMethodFilterSummary],urgency:[els.companyUrgencyFilterOptions,els.companyUrgencyFilterSummary],tariff:[els.companyTariffFilterOptions,els.companyTariffFilterSummary],route:[els.companyRouteFilterOptions,els.companyRouteFilterSummary]};
    COMPANY_FACETS.forEach(facet=>{const [container,summary]=refs[facet]||[];if(!container)return;const options=companyFacetCatalog(records,facet),set=companyFacetSet(facet),availableKeys=new Set(options.map(option=>option.key)),selected=[...set].filter(key=>availableKeys.has(key)).length;container.innerHTML=options.length?options.map(option=>facetOptionMarkup('company',facet,option,set.has(option.key))).join(''):'<div class="choice-filter-empty">Нет вариантов для текущего сочетания фильтров.</div>';if(summary){summary.textContent=facetSummaryText(selected,options.length);summary.classList.toggle('is-empty',selected===0);}});
    const compat={company:els.companySelect,route:els.companyRouteFilter,urgency:els.companyUrgencyFilter,type:els.companyMethodFilter};Object.entries(compat).forEach(([facet,select])=>{if(!select)return;const options=companyFacetCatalog(records,facet);select.innerHTML='<option value=""></option>'+options.map(option=>`<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`).join('');});
    document.querySelectorAll('#companyModal [data-choice-search-target]').forEach(filterChoiceOptions);
  }
  function updateCompanyFacetSummaries(){populateCompanyFacetFilters(allCompanyRecords(),false);}
  function handleCompanyFacetChange(event){
    const input=event.target.closest('input[data-company-facet]');if(!input)return;const facet=input.dataset.companyFacet,set=companyFacetSet(facet);if(!set)return;const records=allCompanyRecords();state.companyView.touchedFacets.add(facet);if(input.checked)set.add(input.value);else set.delete(input.value);pruneCompanyFacets(records);renderCompanyView();
  }
  function applyCompanyFacetAction(action){
    const normalized=String(action||'').replace(/^companies-/,'company-').replace(/^tariffs-/,'tariff-');const match=normalized.match(/^(company|type|method|urgency|tariff|route)-(all|none|invert)$/);if(!match)return;const[,facet,operation]=match,records=allCompanyRecords(),available=companyFacetCatalog(records,facet),keys=available.map(option=>option.key),set=companyFacetSet(facet);if(operation==='all'){state.companyView.touchedFacets.delete(facet);setCompanyFacetSet(facet,new Set(keys));}if(operation==='none'){state.companyView.touchedFacets.add(facet);setCompanyFacetSet(facet,new Set());}if(operation==='invert'){state.companyView.touchedFacets.add(facet);setCompanyFacetSet(facet,new Set(keys.filter(key=>!set.has(key))));}pruneCompanyFacets(records);renderCompanyView();
  }
  function resetCompanyFilters(render=true){
    [els.companySearchInput,els.companyPriceMin,els.companyPriceMax,els.companyPeriodMax].forEach(input=>{if(input)input.value='';});document.querySelectorAll('#companyModal [data-choice-search-target]').forEach(input=>{input.value='';filterChoiceOptions(input);});state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';state.companyView.filtersReady=false;initializeCompanyFacets(allCompanyRecords());if(render)renderCompanyView();else populateCompanyFacetFilters(allCompanyRecords(),false);
  }
  function filteredCompanyRecords(){
    const query=normalize(els.companySearchInput.value),priceMin=numericFilterValue(els.companyPriceMin),priceMax=numericFilterValue(els.companyPriceMax),periodMax=numericFilterValue(els.companyPeriodMax);
    const records=allCompanyRecords().filter(record=>{const{row,item}=record,search=normalize([row.senderQuery,row.recipientQuery,item.deliveryCompanyLabel,tariffDisplayName(item),item.urgencyLabel,item.deliveryMethodLabel,item.deliveryTypeLabel].join(' ')),price=optionalNumeric(item.userPrice,{positive:true}),period=validPeriod(item.maxPeriod);return companyRecordMatchesFacets(record,null,true)&&(!query||search.includes(query))&&(priceMin===null||(price!==null&&price>=priceMin))&&(priceMax===null||(price!==null&&price<=priceMax))&&(periodMax===null||(period!==null&&period<=periodMax));});
    const direction=state.companyView.sortDir==='desc'?-1:1,key=state.companyView.sortKey;records.sort((a,b)=>{let av,bv;if(key==='requestNo'){av=a.rowIndex;bv=b.rowIndex;}else if(key==='route'){av=routeKey(a.row);bv=routeKey(b.row);}else{av=a.item[key];bv=b.item[key];}if(key==='maxPeriod')return((validPeriod(av)??Infinity)-(validPeriod(bv)??Infinity))*direction;if(['requestNo','userPrice','inputPrice','retailPrice','discount'].includes(key)){const an=optionalNumeric(av),bn=optionalNumeric(bv);return((an??Infinity)-(bn??Infinity))*direction;}return String(av||'').localeCompare(String(bv||''),'ru')*direction;});return records;
  }
  function renderCompanyView(){
    populateCompanyFacetFilters(allCompanyRecords(),false);const records=filteredCompanyRecords();state.companyView.filtered=records;renderCompanyCards();renderCompanyHeader();
    const prices=records.map(r=>optionalNumeric(r.item.userPrice,{positive:true})).filter(v=>v!==null),periods=records.map(r=>validPeriod(r.item.maxPeriod)).filter(v=>v!==null),requests=new Set(records.map(r=>r.rowIndex));els.companyCountMetric.textContent=String(records.length);els.companyRequestsMetric.textContent=String(requests.size);els.companyMinPriceMetric.textContent=prices.length?`${formatValue(Math.min(...prices))} ₽`:'—';els.companyAvgPriceMetric.textContent=prices.length?`${formatValue(round2(avg(prices)))} ₽`:'—';els.companyFastestMetric.textContent=periods.length?`${Math.min(...periods)} дн.`:'По запросу';
    $$('.company-sort-button').forEach(button=>{button.classList.toggle('active',button.dataset.companySort===state.companyView.sortKey);button.classList.toggle('asc',button.dataset.companySort===state.companyView.sortKey&&state.companyView.sortDir==='asc');button.classList.toggle('desc',button.dataset.companySort===state.companyView.sortKey&&state.companyView.sortDir==='desc');});
    const colCount=companyColumnOrder().length;if(!records.length){els.companyTariffsBody.innerHTML=`<tr><td colspan="${colCount}" class="empty-tariffs">По выбранному сочетанию ТК, тарифов, типов и методов ничего не найдено.</td></tr>`;return;}els.companyTariffsBody.innerHTML=records.map((record,index)=>`<tr>${companyColumnOrder().map(key=>companyCellMarkup(key,record,index)).join('')}</tr><tr class="tariff-details-row hidden" data-company-details-row="${index}"><td colspan="${colCount}">${tariffDetailsMarkup(record.item)}</td></tr>`).join('');
  }
  function handleCompanyCardClick(event){
    const card=event.target.closest('[data-company-card]');if(!card)return;const company=card.dataset.companyCard,records=allCompanyRecords(),all=companyFacetCatalog(records,'company').map(option=>option.key);if(state.companyView.touchedFacets.has('company')&&state.companyView.selectedCompanies.size===1&&state.companyView.selectedCompanies.has(company)){state.companyView.touchedFacets.delete('company');state.companyView.selectedCompanies=new Set(all);}else{state.companyView.touchedFacets.add('company');state.companyView.selectedCompanies=new Set([company]);}pruneCompanyFacets(records);renderCompanyView();
  }



  /* ===== v2.2 unified filters, delivery types and sales clarity ===== */
  function deliveryTypeName(item){return facetText(item?.deliveryTypeLabel||item?.deliveryMethodLabel,'Не указан');}
  function usesUrgencyFilters(){return currentProjectId()!=='kd';}
  function visibleTariffFacets(){return usesUrgencyFilters()?TARIFF_FACETS:TARIFF_FACETS.filter(facet=>facet!=='urgency');}
  function visibleCompanyFacets(){return usesUrgencyFilters()?COMPANY_FACETS:COMPANY_FACETS.filter(facet=>facet!=='urgency');}
  function updateUrgencyFacetVisibility(){
    const show=usesUrgencyFilters();
    [document.getElementById('tariffUrgencyFacetDetails'),document.getElementById('companyUrgencyFilterDetails')].forEach(element=>{if(element)element.classList.toggle('hidden',!show);});
    if(!show){state.tariffView.touchedFacets?.delete('urgency');state.companyView.touchedFacets?.delete('urgency');}
  }
  function tariffFacetKey(item,facet){
    if(facet==='company')return facetText(item?.deliveryCompanyLabel,'Неизвестная ТК');
    if(facet==='type')return deliveryTypeName(item);
    if(facet==='urgency')return facetText(item?.urgencyLabel,'Без срочности');
    if(facet==='tariff')return companyFilterTariffKey(item);
    return FACET_EMPTY_KEY;
  }
  function tariffFacetLabel(item,facet){return facet==='tariff'?tariffDisplayName(item):tariffFacetKey(item,facet);}
  function tariffFacetMeta(item,facet){
    if(facet!=='tariff')return'';
    return [facetText(item?.deliveryCompanyLabel,'Неизвестная ТК'),usesUrgencyFilters()?facetText(item?.urgencyLabel,''):'' ,deliveryTypeName(item)].filter(Boolean).join(' · ');
  }
  function tariffMatchesFacetSelection(item,exceptFacet=null,strict=false){
    for(const facet of visibleTariffFacets()){
      if(facet===exceptFacet||!state.tariffView.touchedFacets?.has(facet))continue;
      const set=tariffFacetSet(facet);
      if(!set?.size){if(strict)return false;continue;}
      if(!set.has(tariffFacetKey(item,facet)))return false;
    }
    return true;
  }
  function tariffFacetCatalog(tariffs,facet){
    const map=new Map();
    tariffs.filter(item=>tariffMatchesFacetSelection(item,facet,false)).forEach(item=>{
      const key=tariffFacetKey(item,facet),label=tariffFacetLabel(item,facet),meta=tariffFacetMeta(item,facet);
      if(!map.has(key))map.set(key,{key,label,meta,count:0,company:facetText(item?.deliveryCompanyLabel,'Неизвестная ТК'),urgency:facetText(item?.urgencyLabel,''),type:deliveryTypeName(item)});
      map.get(key).count+=1;
    });
    const values=[...map.values()];
    values.sort((a,b)=>facet==='urgency'?(urgencyRankLocal(a.label)-urgencyRankLocal(b.label)||a.label.localeCompare(b.label,'ru')):facet==='tariff'?(a.company.localeCompare(b.company,'ru')||a.label.localeCompare(b.label,'ru')||a.type.localeCompare(b.type,'ru')):a.label.localeCompare(b.label,'ru'));
    return values;
  }
  function initializeTariffFacets(tariffs){
    state.tariffView.facets={company:new Set(),type:new Set(),method:new Set(),urgency:new Set(),tariff:new Set()};state.tariffView.touchedFacets=new Set();
    visibleTariffFacets().forEach(facet=>state.tariffView.facets[facet]=new Set(tariffFacetCatalog(tariffs,facet).map(option=>option.key)));state.tariffView.filtersReady=true;
  }
  function pruneTariffFacets(tariffs){
    for(let pass=0;pass<4;pass++){let changed=false;for(const facet of visibleTariffFacets()){const available=new Set(tariffFacetCatalog(tariffs,facet).map(option=>option.key)),current=tariffFacetSet(facet),next=state.tariffView.touchedFacets.has(facet)?new Set([...current].filter(key=>available.has(key))):new Set(available);if(next.size!==current.size||[...next].some(key=>!current.has(key))){state.tariffView.facets[facet]=next;changed=true;}}if(!changed)break;}
  }
  function facetOptionMarkup(scope,facet,option,checked){
    const search=normalize([option.company,option.label,option.urgency,option.type,option.meta].join(' '));
    if(facet==='tariff'){
      const secondary=[usesUrgencyFilters()?option.urgency:'',option.type].filter(Boolean).join(' · ');
      return `<label data-choice-text="${escapeHtml(search)}"><input type="checkbox" data-${scope}-facet="tariff" value="${escapeHtml(option.key)}" ${checked?'checked':''}><span class="facet-label tariff-facet-label" title="${escapeHtml([option.company,option.label,secondary].filter(Boolean).join(' · '))}"><span class="tariff-facet-main"><b>${escapeHtml(option.company||'')}</b><span>${escapeHtml(option.label)}</span></span>${secondary?`<small>${escapeHtml(secondary)}</small>`:''}</span><small class="facet-meta">${option.count}</small></label>`;
    }
    return `<label data-choice-text="${escapeHtml(search)}"><input type="checkbox" data-${scope}-facet="${escapeHtml(facet)}" value="${escapeHtml(option.key)}" ${checked?'checked':''}><span class="facet-label" title="${escapeHtml(option.label)}">${escapeHtml(option.label)}</span><small class="facet-meta">${option.count}</small></label>`;
  }
  function updateTariffFacetFilters(tariffs=visibleTariffs(activeTariffRow()?.result?.allTariffs)){
    updateUrgencyFacetVisibility();if(!state.tariffView.filtersReady)initializeTariffFacets(tariffs);
    const refs={company:[els.tariffCompanyFacetOptions,els.tariffCompanyFacetSummary],type:[els.tariffTypeFacetOptions,els.tariffTypeFacetSummary],urgency:[els.tariffUrgencyFacetOptions,els.tariffUrgencyFacetSummary],tariff:[els.tariffNameFacetOptions,els.tariffNameFacetSummary]};
    visibleTariffFacets().forEach(facet=>{const[container,summary]=refs[facet]||[];if(!container)return;const options=tariffFacetCatalog(tariffs,facet),set=tariffFacetSet(facet),availableKeys=new Set(options.map(option=>option.key)),selected=[...set].filter(key=>availableKeys.has(key)).length;container.innerHTML=options.length?options.map(option=>facetOptionMarkup('tariff',facet,option,set.has(option.key))).join(''):'<div class="choice-filter-empty">Нет вариантов для текущего сочетания фильтров.</div>';if(summary){summary.textContent=facetSummaryText(selected,options.length);summary.classList.toggle('is-empty',selected===0);}});
    const compat={company:els.tariffCompanyFilter,urgency:els.tariffUrgencyFilter,tariff:els.tariffNameFilter,type:els.tariffMethodFilter};
    Object.entries(compat).forEach(([facet,select])=>{if(!select)return;const options=tariffFacetCatalog(tariffs,facet);select.innerHTML='<option value=""></option>'+options.map(option=>`<option value="${escapeHtml(facet==='tariff'?option.label:option.key)}">${escapeHtml(option.label)}</option>`).join('');});
    document.querySelectorAll('#tariffsModal [data-choice-search-target]').forEach(filterChoiceOptions);
  }
  function applyTariffFacetAction(action){
    const match=String(action||'').match(/^(company|type|urgency|tariff)-(all|none|invert)$/);if(!match)return;
    const[,facet,operation]=match,items=visibleTariffs(activeTariffRow()?.result?.allTariffs),available=tariffFacetCatalog(items,facet),keys=available.map(option=>option.key),set=tariffFacetSet(facet);
    if(operation==='all'){state.tariffView.touchedFacets.delete(facet);state.tariffView.facets[facet]=new Set(keys);}
    if(operation==='none'){state.tariffView.touchedFacets.add(facet);state.tariffView.facets[facet]=new Set();}
    if(operation==='invert'){state.tariffView.touchedFacets.add(facet);state.tariffView.facets[facet]=new Set(keys.filter(key=>!set.has(key)));}
    pruneTariffFacets(items);renderTariffsView();
  }
  function tariffTableColumns(){return[
    {key:'company',label:'ТК',sort:'deliveryCompanyLabel'},
    ...(usesUrgencyView()?[{key:'urgency',label:'Срочность',sort:'urgencyLabel'}]:[]),
    {key:'tariff',label:'Тариф',sort:'tariffCaption'},
    {key:'method',label:'Тип доставки',sort:'deliveryTypeLabel'},
    {key:'period',label:'Макс. срок',sort:'maxPeriod'},
    {key:'price',label:'Цена клиента',sort:'userPrice'},
    {key:'input',label:'Вход',sort:'inputPrice',advanced:true},
    {key:'retail',label:'Розница',sort:'retailPrice',advanced:true},
    {key:'discount',label:'Скидка от розницы',sort:'discount',advanced:true},
    {key:'services',label:'Услуги',advanced:true},{key:'details',label:''}
  ];}
  function tariffDetailsMarkup(item){
    const services=servicesList(item,false).map(service=>`<span class="tariff-tag" title="${escapeHtml(service.description||'')}">${escapeHtml(serviceText(service))}${service.required?' · обязательно':service.enabled?' · включено':''}</span>`).join('')||'<span class="tariff-tag">Нет дополнительных услуг</span>';
    const price=tariffPriceModel(item),priceLines=[],metricLines=[];
    if(price.userPrice!==null)priceLines.push(`<p><span>Цена клиента</span><strong>${escapeHtml(moneyOrDash(price.userPrice,{positive:true}))}</strong></p>`);
    if(price.userPriceWithoutDiscount!==null)priceLines.push(`<p><span>Цена клиента без персональной скидки</span><strong>${escapeHtml(moneyOrDash(price.userPriceWithoutDiscount,{positive:true}))}</strong></p>`);
    if(price.inputPrice!==null)priceLines.push(`<p><span>Вход</span><strong>${escapeHtml(moneyOrDash(price.inputPrice,{nonNegative:true}))}</strong>${price.inputPricePercent===null?'':`<small>${escapeHtml(percentOrDash(price.inputPricePercent))}</small>`}</p>`);
    if(price.minPrice!==null)priceLines.push(`<p><span>Минимально допустимая цена ЛК</span><strong>${escapeHtml(moneyOrDash(price.minPrice,{positive:true}))}</strong>${price.minPricePercent===null?'':`<small>${escapeHtml(percentOrDash(price.minPricePercent))}</small>`}</p>`);
    if(price.retailPrice!==null)priceLines.push(`<p><span>Розница</span><strong>${escapeHtml(moneyOrDash(price.retailPrice,{positive:true}))}</strong></p>`);
    if(price.marginRub!==null)metricLines.push(`<p>Маржа: <strong>${escapeHtml(formatValue(round2(price.marginRub)))} ₽</strong></p>`);
    if(price.marginPct!==null)metricLines.push(`<p>Маржа: <strong>${escapeHtml(formatValue(round2(price.marginPct)))}%</strong></p>`);
    if(price.clientDiscountPct!==null)metricLines.push(`<p data-tip="Дополнительная персональная скидка конкретного клиента. 0% означает, что персональной скидки нет.">Персональная скидка клиента: <strong>${escapeHtml(formatValue(round2(price.clientDiscountPct)))}%</strong></p>`);
    if(price.activeDiscountPct!==null)metricLines.push(`<p data-tip="Базовая активная скидка тарифа в личном кабинете. Она показывается отдельно от персональной скидки клиента.">Активная скидка ЛК: <strong>${escapeHtml(formatValue(round2(price.activeDiscountPct)))}%</strong></p>`);
    if(price.retailDiscountPct!==null)metricLines.push(`<p>Скидка от розницы: <strong>${escapeHtml(formatValue(round2(price.retailDiscountPct)))}%</strong></p>`);
    const blocks=[`<div class="tariff-detail-block"><h4>Максимальный срок</h4><p><strong>${escapeHtml(formatTerm(item))}</strong></p></div>`];
    if(priceLines.length)blocks.push(`<div class="tariff-detail-block tariff-price-block"><h4>Цены</h4>${priceLines.join('')}</div>`);if(metricLines.length)blocks.push(`<div class="tariff-detail-block"><h4>Продажные показатели</h4>${metricLines.join('')}</div>`);if(item.returnServiceAllowed)blocks.push(`<div class="tariff-detail-block"><h4>Возврат</h4><p>Разрешён${hasOptionalNumber(item.returnServicePrice,{nonNegative:true})?` · ${escapeHtml(moneyOrDash(item.returnServicePrice,{nonNegative:true}))}`:''}</p></div>`);blocks.push(`<div class="tariff-detail-block tariff-detail-wide"><h4>Услуги</h4>${services}</div>`);return`<div class="tariff-details">${blocks.join('')}</div>`;
  }

  function companyFacetKey(record,facet){const item=record?.item;if(facet==='company')return facetText(item?.deliveryCompanyLabel,'Неизвестная ТК');if(facet==='type')return deliveryTypeName(item);if(facet==='urgency')return facetText(item?.urgencyLabel,'Без срочности');if(facet==='tariff')return companyFilterTariffKey(item);if(facet==='route')return routeKey(record.row);return FACET_EMPTY_KEY;}
  function companyFacetLabel(record,facet){return facet==='tariff'?tariffDisplayName(record.item):companyFacetKey(record,facet);}
  function companyFacetMeta(record,facet){if(facet!=='tariff')return'';return[facetText(record.item?.deliveryCompanyLabel,'Неизвестная ТК'),usesUrgencyFilters()?facetText(record.item?.urgencyLabel,''):'',deliveryTypeName(record.item)].filter(Boolean).join(' · ');}
  function companyRecordMatchesFacets(record,exceptFacet=null,strict=false){for(const facet of visibleCompanyFacets()){if(facet===exceptFacet||!state.companyView.touchedFacets?.has(facet))continue;const set=companyFacetSet(facet);if(!set?.size){if(strict)return false;continue;}if(!set.has(companyFacetKey(record,facet)))return false;}return true;}
  function companyFacetCatalog(records,facet){const map=new Map();records.filter(record=>companyRecordMatchesFacets(record,facet,false)).forEach(record=>{const key=companyFacetKey(record,facet),label=companyFacetLabel(record,facet),meta=companyFacetMeta(record,facet);if(!map.has(key))map.set(key,{key,label,meta,count:0,company:facetText(record.item?.deliveryCompanyLabel,'Неизвестная ТК'),urgency:facetText(record.item?.urgencyLabel,''),type:deliveryTypeName(record.item)});map.get(key).count+=1;});const values=[...map.values()];values.sort((a,b)=>facet==='urgency'?(urgencyRankLocal(a.label)-urgencyRankLocal(b.label)||a.label.localeCompare(b.label,'ru')):facet==='tariff'?(a.company.localeCompare(b.company,'ru')||a.label.localeCompare(b.label,'ru')||a.type.localeCompare(b.type,'ru')):a.label.localeCompare(b.label,'ru'));return values;}
  function initializeCompanyFacets(records){setCompanyFacetSet('company',new Set());setCompanyFacetSet('type',new Set());setCompanyFacetSet('method',new Set());setCompanyFacetSet('urgency',new Set());setCompanyFacetSet('tariff',new Set());setCompanyFacetSet('route',new Set());state.companyView.touchedFacets=new Set();visibleCompanyFacets().forEach(facet=>setCompanyFacetSet(facet,new Set(companyFacetCatalog(records,facet).map(option=>option.key))));state.companyView.filtersReady=true;}
  function pruneCompanyFacets(records){for(let pass=0;pass<5;pass++){let changed=false;for(const facet of visibleCompanyFacets()){const available=new Set(companyFacetCatalog(records,facet).map(option=>option.key)),current=companyFacetSet(facet),next=state.companyView.touchedFacets.has(facet)?new Set([...current].filter(key=>available.has(key))):new Set(available);if(next.size!==current.size||[...next].some(key=>!current.has(key))){setCompanyFacetSet(facet,next);changed=true;}}if(!changed)break;}}
  function populateCompanyFacetFilters(records=allCompanyRecords(),resetSelection=false){
    updateUrgencyFacetVisibility();if(resetSelection||!state.companyView.filtersReady)initializeCompanyFacets(records);
    const refs={company:[els.companyCompanyFilterOptions,els.companyCompanyFilterSummary],type:[els.companyTypeFilterOptions,els.companyTypeFilterSummary],urgency:[els.companyUrgencyFilterOptions,els.companyUrgencyFilterSummary],tariff:[els.companyTariffFilterOptions,els.companyTariffFilterSummary],route:[els.companyRouteFilterOptions,els.companyRouteFilterSummary]};
    visibleCompanyFacets().forEach(facet=>{const[container,summary]=refs[facet]||[];if(!container)return;const options=companyFacetCatalog(records,facet),set=companyFacetSet(facet),availableKeys=new Set(options.map(option=>option.key)),selected=[...set].filter(key=>availableKeys.has(key)).length;container.innerHTML=options.length?options.map(option=>facetOptionMarkup('company',facet,option,set.has(option.key))).join(''):'<div class="choice-filter-empty">Нет вариантов для текущего сочетания фильтров.</div>';if(summary){summary.textContent=facetSummaryText(selected,options.length);summary.classList.toggle('is-empty',selected===0);}});
    const types=companyFacetCatalog(records,'type');if(els.companyMethodFilter)els.companyMethodFilter.innerHTML='<option value=""></option>'+types.map(option=>`<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`).join('');document.querySelectorAll('#companyModal [data-choice-search-target]').forEach(filterChoiceOptions);
  }
  function handleCompanyFacetChange(event){const input=event.target.closest('input[data-company-facet]');if(!input)return;const facet=input.dataset.companyFacet,set=companyFacetSet(facet);if(!set)return;const records=allCompanyRecords();state.companyView.touchedFacets.add(facet);if(input.checked)set.add(input.value);else set.delete(input.value);pruneCompanyFacets(records);renderCompanyView();}
  function applyCompanyFacetAction(action){const normalized=String(action||'').replace(/^companies-/,'company-').replace(/^tariffs-/,'tariff-'),match=normalized.match(/^(company|type|urgency|tariff|route)-(all|none|invert)$/);if(!match)return;const[,facet,operation]=match,records=allCompanyRecords(),available=companyFacetCatalog(records,facet),keys=available.map(option=>option.key),set=companyFacetSet(facet);if(operation==='all'){state.companyView.touchedFacets.delete(facet);setCompanyFacetSet(facet,new Set(keys));}if(operation==='none'){state.companyView.touchedFacets.add(facet);setCompanyFacetSet(facet,new Set());}if(operation==='invert'){state.companyView.touchedFacets.add(facet);setCompanyFacetSet(facet,new Set(keys.filter(key=>!set.has(key))));}pruneCompanyFacets(records);renderCompanyView();}

  function resetCompanyFilters(render=true){[els.companySearchInput,els.companyPriceMin,els.companyPriceMax,els.companyPeriodMax].forEach(input=>{if(input)input.value='';});document.querySelectorAll('#companyModal [data-choice-search-target]').forEach(input=>{input.value='';filterChoiceOptions(input);});state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';state.companyView.filtersReady=false;initializeCompanyFacets(allCompanyRecords());if(render)renderCompanyView();else populateCompanyFacetFilters(allCompanyRecords(),false);}
  function filteredCompanyRecords(){const query=normalize(els.companySearchInput.value),priceMin=numericFilterValue(els.companyPriceMin),priceMax=numericFilterValue(els.companyPriceMax),periodMax=numericFilterValue(els.companyPeriodMax);const records=allCompanyRecords().filter(record=>{const{row,item}=record,search=normalize([row.senderQuery,row.recipientQuery,item.deliveryCompanyLabel,tariffDisplayName(item),item.urgencyLabel,deliveryTypeName(item)].join(' ')),price=optionalNumeric(item.userPrice,{positive:true}),period=validPeriod(item.maxPeriod);return companyRecordMatchesFacets(record,null,true)&&(!query||search.includes(query))&&(priceMin===null||(price!==null&&price>=priceMin))&&(priceMax===null||(price!==null&&price<=priceMax))&&(periodMax===null||(period!==null&&period<=periodMax));});const direction=state.companyView.sortDir==='desc'?-1:1,key=state.companyView.sortKey;records.sort((a,b)=>{let av,bv;if(key==='requestNo'){av=a.rowIndex;bv=b.rowIndex;}else if(key==='route'){av=routeKey(a.row);bv=routeKey(b.row);}else{av=a.item[key];bv=b.item[key];}if(key==='maxPeriod')return((validPeriod(av)??Infinity)-(validPeriod(bv)??Infinity))*direction;if(['requestNo','userPrice','inputPrice','retailPrice','discount'].includes(key)){const an=optionalNumeric(av),bn=optionalNumeric(bv);return((an??Infinity)-(bn??Infinity))*direction;}return String(av||'').localeCompare(String(bv||''),'ru')*direction;});return records;}
  function updateAnalyticsSharedFilterStatus(records){const target=document.getElementById('analyticsSharedFilterStatus');if(!target)return;const requests=new Set(records.map(record=>record.rowIndex)),companies=new Set(records.map(record=>record.item.deliveryCompanyLabel)),types=new Set(records.map(record=>deliveryTypeName(record.item)));target.textContent=`${records.length} тарифов · ${requests.size} запросов · ${companies.size} ТК · ${types.size} тип.`;}
  function renderCompanyCards(records=state.companyView.filtered||filteredCompanyRecords()){const groups=new Map();records.forEach(record=>{const name=record.item.deliveryCompanyLabel||'Неизвестная ТК';if(!groups.has(name))groups.set(name,{count:0,prices:[],requests:new Set()});const group=groups.get(name);group.count+=1;const price=optionalNumeric(record.item.userPrice,{positive:true});if(price!==null)group.prices.push(price);group.requests.add(record.rowIndex);});els.companyCards.innerHTML=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru')).map(([name,group])=>{const min=group.prices.length?Math.min(...group.prices):null;return`<div class="company-card company-card-static"><span>${escapeHtml(name)}</span><b>${group.count} тарифов</b><small>${group.requests.size} запросов · ${min===null?'цена не передана':`от ${escapeHtml(formatValue(min))} ₽`}</small></div>`;}).join('');}
  function handleCompanyCardClick(){return;}
  function companyColumnMeta(key){return{requestNo:{label:'№ запроса',sort:'requestNo'},route:{label:'Маршрут',sort:'route'},cargo:{label:'Груз',advanced:true},company:{label:'ТК',sort:'deliveryCompanyLabel'},urgency:{label:'Срочность',sort:'urgencyLabel'},tariff:{label:'Тариф',sort:'tariffCaption'},method:{label:'Тип доставки',sort:'deliveryTypeLabel'},period:{label:'Макс. срок',sort:'maxPeriod'},price:{label:'Цена клиента',sort:'userPrice'},input:{label:'Вход',advanced:true},retail:{label:'Розница',advanced:true},details:{label:''}}[key];}
  function renderCompanyView(){populateCompanyFacetFilters(allCompanyRecords(),false);const records=filteredCompanyRecords();state.companyView.filtered=records;renderCompanyCards(records);renderCompanyHeader();updateAnalyticsSharedFilterStatus(records);const prices=records.map(r=>optionalNumeric(r.item.userPrice,{positive:true})).filter(v=>v!==null),periods=records.map(r=>validPeriod(r.item.maxPeriod)).filter(v=>v!==null),requests=new Set(records.map(r=>r.rowIndex));els.companyCountMetric.textContent=String(records.length);els.companyRequestsMetric.textContent=String(requests.size);els.companyMinPriceMetric.textContent=prices.length?`${formatValue(Math.min(...prices))} ₽`:'—';els.companyAvgPriceMetric.textContent=prices.length?`${formatValue(round2(avg(prices)))} ₽`:'—';els.companyFastestMetric.textContent=periods.length?`${Math.min(...periods)} дн.`:'По запросу';$$('.company-sort-button').forEach(button=>{button.classList.toggle('active',button.dataset.companySort===state.companyView.sortKey);button.classList.toggle('asc',button.dataset.companySort===state.companyView.sortKey&&state.companyView.sortDir==='asc');button.classList.toggle('desc',button.dataset.companySort===state.companyView.sortKey&&state.companyView.sortDir==='desc');});const colCount=companyColumnOrder().length;if(!records.length)els.companyTariffsBody.innerHTML=`<tr><td colspan="${colCount}" class="empty-tariffs">По выбранным фильтрам ничего не найдено. Снятые значения остаются доступными в списках — выберите нужные или нажмите «Все».</td></tr>`;else els.companyTariffsBody.innerHTML=records.map((record,index)=>`<tr>${companyColumnOrder().map(key=>companyCellMarkup(key,record,index)).join('')}</tr><tr class="tariff-details-row hidden" data-company-details-row="${index}"><td colspan="${colCount}">${tariffDetailsMarkup(record.item)}</td></tr>`).join('');renderAnalyticsTariffPickers();if(els.companyModal?.classList.contains('open'))markAnalyticsDirty('both');}

  function analyticsMethodList(){return[...new Set(allCompanyRecords().map(record=>deliveryTypeName(record.item)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));}
  function analyticsMethod(){const all=analyticsMethodList(),selected=[...state.companyView.selectedTypes].filter(value=>all.includes(value));if(selected.length===1)return selected[0];const stored=state.settings.analyticsMethodByProject?.[currentProjectId()]||'';if(selected.includes(stored))return stored;if(all.includes(stored)&&!state.companyView.touchedFacets?.has('type'))return stored;return selected[0]||all[0]||'';}
  function syncAnalyticsMethod(type){const all=analyticsMethodList(),safe=all.includes(type)?type:analyticsMethod();state.settings.analyticsMethodByProject[currentProjectId()]=safe;[els.comparisonMethodSelect,els.managerMethodFilter].forEach(select=>{if(!select)return;select.innerHTML=all.length?all.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(''):'<option value="">Нет типов доставки</option>';select.value=safe;});normalizeAnalyticsSelections(safe);renderAnalyticsTariffPickers();persistSettings();return safe;}
  function ensureSingleAnalyticsType(){const all=companyFacetCatalog(allCompanyRecords(),'type').map(option=>option.key),selected=[...state.companyView.selectedTypes].filter(value=>all.includes(value));if(selected.length===1)return selected[0];const stored=state.settings.analyticsMethodByProject?.[currentProjectId()]||'',chosen=(selected.includes(stored)&&stored)||selected[0]||(all.includes(stored)&&stored)||all[0]||'';if(chosen){state.companyView.touchedFacets.add('type');state.companyView.selectedTypes=new Set([chosen]);state.settings.analyticsMethodByProject[currentProjectId()]=chosen;pruneCompanyFacets(allCompanyRecords());populateCompanyFacetFilters(allCompanyRecords(),false);updateAnalyticsSharedFilterStatus(filteredCompanyRecords());}return chosen;}
  function analyticsCatalog(type=analyticsMethod()){const catalog=new Map(),records=filteredCompanyRecords().filter(record=>!type||deliveryTypeName(record.item)===type);records.forEach(record=>{const{item,rowIndex}=record,company=item.deliveryCompanyLabel||'Неизвестная ТК',key=tariffSignature(item);if(!catalog.has(company))catalog.set(company,new Map());const map=catalog.get(company);if(!map.has(key))map.set(key,{key,item,count:0,routes:new Set()});const entry=map.get(key);entry.count+=1;entry.routes.add(rowIndex);});return catalog;}
  function bestRouteCompanyRecords(filters={}){const type=filters.method||analyticsMethod(),mode=filters.tariffMode||'cheapest',selection=selectedAnalyticsConfig(type),result=[],byRow=new Map();filteredCompanyRecords().filter(record=>deliveryTypeName(record.item)===type).forEach(record=>{const company=record.item.deliveryCompanyLabel||'Неизвестная ТК',config=selection[company];if(!config?.enabled||!config.tariffs.includes(tariffSignature(record.item)))return;if(!byRow.has(record.rowIndex))byRow.set(record.rowIndex,{row:record.row,rowIndex:record.rowIndex,route:routeKey(record.row),companies:new Map()});const group=byRow.get(record.rowIndex).companies;if(!group.has(company))group.set(company,[]);group.get(company).push(record.item);});byRow.forEach(group=>{const selected=new Map();group.companies.forEach((items,company)=>{const item=selectAnalyticsTariff(items,mode);if(item)selected.set(company,item);});const prices=[...selected.values()].map(item=>optionalNumeric(item.userPrice,{positive:true})).filter(value=>value!==null);selected.forEach((item,company)=>{const others=[...selected.entries()].filter(([name])=>name!==company).map(([,entry])=>optionalNumeric(entry.userPrice,{positive:true})).filter(value=>value!==null);result.push({row:group.row,rowIndex:group.rowIndex,route:group.route,company,item,marketMin:others.length?Math.min(...others):null,routeMarketMin:prices.length?Math.min(...prices):null});});});return result;}
  function comparisonFilters(){return{route:'',method:analyticsMethod(),tariffMode:els.comparisonTariffModeSelect?.value||'cheapest',periodMax:''};}
  function managerFilters(){return{route:'',method:analyticsMethod(),tariffMode:els.managerTariffModeSelect?.value||'cheapest',periodMax:''};}
  function comparisonStats(){const params=salesParams('custom','comparison'),filters=comparisonFilters(),records=bestRouteCompanyRecords(filters).map(record=>enrichSalesRecord(record,params)),scopeRows=new Set(filteredCompanyRecords().filter(record=>deliveryTypeName(record.item)===filters.method).map(record=>record.rowIndex));const groups=new Map();records.forEach(record=>{if(!groups.has(record.company))groups.set(record.company,[]);groups.get(record.company).push(record);});return[...groups.entries()].map(([company,items])=>{const values=key=>items.map(item=>item[key]).filter(value=>Number.isFinite(value)),prices=values('price'),periods=items.map(item=>validPeriod(item.item.maxPeriod)).filter(value=>value!==null),services=items.map(item=>optionalNumeric(item.item.servicesPrice,{nonNegative:true})).filter(value=>value!==null),wins=items.filter(item=>item.routeMarketMin&&item.price!==null&&Math.abs(item.price-item.routeMarketMin)<.01).length;return{company,minPrice:prices.length?Math.min(...prices):null,avgPrice:averageOrNull(prices),maxPrice:prices.length?Math.max(...prices):null,avgPriceWithoutDiscount:averageOrNull(values('priceWithoutDiscount')),avgInput:averageOrNull(values('input')),avgMinAllowedPrice:averageOrNull(values('minAllowedPrice')),avgRetail:averageOrNull(values('retail')),bestPeriod:periods.length?Math.min(...periods):null,avgPeriod:averageOrNull(periods),avgMarginRub:averageOrNull(values('margin')),avgMarginPct:averageOrNull(values('marginPct')),avgRetailDiscount:averageOrNull(values('retailDiscount')),avgClientDiscount:averageOrNull(values('clientDiscount')),avgActiveDiscount:averageOrNull(values('activeDiscount')),marketGapPct:averageOrNull(values('marketGap')),safeDiscountPct:averageOrNull(values('safeDiscount')),recommendedPrice:averageOrNull(values('recommendedPrice')),recommendedDiscountPct:averageOrNull(values('recommendedDiscount')),avgServicesPrice:averageOrNull(services),winRatePct:items.length?wins/items.length*100:null,offersCount:items.length,coveragePct:scopeRows.size?new Set(items.map(item=>item.rowIndex)).size/scopeRows.size*100:null,records:items};});}
  function renderAnalyticsTariffPickers(){const type=analyticsMethod(),markup=analyticsPickerMarkup(type),summary=analyticsSelectionSummary(type),text=`(${summary.companies} ТК · ${summary.tariffs} тарифов · ${type||'выберите тип доставки'})`;if(els.comparisonTariffPicker)els.comparisonTariffPicker.innerHTML=markup;if(els.managerTariffPicker)els.managerTariffPicker.innerHTML=markup;if(els.comparisonSelectionCount)els.comparisonSelectionCount.textContent=text;if(els.managerSelectionCount)els.managerSelectionCount.textContent=text;const{catalog,store}=normalizeAnalyticsSelections(type),enabledCompanies=[...catalog.keys()].filter(company=>store[company]?.enabled).sort((a,b)=>a.localeCompare(b,'ru'));if(els.managerCompanyFilter){const previous=els.managerCompanyFilter.value;els.managerCompanyFilter.innerHTML='<option value="">Все выбранные ТК</option>'+enabledCompanies.map(company=>`<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');els.managerCompanyFilter.value=enabledCompanies.includes(previous)?previous:'';}if(els.managerBaseCompanyFilter){const previous=els.managerBaseCompanyFilter.value;els.managerBaseCompanyFilter.innerHTML='<option value="cheapest">Минимальная цена среди выбранных ТК</option>'+enabledCompanies.map(company=>`<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');els.managerBaseCompanyFilter.value=previous==='cheapest'||enabledCompanies.includes(previous)?previous:'cheapest';}}
  function activateCompanyPane(name){state.companyView.pane=name;$$('[data-company-view]').forEach(button=>button.classList.toggle('active',button.dataset.companyView===name));$$('[data-company-pane]').forEach(pane=>pane.classList.toggle('active',pane.dataset.companyPane===name));if(name!=='tariffs'){const type=ensureSingleAnalyticsType();syncAnalyticsMethod(type);renderCompanyView();}if(name==='compare')renderComparison(true);if(name==='manager')renderManagerTable(true);requestAnimationFrame(repositionOpenChoiceFilters);}

  function initV22TableScrolling(){document.addEventListener('wheel',event=>{const wrap=event.target.closest?.('#companyModal .tariffs-wrap');if(!wrap||Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;const pane=wrap.closest('.company-view-pane');if(!pane||pane===wrap)return;const max=pane.scrollHeight-pane.clientHeight;if(max<=0)return;pane.scrollTop+=event.deltaY;event.preventDefault();},{passive:false,capture:true});}
  function initV22Ui(){updateUrgencyFacetVisibility();initV22TableScrolling();}

  let tooltipElement=null,tooltipTrigger=null;
  function initGlobalTooltips(){
    if(tooltipElement)return;
    tooltipElement=document.createElement('div');tooltipElement.className='global-tooltip';tooltipElement.setAttribute('role','tooltip');document.body.appendChild(tooltipElement);
    const show=event=>{const trigger=event.target.closest?.('[data-tip]');if(!trigger||!trigger.dataset.tip)return;tooltipTrigger=trigger;tooltipElement.textContent=trigger.dataset.tip;tooltipElement.classList.add('visible');requestAnimationFrame(positionGlobalTooltip);};
    const hide=event=>{if(!tooltipTrigger)return;const next=event.relatedTarget;if(next&&tooltipTrigger.contains(next))return;tooltipElement.classList.remove('visible');tooltipTrigger=null;};
    document.addEventListener('pointerover',show);document.addEventListener('pointerout',hide);document.addEventListener('focusin',show);document.addEventListener('focusout',hide);
    window.addEventListener('resize',()=>tooltipTrigger?positionGlobalTooltip():null);document.addEventListener('scroll',()=>tooltipElement?.classList.remove('visible'),true);
  }
  function positionGlobalTooltip(){
    if(!tooltipElement||!tooltipTrigger)return;const rect=tooltipTrigger.getBoundingClientRect(),tip=tooltipElement.getBoundingClientRect(),gap=9,pad=8;
    let top=rect.top-tip.height-gap,placement='top';if(top<pad){top=rect.bottom+gap;placement='bottom';}if(top+tip.height>window.innerHeight-pad)top=Math.max(pad,window.innerHeight-tip.height-pad);
    let left=rect.left+rect.width/2-tip.width/2;left=Math.min(Math.max(pad,left),Math.max(pad,window.innerWidth-tip.width-pad));
    tooltipElement.style.left=`${Math.round(left)}px`;tooltipElement.style.top=`${Math.round(top)}px`;tooltipElement.dataset.placement=placement;
  }

  function toggleModalFullscreen(button){
    const modal=document.getElementById(button?.dataset?.targetModal||'');if(!modal)return;
    const panel=modal.querySelector('.modal-panel');if(!panel)return;
    const expanded=panel.classList.toggle('is-fullscreen');
    button.textContent=expanded?'🗗':'⛶';
    button.setAttribute('aria-label',expanded?'Восстановить размер':'Развернуть');
    button.dataset.tip=expanded?'Восстановить размер окна':'Развернуть на весь экран';
  }
  function resetModalFullscreen(modal){
    const panel=modal?.querySelector?.('.modal-panel');if(panel)panel.classList.remove('is-fullscreen');
    modal?.querySelectorAll?.('[data-toggle-fullscreen]').forEach(button=>{button.textContent='⛶';button.setAttribute('aria-label','Развернуть');button.dataset.tip='Развернуть на весь экран';});
  }

  function resetSecretVisibility() {
    document.querySelectorAll('[data-toggle-secret]').forEach(button=>{
      const input=document.getElementById(button.dataset.toggleSecret);
      if(input) input.type='password';
      button.textContent='Показать'; button.setAttribute('aria-pressed','false');
      button.setAttribute('aria-label',button.dataset.toggleSecret==='dadataInput'?'Показать токен DaData':'Показать пароль');
    });
  }
  function toggleSecretVisibility(button) {
    const input=document.getElementById(button.dataset.toggleSecret); if(!input)return;
    const showing=input.type==='text'; input.type=showing?'password':'text';
    button.textContent=showing?'Показать':'Скрыть'; button.setAttribute('aria-pressed',String(!showing));
    button.setAttribute('aria-label',`${showing?'Показать':'Скрыть'} ${button.dataset.toggleSecret==='dadataInput'?'токен DaData':'пароль'}`);
  }
  function openHelpModal(){
    els.helpModal?.classList.add('open');
    els.helpModal?.setAttribute('aria-hidden','false');
  }
  function closeHelpModal(){
    resetModalFullscreen(els.helpModal);
    els.helpModal?.classList.remove('open');
    els.helpModal?.setAttribute('aria-hidden','true');
  }
  function humanBytes(bytes){const n=Number(bytes)||0;if(n<1024)return`${n} Б`;if(n<1024*1024)return`${round2(n/1024)} КБ`;return`${round2(n/1024/1024)} МБ`;}
  function ttlText(ms){if(!Number.isFinite(ms)||ms<=0)return'—';const minutes=Math.round(ms/60000);if(minutes<60)return`${minutes} мин.`;const hours=Math.round(minutes/60);if(hours<48)return`${hours} ч.`;return`${Math.round(hours/24)} дн.`;}
  function tableStorageBytes(){
    const value=localStorage.getItem(TABLE_STATE_KEY)||'';
    return value?new Blob([value]).size:0;
  }
  function cacheStatsLabel(key, source){
    const labels={
      addresses:'Адреса в браузере',
      calculations:'Расчёты в браузере',
      dadata:'DaData',
      geo:'Города ЛК',
      users:'Контрагенты ЛК',
      auth:'Токены ЛК',
      companies:'Транспортные компании',
      other:'Прочее'
    };
    if(source==='table')return'Сохранённый ввод таблицы';
    return labels[key]||key;
  }
  function cacheStatsSource(source){
    if(source==='browser')return'Браузер';
    if(source==='table')return'Таблица';
    return'Фоновый сервис';
  }
  async function refreshCacheStats(){
    if(!els.cacheStatsGrid)return;
    els.cacheStatsGrid.innerHTML='<div class="empty-state">Считаем…</div>';
    try{
      const[browser,network]=await Promise.all([state.cache.stats(),KDBridge.rpc('cacheStats')]);
      const cards=[];
      Object.entries(browser.groups||{}).forEach(([key,g])=>cards.push({
        key:`browser-${key}`,
        source:'browser',
        label:cacheStatsLabel(key,'browser'),
        entries:g.entries,
        bytes:g.bytes,
        ttl:'до очистки'
      }));
      Object.entries(network.groups||{}).forEach(([key,g])=>cards.push({
        key:`network-${key}`,
        source:'network',
        label:cacheStatsLabel(key,'network'),
        entries:g.entries,
        bytes:g.bytes,
        ttl:g.maxTtlMs?`до ${ttlText(g.maxTtlMs)}`:'до очистки'
      }));
      const savedRows=Object.values(state.projectRows||{}).flat().filter(rowHasUserData).length;
      if(savedRows){
        cards.unshift({
          key:'table-inputs',
          source:'table',
          label:cacheStatsLabel('table-inputs','table'),
          entries:savedRows,
          bytes:tableStorageBytes(),
          ttl:'до очистки'
        });
      }
      els.cacheStatsGrid.innerHTML=cards.length?cards.map(c=>`<div class="cache-stat-card"><span>${escapeHtml(cacheStatsSource(c.source))}</span><b>${escapeHtml(c.label)}</b><small>${Number(c.entries)||0} записей · ${humanBytes(c.bytes)}${c.ttl?` · ${escapeHtml(c.ttl)}`:''}</small></div>`).join(''):'<div class="empty-state">Кэш пуст.</div>';
      const total=Number(browser.totalEntries||0)+Number(network.totalEntries||0)+savedRows;
      els.cacheStatusBtn.textContent=`Кэш ${total}`;
    }catch(error){
      els.cacheStatsGrid.innerHTML=`<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }
  function normalizeCacheCategory(category){
    if(category==='addresses')return'dadata';
    if(category==='calculations')return'calculator';
    return category||'all';
  }
  function cacheClearMessage(category){
    const labels={
      all:'Весь кэш очищен',
      calculator:'Кэш калькулятора очищен',
      dadata:'Кэш DaData очищен',
      geo:'Кэш городов ЛК очищен',
      lk:'Кэш ЛК очищен',
      'table-inputs':'Сохранённый ввод таблицы очищен'
    };
    return labels[category]||'Раздел кэша очищен';
  }
  function cacheClearConfirmation(category){
    const labels={
      all:{
        title:'Очистить весь кэш?',
        message:'Будут удалены кэш расчётов, адресов, данных ЛК и сохранённый ввод таблицы.',
        confirmText:'Очистить всё'
      },
      calculator:{
        title:'Очистить кэш калькулятора?',
        message:'Повторные расчёты по тем же маршрутам снова пойдут в калькулятор.',
        confirmText:'Очистить'
      },
      dadata:{
        title:'Очистить кэш DaData?',
        message:'Адреса будут заново распознаваться через DaData.',
        confirmText:'Очистить'
      },
      geo:{
        title:'Очистить кэш городов ЛК?',
        message:'Связки адресов DaData с городами личного кабинета будут получены заново.',
        confirmText:'Очистить'
      },
      lk:{
        title:'Очистить кэш ЛК?',
        message:'Будут сброшены токены, контрагенты и справочники личного кабинета.',
        confirmText:'Очистить'
      },
      'table-inputs':{
        title:'Очистить сохранённый ввод?',
        message:'Будут удалены сохранённые строки, адреса и текущие результаты, которые восстанавливаются после перезагрузки.',
        confirmText:'Очистить ввод'
      }
    };
    return labels[category]?{...labels[category],danger:true}:null;
  }
  async function clearCaches(category='all'){
    const normalized=normalizeCacheCategory(category);
    const confirmation=cacheClearConfirmation(normalized);
    if(confirmation&&!(await confirmDialog(confirmation)))return;
    const buttons=[els.clearCacheBtn,...$$('[data-cache-clear]').filter(button=>normalizeCacheCategory(button.dataset.cacheClear)===normalized)];
    buttons.forEach(button=>{if(button)button.disabled=true;});
    try{
      if(normalized==='table-inputs'){
        clearSavedTableState(true);
        toast(cacheClearMessage(normalized),'success');
        await refreshCacheStats();
        return;
      }
      let prefixes=null;
      if(normalized==='dadata')prefixes=['address:'];
      if(normalized==='calculator')prefixes=['calc:'];
      const localClear=normalized==='geo'||normalized==='lk'?Promise.resolve():state.cache.clear(prefixes);
      await Promise.all([localClear,KDBridge.rpc('clearCache',{category:normalized,projectId:normalized==='all'||normalized==='dadata'?'':currentProjectId()})]);
      if(normalized==='all')clearSavedTableState(true);
      toast(cacheClearMessage(normalized),'success');
      await refreshCacheStats();
    }catch(error){
      toast(error.message,'error');
    }finally{
      buttons.forEach(button=>{if(button)button.disabled=false;});
    }
  }


  /* ===== v2.3 stable facets, clear sales analytics and native table scrolling ===== */
  function tariffFacetMeta(item,facet){
    if(facet!=='tariff')return'';
    return[usesUrgencyFilters()?facetText(item?.urgencyLabel,''):'',deliveryTypeName(item)].filter(Boolean).join(' · ');
  }
  function companyFacetMeta(record,facet){
    if(facet!=='tariff')return'';
    return[usesUrgencyFilters()?facetText(record.item?.urgencyLabel,''):'',deliveryTypeName(record.item)].filter(Boolean).join(' · ');
  }
  function facetOptionMarkup(scope,facet,option,checked){
    const search=normalize([option.company,option.label,option.meta].join(' '));
    const labelMarkup=facet==='tariff'?`<span class="tariff-facet-label" title="${escapeHtml([option.company,option.label,option.meta].filter(Boolean).join(' · '))}"><span class="tariff-facet-main"><b>${escapeHtml(option.company||'Неизвестная ТК')}</b><span>${escapeHtml(option.label)}</span></span>${option.meta?`<small>${escapeHtml(option.meta)}</small>`:''}</span>`:`<span class="facet-label" title="${escapeHtml(option.label)}">${escapeHtml(option.label)}</span>`;
    return`<label data-choice-text="${escapeHtml(search)}"><input type="checkbox" data-${scope}-facet="${escapeHtml(facet)}" value="${escapeHtml(option.key)}" ${checked?'checked':''}>${labelMarkup}<small class="facet-meta">${option.count}</small></label>`;
  }
  function facetCatalogIgnores(facet){
    const ignored=new Set([facet]);
    // Tariff is the most detailed facet. It may depend on company/type/route,
    // but it must never erase parent options from their own dropdowns.
    if(facet!=='tariff')ignored.add('tariff');
    return ignored;
  }
  function tariffMatchesFacetCatalog(item,facet){
    const ignored=facetCatalogIgnores(facet);
    for(const currentFacet of visibleTariffFacets()){
      if(ignored.has(currentFacet)||!state.tariffView.touchedFacets?.has(currentFacet))continue;
      const set=tariffFacetSet(currentFacet);
      if(!set?.size||!set.has(tariffFacetKey(item,currentFacet)))return false;
    }
    return true;
  }
  function tariffFacetCatalog(tariffs,facet){
    const map=new Map();
    tariffs.filter(item=>tariffMatchesFacetCatalog(item,facet)).forEach(item=>{
      const key=tariffFacetKey(item,facet),label=tariffFacetLabel(item,facet),meta=tariffFacetMeta(item,facet);
      if(!map.has(key))map.set(key,{key,label,meta,count:0,company:facetText(item?.deliveryCompanyLabel,'Неизвестная ТК'),type:deliveryTypeName(item),urgency:facetText(item?.urgencyLabel,'')});
      map.get(key).count+=1;
    });
    const values=[...map.values()];
    values.sort((a,b)=>facet==='urgency'?(urgencyRankLocal(a.label)-urgencyRankLocal(b.label)||a.label.localeCompare(b.label,'ru')):facet==='tariff'?(a.company.localeCompare(b.company,'ru')||a.label.localeCompare(b.label,'ru')||a.type.localeCompare(b.type,'ru')):a.label.localeCompare(b.label,'ru'));
    return values;
  }
  function pruneTariffFacets(tariffs){
    for(const facet of visibleTariffFacets()){
      if(state.tariffView.touchedFacets?.has(facet))continue;
      state.tariffView.facets[facet]=new Set(tariffFacetCatalog(tariffs,facet).map(option=>option.key));
    }
  }
  function companyRecordMatchesFacetCatalog(record,facet){
    const ignored=facetCatalogIgnores(facet);
    for(const currentFacet of visibleCompanyFacets()){
      if(ignored.has(currentFacet)||!state.companyView.touchedFacets?.has(currentFacet))continue;
      const set=companyFacetSet(currentFacet);
      if(!set?.size||!set.has(companyFacetKey(record,currentFacet)))return false;
    }
    return true;
  }
  function companyFacetCatalog(records,facet){
    const map=new Map();
    records.filter(record=>companyRecordMatchesFacetCatalog(record,facet)).forEach(record=>{
      const key=companyFacetKey(record,facet),label=companyFacetLabel(record,facet),meta=companyFacetMeta(record,facet);
      if(!map.has(key))map.set(key,{key,label,meta,count:0,company:facetText(record.item?.deliveryCompanyLabel,'Неизвестная ТК'),urgency:facetText(record.item?.urgencyLabel,''),type:deliveryTypeName(record.item)});
      map.get(key).count+=1;
    });
    const values=[...map.values()];
    values.sort((a,b)=>facet==='urgency'?(urgencyRankLocal(a.label)-urgencyRankLocal(b.label)||a.label.localeCompare(b.label,'ru')):facet==='tariff'?(a.company.localeCompare(b.company,'ru')||a.label.localeCompare(b.label,'ru')||a.type.localeCompare(b.type,'ru')):a.label.localeCompare(b.label,'ru'));
    return values;
  }
  function pruneCompanyFacets(records){
    for(const facet of visibleCompanyFacets()){
      if(state.companyView.touchedFacets?.has(facet))continue;
      setCompanyFacetSet(facet,new Set(companyFacetCatalog(records,facet).map(option=>option.key)));
    }
  }

  // Comparison and recommendation tabs use exactly the shared filters above.
  // There is no second hidden selection model for companies or tariffs.
  function analyticsSelectionSummary(type=analyticsMethod()){
    const records=filteredCompanyRecords().filter(record=>!type||deliveryTypeName(record.item)===type);
    return{companies:new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК')).size,tariffs:new Set(records.map(record=>companyFilterTariffKey(record.item))).size};
  }
  function renderAnalyticsTariffPickers(){
    const type=analyticsMethod(),records=filteredCompanyRecords().filter(record=>!type||deliveryTypeName(record.item)===type),enabledCompanies=[...new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК'))].sort((a,b)=>a.localeCompare(b,'ru'));
    if(els.managerCompanyFilter){els.managerCompanyFilter.innerHTML='<option value="">Все ТК общей выборки</option>';els.managerCompanyFilter.value='';}
    if(els.managerBaseCompanyFilter){const previous=els.managerBaseCompanyFilter.value;els.managerBaseCompanyFilter.innerHTML='<option value="cheapest">Минимальная цена в строке</option>'+enabledCompanies.map(company=>`<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');els.managerBaseCompanyFilter.value=previous==='cheapest'||enabledCompanies.includes(previous)?previous:'cheapest';}
  }
  function bestRouteCompanyRecords(filters={}){
    const hasMethod=Object.prototype.hasOwnProperty.call(filters,'method'),type=hasMethod?String(filters.method||''):analyticsMethod(),mode=filters.tariffMode||'cheapest',periodMax=validPeriod(filters.periodMax),result=[],byRow=new Map();
    filteredCompanyRecords().filter(record=>!type||deliveryTypeName(record.item)===type).forEach(record=>{
      const period=validPeriod(record.item.maxPeriod);if(periodMax!==null&&(period===null||period>periodMax))return;
      const price=optionalNumeric(record.item.userPrice,{positive:true});if(price===null)return;
      const company=record.item.deliveryCompanyLabel||'Неизвестная ТК';
      if(!byRow.has(record.rowIndex))byRow.set(record.rowIndex,{row:record.row,rowIndex:record.rowIndex,route:routeKey(record.row),companies:new Map()});
      const companies=byRow.get(record.rowIndex).companies;if(!companies.has(company))companies.set(company,[]);companies.get(company).push(record.item);
    });
    byRow.forEach(group=>{
      const selected=new Map();group.companies.forEach((items,company)=>{const item=selectAnalyticsTariff(items,mode);if(item)selected.set(company,item);});
      const prices=[...selected.values()].map(item=>optionalNumeric(item.userPrice,{positive:true})).filter(value=>value!==null);
      selected.forEach((item,company)=>{
        const others=[...selected.entries()].filter(([name])=>name!==company).map(([,entry])=>optionalNumeric(entry.userPrice,{positive:true})).filter(value=>value!==null);
        result.push({row:group.row,rowIndex:group.rowIndex,route:group.route,company,item,marketMin:others.length?Math.min(...others):null,routeMarketMin:prices.length?Math.min(...prices):null});
      });
    });
    return result;
  }
  function buildManagerRows(presetOverride=''){
    const preset=presetOverride||els.managerPresetSelect?.value||'custom',params=salesParams(preset,'manager');
    return bestRouteCompanyRecords(managerFilters()).map(record=>enrichSalesRecord(record,params)).sort((a,b)=>a.route.localeCompare(b.route,'ru')||(a.price??Infinity)-(b.price??Infinity));
  }
  function priceFloorModel(model,params){
    const ownMarginFloor=model.inputPrice!==null&&params.floorPercent<100?model.inputPrice/(1-params.floorPercent/100):null;
    const lkPriceFloor=model.minPrice,candidates=[];
    if(params.floorMode==='strict'){
      if(lkPriceFloor!==null)candidates.push({value:lkPriceFloor,label:'Минимальная цена ЛК'});
      if(ownMarginFloor!==null)candidates.push({value:ownMarginFloor,label:`Цена с маржой ${formatValue(params.floorPercent)}%`});
    }else if(params.floorMode==='lkPrice'&&lkPriceFloor!==null)candidates.push({value:lkPriceFloor,label:'Минимальная цена ЛК'});
    else if(params.floorMode==='ownMargin'&&ownMarginFloor!==null)candidates.push({value:ownMarginFloor,label:`Цена с маржой ${formatValue(params.floorPercent)}%`});
    if(!candidates.length)return{floorPrice:null,floorSource:params.floorMode==='ownMargin'?'Нет входа для расчёта маржи':'Минимальная цена недоступна'};
    candidates.sort((a,b)=>b.value-a.value);return{floorPrice:candidates[0].value,floorSource:candidates[0].label};
  }
  function enrichSalesRecord(record,params){
    const model=tariffPriceModel(record.item),price=model.userPrice,marketGap=price!==null&&record.marketMin&&record.marketMin>0?(price-record.marketMin)/record.marketMin*100:null,{floorPrice,floorSource}=priceFloorModel(model,params),marketTarget=record.marketMin&&record.marketMin>0?record.marketMin*(1-params.beat/100):null,currentBelowFloor=price!==null&&floorPrice!==null&&price<floorPrice,safeDiscount=price!==null&&floorPrice!==null&&!currentBelowFloor?Math.max(0,(price-floorPrice)/price*100):currentBelowFloor?0:null;
    let recommendedPrice=null,recommendedDiscount=null,recommendationStatus='';
    if(price===null)recommendationStatus='Нет цены клиента';
    else if(floorPrice===null)recommendationStatus='Не хватает данных для ограничения цены';
    else if(currentBelowFloor){recommendedPrice=floorPrice;recommendedDiscount=0;recommendationStatus='Поднять цену до допустимого минимума';}
    else if(marketTarget===null){recommendedPrice=price;recommendedDiscount=0;recommendationStatus='Нет другой ТК для сравнения';}
    else if(price<=marketTarget){recommendedPrice=price;recommendedDiscount=0;recommendationStatus='Цена уже конкурентнее альтернативы';}
    else{
      recommendedPrice=Math.max(floorPrice,marketTarget);recommendedDiscount=Math.max(0,(price-recommendedPrice)/price*100);
      recommendationStatus=recommendedPrice>marketTarget?'Скидку ограничивает допустимый минимум':'Можно снизить цену и стать конкурентнее';
    }
    return{...record,price,priceWithoutDiscount:model.userPriceWithoutDiscount,input:model.inputPrice,inputPercent:model.inputPricePercent,minAllowedPrice:model.minPrice,minAllowedPercent:model.minPricePercent,retail:model.retailPrice,activeDiscount:model.activeDiscountPct,margin:model.marginRub,marginPct:model.marginPct,clientDiscount:model.clientDiscountPct,retailDiscount:model.retailDiscountPct,marketGap,marketTarget,floorPrice,floorSource,currentBelowFloor,safeDiscount,recommendedPrice,recommendedDiscount,recommendationStatus};
  }
  function managerSalesColumns(rows=buildManagerRows()){
    const any=key=>rows.some(record=>record[key]!==null&&record[key]!==undefined&&Number.isFinite(Number(record[key])));
    return[
      {key:'route',label:'Маршрут'},{key:'cargo',label:'Груз'},{key:'company',label:'ТК'},...(usesUrgencyView()?[{key:'urgency',label:'Срочность'}]:[]),{key:'tariff',label:'Тариф'},{key:'method',label:'Тип доставки'},
      {key:'period',label:'Макс. срок',tip:'Используется максимальный срок. Ноль отображается как «По запросу».'},{key:'price',label:'Текущая цена клиенту',tip:'Фактическая цена выбранного тарифа для клиента.'},
      ...(any('priceWithoutDiscount')?[{key:'priceWithoutDiscount',label:'Цена без персональной скидки',tip:'Цена до дополнительной скидки конкретного клиента.'}]:[]),
      ...(any('clientDiscount')?[{key:'clientDiscount',label:'Персональная скидка, %',tip:'Дополнительная скидка клиента. 0% означает, что персональной скидки нет.'}]:[]),
      ...(any('activeDiscount')?[{key:'activeDiscount',label:'Активная скидка ЛК, %',tip:'Скидка, переданная личным кабинетом. Не равна персональной скидке клиента.'}]:[]),
      ...(any('input')?[{key:'input',label:'Вход',tip:'Себестоимость тарифа.'},{key:'marginPct',label:'Маржа, %',tip:'Доля разницы между ценой клиенту и входом в цене продажи.'}]:[]),
      ...(any('minAllowedPrice')?[{key:'minAllowedPrice',label:'Минимум ЛК',tip:'Минимальная допустимая цена из ответа личного кабинета.'}]:[]),
      ...(any('retail')?[{key:'retail',label:'Розница',tip:'Розничная цена, когда она доступна.'},{key:'retailDiscount',label:'Скидка от розницы, %',tip:'Разница между розницей и текущей ценой клиенту.'}]:[]),
      {key:'marketMin',label:'Лучшая цена другой ТК',tip:'Минимальная цена другой выбранной ТК на том же маршруте и типе доставки.'},
      {key:'marketGap',label:'Разница с альтернативой, %',tip:'Отрицательное значение — текущая ТК дешевле; положительное — дороже лучшей другой ТК.'},
      {key:'floorPrice',label:'Минимально допустимая цена',tip:'Ниже этой цены нельзя опускаться: минимум ЛК, заданная маржа или более строгое из двух.'},
      {key:'safeDiscount',label:'Макс. безопасная скидка, %',tip:'Сколько можно дополнительно снизить от текущей цены до допустимого минимума.'},
      {key:'recommendedPrice',label:'Цена для предложения',tip:'Цена, которую можно предложить клиенту: конкурентнее другой ТК, но не ниже допустимого минимума.'},
      {key:'recommendedDiscount',label:'Доп. скидка до рекомендации, %',tip:'Дополнительное снижение от текущей цены до цены для предложения.'},{key:'status',label:'Вывод для сотрудника'}
    ];
  }
  function renderManagerTable(markUpdated=false){
    if(!els.managerTableBody)return;syncAnalyticsMethod(els.managerMethodFilter?.value||analyticsMethod());const matrix=els.managerViewSelect?.value==='matrix';
    els.managerCompanyFilterLabel?.classList.add('hidden');els.managerPresetLabel?.classList.toggle('hidden',matrix);els.managerFloorModeLabel?.classList.toggle('hidden',matrix);els.managerFloorPercentLabel?.classList.toggle('hidden',matrix);els.managerBeatMarketLabel?.classList.toggle('hidden',matrix);els.managerBaseCompanyLabel?.classList.toggle('hidden',!matrix);
    state.settings.managerView=matrix?'matrix':'recommendations';state.settings.managerBaseCompany=els.managerBaseCompanyFilter?.value||'cheapest';state.settings.managerTariffMode=els.managerTariffModeSelect?.value||'cheapest';state.settings.managerPeriodMax=validPeriod(els.managerPeriodMax?.value)||'';state.settings.managerMethod=analyticsMethod();state.settings.managerPreset=els.managerPresetSelect?.value||'custom';state.settings.managerFloorMode=['strict','lkPrice','ownMargin'].includes(els.managerFloorModeSelect?.value)?els.managerFloorModeSelect.value:'strict';state.settings.managerFloorPercent=clampNumber(els.managerFloorPercentInput?.value,10,0,99);state.settings.managerBeatMarketPct=clampNumber(els.managerBeatMarketInput?.value,1,0,30);persistSettings();
    if(matrix)renderManagerMatrix();else renderManagerRecommendations();if(markUpdated&&els.managerUpdatedAt){els.managerUpdatedAt.textContent=`Обновлено ${analyticsTimestamp()}`;els.managerUpdatedAt.classList.remove('analytics-dirty');els.managerUpdatedAt.closest('.analytics-auto-status')?.classList.remove('updating');els.managerUpdatedAt.closest('.analytics-auto-status')?.classList.add('updated');state.analyticsDirty.manager=false;}
  }
  function metricDirectionText(metric){
    if(['recommendedPrice'].includes(metric.key))return'Как читать: это целевая цена, а не рейтинг. Ниже — конкурентнее, но цена не должна пересекать допустимый минимум.';
    if(['recommendedDiscountPct','safeDiscountPct'].includes(metric.key))return'Как читать: больше — больше доступный запас для дополнительной скидки. Всегда проверяйте ограничение цены.';
    return metric.lowerBetter?'Как читать: меньше — лучше. Первая строка показывает лучший результат.':'Как читать: больше — лучше. Первая строка показывает лучший результат.';
  }
  function renderComparison(markUpdated=false){
    renderComparisonLegacy(markUpdated);
    els.comparisonCharts?.querySelectorAll('.comparison-chart-card').forEach(card=>{
      const title=card.querySelector('h4')?.textContent?.replace('?','').trim(),metric=COMPARISON_METRICS.find(item=>item.label===title);if(!metric)return;
      const direction=document.createElement('p');direction.className='chart-direction';direction.textContent=metricDirectionText(metric);
      const description=card.querySelector('h4 + p');if(description)description.insertAdjacentElement('afterend',direction);else card.querySelector('h4')?.insertAdjacentElement('afterend',direction);
      const best=card.querySelector('.chart-row.best .chart-label')?.textContent?.trim(),value=card.querySelector('.chart-row.best .chart-value')?.textContent?.trim();if(best&&value){const conclusion=document.createElement('div');conclusion.className='chart-conclusion';conclusion.innerHTML=`<b>Вывод:</b> лучший результат — ${escapeHtml(best)} (${escapeHtml(value)}).`;card.appendChild(conclusion);}
    });
  }
  function initV22TableScrolling(){/* Native scroll containers are used in v2.3; no wheel interception. */}

  /* ===== v2.4 sales usability, decision hints and richer tariff analytics ===== */
  const SALES_COMPARISON_METRICS = [
    { key:'discountOpportunityPct', label:'Маршрутов с возможной скидкой', unit:'%', lowerBetter:false, tip:'Доля предложений, где можно снизить цену относительно текущей и не выйти ниже выбранного ограничения.' },
    { key:'avgPotentialSavingsRub', label:'Средний резерв скидки', unit:'₽', lowerBetter:false, tip:'Средняя сумма, на которую можно снизить текущую цену до рекомендованной цены. Считается только там, где резерв положительный.' },
    { key:'needsPriceIncreasePct', label:'Ниже допустимого минимума', unit:'%', lowerBetter:true, tip:'Доля предложений, где текущая цена уже ниже выбранной нижней границы и цену лучше поднять.' },
    { key:'noAlternativePct', label:'Без альтернативы для сравнения', unit:'%', lowerBetter:true, tip:'Доля предложений, где нет другой выбранной ТК на том же маршруте и типе доставки.' }
  ];
  SALES_COMPARISON_METRICS.forEach(metric=>{
    if(!COMPARISON_METRICS.some(item=>item.key===metric.key))COMPARISON_METRICS.push(metric);
  });
  COMPARISON_PRESETS.sale = ['minPrice','marketGapPct','discountOpportunityPct','avgPotentialSavingsRub','safeDiscountPct','recommendedDiscountPct','needsPriceIncreasePct'];
  COMPARISON_PRESETS.discount = ['discountOpportunityPct','avgPotentialSavingsRub','avgClientDiscount','avgActiveDiscount','avgRetailDiscount','safeDiscountPct','recommendedPrice','recommendedDiscountPct'];
  DEFAULT_SETTINGS.comparisonMetrics = [...COMPARISON_PRESETS.sale];

  function salesPotentialSavings(record){
    if(record.price===null||record.recommendedPrice===null)return null;
    return Math.max(0,record.price-record.recommendedPrice);
  }
  function salesPriority(record){
    const savings=salesPotentialSavings(record);
    if(record.currentBelowFloor)return{tone:'bad',label:'Поднять цену',details:`ниже минимума ${moneyOrDash(record.floorPrice,{positive:true})}`,rank:0};
    if(record.marketMin===null)return{tone:'neutral',label:'Нет альтернативы',details:'нет другой ТК на маршруте',rank:4};
    if(savings!==null&&savings>0)return{tone:'warn',label:'Можно дать скидку',details:`резерв ${moneyOrDash(savings,{positive:true})}`,rank:1};
    if(record.marketGap!==null&&record.marketGap<=0)return{tone:'ok',label:'Цена сильная',details:'уже не дороже рынка',rank:2};
    if(record.floorPrice===null)return{tone:'neutral',label:'Проверить вручную',details:'нет нижней границы',rank:5};
    return{tone:'info',label:'Малый запас',details:'скидка почти не нужна',rank:3};
  }
  function enrichSalesRecord(record,params){
    const model=tariffPriceModel(record.item),price=model.userPrice,marketGap=price!==null&&record.marketMin&&record.marketMin>0?(price-record.marketMin)/record.marketMin*100:null,{floorPrice,floorSource}=priceFloorModel(model,params),marketTarget=record.marketMin&&record.marketMin>0?record.marketMin*(1-params.beat/100):null,currentBelowFloor=price!==null&&floorPrice!==null&&price<floorPrice,safeDiscount=price!==null&&floorPrice!==null&&!currentBelowFloor?Math.max(0,(price-floorPrice)/price*100):currentBelowFloor?0:null;
    let recommendedPrice=null,recommendedDiscount=null,recommendationStatus='';
    if(price===null)recommendationStatus='Нет цены клиента';
    else if(floorPrice===null)recommendationStatus='Не хватает данных для ограничения цены';
    else if(currentBelowFloor){recommendedPrice=floorPrice;recommendedDiscount=0;recommendationStatus='Поднять цену до допустимого минимума';}
    else if(marketTarget===null){recommendedPrice=price;recommendedDiscount=0;recommendationStatus='Нет другой ТК для сравнения';}
    else if(price<=marketTarget){recommendedPrice=price;recommendedDiscount=0;recommendationStatus='Цена уже конкурентнее альтернативы';}
    else{
      recommendedPrice=Math.max(floorPrice,marketTarget);recommendedDiscount=Math.max(0,(price-recommendedPrice)/price*100);
      recommendationStatus=recommendedPrice>marketTarget?'Скидку ограничивает допустимый минимум':'Можно снизить цену и стать конкурентнее';
    }
    const enriched={...record,price,priceWithoutDiscount:model.userPriceWithoutDiscount,input:model.inputPrice,inputPercent:model.inputPricePercent,minAllowedPrice:model.minPrice,minAllowedPercent:model.minPricePercent,retail:model.retailPrice,activeDiscount:model.activeDiscountPct,margin:model.marginRub,marginPct:model.marginPct,clientDiscount:model.clientDiscountPct,retailDiscount:model.retailDiscountPct,marketGap,marketTarget,floorPrice,floorSource,currentBelowFloor,safeDiscount,recommendedPrice,recommendedDiscount,recommendationStatus};
    const priority=salesPriority(enriched);
    return{...enriched,priority:priority.label,priorityDetails:priority.details,priorityTone:priority.tone,priorityRank:priority.rank,potentialSavingsRub:salesPotentialSavings(enriched)};
  }
  function comparisonStats(){
    const params=salesParams('custom','comparison'),filters=comparisonFilters(),records=bestRouteCompanyRecords(filters).map(record=>enrichSalesRecord(record,params)),scopeRows=new Set(filteredCompanyRecords().filter(record=>deliveryTypeName(record.item)===filters.method).map(record=>record.rowIndex)),groups=new Map();
    records.forEach(record=>{if(!groups.has(record.company))groups.set(record.company,[]);groups.get(record.company).push(record);});
    return[...groups.entries()].map(([company,items])=>{
      const values=key=>items.map(item=>item[key]).filter(value=>Number.isFinite(value)),prices=values('price'),periods=items.map(item=>validPeriod(item.item.maxPeriod)).filter(value=>value!==null),services=items.map(item=>optionalNumeric(item.item.servicesPrice,{nonNegative:true})).filter(value=>value!==null),wins=items.filter(item=>item.routeMarketMin&&item.price!==null&&Math.abs(item.price-item.routeMarketMin)<.01).length,opportunities=items.filter(item=>Number(item.potentialSavingsRub)>0),needsIncrease=items.filter(item=>item.currentBelowFloor),withoutAlternative=items.filter(item=>item.marketMin===null);
      return{company,minPrice:prices.length?Math.min(...prices):null,avgPrice:averageOrNull(prices),maxPrice:prices.length?Math.max(...prices):null,avgPriceWithoutDiscount:averageOrNull(values('priceWithoutDiscount')),avgInput:averageOrNull(values('input')),avgMinAllowedPrice:averageOrNull(values('minAllowedPrice')),avgRetail:averageOrNull(values('retail')),bestPeriod:periods.length?Math.min(...periods):null,avgPeriod:averageOrNull(periods),avgMarginRub:averageOrNull(values('margin')),avgMarginPct:averageOrNull(values('marginPct')),avgRetailDiscount:averageOrNull(values('retailDiscount')),avgClientDiscount:averageOrNull(values('clientDiscount')),avgActiveDiscount:averageOrNull(values('activeDiscount')),marketGapPct:averageOrNull(values('marketGap')),safeDiscountPct:averageOrNull(values('safeDiscount')),recommendedPrice:averageOrNull(values('recommendedPrice')),recommendedDiscountPct:averageOrNull(values('recommendedDiscount')),avgServicesPrice:averageOrNull(services),winRatePct:items.length?wins/items.length*100:null,offersCount:items.length,coveragePct:scopeRows.size?new Set(items.map(item=>item.rowIndex)).size/scopeRows.size*100:null,discountOpportunityPct:items.length?opportunities.length/items.length*100:null,avgPotentialSavingsRub:averageOrNull(opportunities.map(item=>item.potentialSavingsRub)),needsPriceIncreasePct:items.length?needsIncrease.length/items.length*100:null,noAlternativePct:items.length?withoutAlternative.length/items.length*100:null,records:items};
    });
  }
  function managerSalesColumns(rows=buildManagerRows()){
    const any=key=>rows.some(record=>record[key]!==null&&record[key]!==undefined&&Number.isFinite(Number(record[key])));
    return[
      {key:'priority',label:'Действие',tip:'Короткая подсказка для менеджера: дать скидку, поднять цену, оставить как есть или проверить вручную.'},
      {key:'route',label:'Маршрут'},{key:'cargo',label:'Груз'},{key:'company',label:'ТК'},...(usesUrgencyView()?[{key:'urgency',label:'Срочность'}]:[]),{key:'tariff',label:'Тариф'},{key:'method',label:'Тип доставки'},
      {key:'period',label:'Макс. срок',tip:'Используется максимальный срок. Ноль отображается как «По запросу».'},{key:'price',label:'Текущая цена клиенту',tip:'Фактическая цена выбранного тарифа для клиента.'},
      ...(any('priceWithoutDiscount')?[{key:'priceWithoutDiscount',label:'Цена без персональной скидки',tip:'Цена до дополнительной скидки конкретного клиента.'}]:[]),
      ...(any('clientDiscount')?[{key:'clientDiscount',label:'Персональная скидка, %',tip:'Дополнительная скидка клиента. 0% означает, что персональной скидки нет.'}]:[]),
      ...(any('activeDiscount')?[{key:'activeDiscount',label:'Активная скидка ЛК, %',tip:'Скидка, переданная личным кабинетом. Не равна персональной скидке клиента.'}]:[]),
      ...(any('input')?[{key:'input',label:'Вход',tip:'Себестоимость тарифа.'},{key:'marginPct',label:'Маржа, %',tip:'Доля разницы между ценой клиенту и входом в цене продажи.'}]:[]),
      ...(any('minAllowedPrice')?[{key:'minAllowedPrice',label:'Минимум ЛК',tip:'Минимальная допустимая цена из ответа личного кабинета.'}]:[]),
      ...(any('retail')?[{key:'retail',label:'Розница',tip:'Розничная цена, когда она доступна.'},{key:'retailDiscount',label:'Скидка от розницы, %',tip:'Разница между розницей и текущей ценой клиенту.'}]:[]),
      {key:'marketMin',label:'Лучшая цена другой ТК',tip:'Минимальная цена другой выбранной ТК на том же маршруте и типе доставки.'},
      {key:'marketGap',label:'Разница с альтернативой, %',tip:'Отрицательное значение — текущая ТК дешевле; положительное — дороже лучшей другой ТК.'},
      {key:'floorPrice',label:'Минимально допустимая цена',tip:'Ниже этой цены нельзя опускаться: минимум ЛК, заданная маржа или более строгое из двух.'},
      {key:'safeDiscount',label:'Макс. безопасная скидка, %',tip:'Сколько можно дополнительно снизить от текущей цены до допустимого минимума.'},
      {key:'potentialSavingsRub',label:'Резерв скидки, ₽',tip:'Разница между текущей ценой и рекомендованной ценой. Показывает запас для переговоров в рублях.'},
      {key:'recommendedPrice',label:'Цена для предложения',tip:'Цена, которую можно предложить клиенту: конкурентнее другой ТК, но не ниже допустимого минимума.'},
      {key:'recommendedDiscount',label:'Доп. скидка до рекомендации, %',tip:'Дополнительное снижение от текущей цены до цены для предложения.'},{key:'status',label:'Вывод для сотрудника'}
    ];
  }
  function managerExportValue(record,key){
    const values={priority:`${record.priority}${record.priorityDetails?` — ${record.priorityDetails}`:''}`,route:record.route,cargo:`${parsePositive(record.row.weight,.1)} кг · ${Math.round(parsePositive(record.row.seats,1))} м. · ${parsePositive(record.row.length,10)}×${parsePositive(record.row.width,10)}×${parsePositive(record.row.height,10)}`,
      company:record.company,urgency:record.item.urgencyLabel||'',tariff:tariffDisplayName(record.item),method:record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'',period:periodExportValue(record.item.maxPeriod),
      price:record.price,priceWithoutDiscount:record.priceWithoutDiscount,clientDiscount:record.clientDiscount,activeDiscount:record.activeDiscount,input:record.input,marginPct:record.marginPct,
      minAllowedPrice:record.minAllowedPrice,retail:record.retail,retailDiscount:record.retailDiscount,marketMin:record.marketMin,marketGap:record.marketGap,floorPrice:record.floorPrice,
      safeDiscount:record.safeDiscount,potentialSavingsRub:record.potentialSavingsRub,recommendedPrice:record.recommendedPrice,recommendedDiscount:record.recommendedDiscount,status:record.recommendationStatus};
    const value=values[key];return typeof value==='number'&&Number.isFinite(value)?round2(value):(value??'');
  }
  function managerCellMarkup(record,key){
    const gapClass=record.marketGap===null?'':record.marketGap<=0?'status-good':record.marketGap<=5?'status-warn':'status-bad',priorityClass=`recommendation-status ${record.priorityTone||'neutral'}`;
    const cells={
      priority:`<td><span class="${priorityClass}">${escapeHtml(record.priority||'Проверить')}</span>${record.priorityDetails?`<small class="cell-note">${escapeHtml(record.priorityDetails)}</small>`:''}</td>`,
      route:`<td class="route-cell">${escapeHtml(record.route)}</td>`,
      cargo:`<td>${escapeHtml(`${formatValue(parsePositive(record.row.weight,.1))} кг · ${Math.round(parsePositive(record.row.seats,1))} м. · ${formatValue(parsePositive(record.row.length,10))}×${formatValue(parsePositive(record.row.width,10))}×${formatValue(parsePositive(record.row.height,10))}`)}</td>`,
      company:`<td>${escapeHtml(record.company)}</td>`,urgency:`<td><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(record.item))}</span></td>`,
      tariff:`<td>${escapeHtml(tariffDisplayName(record.item))}</td>`,method:`<td>${escapeHtml(record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'—')}</td>`,period:`<td>${escapeHtml(formatTerm(record.item))}</td>`,
      price:`<td><b>${escapeHtml(moneyOrDash(record.price,{positive:true}))}</b></td>`,priceWithoutDiscount:`<td>${escapeHtml(moneyOrDash(record.priceWithoutDiscount,{positive:true}))}</td>`,
      clientDiscount:`<td>${escapeHtml(percentOrDash(record.clientDiscount))}</td>`,activeDiscount:`<td>${escapeHtml(percentOrDash(record.activeDiscount))}</td>`,
      input:`<td>${escapeHtml(moneyOrDash(record.input,{nonNegative:true}))}</td>`,marginPct:`<td>${escapeHtml(percentOrDash(record.marginPct))}</td>`,
      minAllowedPrice:`<td>${escapeHtml(moneyOrDash(record.minAllowedPrice,{positive:true}))}</td>`,retail:`<td>${escapeHtml(moneyOrDash(record.retail,{positive:true}))}</td>`,retailDiscount:`<td>${escapeHtml(percentOrDash(record.retailDiscount))}</td>`,
      marketMin:`<td>${escapeHtml(moneyOrDash(record.marketMin,{positive:true}))}</td>`,marketGap:`<td class="${gapClass}">${escapeHtml(percentOrDash(record.marketGap))}</td>`,
      floorPrice:`<td>${record.floorPrice===null?'—':`${escapeHtml(formatValue(round2(record.floorPrice)))} ₽`}<small class="cell-note">${escapeHtml(record.floorSource||'')}</small></td>`,
      safeDiscount:`<td>${escapeHtml(percentOrDash(record.safeDiscount))}</td>`,potentialSavingsRub:`<td>${escapeHtml(moneyOrDash(record.potentialSavingsRub,{positive:true}))}</td>`,
      recommendedPrice:`<td><b>${record.recommendedPrice===null?'—':`${escapeHtml(formatValue(round2(record.recommendedPrice)))} ₽`}</b></td>`,
      recommendedDiscount:`<td>${escapeHtml(percentOrDash(record.recommendedDiscount))}</td>`,status:`<td><span class="${priorityClass}">${escapeHtml(record.recommendationStatus)}</span></td>`
    };
    return cells[key]||'<td>—</td>';
  }
  function salesSummaryCards(rows){
    const count=rows.length,routeCount=new Set(rows.map(record=>record.rowIndex)).size,companyCount=new Set(rows.map(record=>record.company)).size,opportunities=rows.filter(record=>Number(record.potentialSavingsRub)>0),belowFloor=rows.filter(record=>record.currentBelowFloor),strong=rows.filter(record=>record.marketGap!==null&&record.marketGap<=0),withoutAlternative=rows.filter(record=>record.marketMin===null),savings=opportunities.map(record=>record.potentialSavingsRub).filter(Number.isFinite);
    return[
      {label:'Источник',value:`${state.rows.filter(row=>row.result).length} расчётов`,tone:''},
      {label:'Маршрутов / ТК',value:`${routeCount} / ${companyCount}`,tone:''},
      {label:'Можно дать скидку',value:count?`${opportunities.length} из ${count}`:'—',note:savings.length?`средний резерв ${moneyOrDash(averageOrNull(savings),{positive:true})}`:'резерва нет',tone:'warn'},
      {label:'Ниже минимума',value:count?`${belowFloor.length} из ${count}`:'—',note:'лучше поднять цену',tone:belowFloor.length?'bad':''},
      {label:'Цена уже сильная',value:count?`${strong.length} из ${count}`:'—',note:'не дороже альтернативы',tone:'ok'},
      {label:'Без альтернативы',value:count?`${withoutAlternative.length} из ${count}`:'—',note:'нужна ручная проверка',tone:withoutAlternative.length?'neutral':''}
    ];
  }
  function renderManagerRecommendations(){
    const rows=buildManagerRows().sort((a,b)=>(a.priorityRank??9)-(b.priorityRank??9)||a.route.localeCompare(b.route,'ru')||(a.price??Infinity)-(b.price??Infinity));
    renderManagerColumnSelector(rows);
    const columns=managerSalesColumns(rows);
    els.managerSummary.innerHTML=salesSummaryCards(rows).map(card=>`<div class="metric sales-metric ${card.tone||''}"><span>${escapeHtml(card.label)}</span><b>${escapeHtml(card.value)}</b>${card.note?`<small>${escapeHtml(card.note)}</small>`:''}</div>`).join('');
    if(!columns.length){els.managerTableHead.innerHTML='';els.managerTableBody.innerHTML='<tr><td class="empty-tariffs">Выберите хотя бы одну колонку в настройках таблицы.</td></tr>';return;}
    els.managerTableHead.innerHTML=`<tr>${columns.map(column=>`<th${column.tip?` data-tip="${escapeHtml(column.tip)}"`:''}>${escapeHtml(column.label)}</th>`).join('')}</tr>`;
    if(!rows.length){els.managerTableBody.innerHTML=`<tr><td colspan="${columns.length}" class="empty-tariffs">Нет данных по текущим расчётам и выбранным фильтрам. Проверьте общую выборку: ТК, тип доставки, тарифы и диапазон цен.</td></tr>`;return;}
    els.managerTableBody.innerHTML=rows.map(record=>`<tr class="sales-priority-row ${escapeHtml(record.priorityTone||'neutral')}">${columns.map(column=>managerCellMarkup(record,column.key)).join('')}</tr>`).join('');
  }
  function comparisonInsightHtml(stats=comparisonStats()){
    const records=stats.flatMap(stat=>stat.records||[]),opportunities=records.filter(record=>Number(record.potentialSavingsRub)>0),belowFloor=records.filter(record=>record.currentBelowFloor),withoutAlternative=records.filter(record=>record.marketMin===null),bestPrice=[...stats].filter(stat=>hasMetricValue(stat.minPrice)).sort((a,b)=>a.minPrice-b.minPrice)[0],bestSavings=[...stats].filter(stat=>hasMetricValue(stat.avgPotentialSavingsRub)).sort((a,b)=>b.avgPotentialSavingsRub-a.avgPotentialSavingsRub)[0],count=records.length;
    if(!count)return'';
    const cards=[
      {label:'Лидер по цене',value:bestPrice?`${bestPrice.company} · ${formatMetric(COMPARISON_METRICS.find(metric=>metric.key==='minPrice'),bestPrice.minPrice)}`:'—',tone:'ok'},
      {label:'Где есть резерв скидки',value:bestSavings?`${bestSavings.company} · ${formatMetric(COMPARISON_METRICS.find(metric=>metric.key==='avgPotentialSavingsRub'),bestSavings.avgPotentialSavingsRub)}`:'—',tone:'warn'},
      {label:'Можно снижать цену',value:`${opportunities.length} из ${count}`,note:'есть безопасный резерв',tone:'warn'},
      {label:'Ниже минимума',value:`${belowFloor.length} из ${count}`,note:'риск убыточной/недопустимой цены',tone:belowFloor.length?'bad':'ok'},
      {label:'Без альтернативы',value:`${withoutAlternative.length} из ${count}`,note:'не с чем сравнить рынок',tone:withoutAlternative.length?'neutral':'ok'}
    ];
    return`<section class="sales-insights">${cards.map(card=>`<div class="sales-insight-card ${card.tone||''}"><span>${escapeHtml(card.label)}</span><b>${escapeHtml(card.value)}</b>${card.note?`<small>${escapeHtml(card.note)}</small>`:''}</div>`).join('')}</section>`;
  }
  function metricDirectionText(metric){
    if(['recommendedPrice'].includes(metric.key))return'Как читать: это целевая цена, а не рейтинг. Ниже — конкурентнее, но цена не должна пересекать допустимый минимум.';
    if(['recommendedDiscountPct','safeDiscountPct','discountOpportunityPct','avgPotentialSavingsRub'].includes(metric.key))return'Как читать: больше — больше запас для переговоров. Перед скидкой проверьте нижнюю границу цены.';
    if(['needsPriceIncreasePct','noAlternativePct'].includes(metric.key))return'Как читать: меньше — лучше. Высокое значение показывает риск или нехватку рынка для сравнения.';
    return metric.lowerBetter?'Как читать: меньше — лучше. Первая строка показывает лучший результат.':'Как читать: больше — лучше. Первая строка показывает лучший результат.';
  }
  function renderComparison(markUpdated=false){
    renderComparisonLegacy(markUpdated);
    if(els.comparisonCharts){els.comparisonCharts.insertAdjacentHTML('afterbegin',comparisonInsightHtml());}
    els.comparisonCharts?.querySelectorAll('.comparison-chart-card').forEach(card=>{
      const title=card.querySelector('h4')?.textContent?.replace('?','').trim(),metric=COMPARISON_METRICS.find(item=>item.label===title);if(!metric)return;
      const direction=document.createElement('p');direction.className='chart-direction';direction.textContent=metricDirectionText(metric);
      const description=card.querySelector('h4 + p');if(description)description.insertAdjacentElement('afterend',direction);else card.querySelector('h4')?.insertAdjacentElement('afterend',direction);
      const best=card.querySelector('.chart-row.best .chart-label')?.textContent?.trim(),value=card.querySelector('.chart-row.best .chart-value')?.textContent?.trim();if(best&&value){const conclusion=document.createElement('div');conclusion.className='chart-conclusion';conclusion.innerHTML=`<b>Вывод:</b> лучший результат — ${escapeHtml(best)} (${escapeHtml(value)}).`;card.appendChild(conclusion);}
    });
  }

  /* ===== v2.5 interface refactor, separate price matrix and LK percent floor ===== */
  function lkPercentBase(model){
    return model.inputPrice;
  }
  function lkFloorCandidates(model){
    const candidates=[];
    if(model.minPrice!==null)return[{value:model.minPrice,label:'Минимум ЛК'}].filter(item=>Number.isFinite(item.value)&&item.value>0);
    const base=lkPercentBase(model);
    if(base!==null&&model.minPricePercent!==null)candidates.push({value:base*model.minPricePercent/100,label:`${formatValue(model.minPricePercent)}% от входа`});
    return candidates.filter(item=>Number.isFinite(item.value)&&item.value>0);
  }
  function priceFloorModel(model,params){
    const lkCandidates=lkFloorCandidates(model);
    const ownMarginFloor=model.inputPrice!==null&&params.floorPercent<100?model.inputPrice/(1-params.floorPercent/100):null;
    const candidates=[];
    if(params.floorMode==='strict'){
      candidates.push(...lkCandidates);
      if(ownMarginFloor!==null)candidates.push({value:ownMarginFloor,label:`Своя маржа ${formatValue(params.floorPercent)}%`});
    }else if(params.floorMode==='lkPrice')candidates.push(...lkCandidates);
    else if(params.floorMode==='ownMargin'&&ownMarginFloor!==null)candidates.push({value:ownMarginFloor,label:`Своя маржа ${formatValue(params.floorPercent)}%`});
    if(!candidates.length)return{floorPrice:null,floorSource:params.floorMode==='ownMargin'?'Нет входа для расчёта маржи':'Нет суммы или процента минимума ЛК'};
    candidates.sort((a,b)=>b.value-a.value);
    return{floorPrice:candidates[0].value,floorSource:candidates[0].label};
  }
  function enrichSalesRecord(record,params){
    const model=tariffPriceModel(record.item),price=model.userPrice,lkPercentFloor=lkFloorCandidates(model).find(item=>item.label.includes('%'))?.value??null,marketGap=price!==null&&record.marketMin&&record.marketMin>0?(price-record.marketMin)/record.marketMin*100:null,{floorPrice,floorSource}=priceFloorModel(model,params),marketTarget=record.marketMin&&record.marketMin>0?record.marketMin*(1-params.beat/100):null,currentBelowFloor=price!==null&&floorPrice!==null&&price<floorPrice,safeDiscount=price!==null&&floorPrice!==null&&!currentBelowFloor?Math.max(0,(price-floorPrice)/price*100):currentBelowFloor?0:null;
    let recommendedPrice=null,recommendedDiscount=null,recommendationStatus='';
    if(price===null)recommendationStatus='Нет цены клиента';
    else if(floorPrice===null)recommendationStatus='Не хватает данных для ограничения цены';
    else if(currentBelowFloor){recommendedPrice=floorPrice;recommendedDiscount=0;recommendationStatus='Поднять цену до допустимого минимума';}
    else if(marketTarget===null){recommendedPrice=price;recommendedDiscount=0;recommendationStatus='Нет другой ТК для сравнения';}
    else if(price<=marketTarget){recommendedPrice=price;recommendedDiscount=0;recommendationStatus='Цена уже конкурентнее альтернативы';}
    else{
      recommendedPrice=Math.max(floorPrice,marketTarget);recommendedDiscount=Math.max(0,(price-recommendedPrice)/price*100);
      recommendationStatus=recommendedPrice>marketTarget?'Скидку ограничивает допустимый минимум':'Можно снизить цену и стать конкурентнее';
    }
    const enriched={...record,price,priceWithoutDiscount:model.userPriceWithoutDiscount,input:model.inputPrice,inputPercent:model.inputPricePercent,minAllowedPrice:model.minPrice,minAllowedPercent:model.minPricePercent,minPercentFloor:lkPercentFloor,retail:model.retailPrice,activeDiscount:model.activeDiscountPct,margin:model.marginRub,marginPct:model.marginPct,clientDiscount:model.clientDiscountPct,retailDiscount:model.retailDiscountPct,marketGap,marketTarget,floorPrice,floorSource,currentBelowFloor,safeDiscount,recommendedPrice,recommendedDiscount,recommendationStatus};
    const priority=salesPriority(enriched);
    return{...enriched,priority:priority.label,priorityDetails:priority.details,priorityTone:priority.tone,priorityRank:priority.rank,potentialSavingsRub:salesPotentialSavings(enriched)};
  }
  function managerSalesColumns(rows=buildManagerRows()){
    const any=key=>rows.some(record=>record[key]!==null&&record[key]!==undefined&&Number.isFinite(Number(record[key])));
    return[
      {key:'priority',label:'Действие',tip:'Короткая подсказка для менеджера: дать скидку, поднять цену, оставить как есть или проверить вручную.'},
      {key:'route',label:'Маршрут'},{key:'cargo',label:'Груз'},{key:'company',label:'ТК'},...(usesUrgencyView()?[{key:'urgency',label:'Срочность'}]:[]),{key:'tariff',label:'Тариф'},{key:'method',label:'Тип доставки'},
      {key:'period',label:'Макс. срок',tip:'Используется максимальный срок. Ноль отображается как «По запросу».'},{key:'price',label:'Текущая цена клиенту',tip:'Фактическая цена выбранного тарифа для клиента.'},
      ...(any('priceWithoutDiscount')?[{key:'priceWithoutDiscount',label:'Цена без персональной скидки',tip:'Цена до дополнительной скидки конкретного клиента.'}]:[]),
      ...(any('clientDiscount')?[{key:'clientDiscount',label:'Персональная скидка, %',tip:'Дополнительная скидка клиента. 0% означает, что персональной скидки нет.'}]:[]),
      ...(any('activeDiscount')?[{key:'activeDiscount',label:'Активная скидка ЛК, %',tip:'Скидка, переданная личным кабинетом. Не равна персональной скидке клиента.'}]:[]),
      ...(any('input')?[{key:'input',label:'Вход',tip:'Себестоимость тарифа.'},{key:'marginPct',label:'Маржа, %',tip:'Доля разницы между ценой клиенту и входом в цене продажи.'}]:[]),
      ...(any('minAllowedPrice')?[{key:'minAllowedPrice',label:'Минимум ЛК, ₽',tip:'Минимальная допустимая сумма из ответа личного кабинета.'}]:[]),
      ...(any('minPercentFloor')?[{key:'minPercentFloor',label:'Мин. по проценту ЛК',tip:'Запасной минимум, когда сумма Минимум ЛК пустая: вход × minPricePercent / 100. Например 70% у CDEK считается от входа, а не от цены клиента.'}]:[]),
      ...(any('retail')?[{key:'retail',label:'Розница',tip:'Розничная цена, когда она доступна.'},{key:'retailDiscount',label:'Скидка от розницы, %',tip:'Разница между розницей и текущей ценой клиенту.'}]:[]),
      {key:'marketMin',label:'Лучшая цена другой ТК',tip:'Минимальная цена другой выбранной ТК на том же маршруте и типе доставки.'},
      {key:'marketGap',label:'Разница с альтернативой, %',tip:'Отрицательное значение — текущая ТК дешевле; положительное — дороже лучшей другой ТК.'},
      {key:'floorPrice',label:'Итоговая нижняя граница',tip:'Ниже этой цены нельзя опускаться по выбранному правилу: сумма ЛК, процент ЛК, маржа или самый строгий вариант.'},
      {key:'safeDiscount',label:'Макс. безопасная скидка, %',tip:'Сколько можно дополнительно снизить от текущей цены до допустимого минимума.'},
      {key:'potentialSavingsRub',label:'Резерв скидки, ₽',tip:'Разница между текущей ценой и рекомендованной ценой. Показывает запас для переговоров в рублях.'},
      {key:'recommendedPrice',label:'Цена для предложения',tip:'Цена, которую можно предложить клиенту: конкурентнее другой ТК, но не ниже допустимого минимума.'},
      {key:'recommendedDiscount',label:'Доп. скидка до рекомендации, %',tip:'Дополнительное снижение от текущей цены до цены для предложения.'},{key:'status',label:'Вывод для сотрудника'}
    ];
  }
  function managerExportValue(record,key){
    const values={priority:`${record.priority}${record.priorityDetails?` — ${record.priorityDetails}`:''}`,route:record.route,cargo:`${parsePositive(record.row.weight,.1)} кг · ${Math.round(parsePositive(record.row.seats,1))} м. · ${parsePositive(record.row.length,10)}×${parsePositive(record.row.width,10)}×${parsePositive(record.row.height,10)}`,
      company:record.company,urgency:record.item.urgencyLabel||'',tariff:tariffDisplayName(record.item),method:record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'',period:periodExportValue(record.item.maxPeriod),
      price:record.price,priceWithoutDiscount:record.priceWithoutDiscount,clientDiscount:record.clientDiscount,activeDiscount:record.activeDiscount,input:record.input,marginPct:record.marginPct,
      minAllowedPrice:record.minAllowedPrice,minPercentFloor:record.minPercentFloor,retail:record.retail,retailDiscount:record.retailDiscount,marketMin:record.marketMin,marketGap:record.marketGap,floorPrice:record.floorPrice,
      safeDiscount:record.safeDiscount,potentialSavingsRub:record.potentialSavingsRub,recommendedPrice:record.recommendedPrice,recommendedDiscount:record.recommendedDiscount,status:record.recommendationStatus};
    const value=values[key];return typeof value==='number'&&Number.isFinite(value)?round2(value):(value??'');
  }
  function managerCellMarkup(record,key){
    const gapClass=record.marketGap===null?'':record.marketGap<=0?'status-good':record.marketGap<=5?'status-warn':'status-bad',priorityClass=`recommendation-status ${record.priorityTone||'neutral'}`;
    const cells={
      priority:`<td><span class="${priorityClass}">${escapeHtml(record.priority||'Проверить')}</span>${record.priorityDetails?`<small class="cell-note">${escapeHtml(record.priorityDetails)}</small>`:''}</td>`,
      route:`<td class="route-cell">${escapeHtml(record.route)}</td>`,
      cargo:`<td>${escapeHtml(`${formatValue(parsePositive(record.row.weight,.1))} кг · ${Math.round(parsePositive(record.row.seats,1))} м. · ${formatValue(parsePositive(record.row.length,10))}×${formatValue(parsePositive(record.row.width,10))}×${formatValue(parsePositive(record.row.height,10))}`)}</td>`,
      company:`<td>${escapeHtml(record.company)}</td>`,urgency:`<td><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(record.item))}</span></td>`,
      tariff:`<td>${escapeHtml(tariffDisplayName(record.item))}</td>`,method:`<td>${escapeHtml(record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'—')}</td>`,period:`<td>${escapeHtml(formatTerm(record.item))}</td>`,
      price:`<td><b>${escapeHtml(moneyOrDash(record.price,{positive:true}))}</b></td>`,priceWithoutDiscount:`<td>${escapeHtml(moneyOrDash(record.priceWithoutDiscount,{positive:true}))}</td>`,
      clientDiscount:`<td>${escapeHtml(percentOrDash(record.clientDiscount))}</td>`,activeDiscount:`<td>${escapeHtml(percentOrDash(record.activeDiscount))}</td>`,
      input:`<td>${escapeHtml(moneyOrDash(record.input,{nonNegative:true}))}</td>`,marginPct:`<td>${escapeHtml(percentOrDash(record.marginPct))}</td>`,
      minAllowedPrice:`<td>${escapeHtml(moneyOrDash(record.minAllowedPrice,{positive:true}))}</td>`,minPercentFloor:`<td>${escapeHtml(moneyOrDash(record.minPercentFloor,{positive:true}))}<small class="cell-note">${record.minAllowedPercent===null?'':`${escapeHtml(percentOrDash(record.minAllowedPercent))} ЛК`}</small></td>`,
      retail:`<td>${escapeHtml(moneyOrDash(record.retail,{positive:true}))}</td>`,retailDiscount:`<td>${escapeHtml(percentOrDash(record.retailDiscount))}</td>`,
      marketMin:`<td>${escapeHtml(moneyOrDash(record.marketMin,{positive:true}))}</td>`,marketGap:`<td class="${gapClass}">${escapeHtml(percentOrDash(record.marketGap))}</td>`,
      floorPrice:`<td>${record.floorPrice===null?'—':`${escapeHtml(formatValue(round2(record.floorPrice)))} ₽`}<small class="cell-note">${escapeHtml(record.floorSource||'')}</small></td>`,
      safeDiscount:`<td>${escapeHtml(percentOrDash(record.safeDiscount))}</td>`,potentialSavingsRub:`<td>${escapeHtml(moneyOrDash(record.potentialSavingsRub,{positive:true}))}</td>`,
      recommendedPrice:`<td><b>${record.recommendedPrice===null?'—':`${escapeHtml(formatValue(round2(record.recommendedPrice)))} ₽`}</b></td>`,
      recommendedDiscount:`<td>${escapeHtml(percentOrDash(record.recommendedDiscount))}</td>`,status:`<td><span class="${priorityClass}">${escapeHtml(record.recommendationStatus)}</span></td>`
    };
    return cells[key]||'<td>—</td>';
  }
  function renderManagerTable(markUpdated=false){
    if(!els.managerTableBody)return;
    if(els.managerViewSelect)els.managerViewSelect.value='recommendations';
    syncAnalyticsMethod(els.managerMethodFilter?.value||analyticsMethod());
    els.managerCompanyFilterLabel?.classList.add('hidden');els.managerBaseCompanyLabel?.classList.add('hidden');
    els.managerPresetLabel?.classList.remove('hidden');els.managerFloorModeLabel?.classList.remove('hidden');els.managerFloorPercentLabel?.classList.remove('hidden');els.managerBeatMarketLabel?.classList.remove('hidden');
    state.settings.managerView='recommendations';state.settings.managerTariffMode=els.managerTariffModeSelect?.value||'cheapest';state.settings.managerPeriodMax=validPeriod(els.managerPeriodMax?.value)||'';state.settings.managerMethod=analyticsMethod();state.settings.managerPreset=els.managerPresetSelect?.value||'custom';state.settings.managerFloorMode=['strict','lkPrice','ownMargin'].includes(els.managerFloorModeSelect?.value)?els.managerFloorModeSelect.value:'strict';state.settings.managerFloorPercent=clampNumber(els.managerFloorPercentInput?.value,10,0,99);state.settings.managerBeatMarketPct=clampNumber(els.managerBeatMarketInput?.value,1,0,30);persistSettings();
    renderManagerRecommendations();
    if(markUpdated&&els.managerUpdatedAt){els.managerUpdatedAt.textContent=`Обновлено ${analyticsTimestamp()}`;els.managerUpdatedAt.classList.remove('analytics-dirty');els.managerUpdatedAt.closest('.analytics-auto-status')?.classList.remove('updating');els.managerUpdatedAt.closest('.analytics-auto-status')?.classList.add('updated');state.analyticsDirty.manager=false;}
  }
  function tariffDetailsMarkup(item){
    const services=servicesList(item,false).map(service=>`<span class="tariff-tag" title="${escapeHtml(service.description||'')}">${escapeHtml(serviceText(service))}${service.required?' · обязательно':service.enabled?' · включено':''}</span>`).join('')||'<span class="tariff-tag">Нет дополнительных услуг</span>';
    const price=tariffPriceModel(item),lkCandidates=lkFloorCandidates(price),priceLines=[],metricLines=[],showServiceInfo=Boolean(state.settings.showServiceInfo);
    if(price.userPrice!==null)priceLines.push(`<p><span>Цена клиента</span><strong>${escapeHtml(moneyOrDash(price.userPrice,{positive:true}))}</strong></p>`);
    if(price.userPriceWithoutDiscount!==null)priceLines.push(`<p><span>Цена без персональной скидки</span><strong>${escapeHtml(moneyOrDash(price.userPriceWithoutDiscount,{positive:true}))}</strong></p>`);
    if(price.inputPrice!==null)priceLines.push(`<p><span>Вход</span><strong>${escapeHtml(moneyOrDash(price.inputPrice,{nonNegative:true}))}</strong>${price.inputPricePercent===null?'':`<small>${escapeHtml(percentOrDash(price.inputPricePercent))}</small>`}</p>`);
    if(price.minPrice!==null)priceLines.push(`<p><span>Минимум ЛК, сумма</span><strong>${escapeHtml(moneyOrDash(price.minPrice,{positive:true}))}</strong></p>`);
    const percentFloor=lkCandidates.find(entry=>entry.label.includes('%'));
    if(percentFloor)priceLines.push(`<p><span>Минимум ЛК, процент</span><strong>${escapeHtml(moneyOrDash(percentFloor.value,{positive:true}))}</strong><small>${escapeHtml(percentFloor.label)}</small></p>`);
    if(price.retailPrice!==null)priceLines.push(`<p><span>Розница</span><strong>${escapeHtml(moneyOrDash(price.retailPrice,{positive:true}))}</strong></p>`);
    if(showServiceInfo&&item.rateName)priceLines.push(`<p><span>Ставка API</span><strong>${escapeHtml(item.rateName)}</strong>${hasOptionalNumber(item.ratePrice,{positive:true})?`<small>${escapeHtml(moneyOrDash(item.ratePrice,{positive:true}))}${hasOptionalNumber(item.ratePricePercent,{nonNegative:true})?` · ${escapeHtml(percentOrDash(item.ratePricePercent))}`:''}</small>`:''}</p>`);
    if(showServiceInfo&&item.emptyTermText)metricLines.push(`<p>Сервисный срок API: <strong>${escapeHtml(item.emptyTermText)}</strong></p>`);
    if(price.marginRub!==null)metricLines.push(`<p>Маржа: <strong>${escapeHtml(formatValue(round2(price.marginRub)))} ₽</strong></p>`);
    if(price.marginPct!==null)metricLines.push(`<p>Маржа: <strong>${escapeHtml(formatValue(round2(price.marginPct)))}%</strong></p>`);
    if(price.clientDiscountPct!==null)metricLines.push(`<p data-tip="Дополнительная персональная скидка конкретного клиента. 0% означает, что персональной скидки нет.">Персональная скидка клиента: <strong>${escapeHtml(formatValue(round2(price.clientDiscountPct)))}%</strong></p>`);
    if(price.activeDiscountPct!==null)metricLines.push(`<p data-tip="Базовая активная скидка тарифа в личном кабинете. Она показывается отдельно от персональной скидки клиента.">Активная скидка ЛК: <strong>${escapeHtml(formatValue(round2(price.activeDiscountPct)))}%</strong></p>`);
    if(price.retailDiscountPct!==null)metricLines.push(`<p>Скидка от розницы: <strong>${escapeHtml(formatValue(round2(price.retailDiscountPct)))}%</strong></p>`);
    const blocks=[`<div class="tariff-detail-block"><h4>Максимальный срок</h4><p><strong>${escapeHtml(formatTerm(item))}</strong></p></div>`];
    if(priceLines.length)blocks.push(`<div class="tariff-detail-block tariff-price-block"><h4>Цены и границы</h4>${priceLines.join('')}</div>`);
    if(metricLines.length)blocks.push(`<div class="tariff-detail-block"><h4>Продажные показатели</h4>${metricLines.join('')}</div>`);
    if(item.returnServiceAllowed)blocks.push(`<div class="tariff-detail-block"><h4>Возврат</h4><p>Разрешён${hasOptionalNumber(item.returnServicePrice,{nonNegative:true})?` · ${escapeHtml(moneyOrDash(item.returnServicePrice,{nonNegative:true}))}`:''}</p></div>`);
    blocks.push(`<div class="tariff-detail-block tariff-detail-wide"><h4>Услуги</h4>${services}</div>`);
    return`<div class="tariff-details">${blocks.join('')}</div>`;
  }
  function matrixElements(){
    return{table:document.getElementById('matrixTable'),base:document.getElementById('matrixBaseCompanyFilter'),mode:document.getElementById('matrixTariffModeSelect'),method:document.getElementById('matrixMethodSelect'),discount:document.getElementById('matrixDiscountModeSelect'),summary:document.getElementById('matrixSummary'),head:document.getElementById('matrixTableHead'),body:document.getElementById('matrixTableBody'),updated:document.getElementById('matrixUpdatedAt')};
  }
  function matrixDiscountMode(){
    const value=matrixElements().discount?.value||state.settings.matrixDiscountMode||'';
    return ['current','active'].includes(value)?value:'';
  }
  function matrixDiscountLabel(mode=matrixDiscountMode()){
    if(mode==='current')return discountMetricLabel();
    if(mode==='active')return 'Активная скидка';
    return '';
  }
  function matrixDiscountTip(mode=matrixDiscountMode()){
    if(mode==='current')return discountMetricTip();
    if(mode==='active')return 'Активная скидка, переданная личным кабинетом для тарифа.';
    return '';
  }
  function matrixDiscountValue(item,mode=matrixDiscountMode()){
    if(!item||!mode)return null;
    if(mode==='current')return optionalNumeric(displayDiscountPct(item),{nonNegative:true});
    if(mode==='active')return tariffPriceModel(item).activeDiscountPct??optionalNumeric(item?.activeDiscount,{nonNegative:true});
    return null;
  }
  function matrixSelectedMethod(){
    const methods=analyticsMethodList(),store=state.settings.matrixMethodByProject||={},selected=matrixElements().method?.value??store[currentProjectId()]??'';
    return methods.includes(selected)?selected:'';
  }
  function matrixFilters(){const m=matrixElements();return{route:'',method:matrixSelectedMethod(),tariffMode:m.mode?.value||els.managerTariffModeSelect?.value||'cheapest',periodMax:''};}
  function matrixModel(){
    const m=matrixElements(),records=bestRouteCompanyRecords(matrixFilters()),companies=[...new Set(records.map(record=>record.company))].sort((a,b)=>a.localeCompare(b,'ru')),previous=m.base?.value||'cheapest';
    if(m.base){m.base.innerHTML='<option value="cheapest">Самая низкая цена в строке</option>'+companies.map(company=>`<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');m.base.value=previous==='cheapest'||companies.includes(previous)?previous:'cheapest';}
    const groups=new Map();records.forEach(record=>{if(!groups.has(record.rowIndex))groups.set(record.rowIndex,{rowIndex:record.rowIndex,row:record.row,route:record.route,items:new Map()});groups.get(record.rowIndex).items.set(record.company,record.item);});
    return{method:matrixSelectedMethod(),companies,rows:[...groups.values()].sort((a,b)=>a.route.localeCompare(b.route,'ru')||a.rowIndex-b.rowIndex),selectedBase:m.base?.value||'cheapest'};
  }
  function allMatrixColumns(useUrgency=usesUrgencyView(),showMethod=true,discountMode=matrixDiscountMode()){
    return[
      {key:'route',label:'Маршрут',scope:'base',className:'matrix-route-col'},
      {key:'weight',label:'Вес',scope:'base',className:'matrix-weight-col'},
      {key:'seats',label:'Мест',scope:'base',className:'matrix-seats-col'},
      {key:'dimensions',label:'Габариты',scope:'base',className:'matrix-dimensions-col'},
      ...(useUrgency?[{key:'urgency',label:'Срочность',scope:'company',className:'matrix-urgency-col'}]:[]),
      ...(showMethod?[{key:'method',label:'Тип доставки',scope:'company',className:'matrix-method-col'}]:[]),
      {key:'tariff',label:'Тариф',scope:'company',className:'matrix-tariff-col'},
      {key:'price',label:'Цена',scope:'company',className:'matrix-price-col'},
      ...(discountMode?[{key:'discount',label:matrixDiscountLabel(discountMode),scope:'company',className:'matrix-discount-col'}]:[]),
      {key:'delta',label:'Отклонение, %',scope:'company',className:'matrix-delta-col'},
      {key:'period',label:'Макс. срок',scope:'company',className:'matrix-period-col'}
    ];
  }
  function matrixColumns(useUrgency=usesUrgencyView(),showMethod=true,discountMode=matrixDiscountMode()){
    const all=allMatrixColumns(useUrgency,showMethod,discountMode),saved=Array.isArray(state.settings.matrixVisibleColumns)?state.settings.matrixVisibleColumns:[],selected=new Set(saved);
    if(selected.has('__none__'))return[];
    return selected.size?all.filter(column=>selected.has(column.key)):all;
  }
  function renderMatrixColumnSelector(useUrgency=usesUrgencyView(),showMethod=true,discountMode=matrixDiscountMode()){
    const host=document.getElementById('matrixColumnFields'),count=document.getElementById('matrixColumnsCount');if(!host)return;
    const all=allMatrixColumns(useUrgency,showMethod,discountMode),saved=Array.isArray(state.settings.matrixVisibleColumns)?state.settings.matrixVisibleColumns:[],selected=new Set(saved),showAll=!saved.length,selectedCount=showAll?all.length:all.filter(column=>selected.has(column.key)).length;
    host.innerHTML=`<div class="column-picker-actions"><button type="button" class="button mini secondary" data-column-picker-action="all">Выбрать все</button><button type="button" class="button mini ghost" data-column-picker-action="none">Снять все</button></div>`+all.map(column=>`<label><input type="checkbox" value="${escapeHtml(column.key)}" ${showAll||selected.has(column.key)?'checked':''}><span>${escapeHtml(column.label)}</span></label>`).join('');
    if(count)count.textContent=`(${selectedCount}/${all.length})`;
  }
  function matrixAoa(model=matrixModel()){
    const useUrgency=usesUrgencyView(),showMethod=!model.method,discountMode=matrixDiscountMode(),columns=matrixColumns(useUrgency,showMethod,discountMode),baseColumns=columns.filter(column=>column.scope==='base'),companyColumns=columns.filter(column=>column.scope==='company'),headers=baseColumns.map(column=>column.label);
    if(!columns.length)return[];
    model.companies.forEach(company=>companyColumns.forEach(column=>headers.push(`${company} — ${column.label}`)));
    const rows=model.rows.map(group=>{
      const prices=model.companies.map(company=>Number(group.items.get(company)?.userPrice)).filter(value=>Number.isFinite(value)&&value>0),baseItem=model.selectedBase==='cheapest'?null:group.items.get(model.selectedBase),basePrice=model.selectedBase==='cheapest'?(prices.length?Math.min(...prices):null):(Number(baseItem?.userPrice)>0?Number(baseItem.userPrice):null),baseValues={route:group.route,weight:parsePositive(group.row.weight,.1),seats:Math.round(parsePositive(group.row.seats,1)),dimensions:`${parsePositive(group.row.length,10)}×${parsePositive(group.row.width,10)}×${parsePositive(group.row.height,10)}`},values=baseColumns.map(column=>baseValues[column.key]??'');
      model.companies.forEach(company=>{
        const item=group.items.get(company),price=Number(item?.userPrice),pct=item&&price>0&&basePrice?round2((price-basePrice)/basePrice*100):'',discountValue=item?matrixDiscountValue(item,discountMode):null,companyValues={urgency:item?.urgencyLabel||'',method:item?deliveryTypeName(item):'',tariff:item?tariffDisplayName(item):'',price:item&&price>0?round2(price):'',discount:discountValue===null?'':round2(discountValue),delta:pct,period:item?periodExportValue(item.maxPeriod):''};
        companyColumns.forEach(column=>values.push(companyValues[column.key]??''));
      });
      return values;
    });
    return[headers,...rows];
  }
  function renderMatrixColGroup(m,model,columns){
    if(!m.table)return;
    let colgroup=m.table.querySelector('colgroup');if(!colgroup){colgroup=document.createElement('colgroup');m.table.prepend(colgroup);}
    const cols=columns.filter(column=>column.scope==='base').map(column=>column.className),companyColumns=columns.filter(column=>column.scope==='company');
    model.companies.forEach(()=>companyColumns.forEach(column=>cols.push(column.className)));
    colgroup.innerHTML=cols.map(name=>`<col class="${name}">`).join('');
  }
  function renderMatrixPane(markUpdated=false){
    const m=matrixElements();
    if(!m.body||!m.head)return;
    const selectedMethod=matrixSelectedMethod();
    if(selectedMethod)syncAnalyticsMethod(selectedMethod);
    const model=matrixModel(),spreads=[],wins=new Map(),useUrgency=usesUrgencyView(),showMethod=!model.method,discountMode=matrixDiscountMode(),discountTip=matrixDiscountTip(discountMode),columns=matrixColumns(useUrgency,showMethod,discountMode),baseColumns=columns.filter(column=>column.scope==='base'),companyColumns=columns.filter(column=>column.scope==='company');
    renderMatrixColumnSelector(useUrgency,showMethod,discountMode);
    model.rows.forEach(group=>{
      const entries=model.companies.map(company=>({company,price:Number(group.items.get(company)?.userPrice)})).filter(entry=>Number.isFinite(entry.price)&&entry.price>0);
      if(!entries.length)return;
      const min=Math.min(...entries.map(entry=>entry.price)),max=Math.max(...entries.map(entry=>entry.price));
      if(min>0)spreads.push((max-min)/min*100);
      entries.filter(entry=>entry.price===min).forEach(entry=>wins.set(entry.company,(wins.get(entry.company)||0)+1));
    });
    const leader=[...wins.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ru'))[0];
    if(m.summary)m.summary.innerHTML=`<div class="metric"><span>Маршрутов</span><b>${model.rows.length}</b></div><div class="metric"><span>ТК</span><b>${model.companies.length}</b></div><div class="metric"><span>Типы доставки</span><b>${model.method?escapeHtml(model.method):'Все'}</b></div><div class="metric"><span>Средний разброс цен</span><b>${spreads.length?`${formatValue(round2(averageOrNull(spreads)))}%`:'—'}</b></div><div class="metric"><span>Чаще дешевле</span><b>${leader?`${escapeHtml(leader[0])} · ${leader[1]}`:'—'}</b></div>`;
    if(!columns.length){renderMatrixColGroup(m,model,columns);m.head.innerHTML='';m.body.innerHTML='<tr><td class="empty-tariffs">Выберите хотя бы одну колонку в настройках таблицы.</td></tr>';return;}
    const baseLabel=model.selectedBase==='cheapest'?'к минимуму':`к ${model.selectedBase}`,perCompany=companyColumns.length,companyHead=column=>{
      if(column.key==='discount')return`<th data-tip="${escapeHtml(discountTip)}">${escapeHtml(column.label)}, %</th>`;
      if(column.key==='delta')return`<th data-tip="(Цена ТК − базовая цена) / базовая цена × 100">Δ ${escapeHtml(baseLabel)}, %</th>`;
      if(column.key==='period')return'<th data-tip="Только максимальный срок; 0 отображается как «По запросу»">Макс. срок</th>';
      return`<th>${escapeHtml(column.label)}</th>`;
    };
    renderMatrixColGroup(m,model,columns);
    m.head.innerHTML=`<tr>${baseColumns.map(column=>`<th rowspan="2">${escapeHtml(column.label)}</th>`).join('')}${perCompany?model.companies.map(company=>`<th colspan="${perCompany}">${escapeHtml(company)}</th>`).join(''):''}</tr>${perCompany?`<tr>${model.companies.map(()=>companyColumns.map(companyHead).join('')).join('')}</tr>`:''}`;
    if(!model.rows.length){m.body.innerHTML=`<tr><td colspan="${baseColumns.length+model.companies.length*perCompany}" class="empty-tariffs">Нет данных для матрицы по текущей общей выборке.</td></tr>`;return;}
    m.body.innerHTML=model.rows.map(group=>{
      const prices=model.companies.map(company=>Number(group.items.get(company)?.userPrice)).filter(value=>Number.isFinite(value)&&value>0),baseItem=model.selectedBase==='cheapest'?null:group.items.get(model.selectedBase),basePrice=model.selectedBase==='cheapest'?(prices.length?Math.min(...prices):null):(Number(baseItem?.userPrice)>0?Number(baseItem.userPrice):null),emptyCells=companyColumns.map(()=>'<td>—</td>').join(''),baseCells={route:`<td title="${escapeHtml(group.route)}">${escapeHtml(group.route)}</td>`,weight:`<td>${escapeHtml(formatValue(parsePositive(group.row.weight,.1)))}</td>`,seats:`<td>${Math.round(parsePositive(group.row.seats,1))}</td>`,dimensions:`<td>${escapeHtml(`${formatValue(parsePositive(group.row.length,10))}×${formatValue(parsePositive(group.row.width,10))}×${formatValue(parsePositive(group.row.height,10))}`)}</td>`};
      const cells=model.companies.map(company=>{
        const item=group.items.get(company),price=Number(item?.userPrice);
        if(!item||!(price>0))return emptyCells;
        const pct=basePrice?(price-basePrice)/basePrice*100:null,cls=pct===null?'':pct<=0?'status-good':pct<=5?'status-warn':'status-bad',discountValue=matrixDiscountValue(item,discountMode),companyCells={urgency:`<td><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(item))}</span></td>`,method:`<td><span class="matrix-method-tag">${escapeHtml(deliveryTypeName(item))}</span></td>`,tariff:`<td>${escapeHtml(tariffDisplayName(item))}</td>`,price:`<td><b>${escapeHtml(formatValue(price))} ₽</b></td>`,discount:`<td class="matrix-discount-cell" title="${escapeHtml(discountTip)}">${escapeHtml(percentOrDash(discountValue))}</td>`,delta:`<td class="${cls}">${pct===null?'—':`${escapeHtml(formatValue(round2(pct)))}%`}</td>`,period:`<td>${escapeHtml(formatTerm(item))}</td>`};
        return companyColumns.map(column=>companyCells[column.key]||'<td>—</td>').join('');
      }).join('');
      return`<tr>${baseColumns.map(column=>baseCells[column.key]||'<td>—</td>').join('')}${cells}</tr>`;
    }).join('');
    if(markUpdated&&m.updated)m.updated.textContent=`Обновлено ${analyticsTimestamp()}`;
  }
  function copyMatrix(){return copyAoa(matrixAoa(),'Матрица цен скопирована');}
  function downloadMatrixXlsx(){const aoa=matrixAoa();if(aoa.length<2){toast('Нет данных','error');return;}const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,makeWorksheet(aoa,32),'Матрица цен');XLSX.writeFile(workbook,`${filePrefix()}_матрица_цен.xlsx`,{compression:true});}
  function renderAnalyticsTariffPickers(){
    const type=analyticsMethod(),records=filteredCompanyRecords().filter(record=>!type||deliveryTypeName(record.item)===type),enabledCompanies=[...new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК'))].sort((a,b)=>a.localeCompare(b,'ru'));
    if(els.managerCompanyFilter){els.managerCompanyFilter.innerHTML='<option value="">Все ТК общей выборки</option>';els.managerCompanyFilter.value='';}
    const fillBase=select=>{if(!select)return;const previous=select.value;select.innerHTML='<option value="cheapest">Минимальная цена в строке</option>'+enabledCompanies.map(company=>`<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');select.value=previous==='cheapest'||enabledCompanies.includes(previous)?previous:'cheapest';};
    fillBase(els.managerBaseCompanyFilter);fillBase(document.getElementById('matrixBaseCompanyFilter'));
  }
  function activateCompanyPane(name){
    state.companyView.pane=name;$$('[data-company-view]').forEach(button=>button.classList.toggle('active',button.dataset.companyView===name));$$('[data-company-pane]').forEach(pane=>pane.classList.toggle('active',pane.dataset.companyPane===name));
    if(name!=='tariffs'){const type=ensureSingleAnalyticsType();syncAnalyticsMethod(type);renderCompanyView();}
    if(name==='compare')renderComparison(true);
    if(name==='manager')renderManagerTable(true);
    if(name==='matrix')renderMatrixPane(true);
    requestAnimationFrame(repositionOpenChoiceFilters);
  }

  /* ===== v2.6 project-aware discounts, cargo filters and manual analytics refresh ===== */
  function projectHasRetailPricing(projectId=currentProjectId()){return projectId==='kd';}
  function discountMetricLabel(projectId=currentProjectId()){return projectHasRetailPricing(projectId)?'Скидка от розницы':'Скидка от цены без скидки';}
  function discountMetricTip(projectId=currentProjectId()){return projectHasRetailPricing(projectId)?'Разница между розничной ценой и ценой клиента.':'Разница между ценой клиента без скидки и фактической ценой клиента.';}
  function displayDiscountPct(item,projectId=currentProjectId()){
    const model=tariffPriceModel(item);
    const fallback=optionalNumeric(item?.discount,{nonNegative:true});
    return projectHasRetailPricing(projectId)?(model.retailDiscountPct??fallback):(model.clientDiscountPct??fallback);
  }
  function cargoKey(row){
    return [parsePositive(row?.weight,.1),Math.round(parsePositive(row?.seats,1)),parsePositive(row?.length,10),parsePositive(row?.width,10),parsePositive(row?.height,10)].join('|');
  }
  function cargoLabel(row){
    return `${formatValue(parsePositive(row?.weight,.1))} кг · ${Math.round(parsePositive(row?.seats,1))} мест · ${formatValue(parsePositive(row?.length,10))}×${formatValue(parsePositive(row?.width,10))}×${formatValue(parsePositive(row?.height,10))}`;
  }
  function dynamicExportField(field){
    if(!field)return field;
    if(!projectHasRetailPricing()&&(field.key==='bestRetail'||field.key==='retailPrice'))return null;
    if(field.key==='bestDiscount'||field.key==='calculatedDiscount')return{...field,label:`${discountMetricLabel()}, %`};
    return field;
  }
  function selectedTariffFields(){
    return selectedDefinitions(TARIFF_EXPORT_FIELDS,state.settings.tariffExportFields).map(dynamicExportField).filter(Boolean);
  }
  function mainFieldValue(key,row,index){
    const best=row.result?.best||{},discount=displayDiscountPct(best);
    const values={
      requestNo:index+1,senderQuery:row.senderQuery,senderKd:row.senderResolved?.placeText||row.senderResolved?.kdText||'',recipientQuery:row.recipientQuery,recipientKd:row.recipientResolved?.placeText||row.recipientResolved?.kdText||'',
      weight:parsePositive(row.weight,.1),seats:Math.round(parsePositive(row.seats,1)),length:parsePositive(row.length,10),width:parsePositive(row.width,10),height:parsePositive(row.height,10),status:row.statusText,error:row.error||'',
      bestCompany:best.deliveryCompanyLabel||'',bestUrgency:best.urgencyLabel||'',bestTariff:tariffDisplayName(best),bestMethod:best.deliveryTypeLabel||best.deliveryMethodLabel||'',bestMaxPeriod:formatTerm(best),bestPrice:safeNumber(best.userPrice),bestInput:safeNumber(best.inputPrice),bestRetail:projectHasRetailPricing()?safeNumber(best.retailPrice):'',bestDiscount:safeNumber(discount)
    };
    return values[key]??'';
  }
  function tariffFieldValue(key,item,row,index){
    const values={
      requestNo:index+1,senderQuery:row.senderQuery,senderKd:row.senderResolved?.placeText||row.senderResolved?.kdText||'',recipientQuery:row.recipientQuery,recipientKd:row.recipientResolved?.placeText||row.recipientResolved?.kdText||'',
      weight:parsePositive(row.weight,.1),seats:Math.round(parsePositive(row.seats,1)),length:parsePositive(row.length,10),width:parsePositive(row.width,10),height:parsePositive(row.height,10),
      company:item?.deliveryCompanyLabel||'',urgency:item?.urgencyLabel||'',tariffCaption:item?tariffDisplayName(item):'',method:item?.deliveryTypeLabel||item?.deliveryMethodLabel||'',minPeriod:periodExportValue(item?.minPeriod),maxPeriod:periodExportValue(item?.maxPeriod),
      userPrice:safeNumber(item?.userPrice),userPriceWithoutDiscount:safeNumber(item?.userPriceWithoutDiscount),inputPrice:safeNumber(ceilingMoney(item?.inputPrice,{nonNegative:true})),inputPricePercent:safeNumber(item?.inputPricePercent),retailPrice:projectHasRetailPricing()?safeNumber(item?.retailPrice):'',servicesPrice:safeNumber(ceilingMoney(item?.servicesPrice,{nonNegative:true})),activeDiscount:safeNumber(item?.activeDiscount),discountPercent:safeNumber(item?.discountPercent),calculatedDiscount:safeNumber(displayDiscountPct(item)),minPrice:safeNumber(item?.minPrice),minPricePercent:safeNumber(item?.minPricePercent),returnAllowed:item?.returnServiceAllowed?'Да':'Нет',returnPrice:safeNumber(ceilingMoney(item?.returnServicePrice,{nonNegative:true})),includedServices:servicesSummary(item,true),allServices:servicesSummary(item,false)
    };
    return values[key]??'';
  }
  function buildExportAoa(){
    const fields=selectedDefinitions(MAIN_EXPORT_FIELDS,state.settings.mainExportFields).map(dynamicExportField).filter(Boolean),companiesOrder=state.settings.exportMainCompanyColumns?getExportCompanies():[],headers=fields.map(field=>field.label);
    if(companiesOrder.length)companiesOrder.forEach(company=>headers.push(`${company}: тариф`,`${company}: метод`,`${company}: срок`,`${company}: цена`,`${company}: вход`,`${company}: скидка, %`));
    const rows=state.rows.filter(row=>row.senderQuery||row.recipientQuery||row.result).map((row,index)=>{
      const values=fields.map(field=>mainFieldValue(field.key,row,index));
      companiesOrder.forEach(company=>{const item=row.result?.companies?.[company];values.push(...(item?[item.tariffCaption,item.deliveryTypeLabel||item.deliveryMethodLabel,formatTerm(item),item.userPrice,item.inputPrice,displayDiscountPct(item)]:['','','','','','']));});
      return values;
    });
    return[headers,...rows];
  }
  function buildAllTariffsAoa(rows=state.rows,companyFilter='',flattened=null){
    const fields=selectedTariffFields(),records=flattened||flattenTariffs(rows,companyFilter);
    return[fields.map(field=>field.label),...records.map(({row,rowIndex,item})=>fields.map(field=>tariffFieldValue(field.key,item,row,rowIndex)))];
  }
  function buildTariffsAoaForRow(row,tariffs=row.result?.allTariffs||[]){
    const rowIndex=Math.max(0,state.rows.indexOf(row)),fields=selectedTariffFields();
    return[fields.map(field=>field.label),...tariffs.map(item=>fields.map(field=>tariffFieldValue(field.key,item,row,rowIndex)))];
  }
  function updateRowDom(row,suppliedTr=null){
    const tr=suppliedTr||els.tableBody.querySelector(`tr[data-row-id="${CSS.escape(row.id)}"]`);
    if(!suppliedTr&&isTableFilterActive()){
      const index=state.rows.indexOf(row),matches=index>=0&&tableRowMatchesFilter(row,index);
      if((tr&&!matches)||(!tr&&matches)){renderTable();return;}
    }
    if(!tr)return;
    const senderPhase=row.status==='resolving-sender'?'loading':'',recipientPhase=row.status==='resolving-recipient'?'loading':'';
    tr.querySelector('[data-role="senderResolved"]').innerHTML=resolvedMarkup(row.senderResolved,senderPhase,row.senderError);
    tr.querySelector('[data-role="recipientResolved"]').innerHTML=resolvedMarkup(row.recipientResolved,recipientPhase,row.recipientError);
    const statusClass=row.status==='done'?'ready':row.status==='error'?'error':/resolving|calculating/.test(row.status)?'loading':'';
    tr.querySelector('[data-role="status"]').innerHTML=`<span class="status-pill ${statusClass}" title="${escapeHtml(row.error||row.statusText)}">${escapeHtml(row.statusText)}</span>`;
    const best=row.result?.best;
    tr.querySelector('[data-role="bestCompany"]').textContent=best?.deliveryCompanyLabel||'—';
    tr.querySelector('[data-role="bestTariff"]').innerHTML=best?`${usesUrgencyView()&&best.urgencyLabel?`<small class="best-urgency">${escapeHtml(best.urgencyLabel)}</small>`:''}<span>${escapeHtml(tariffDisplayName(best))}</span>`:'—';
    tr.querySelector('[data-role="bestMethod"]').textContent=best?.deliveryTypeLabel||best?.deliveryMethodLabel||'—';
    tr.querySelector('[data-role="bestPeriod"]').textContent=best?formatTerm(best):'—';
    tr.querySelector('[data-role="bestPrice"]').textContent=best?moneyOrDash(best.userPrice,{positive:true}):'—';
    tr.querySelector('[data-role="bestInput"]').textContent=best?moneyOrDash(best.inputPrice,{nonNegative:true}):'—';
    tr.querySelector('[data-role="bestDiscount"]').textContent=best?percentOrDash(displayDiscountPct(best)):'—';
    const tariffsButton=tr.querySelector('[data-action="tariffs"]');
    tariffsButton.disabled=!row.result?.allTariffs?.length;
    refreshSummary();
  }
  function tariffTableColumns(){
    return[
      {key:'company',label:'ТК',sort:'deliveryCompanyLabel'},
      ...(usesUrgencyView()?[{key:'urgency',label:'Срочность',sort:'urgencyLabel'}]:[]),
      {key:'tariff',label:'Тариф',sort:'tariffCaption'},
      {key:'method',label:'Тип доставки',sort:'deliveryTypeLabel'},
      {key:'period',label:'Макс. срок',sort:'maxPeriod'},
      {key:'price',label:'Цена клиента',sort:'userPrice'},
      {key:'input',label:'Вход',sort:'inputPrice',advanced:true},
      ...(projectHasRetailPricing()?[{key:'retail',label:'Розница',sort:'retailPrice',advanced:true}]:[]),
      {key:'discount',label:discountMetricLabel(),sort:'displayDiscount',advanced:true},
      {key:'services',label:'Услуги',advanced:true},{key:'details',label:''}
    ];
  }
  function filteredTariffs(){
    const row=activeTariffRow();if(!row)return[];
    const query=normalize(els.tariffSearchInput.value),priceMin=numericFilterValue(els.tariffPriceMin),priceMax=numericFilterValue(els.tariffPriceMax),periodMax=numericFilterValue(els.tariffPeriodMax);
    const filtered=visibleTariffs(row.result?.allTariffs).filter(item=>{const search=normalize([item.deliveryCompanyLabel,tariffDisplayName(item),item.urgencyLabel,item.deliveryMethodLabel,item.deliveryTypeLabel].join(' ')),price=optionalNumeric(item.userPrice,{positive:true}),period=validPeriod(item.maxPeriod);return tariffMatchesFacetSelection(item,null,true)&&(!query||search.includes(query))&&(priceMin===null||(price!==null&&price>=priceMin))&&(priceMax===null||(price!==null&&price<=priceMax))&&(periodMax===null||(period!==null&&period<=periodMax));});
    const direction=state.tariffView.sortDir==='desc'?-1:1,key=state.tariffView.sortKey;
    filtered.sort((a,b)=>{if(key==='calculatorOrder')return((Number(a.calculatorOrder)||0)-(Number(b.calculatorOrder)||0))*direction;if(key==='maxPeriod')return((validPeriod(a.maxPeriod)??Infinity)-(validPeriod(b.maxPeriod)??Infinity))*direction;const av=key==='displayDiscount'?displayDiscountPct(a):a[key],bv=key==='displayDiscount'?displayDiscountPct(b):b[key];if(['userPrice','inputPrice','retailPrice','discount','displayDiscount'].includes(key)){const an=optionalNumeric(av),bn=optionalNumeric(bv);return((an??Infinity)-(bn??Infinity))*direction;}return String(av||'').localeCompare(String(bv||''),'ru')*direction;});
    return filtered;
  }
  function tariffTableCell(column,item,index,isBest,totalServices,requiredCount){
    const cells={
      company:`<td><div class="tariff-company">${item.deliveryCompanyIcon?`<img src="${escapeHtml(item.deliveryCompanyIcon)}" alt="">`:''}<span>${escapeHtml(item.deliveryCompanyLabel||'—')}</span></div></td>`,
      urgency:`<td class="urgency-cell"><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(item))}</span></td>`,
      tariff:`<td class="tariff-description"><b>${escapeHtml(tariffDisplayName(item))}</b>${isBest?' <span class="tariff-tag best-tag">лучший</span>':''}</td>`,
      method:`<td>${escapeHtml(item.deliveryTypeLabel||item.deliveryMethodLabel||'—')}</td>`,
      period:`<td>${escapeHtml(formatTerm(item))}</td>`,
      price:`<td><b>${escapeHtml(formatValue(item.userPrice))} ₽</b></td>`,
      input:`<td class="advanced-column">${escapeHtml(moneyOrDash(item.inputPrice,{nonNegative:true}))}</td>`,
      retail:`<td class="advanced-column">${escapeHtml(projectHasRetailPricing()?moneyOrDash(item.retailPrice,{positive:true}):'—')}</td>`,
      discount:`<td class="advanced-column">${escapeHtml(percentOrDash(displayDiscountPct(item)))}</td>`,
      services:`<td class="tariff-services advanced-column">${totalServices?`${totalServices} шт.${requiredCount?` · ${requiredCount} обяз.`:''}`:'—'}</td>`,
      details:`<td><button class="button ghost compact-detail" data-tariff-details="${index}">Подробнее</button></td>`
    };
    return cells[column.key]||'';
  }
  function tariffDetailsMarkup(item){
    const services=servicesList(item,false).map(service=>`<span class="tariff-tag" title="${escapeHtml(service.description||'')}">${escapeHtml(serviceText(service))}${service.required?' · обязательно':service.enabled?' · включено':''}</span>`).join('')||'<span class="tariff-tag">Нет дополнительных услуг</span>';
    const price=tariffPriceModel(item),lkCandidates=lkFloorCandidates(price),priceLines=[],metricLines=[],showServiceInfo=Boolean(state.settings.showServiceInfo),discount=displayDiscountPct(item);
    if(price.userPrice!==null)priceLines.push(`<p><span>Цена клиента</span><strong>${escapeHtml(moneyOrDash(price.userPrice,{positive:true}))}</strong></p>`);
    if(price.userPriceWithoutDiscount!==null)priceLines.push(`<p><span>${projectHasRetailPricing()?'Цена без персональной скидки':'Цена клиента без скидки'}</span><strong>${escapeHtml(moneyOrDash(price.userPriceWithoutDiscount,{positive:true}))}</strong></p>`);
    if(price.inputPrice!==null)priceLines.push(`<p><span>Вход</span><strong>${escapeHtml(moneyOrDash(price.inputPrice,{nonNegative:true}))}</strong>${price.inputPricePercent===null?'':`<small>${escapeHtml(percentOrDash(price.inputPricePercent))}</small>`}</p>`);
    if(price.minPrice!==null)priceLines.push(`<p><span>Минимум ЛК, сумма</span><strong>${escapeHtml(moneyOrDash(price.minPrice,{positive:true}))}</strong></p>`);
    const percentFloor=lkCandidates.find(entry=>entry.label.includes('%'));
    if(percentFloor)priceLines.push(`<p><span>Минимум ЛК, процент</span><strong>${escapeHtml(moneyOrDash(percentFloor.value,{positive:true}))}</strong><small>${escapeHtml(percentFloor.label)}</small></p>`);
    if(projectHasRetailPricing()&&price.retailPrice!==null)priceLines.push(`<p><span>Розница</span><strong>${escapeHtml(moneyOrDash(price.retailPrice,{positive:true}))}</strong></p>`);
    if(showServiceInfo&&item.rateName)priceLines.push(`<p><span>Ставка API</span><strong>${escapeHtml(item.rateName)}</strong>${hasOptionalNumber(item.ratePrice,{positive:true})?`<small>${escapeHtml(moneyOrDash(item.ratePrice,{positive:true}))}${hasOptionalNumber(item.ratePricePercent,{nonNegative:true})?` · ${escapeHtml(percentOrDash(item.ratePricePercent))}`:''}</small>`:''}</p>`);
    if(showServiceInfo&&item.emptyTermText)metricLines.push(`<p>Сервисный срок API: <strong>${escapeHtml(item.emptyTermText)}</strong></p>`);
    if(price.marginRub!==null)metricLines.push(`<p>Маржа: <strong>${escapeHtml(formatValue(round2(price.marginRub)))} ₽</strong></p>`);
    if(price.marginPct!==null)metricLines.push(`<p>Маржа: <strong>${escapeHtml(formatValue(round2(price.marginPct)))}%</strong></p>`);
    if(projectHasRetailPricing()&&price.clientDiscountPct!==null)metricLines.push(`<p data-tip="Дополнительная персональная скидка конкретного клиента. 0% означает, что персональной скидки нет.">Персональная скидка клиента: <strong>${escapeHtml(formatValue(round2(price.clientDiscountPct)))}%</strong></p>`);
    if(price.activeDiscountPct!==null)metricLines.push(`<p data-tip="Базовая активная скидка тарифа в личном кабинете. Она показывается отдельно от скидки клиента.">Активная скидка ЛК: <strong>${escapeHtml(formatValue(round2(price.activeDiscountPct)))}%</strong></p>`);
    if(discount!==null)metricLines.push(`<p data-tip="${escapeHtml(discountMetricTip())}">${escapeHtml(discountMetricLabel())}: <strong>${escapeHtml(formatValue(round2(discount)))}%</strong></p>`);
    const blocks=[`<div class="tariff-detail-block"><h4>Максимальный срок</h4><p><strong>${escapeHtml(formatTerm(item))}</strong></p></div>`];
    if(priceLines.length)blocks.push(`<div class="tariff-detail-block tariff-price-block"><h4>Цены и границы</h4>${priceLines.join('')}</div>`);
    if(metricLines.length)blocks.push(`<div class="tariff-detail-block"><h4>Продажные показатели</h4>${metricLines.join('')}</div>`);
    if(item.returnServiceAllowed)blocks.push(`<div class="tariff-detail-block"><h4>Возврат</h4><p>Разрешён${hasOptionalNumber(item.returnServicePrice,{nonNegative:true})?` · ${escapeHtml(moneyOrDash(item.returnServicePrice,{nonNegative:true}))}`:''}</p></div>`);
    blocks.push(`<div class="tariff-detail-block tariff-detail-wide tariff-services-block"><h4>Услуги</h4><div class="tariff-services-scroll">${services}</div></div>`);
    return`<div class="tariff-details">${blocks.join('')}</div>`;
  }
  function companyFacetSet(facet){
    if(!state.companyView.selectedCargo)state.companyView.selectedCargo=new Set();
    return{company:state.companyView.selectedCompanies,type:state.companyView.selectedTypes,method:state.companyView.selectedMethods,urgency:state.companyView.selectedUrgencies,tariff:state.companyView.selectedTariffs,route:state.companyView.selectedRoutes,cargo:state.companyView.selectedCargo}[facet];
  }
  function setCompanyFacetSet(facet,value){
    const map={company:'selectedCompanies',type:'selectedTypes',method:'selectedMethods',urgency:'selectedUrgencies',tariff:'selectedTariffs',route:'selectedRoutes',cargo:'selectedCargo'};
    if(map[facet])state.companyView[map[facet]]=value;
  }
  function visibleCompanyFacets(){return usesUrgencyFilters()?['company','type','urgency','tariff','route','cargo']:['company','type','tariff','route','cargo'];}
  function companyFacetKey(record,facet){
    const item=record?.item;if(facet==='company')return facetText(item?.deliveryCompanyLabel,'Неизвестная ТК');if(facet==='type')return deliveryTypeName(item);if(facet==='urgency')return facetText(item?.urgencyLabel,'Без срочности');if(facet==='tariff')return companyFilterTariffKey(item);if(facet==='route')return routeKey(record.row);if(facet==='cargo')return cargoKey(record.row);return FACET_EMPTY_KEY;
  }
  function companyFacetLabel(record,facet){return facet==='tariff'?tariffDisplayName(record.item):facet==='cargo'?cargoLabel(record.row):companyFacetKey(record,facet);}
  function companyFacetMeta(record,facet){if(facet==='tariff')return[facetText(record.item?.deliveryCompanyLabel,'Неизвестная ТК'),usesUrgencyFilters()?facetText(record.item?.urgencyLabel,''):'',deliveryTypeName(record.item)].filter(Boolean).join(' · ');if(facet==='cargo')return routeKey(record.row);return'';}
  function companyRecordMatchesFacets(record,exceptFacet=null,strict=false){for(const facet of visibleCompanyFacets()){if(facet===exceptFacet||!state.companyView.touchedFacets?.has(facet))continue;const set=companyFacetSet(facet);if(!set?.size){if(strict)return false;continue;}if(!set.has(companyFacetKey(record,facet)))return false;}return true;}
  function companyFacetCatalog(records,facet){const map=new Map();records.filter(record=>companyRecordMatchesFacets(record,facet,false)).forEach(record=>{const key=companyFacetKey(record,facet),label=companyFacetLabel(record,facet),meta=companyFacetMeta(record,facet);if(!map.has(key))map.set(key,{key,label,meta,count:0,company:facetText(record.item?.deliveryCompanyLabel,'Неизвестная ТК'),urgency:facetText(record.item?.urgencyLabel,''),type:deliveryTypeName(record.item)});map.get(key).count+=1;});const values=[...map.values()];values.sort((a,b)=>facet==='urgency'?(urgencyRankLocal(a.label)-urgencyRankLocal(b.label)||a.label.localeCompare(b.label,'ru')):facet==='tariff'?(a.company.localeCompare(b.company,'ru')||a.label.localeCompare(b.label,'ru')||a.type.localeCompare(b.type,'ru')):a.label.localeCompare(b.label,'ru'));return values;}
  function initializeCompanyFacets(records){['company','type','method','urgency','tariff','route','cargo'].forEach(facet=>setCompanyFacetSet(facet,new Set()));state.companyView.touchedFacets=new Set();visibleCompanyFacets().forEach(facet=>setCompanyFacetSet(facet,new Set(companyFacetCatalog(records,facet).map(option=>option.key))));state.companyView.filtersReady=true;}
  function pruneCompanyFacets(records){for(let pass=0;pass<5;pass++){let changed=false;for(const facet of visibleCompanyFacets()){const available=new Set(companyFacetCatalog(records,facet).map(option=>option.key)),current=companyFacetSet(facet),next=state.companyView.touchedFacets.has(facet)?new Set([...current].filter(key=>available.has(key))):new Set(available);if(next.size!==current.size||[...next].some(key=>!current.has(key))){setCompanyFacetSet(facet,next);changed=true;}}if(!changed)break;}}
  function populateCompanyFacetFilters(records=allCompanyRecords(),resetSelection=false){
    updateUrgencyFacetVisibility();if(resetSelection||!state.companyView.filtersReady)initializeCompanyFacets(records);
    const refs={company:[els.companyCompanyFilterOptions,els.companyCompanyFilterSummary],type:[els.companyTypeFilterOptions,els.companyTypeFilterSummary],urgency:[els.companyUrgencyFilterOptions,els.companyUrgencyFilterSummary],tariff:[els.companyTariffFilterOptions,els.companyTariffFilterSummary],route:[els.companyRouteFilterOptions,els.companyRouteFilterSummary],cargo:[document.getElementById('companyCargoFilterOptions'),document.getElementById('companyCargoFilterSummary')]};
    visibleCompanyFacets().forEach(facet=>{const[container,summary]=refs[facet]||[];if(!container)return;const options=companyFacetCatalog(records,facet),set=companyFacetSet(facet),availableKeys=new Set(options.map(option=>option.key)),selected=[...set].filter(key=>availableKeys.has(key)).length;container.innerHTML=options.length?options.map(option=>facetOptionMarkup('company',facet,option,set.has(option.key))).join(''):'<div class="choice-filter-empty">Нет вариантов для текущего сочетания фильтров.</div>';if(summary){summary.textContent=facetSummaryText(selected,options.length);summary.classList.toggle('is-empty',selected===0);}});
    const compat={company:els.companySelect,route:els.companyRouteFilter,urgency:els.companyUrgencyFilter,type:els.companyMethodFilter};
    Object.entries(compat).forEach(([facet,select])=>{if(!select)return;const options=companyFacetCatalog(records,facet);select.innerHTML='<option value=""></option>'+options.map(option=>`<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`).join('');});
    document.querySelectorAll('#companyModal [data-choice-search-target]').forEach(filterChoiceOptions);
  }
  function applyCompanyFacetAction(action){const normalized=String(action||'').replace(/^companies-/,'company-').replace(/^tariffs-/,'tariff-'),match=normalized.match(/^(company|type|urgency|tariff|route|cargo)-(all|none|invert)$/);if(!match)return;const[,facet,operation]=match,records=allCompanyRecords(),available=companyFacetCatalog(records,facet),keys=available.map(option=>option.key),set=companyFacetSet(facet);if(operation==='all'){state.companyView.touchedFacets.delete(facet);setCompanyFacetSet(facet,new Set(keys));}if(operation==='none'){state.companyView.touchedFacets.add(facet);setCompanyFacetSet(facet,new Set());}if(operation==='invert'){state.companyView.touchedFacets.add(facet);setCompanyFacetSet(facet,new Set(keys.filter(key=>!set.has(key))));}pruneCompanyFacets(records);renderCompanyView();}
  function resetCompanyFilters(render=true){[els.companySearchInput,els.companyPriceMin,els.companyPriceMax,els.companyPeriodMax].forEach(input=>{if(input)input.value='';});document.querySelectorAll('#companyModal [data-choice-search-target]').forEach(input=>{input.value='';filterChoiceOptions(input);});state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';state.companyView.filtersReady=false;initializeCompanyFacets(allCompanyRecords());if(render)renderCompanyView();else populateCompanyFacetFilters(allCompanyRecords(),false);}
  function filteredCompanyRecords(){
    const query=normalize(els.companySearchInput.value),priceMin=numericFilterValue(els.companyPriceMin),priceMax=numericFilterValue(els.companyPriceMax),periodMax=numericFilterValue(els.companyPeriodMax);
    const records=allCompanyRecords().filter(record=>{const{row,item}=record,search=normalize([row.senderQuery,row.recipientQuery,cargoLabel(row),item.deliveryCompanyLabel,tariffDisplayName(item),item.urgencyLabel,deliveryTypeName(item)].join(' ')),price=optionalNumeric(item.userPrice,{positive:true}),period=validPeriod(item.maxPeriod);return companyRecordMatchesFacets(record,null,true)&&(!query||search.includes(query))&&(priceMin===null||(price!==null&&price>=priceMin))&&(priceMax===null||(price!==null&&price<=priceMax))&&(periodMax===null||(period!==null&&period<=periodMax));});
    const direction=state.companyView.sortDir==='desc'?-1:1,key=state.companyView.sortKey;records.sort((a,b)=>{let av,bv;if(key==='requestNo'){av=a.rowIndex;bv=b.rowIndex;}else if(key==='route'){av=routeKey(a.row);bv=routeKey(b.row);}else if(key==='cargo'){av=cargoLabel(a.row);bv=cargoLabel(b.row);}else if(key==='displayDiscount'){av=displayDiscountPct(a.item);bv=displayDiscountPct(b.item);}else{av=a.item[key];bv=b.item[key];}if(key==='maxPeriod')return((validPeriod(av)??Infinity)-(validPeriod(bv)??Infinity))*direction;if(['requestNo','userPrice','inputPrice','retailPrice','discount','displayDiscount'].includes(key)){const an=optionalNumeric(av),bn=optionalNumeric(bv);return((an??Infinity)-(bn??Infinity))*direction;}return String(av||'').localeCompare(String(bv||''),'ru')*direction;});return records;
  }
  function companyColumnOrder(){const order=[...(COMPANY_COLUMN_ORDERS[state.settings.overviewColumnOrder]||COMPANY_COLUMN_ORDERS.logistics)].filter(key=>projectHasRetailPricing()||key!=='retail');if(!projectHasRetailPricing()&&!order.includes('discount'))order.splice(Math.max(0,order.indexOf('price')+1),0,'discount');if(usesUrgencyView()&&!order.includes('urgency'))order.splice(Math.max(0,order.indexOf('tariff')),0,'urgency');return order;}
  function companyColumnMeta(key){return{requestNo:{label:'№ запроса',sort:'requestNo'},route:{label:'Маршрут',sort:'route'},cargo:{label:'Груз',sort:'cargo',advanced:true},company:{label:'ТК',sort:'deliveryCompanyLabel'},urgency:{label:'Срочность',sort:'urgencyLabel'},tariff:{label:'Тариф',sort:'tariffCaption'},method:{label:'Тип доставки',sort:'deliveryTypeLabel'},period:{label:'Макс. срок',sort:'maxPeriod'},price:{label:'Цена клиента',sort:'userPrice'},input:{label:'Вход',advanced:true,sort:'inputPrice'},retail:{label:'Розница',advanced:true,sort:'retailPrice'},discount:{label:discountMetricLabel(),advanced:true,sort:'displayDiscount'},details:{label:''}}[key];}
  function companyCellMarkup(key,record,index){const{row,rowIndex,item}=record,cargo=cargoLabel(row);const cells={requestNo:`<td>${rowIndex+1}</td>`,route:`<td class="route-cell"><div class="route-points"><div class="route-point"><span>Откуда</span><b>${escapeHtml(row.senderQuery||'—')}</b></div><span>→</span><div class="route-point"><span>Куда</span><b>${escapeHtml(row.recipientQuery||'—')}</b></div></div></td>`,cargo:`<td class="advanced-column cargo-cell">${escapeHtml(cargo)}</td>`,company:`<td><div class="tariff-company">${item.deliveryCompanyIcon?`<img src="${escapeHtml(item.deliveryCompanyIcon)}" alt="">`:''}<span>${escapeHtml(item.deliveryCompanyLabel||'—')}</span></div></td>`,urgency:`<td class="urgency-cell"><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(item))}</span></td>`,tariff:`<td><b>${escapeHtml(tariffDisplayName(item))}</b></td>`,method:`<td>${escapeHtml(item.deliveryTypeLabel||item.deliveryMethodLabel||'—')}</td>`,period:`<td>${escapeHtml(formatTerm(item))}</td>`,price:`<td><b>${escapeHtml(formatValue(item.userPrice))} ₽</b></td>`,input:`<td class="advanced-column">${escapeHtml(moneyOrDash(item.inputPrice,{nonNegative:true}))}</td>`,retail:`<td class="advanced-column">${escapeHtml(projectHasRetailPricing()?moneyOrDash(item.retailPrice,{positive:true}):'—')}</td>`,discount:`<td class="advanced-column">${escapeHtml(percentOrDash(displayDiscountPct(item)))}</td>`,details:`<td><button class="button ghost compact-detail" data-company-details="${index}">Подробнее</button></td>`};return cells[key]||'';}
  function syncProjectMetricLabels(){const client=COMPARISON_METRICS.find(metric=>metric.key==='avgClientDiscount'),retail=COMPARISON_METRICS.find(metric=>metric.key==='avgRetailDiscount');if(client){client.label=projectHasRetailPricing()?'Персональная скидка клиента':'Скидка от цены без скидки';client.tip=projectHasRetailPricing()?'Дополнительная скидка конкретного клиента: разница между ценой клиента без персональной скидки и фактической ценой.':'Скидка относительно цены клиента без скидки: разница между базовой ценой клиента и фактической ценой.';}if(retail){retail.label='Скидка от розницы';retail.tip='Средняя скидка цены клиента относительно розничной цены, когда розница доступна.';}}
  function comparisonMetricOptions(){syncProjectMetricLabels();const unsupported=new Set(projectHasRetailPricing()?[]:['avgRetailDiscount']);return COMPARISON_METRICS.filter(metric=>!unsupported.has(metric.key));}
  function comparisonPresetKeys(preset){const allowed=new Set(comparisonMetricOptions().map(metric=>metric.key));return (COMPARISON_PRESETS[preset]||COMPARISON_PRESETS.sale).filter(key=>allowed.has(key));}
  function renderComparisonMetricFields(metrics=comparisonMetricOptions()){
    if(!els.comparisonMetricFields)return;
    els.comparisonMetricFields.innerHTML=metrics.map(metric=>`<label data-tip="${escapeHtml(metric.tip)}"><input type="checkbox" value="${metric.key}"><span>${escapeHtml(metric.label)}</span></label>`).join('');
  }
  function renderComparisonMetricSelector(){renderComparisonMetricFields();setComparisonMetrics(state.settings.comparisonMetrics);}
  function setComparisonMetrics(keys){
    const metrics=comparisonMetricOptions(),allowed=new Set(metrics.map(metric=>metric.key)),current=[...els.comparisonMetricFields?.querySelectorAll('input')||[]].map(input=>input.value);
    if(current.join('|')!==metrics.map(metric=>metric.key).join('|'))renderComparisonMetricFields(metrics);
    const selected=(keys||[]).filter(key=>allowed.has(key)),fallback=comparisonPresetKeys('sale'),final=selected.length?selected:fallback;
    els.comparisonMetricFields?.querySelectorAll('input').forEach(input=>{input.checked=final.includes(input.value);});
    state.settings.comparisonMetrics=final;if(els.comparisonMetricCount)els.comparisonMetricCount.textContent=`(${final.length})`;
  }
  function selectedComparisonMetrics(){const allowed=new Set(comparisonMetricOptions().map(metric=>metric.key));return[...els.comparisonMetricFields.querySelectorAll('input:checked')].map(input=>input.value).filter(key=>allowed.has(key));}
  function applyComparisonPreset(){const preset=els.comparisonPresetSelect.value;if(preset!=='custom')setComparisonMetrics(comparisonPresetKeys(preset));comparisonMetricsChanged();}
  function comparisonMetricsChanged(){const selected=selectedComparisonMetrics(),fallback=comparisonPresetKeys('sale');state.settings.comparisonMetrics=selected.length?selected:fallback;if(els.comparisonMetricCount)els.comparisonMetricCount.textContent=`(${state.settings.comparisonMetrics.length})`;els.comparisonPresetSelect.value=Object.entries(COMPARISON_PRESETS).find(([,keys])=>comparisonPresetKeysFromList(keys).sort().join('|')===[...state.settings.comparisonMetrics].sort().join('|'))?.[0]||'custom';persistSettings();markAnalyticsDirty('comparison');}
  function comparisonPresetKeysFromList(keys){const allowed=new Set(comparisonMetricOptions().map(metric=>metric.key));return(keys||[]).filter(key=>allowed.has(key));}
  function enrichSalesRecord(record,params){const model=tariffPriceModel(record.item),price=model.userPrice,lkPercentFloor=lkFloorCandidates(model).find(item=>item.label.includes('%'))?.value??null,marketGap=price!==null&&record.marketMin&&record.marketMin>0?(price-record.marketMin)/record.marketMin*100:null,{floorPrice,floorSource}=priceFloorModel(model,params),marketTarget=record.marketMin&&record.marketMin>0?record.marketMin*(1-params.beat/100):null,currentBelowFloor=price!==null&&floorPrice!==null&&price<floorPrice,safeDiscount=price!==null&&floorPrice!==null&&!currentBelowFloor?Math.max(0,(price-floorPrice)/price*100):currentBelowFloor?0:null;let recommendedPrice=null,recommendedDiscount=null,recommendationStatus='';if(price===null)recommendationStatus='Нет цены клиента';else if(floorPrice===null)recommendationStatus='Не хватает данных для ограничения цены';else if(currentBelowFloor){recommendedPrice=floorPrice;recommendedDiscount=0;recommendationStatus='Поднять цену до допустимого минимума';}else if(marketTarget===null){recommendedPrice=price;recommendedDiscount=0;recommendationStatus='Нет другой ТК для сравнения';}else if(price<=marketTarget){recommendedPrice=price;recommendedDiscount=0;recommendationStatus='Цена уже конкурентнее альтернативы';}else{recommendedPrice=Math.max(floorPrice,marketTarget);recommendedDiscount=Math.max(0,(price-recommendedPrice)/price*100);recommendationStatus=recommendedPrice>marketTarget?'Скидку ограничивает допустимый минимум':'Можно снизить цену и стать конкурентнее';}const enriched={...record,price,priceWithoutDiscount:model.userPriceWithoutDiscount,input:model.inputPrice,inputPercent:model.inputPricePercent,minAllowedPrice:model.minPrice,minAllowedPercent:model.minPricePercent,minPercentFloor:lkPercentFloor,retail:projectHasRetailPricing()?model.retailPrice:null,activeDiscount:model.activeDiscountPct,margin:model.marginRub,marginPct:model.marginPct,clientDiscount:model.clientDiscountPct,displayDiscount:displayDiscountPct(record.item),retailDiscount:projectHasRetailPricing()?model.retailDiscountPct:null,marketGap,marketTarget,floorPrice,floorSource,currentBelowFloor,safeDiscount,recommendedPrice,recommendedDiscount,recommendationStatus};const priority=salesPriority(enriched);return{...enriched,priority:priority.label,priorityDetails:priority.details,priorityTone:priority.tone,priorityRank:priority.rank,potentialSavingsRub:salesPotentialSavings(enriched)};}
  function comparisonStats(){const params=salesParams('custom','comparison'),filters=comparisonFilters(),records=bestRouteCompanyRecords(filters).map(record=>enrichSalesRecord(record,params)),scopeRows=new Set(filteredCompanyRecords().filter(record=>deliveryTypeName(record.item)===filters.method).map(record=>record.rowIndex)),groups=new Map();records.forEach(record=>{if(!groups.has(record.company))groups.set(record.company,[]);groups.get(record.company).push(record);});return[...groups.entries()].map(([company,items])=>{const values=key=>items.map(item=>item[key]).filter(value=>Number.isFinite(value)),prices=values('price'),periods=items.map(item=>validPeriod(item.item.maxPeriod)).filter(value=>value!==null),services=items.map(item=>ceilingMoney(item.item.servicesPrice,{nonNegative:true})).filter(value=>value!==null),wins=items.filter(item=>item.routeMarketMin&&item.price!==null&&Math.abs(item.price-item.routeMarketMin)<.01).length,opportunities=items.filter(item=>Number(item.potentialSavingsRub)>0),needsIncrease=items.filter(item=>item.currentBelowFloor),withoutAlternative=items.filter(item=>item.marketMin===null);return{company,minPrice:prices.length?Math.min(...prices):null,avgPrice:averageOrNull(prices),maxPrice:prices.length?Math.max(...prices):null,avgPriceWithoutDiscount:averageOrNull(values('priceWithoutDiscount')),avgInput:averageOrNull(values('input')),avgMinAllowedPrice:averageOrNull(values('minAllowedPrice')),avgRetail:projectHasRetailPricing()?averageOrNull(values('retail')):null,bestPeriod:periods.length?Math.min(...periods):null,avgPeriod:averageOrNull(periods),avgMarginRub:averageOrNull(values('margin')),avgMarginPct:averageOrNull(values('marginPct')),avgRetailDiscount:projectHasRetailPricing()?averageOrNull(values('retailDiscount')):null,avgClientDiscount:averageOrNull(values('clientDiscount')),avgActiveDiscount:averageOrNull(values('activeDiscount')),marketGapPct:averageOrNull(values('marketGap')),safeDiscountPct:averageOrNull(values('safeDiscount')),recommendedPrice:averageOrNull(values('recommendedPrice')),recommendedDiscountPct:averageOrNull(values('recommendedDiscount')),avgServicesPrice:averageOrNull(services),winRatePct:items.length?wins/items.length*100:null,offersCount:items.length,coveragePct:scopeRows.size?new Set(items.map(item=>item.rowIndex)).size/scopeRows.size*100:null,discountOpportunityPct:items.length?opportunities.length/items.length*100:null,avgPotentialSavingsRub:averageOrNull(opportunities.map(item=>item.potentialSavingsRub)),needsPriceIncreasePct:items.length?needsIncrease.length/items.length*100:null,noAlternativePct:items.length?withoutAlternative.length/items.length*100:null,records:items};});}
  function allManagerSalesColumns(rows=buildManagerRows()){const any=key=>rows.some(record=>record[key]!==null&&record[key]!==undefined&&Number.isFinite(Number(record[key])));return[{key:'priority',label:'Действие',tip:'Короткая подсказка для менеджера: дать скидку, поднять цену, оставить как есть или проверить вручную.'},{key:'route',label:'Маршрут'},{key:'cargo',label:'Груз'},{key:'company',label:'ТК'},...(usesUrgencyView()?[{key:'urgency',label:'Срочность'}]:[]),{key:'tariff',label:'Тариф'},{key:'method',label:'Тип доставки'},{key:'period',label:'Макс. срок',tip:'Используется максимальный срок. Ноль отображается как «По запросу».'},{key:'price',label:'Текущая цена клиенту',tip:'Фактическая цена выбранного тарифа для клиента.'},...(any('priceWithoutDiscount')?[{key:'priceWithoutDiscount',label:projectHasRetailPricing()?'Цена без персональной скидки':'Цена клиента без скидки',tip:'Цена до скидки клиента.'}]:[]),...(!projectHasRetailPricing()&&any('displayDiscount')?[{key:'displayDiscount',label:`${discountMetricLabel()}, %`,tip:discountMetricTip()}]:[]),...(projectHasRetailPricing()&&any('clientDiscount')?[{key:'clientDiscount',label:'Персональная скидка, %',tip:'Дополнительная скидка клиента. 0% означает, что персональной скидки нет.'}]:[]),...(any('activeDiscount')?[{key:'activeDiscount',label:'Активная скидка ЛК, %',tip:'Скидка, переданная личным кабинетом.'}]:[]),...(any('input')?[{key:'input',label:'Вход',tip:'Себестоимость тарифа.'},{key:'marginPct',label:'Маржа, %',tip:'Доля разницы между ценой клиенту и входом в цене продажи.'}]:[]),...(any('minAllowedPrice')?[{key:'minAllowedPrice',label:'Минимум ЛК, ₽',tip:'Минимальная допустимая сумма из ответа личного кабинета.'}]:[]),...(any('minPercentFloor')?[{key:'minPercentFloor',label:'Мин. по проценту ЛК',tip:'Запасной минимум, когда сумма Минимум ЛК пустая: вход × minPricePercent / 100.'}]:[]),...(projectHasRetailPricing()&&any('retail')?[{key:'retail',label:'Розница',tip:'Розничная цена, когда она доступна.'},{key:'retailDiscount',label:'Скидка от розницы, %',tip:'Разница между розницей и текущей ценой клиенту.'}]:[]),{key:'marketMin',label:'Лучшая цена другой ТК',tip:'Минимальная цена другой выбранной ТК на том же маршруте и типе доставки.'},{key:'marketGap',label:'Разница с альтернативой, %',tip:'Отрицательное значение — текущая ТК дешевле; положительное — дороже лучшей другой ТК.'},{key:'floorPrice',label:'Итоговая нижняя граница',tip:'Ниже этой цены нельзя опускаться по выбранному правилу.'},{key:'safeDiscount',label:'Макс. безопасная скидка, %',tip:'Сколько можно дополнительно снизить от текущей цены до допустимого минимума.'},{key:'potentialSavingsRub',label:'Резерв скидки, ₽',tip:'Разница между текущей ценой и рекомендованной ценой.'},{key:'recommendedPrice',label:'Цена для предложения',tip:'Цена, которую можно предложить клиенту.'},{key:'recommendedDiscount',label:'Доп. скидка до рекомендации, %',tip:'Дополнительное снижение от текущей цены до цены для предложения.'},{key:'status',label:'Вывод для сотрудника'}];}
  function managerSalesColumns(rows=buildManagerRows()){
    const all=allManagerSalesColumns(rows),saved=Array.isArray(state.settings.managerVisibleColumns)?state.settings.managerVisibleColumns:[],selected=new Set(saved);
    if(selected.has('__none__'))return[];
    return selected.size?all.filter(column=>selected.has(column.key)):all;
  }
  function renderManagerColumnSelector(rows=buildManagerRows()){
    const host=document.getElementById('managerColumnFields'),count=document.getElementById('managerColumnsCount');if(!host)return;
    const all=allManagerSalesColumns(rows),saved=Array.isArray(state.settings.managerVisibleColumns)?state.settings.managerVisibleColumns:[],selected=new Set(saved),showAll=!saved.length,selectedCount=showAll?all.length:all.filter(column=>selected.has(column.key)).length;
    host.innerHTML=`<div class="column-picker-actions"><button type="button" class="button mini secondary" data-column-picker-action="all">Выбрать все</button><button type="button" class="button mini ghost" data-column-picker-action="none">Снять все</button></div>`+all.map(column=>`<label><input type="checkbox" value="${escapeHtml(column.key)}" ${showAll||selected.has(column.key)?'checked':''}><span>${escapeHtml(column.label)}</span></label>`).join('');
    if(count)count.textContent=`(${selectedCount}/${all.length})`;
  }
  function managerExportValue(record,key){const values={priority:`${record.priority}${record.priorityDetails?` — ${record.priorityDetails}`:''}`,route:record.route,cargo:cargoLabel(record.row),company:record.company,urgency:record.item.urgencyLabel||'',tariff:tariffDisplayName(record.item),method:record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'',period:periodExportValue(record.item.maxPeriod),price:record.price,priceWithoutDiscount:record.priceWithoutDiscount,displayDiscount:record.displayDiscount,clientDiscount:record.clientDiscount,activeDiscount:record.activeDiscount,input:record.input,marginPct:record.marginPct,minAllowedPrice:record.minAllowedPrice,minPercentFloor:record.minPercentFloor,retail:record.retail,retailDiscount:record.retailDiscount,marketMin:record.marketMin,marketGap:record.marketGap,floorPrice:record.floorPrice,safeDiscount:record.safeDiscount,potentialSavingsRub:record.potentialSavingsRub,recommendedPrice:record.recommendedPrice,recommendedDiscount:record.recommendedDiscount,status:record.recommendationStatus};const value=values[key];return typeof value==='number'&&Number.isFinite(value)?round2(value):(value??'');}
  function managerCellMarkup(record,key){const gapClass=record.marketGap===null?'':record.marketGap<=0?'status-good':record.marketGap<=5?'status-warn':'status-bad',priorityClass=`recommendation-status ${record.priorityTone||'neutral'}`;const cells={priority:`<td><span class="${priorityClass}">${escapeHtml(record.priority||'Проверить')}</span>${record.priorityDetails?`<small class="cell-note">${escapeHtml(record.priorityDetails)}</small>`:''}</td>`,route:`<td class="route-cell">${escapeHtml(record.route)}</td>`,cargo:`<td>${escapeHtml(cargoLabel(record.row))}</td>`,company:`<td>${escapeHtml(record.company)}</td>`,urgency:`<td><span class="urgency-badge">${escapeHtml(tariffUrgencyLabel(record.item))}</span></td>`,tariff:`<td>${escapeHtml(tariffDisplayName(record.item))}</td>`,method:`<td>${escapeHtml(record.item.deliveryTypeLabel||record.item.deliveryMethodLabel||'—')}</td>`,period:`<td>${escapeHtml(formatTerm(record.item))}</td>`,price:`<td><b>${escapeHtml(moneyOrDash(record.price,{positive:true}))}</b></td>`,priceWithoutDiscount:`<td>${escapeHtml(moneyOrDash(record.priceWithoutDiscount,{positive:true}))}</td>`,displayDiscount:`<td>${escapeHtml(percentOrDash(record.displayDiscount))}</td>`,clientDiscount:`<td>${escapeHtml(percentOrDash(record.clientDiscount))}</td>`,activeDiscount:`<td>${escapeHtml(percentOrDash(record.activeDiscount))}</td>`,input:`<td>${escapeHtml(moneyOrDash(record.input,{nonNegative:true}))}</td>`,marginPct:`<td>${escapeHtml(percentOrDash(record.marginPct))}</td>`,minAllowedPrice:`<td>${escapeHtml(moneyOrDash(record.minAllowedPrice,{positive:true}))}</td>`,minPercentFloor:`<td>${escapeHtml(moneyOrDash(record.minPercentFloor,{positive:true}))}<small class="cell-note">${record.minAllowedPercent===null?'':`${escapeHtml(percentOrDash(record.minAllowedPercent))} ЛК`}</small></td>`,retail:`<td>${escapeHtml(moneyOrDash(record.retail,{positive:true}))}</td>`,retailDiscount:`<td>${escapeHtml(percentOrDash(record.retailDiscount))}</td>`,marketMin:`<td>${escapeHtml(moneyOrDash(record.marketMin,{positive:true}))}</td>`,marketGap:`<td class="${gapClass}">${escapeHtml(percentOrDash(record.marketGap))}</td>`,floorPrice:`<td>${record.floorPrice===null?'—':`${escapeHtml(formatValue(round2(record.floorPrice)))} ₽`}<small class="cell-note">${escapeHtml(record.floorSource||'')}</small></td>`,safeDiscount:`<td>${escapeHtml(percentOrDash(record.safeDiscount))}</td>`,potentialSavingsRub:`<td>${escapeHtml(moneyOrDash(record.potentialSavingsRub,{positive:true}))}</td>`,recommendedPrice:`<td><b>${record.recommendedPrice===null?'—':`${escapeHtml(formatValue(round2(record.recommendedPrice)))} ₽`}</b></td>`,recommendedDiscount:`<td>${escapeHtml(percentOrDash(record.recommendedDiscount))}</td>`,status:`<td><span class="${priorityClass}">${escapeHtml(record.recommendationStatus)}</span></td>`};return cells[key]||'<td>—</td>';}

  const COMPANY_TABLE_BATCH_SIZE=500;
  const analyticsRenderTimers={comparison:null,manager:null,matrix:null};
  function companyRecordsCacheKey(){
    return `${currentProjectId()}|${state.rows.map(row=>[
      row.id,row.senderQuery,row.recipientQuery,row.weight,row.seats,row.length,row.width,row.height,row.calcVersion,
      row.result?.calculatedAt||'',row.result?.allTariffs?.length||0,row.result?.best?.deliveryCompanyLabel||'',row.result?.best?.userPrice||''
    ].join(':')).join('|')}`;
  }
  function allCompanyRecords(){
    const key=companyRecordsCacheKey(),cache=state.companyView.recordsCache;
    if(cache?.key===key)return cache.records;
    const records=flattenTariffs(state.rows).filter(record=>!isHiddenCompanyName(record.item?.deliveryCompanyLabel));
    state.companyView.recordsCache={key,records};
    state.companyView.facetCatalogCache={};
    state.companyView.filteredCache=null;
    return records;
  }
  function companyFilterSignature(){
    const facets=visibleCompanyFacets().map(facet=>`${facet}:${[...(companyFacetSet(facet)||new Set())].sort().join(',')}`).join('|');
    return [currentProjectId(),facets,els.companySearchInput?.value||'',els.companyPriceMin?.value||'',els.companyPriceMax?.value||'',els.companyPeriodMax?.value||'',state.companyView.sortKey,state.companyView.sortDir,state.companyView.advanced?'1':'0'].join('||');
  }
  function companyAnalyticsFilterSignature(){
    const facets=visibleCompanyFacets().map(facet=>`${facet}:${[...(companyFacetSet(facet)||new Set())].sort().join(',')}`).join('|');
    return [currentProjectId(),facets,els.companySearchInput?.value||'',els.companyPriceMin?.value||'',els.companyPriceMax?.value||'',els.companyPeriodMax?.value||''].join('||');
  }
  function companyFacetCacheKey(records,facet){
    const base=`${state.companyView.recordsCache?.key||companyRecordsCacheKey()}|${records.length}|${facet}`;
    if(facet!=='tariff')return `${base}|all-calculated`;
    const scope=['company','type','urgency'].filter(name=>visibleCompanyFacets().includes(name)).map(name=>`${name}:${[...(companyFacetSet(name)||new Set())].sort().join(',')}`).join('|');
    return `${base}|selected-scope|${scope}`;
  }
  function companyTariffFacetAllowed(record){
    for(const facet of ['company','type','urgency']){
      if(!visibleCompanyFacets().includes(facet))continue;
      const set=companyFacetSet(facet);
      if(!set?.size||!set.has(companyFacetKey(record,facet)))return false;
    }
    return true;
  }
  function companyFacetCatalog(records,facet){
    const key=companyFacetCacheKey(records,facet),cache=state.companyView.facetCatalogCache||={};
    if(cache[key])return cache[key];
    const map=new Map();
    const source=facet==='tariff'?records.filter(companyTariffFacetAllowed):records;
    source.forEach(record=>{const item=record?.item,key=companyFacetKey(record,facet),label=companyFacetLabel(record,facet),meta=companyFacetMeta(record,facet);if(!map.has(key))map.set(key,{key,label,meta,count:0,company:facetText(item?.deliveryCompanyLabel,'Неизвестная ТК'),urgency:facetText(item?.urgencyLabel,''),type:deliveryTypeName(item)});map.get(key).count+=1;});
    const values=[...map.values()];
    values.sort((a,b)=>facet==='urgency'?(urgencyRankLocal(a.label)-urgencyRankLocal(b.label)||a.label.localeCompare(b.label,'ru')):facet==='tariff'?(a.company.localeCompare(b.company,'ru')||a.label.localeCompare(b.label,'ru')||a.type.localeCompare(b.type,'ru')):a.label.localeCompare(b.label,'ru'));
    cache[key]=values;return values;
  }
  function filteredCompanyRecords(){
    const signature=companyFilterSignature(),cache=state.companyView.filteredCache;
    if(cache?.signature===signature)return cache.records;
    const query=normalize(els.companySearchInput.value),priceMin=numericFilterValue(els.companyPriceMin),priceMax=numericFilterValue(els.companyPriceMax),periodMax=numericFilterValue(els.companyPeriodMax);
    const records=allCompanyRecords().filter(record=>{const{row,item}=record,search=normalize([row.senderQuery,row.recipientQuery,cargoLabel(row),item.deliveryCompanyLabel,tariffDisplayName(item),item.urgencyLabel,deliveryTypeName(item)].join(' ')),price=optionalNumeric(item.userPrice,{positive:true}),period=validPeriod(item.maxPeriod);return companyRecordMatchesFacets(record,null,true)&&(!query||search.includes(query))&&(priceMin===null||(price!==null&&price>=priceMin))&&(priceMax===null||(price!==null&&price<=priceMax))&&(periodMax===null||(period!==null&&period<=periodMax));});
    const direction=state.companyView.sortDir==='desc'?-1:1,key=state.companyView.sortKey;
    records.sort((a,b)=>{let av,bv;if(key==='requestNo'){av=a.rowIndex;bv=b.rowIndex;}else if(key==='route'){av=routeKey(a.row);bv=routeKey(b.row);}else if(key==='cargo'){av=cargoLabel(a.row);bv=cargoLabel(b.row);}else if(key==='displayDiscount'){av=displayDiscountPct(a.item);bv=displayDiscountPct(b.item);}else{av=a.item[key];bv=b.item[key];}if(key==='maxPeriod')return((validPeriod(av)??Infinity)-(validPeriod(bv)??Infinity))*direction;if(['requestNo','userPrice','inputPrice','retailPrice','discount','displayDiscount'].includes(key)){const an=optionalNumeric(av),bn=optionalNumeric(bv);return((an??Infinity)-(bn??Infinity))*direction;}return String(av||'').localeCompare(String(bv||''),'ru')*direction;});
    state.companyView.filteredCache={signature,records};return records;
  }
  function markAnalyticsStale(){
    state.analyticsDirty.comparison=true;state.analyticsDirty.manager=true;analyticsPendingScopes.clear();clearTimeout(analyticsAutoRefreshTimer);
    const setStale=element=>{if(!element)return;element.textContent='Есть изменения — откройте вкладку или нажмите «Обновить»';element.classList.add('analytics-dirty');const box=element.closest('.analytics-auto-status');box?.classList.remove('updating','updated');};
    setStale(els.comparisonUpdatedAt);setStale(els.managerUpdatedAt);setStale(document.getElementById('matrixUpdatedAt'));
  }
  function prepareAnalyticsControls(records=allCompanyRecords()){
    const companies=[...new Set(records.map(record=>record.item.deliveryCompanyLabel||'Неизвестная ТК'))].sort((a,b)=>a.localeCompare(b,'ru')),methods=analyticsMethodList(),routes=routeOptions();
    const companyOptions='<option value="">Все ТК</option>'+companies.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(''),routeOptionsHtml='<option value="">Все направления</option>'+routes.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    if(els.companySelect)els.companySelect.innerHTML=companyOptions;
    if(els.managerCompanyFilter)els.managerCompanyFilter.innerHTML=companyOptions;
    if(els.managerBaseCompanyFilter)els.managerBaseCompanyFilter.innerHTML='<option value="cheapest">Самая низкая цена в строке</option>'+companies.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    if(els.comparisonRouteSelect)els.comparisonRouteSelect.innerHTML=routeOptionsHtml;
    if(els.managerRouteFilter)els.managerRouteFilter.innerHTML=routeOptionsHtml;
    populateAnalyticsMethodSelects(methods);
    renderMatrixMethodSelect();
    if(els.managerViewSelect)els.managerViewSelect.value=state.settings.managerView||'recommendations';
    if(els.managerBaseCompanyFilter)els.managerBaseCompanyFilter.value=[...els.managerBaseCompanyFilter.options].some(option=>option.value===state.settings.managerBaseCompany)?state.settings.managerBaseCompany:'cheapest';
    if(els.comparisonTariffModeSelect)els.comparisonTariffModeSelect.value=state.settings.comparisonTariffMode||'cheapest';
    if(els.comparisonPeriodMax)els.comparisonPeriodMax.value=state.settings.comparisonPeriodMax||'';
    if(els.managerTariffModeSelect)els.managerTariffModeSelect.value=state.settings.managerTariffMode||'cheapest';
    if(els.managerPeriodMax)els.managerPeriodMax.value=state.settings.managerPeriodMax||'';
    if(els.managerPresetSelect)els.managerPresetSelect.value=state.settings.managerPreset||'custom';
    if(els.managerFloorModeSelect)els.managerFloorModeSelect.value=state.settings.managerFloorMode||'strict';
    if(els.managerFloorPercentInput)els.managerFloorPercentInput.value=String(state.settings.managerFloorPercent??10);
    if(els.managerBeatMarketInput)els.managerBeatMarketInput.value=String(state.settings.managerBeatMarketPct||1);
    if(els.comparisonFloorModeSelect)els.comparisonFloorModeSelect.value=state.settings.salesFloorMode||'strict';
    if(els.comparisonFloorPercentInput)els.comparisonFloorPercentInput.value=String(state.settings.salesFloorPercent??10);
    if(els.salesBeatMarketInput)els.salesBeatMarketInput.value=String(state.settings.salesBeatMarketPct||1);
    setComparisonMetrics(state.settings.comparisonMetrics);
  }
  function openCompanyModal(){
    const records=allCompanyRecords();
    if(!records.length){toast('Сначала выполните хотя бы один расчёт','error');return;}
    prepareAnalyticsControls(records);activateCompanyPane('tariffs');
    state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';state.companyView.advanced=false;state.companyView.renderLimit=COMPANY_TABLE_BATCH_SIZE;state.companyView.lastFilterSignature='';
    els.advancedCompanyViewToggle.checked=false;applyAdvancedTableMode(els.companyModal,false);
    resetCompanyFilters(false);populateCompanyFacetFilters(records,true);state.companyView.lastAnalyticsFilterSignature=companyAnalyticsFilterSignature();renderCompanyView();markAnalyticsStale();
    els.companyModal.classList.add('open');els.companyModal.setAttribute('aria-hidden','false');requestAnimationFrame(repositionOpenChoiceFilters);
  }
  function renderCompanyView(){
    const allRecords=allCompanyRecords();
    if(!state.companyView.filtersReady||state.companyView.facetsDirty){populateCompanyFacetFilters(allRecords,false);state.companyView.facetsDirty=false;}
    const signature=companyFilterSignature();if(state.companyView.lastFilterSignature!==signature){state.companyView.renderLimit=COMPANY_TABLE_BATCH_SIZE;state.companyView.lastFilterSignature=signature;}
    const records=filteredCompanyRecords();state.companyView.filtered=records;renderCompanyCards(records);renderCompanyHeader();updateAnalyticsSharedFilterStatus(records);
    const prices=records.map(r=>optionalNumeric(r.item.userPrice,{positive:true})).filter(v=>v!==null),periods=records.map(r=>validPeriod(r.item.maxPeriod)).filter(v=>v!==null),requests=new Set(records.map(r=>r.rowIndex));
    els.companyCountMetric.textContent=String(records.length);els.companyRequestsMetric.textContent=String(requests.size);els.companyMinPriceMetric.textContent=prices.length?`${formatValue(Math.min(...prices))} ₽`:'—';els.companyAvgPriceMetric.textContent=prices.length?`${formatValue(round2(avg(prices)))} ₽`:'—';els.companyFastestMetric.textContent=periods.length?`${Math.min(...periods)} дн.`:'По запросу';
    $$('.company-sort-button').forEach(button=>{button.classList.toggle('active',button.dataset.companySort===state.companyView.sortKey);button.classList.toggle('asc',button.dataset.companySort===state.companyView.sortKey&&state.companyView.sortDir==='asc');button.classList.toggle('desc',button.dataset.companySort===state.companyView.sortKey&&state.companyView.sortDir==='desc');});
    const columns=companyColumnOrder(),colCount=columns.length,limit=Math.max(COMPANY_TABLE_BATCH_SIZE,Number(state.companyView.renderLimit)||COMPANY_TABLE_BATCH_SIZE),visibleRecords=records.slice(0,limit);
    if(!records.length){els.companyTariffsBody.innerHTML=`<tr><td colspan="${colCount}" class="empty-tariffs">По выбранным фильтрам ничего не найдено. Снятые значения остаются доступными в списках — выберите нужные или нажмите «Все».</td></tr>`;}
    else{
      const rows=visibleRecords.map((record,index)=>`<tr>${columns.map(key=>companyCellMarkup(key,record,index)).join('')}</tr><tr class="tariff-details-row hidden" data-company-details-row="${index}"><td colspan="${colCount}"></td></tr>`);
      const remaining=records.length-visibleRecords.length;
      if(remaining>0)rows.push(`<tr class="company-show-more-row"><td colspan="${colCount}"><button type="button" class="button secondary" data-company-show-more>Показать ещё ${Math.min(COMPANY_TABLE_BATCH_SIZE,remaining)}</button><small>В таблице показано ${visibleRecords.length} из ${records.length}. Копирование и XLSX берут всю текущую выборку.</small></td></tr>`);
      els.companyTariffsBody.innerHTML=rows.join('');
    }
    if(state.companyView.pane!=='tariffs')renderAnalyticsTariffPickers();
    const analyticsSignature=companyAnalyticsFilterSignature();
    if(els.companyModal?.classList.contains('open')&&state.companyView.lastAnalyticsFilterSignature!==analyticsSignature){
      state.companyView.lastAnalyticsFilterSignature=analyticsSignature;
      if(state.companyView.pane==='compare')markAnalyticsDirty('comparison');
      else if(state.companyView.pane==='manager')markAnalyticsDirty('manager');
      else if(state.companyView.pane==='matrix')markAnalyticsDirty('matrix');
      else markAnalyticsStale();
    }
  }
  function handleCompanyDetailsClick(event){
    const more=event.target.closest('[data-company-show-more]');
    if(more){state.companyView.renderLimit=(Number(state.companyView.renderLimit)||COMPANY_TABLE_BATCH_SIZE)+COMPANY_TABLE_BATCH_SIZE;renderCompanyView();return;}
    const button=event.target.closest('[data-company-details]');if(!button)return;
    const index=Number(button.dataset.companyDetails),row=els.companyTariffsBody.querySelector(`[data-company-details-row="${CSS.escape(String(index))}"]`),cell=row?.querySelector('td'),record=state.companyView.filtered?.[index];
    if(!row||!cell||!record)return;
    if(!cell.dataset.loaded){cell.innerHTML=tariffDetailsMarkup(record.item);cell.dataset.loaded='1';}
    row.classList.toggle('hidden');button.textContent=row.classList.contains('hidden')?'Подробнее':'Скрыть';
  }
  function invalidateCompanyFilterCaches(facets=false){
    state.companyView.filteredCache=null;
    if(facets){state.companyView.facetCatalogCache={};state.companyView.facetsDirty=true;}
  }
  function handleCompanyFacetChange(event){
    const input=event.target.closest('input[data-company-facet]');if(!input)return;
    const facet=input.dataset.companyFacet,set=companyFacetSet(facet);if(!set)return;
    const records=allCompanyRecords();state.companyView.touchedFacets.add(facet);
    if(input.checked)set.add(input.value);else set.delete(input.value);
    invalidateCompanyFilterCaches(true);pruneCompanyFacets(records);invalidateCompanyFilterCaches(true);renderCompanyView();
  }
  function applyCompanyFacetAction(action){
    const normalized=String(action||'').replace(/^companies-/,'company-').replace(/^tariffs-/,'tariff-'),match=normalized.match(/^(company|type|urgency|tariff|route|cargo)-(all|none|invert)$/);if(!match)return;
    const[,facet,operation]=match,records=allCompanyRecords(),available=companyFacetCatalog(records,facet),keys=available.map(option=>option.key),set=companyFacetSet(facet);
    if(operation==='all'){state.companyView.touchedFacets.delete(facet);setCompanyFacetSet(facet,new Set(keys));}
    if(operation==='none'){state.companyView.touchedFacets.add(facet);setCompanyFacetSet(facet,new Set());}
    if(operation==='invert'){state.companyView.touchedFacets.add(facet);setCompanyFacetSet(facet,new Set(keys.filter(key=>!set.has(key))));}
    invalidateCompanyFilterCaches(true);pruneCompanyFacets(records);invalidateCompanyFilterCaches(true);renderCompanyView();
  }
  function resetCompanyFilters(render=true){
    [els.companySearchInput,els.companyPriceMin,els.companyPriceMax,els.companyPeriodMax].forEach(input=>{if(input)input.value='';});
    document.querySelectorAll('#companyModal [data-choice-search-target]').forEach(input=>{input.value='';filterChoiceOptions(input);});
    state.companyView.sortKey='calculatorOrder';state.companyView.sortDir='asc';state.companyView.filtersReady=false;state.companyView.touchedFacets=new Set();
    invalidateCompanyFilterCaches(true);initializeCompanyFacets(allCompanyRecords());state.companyView.facetsDirty=true;
    if(render)renderCompanyView();else populateCompanyFacetFilters(allCompanyRecords(),false);
  }
  function renderMatrixMethodSelect(){
    const select=document.getElementById('matrixMethodSelect');if(!select)return;
    const methods=analyticsMethodList(),store=state.settings.matrixMethodByProject||={},stored=store[currentProjectId()]||'',selected=methods.includes(stored)?stored:'';
    select.innerHTML='<option value="">Все типы доставки</option>'+methods.map(method=>`<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`).join('');
    select.value=selected;
  }
  function analyticsScopeStatusElement(scope){return scope==='comparison'?els.comparisonUpdatedAt:scope==='manager'?els.managerUpdatedAt:document.getElementById('matrixUpdatedAt');}
  function setAnalyticsPaneBusy(scope){
    if(scope==='comparison'&&els.comparisonCharts)els.comparisonCharts.innerHTML='<div class="analytics-loading">Перестраиваем графики…</div>';
    if(scope==='manager'){
      if(els.managerSummary)els.managerSummary.innerHTML='<div class="metric"><span>Статус</span><b>Пересчёт…</b></div>';
      if(els.managerTableHead)els.managerTableHead.innerHTML='';
      if(els.managerTableBody)els.managerTableBody.innerHTML='<tr><td class="empty-tariffs">Пересчитываем рекомендации по текущей выборке…</td></tr>';
    }
    if(scope==='matrix'){
      const m=matrixElements();
      if(m.summary)m.summary.innerHTML='<div class="metric"><span>Статус</span><b>Пересчёт…</b></div>';
      if(m.head)m.head.innerHTML='';
      if(m.body)m.body.innerHTML='<tr><td class="empty-tariffs">Пересчитываем матрицу цен…</td></tr>';
    }
  }
  function runAnalyticsRender(scope,showToast=false){
    if(!els.companyModal?.classList.contains('open'))return;
    const type=scope==='matrix'?matrixSelectedMethod():ensureSingleAnalyticsType();if(type)syncAnalyticsMethod(type);
    if(scope==='comparison')renderComparison(true);
    if(scope==='manager')renderManagerTable(true);
    if(scope==='matrix'){renderMatrixMethodSelect();renderMatrixPane(true);setAnalyticsStatus(document.getElementById('matrixUpdatedAt'),`Обновлено ${analyticsTimestamp()}`,false);}
    if(showToast){const names={comparison:'графики',manager:'рекомендации',matrix:'матрица'},summary=scope==='matrix'?analyticsSelectionSummary(matrixSelectedMethod()):analyticsSelectionSummary();toast(`${names[scope]||scope} обновлены · ${summary.companies} ТК · ${summary.tariffs} тарифов`,'success');}
  }
  function scheduleAnalyticsRender(scope,showToast=false){
    clearTimeout(analyticsRenderTimers[scope]);setAnalyticsPaneBusy(scope);
    setAnalyticsStatus(analyticsScopeStatusElement(scope),scope==='comparison'?'Перестраиваем…':'Пересчитываем…',true);
    analyticsRenderTimers[scope]=setTimeout(()=>{analyticsRenderTimers[scope]=null;runAnalyticsRender(scope,showToast);},40);
  }
  function activateCompanyPane(name){
    state.companyView.pane=name;$$('[data-company-view]').forEach(button=>button.classList.toggle('active',button.dataset.companyView===name));$$('[data-company-pane]').forEach(pane=>pane.classList.toggle('active',pane.dataset.companyPane===name));
    if(name==='tariffs'){requestAnimationFrame(repositionOpenChoiceFilters);return;}
    if(name==='matrix')renderMatrixMethodSelect();
    scheduleAnalyticsRender(name==='compare'?'comparison':name,false);requestAnimationFrame(repositionOpenChoiceFilters);
  }
  function setAnalyticsStatus(element,text,updating=false){if(!element)return;element.textContent=text;element.classList.toggle('analytics-dirty',updating);const box=element.closest('.analytics-auto-status');box?.classList.toggle('updating',updating);box?.classList.toggle('updated',!updating);}
  function refreshAnalyticsScope(scope='both',showToast=true){
    clearTimeout(analyticsAutoRefreshTimer);
    const scopes=scope==='pending'?[...analyticsPendingScopes]:scope==='both'?['comparison','manager','matrix']:[scope];
    analyticsPendingScopes.clear();
    scopes.forEach((item,index)=>setTimeout(()=>scheduleAnalyticsRender(item,showToast&&scopes.length===1),index*70));
  }
  function markAnalyticsDirty(scope='both'){
    const scopes=scope==='both'?['comparison','manager','matrix']:[scope];
    if(scopes.includes('comparison')){state.analyticsDirty.comparison=true;analyticsPendingScopes.add('comparison');setAnalyticsStatus(els.comparisonUpdatedAt,'Перестраиваем…',true);}
    if(scopes.includes('manager')){state.analyticsDirty.manager=true;analyticsPendingScopes.add('manager');setAnalyticsStatus(els.managerUpdatedAt,'Пересчитываем…',true);}
    if(scopes.includes('matrix')){state.analyticsDirty.matrix=true;analyticsPendingScopes.add('matrix');setAnalyticsStatus(document.getElementById('matrixUpdatedAt'),'Пересчитываем…',true);}
    clearTimeout(analyticsAutoRefreshTimer);analyticsAutoRefreshTimer=setTimeout(()=>{if(!els.companyModal?.classList.contains('open'))return;refreshAnalyticsScope('pending',true);},650);
  }
  const ANALYTICS_HELP={
    comparison:{
      title:'Графики сравнения',
      lead:'Здесь видно, какие ТК легче продавать по выбранным расчётам, тарифам и типу доставки.',
      sections:[
        {title:'Что делают пресеты',body:'Пресет не меняет сами расчёты. Он только выбирает набор показателей: конкурентную цену, запас скидки, маржинальность или логистические параметры.'},
        {title:'Какие цены сравниваются',body:'Основная цена — фактическая цена клиента. Цена без персональной скидки показывает базу до дополнительной скидки конкретного клиента. Вход нужен для маржи. Минимум ЛК задаёт нижнюю границу, ниже которой рекомендация не опускается.'},
        {title:'Скидки для разных проектов',body:'Для КД скидка считается от розницы, когда розница есть. Для ME и OPS розницы нет, поэтому скидка считается от цены клиента без скидки и в аналитике не показываются лишние розничные поля.'},
        {title:'Если цены нет',body:'Пустое значение не считается нулём. Такая цена просто не участвует в средних, процентах и рекомендациях, чтобы не искажать сравнение.'},
        {title:'Как читать графики',body:'Смотрите не только самую низкую цену, но и покрытие маршрутов, средний срок и запас безопасной скидки. ТК может быть дешёвой в одной строке, но проигрывать по стабильности на общей выборке.'}
      ]
    },
    manager:{
      title:'Рекомендации продажам',
      lead:'Вкладка помогает понять, можно ли снижать цену и какую цену безопасно предложить клиенту.',
      sections:[
        {title:'Сценарии продажи',body:'«Баланс» старается быть немного дешевле рынка и сохранить маржу. «Закрыть сделку» агрессивнее снижает цену. «Защитить маржу» осторожнее. «Не ниже ограничения ЛК» жёстко держит минимум личного кабинета.'},
        {title:'Как строится рекомендация',body:'Для каждой строки берётся выбранный тариф ТК и лучшая альтернатива другой ТК на том же маршруте и типе доставки. Затем система считает целевую цену ниже альтернативы и проверяет нижнюю границу.'},
        {title:'Что означает процент',body:'Отрицательное отклонение значит, что текущая ТК дешевле альтернативы. Положительное — дороже. Безопасная скидка показывает, сколько ещё можно снизить от текущей цены до допустимого минимума.'},
        {title:'Нижняя граница',body:'Ограничение цены может быть суммой «Минимум ЛК», процентом minPricePercent от входа, заданной минимальной маржой или более строгим правилом из этих вариантов.'},
        {title:'Как читать строку',body:'Сначала смотрите статус, затем рекомендованную цену, запас скидки и причину ограничения. Если входа или минимума нет, часть полей может быть пустой — это нормально.'}
      ]
    },
    matrix:{
      title:'Матрица цен',
      lead:'Матрица показывает рынок рядом: по каждому маршруту видно, какие ТК и тарифы дешевле или дороже базы.',
      sections:[
        {title:'Строки и колонки',body:'Одна строка — один рассчитанный маршрут с весом, местами и габаритами. В колонках по ТК показываются тариф, тип доставки, цена, отклонение от базы и максимальный срок.'},
        {title:'Тип доставки',body:'Можно смотреть все типы доставки сразу или выбрать один тип. Когда включены все типы, в строках дополнительно показывается тип, чтобы не смешивать дверь-дверь со складскими вариантами без подписи.'},
        {title:'База процентов',body:'Если база — самая низкая цена в строке, 0% получает самый дешёвый вариант. Если выбрана конкретная ТК, проценты считаются относительно её цены.'},
        {title:'Скидки в матрице',body:'Селект «Скидка в матрице» добавляет отдельную колонку внутри каждой ТК. Текущая скидка для КД считается от розницы, для ME и OPS — от цены без скидки. Активная скидка показывает процент, который пришёл из ЛК.'},
        {title:'Как читать проценты',body:'+5% означает, что предложение дороже базы на 5%. −5% означает, что оно дешевле выбранной базовой цены. Прочерк значит, что подходящего тарифа в строке нет.'},
        {title:'Для чего использовать',body:'Матрица удобна для сравнения одинаковых направлений и грузов. Для финальной цены клиенту используйте рекомендации, потому что там учитываются минимум ЛК, вход и маржа.'}
      ]
    }
  };
  function closeAnalyticsHelp(){
    const modal=document.getElementById('analyticsHelpModal');
    if(!modal)return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  }
  function openAnalyticsHelp(topic){
    const data=ANALYTICS_HELP[topic]||ANALYTICS_HELP.comparison,modal=document.getElementById('analyticsHelpModal'),title=document.getElementById('analyticsHelpTitle'),lead=document.getElementById('analyticsHelpLead'),content=document.getElementById('analyticsHelpContent');
    if(!modal||!content)return;
    if(title)title.textContent=data.title;
    if(lead)lead.textContent=data.lead;
    content.innerHTML=data.sections.map((section,index)=>`<section class="analytics-help-card ${index===0?'wide':''}"><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.body)}</p></section>`).join('');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
  }
  function initV25Ui(){
    $$('[data-analytics-help]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openAnalyticsHelp(button.dataset.analyticsHelp);}));
    $$('[data-close-analytics-help]').forEach(element=>element.addEventListener('click',closeAnalyticsHelp));
    document.getElementById('companyModal')?.classList.remove('analytics-filters-collapsed');
    document.getElementById('matrixTariffModeSelect')?.addEventListener('change',()=>refreshAnalyticsScope('matrix'));
    document.getElementById('matrixBaseCompanyFilter')?.addEventListener('change',()=>refreshAnalyticsScope('matrix'));
    document.getElementById('matrixMethodSelect')?.addEventListener('change',event=>{state.settings.matrixMethodByProject||={};state.settings.matrixMethodByProject[currentProjectId()]=event.target.value;persistSettings();refreshAnalyticsScope('matrix');});
    const matrixDiscountSelect=document.getElementById('matrixDiscountModeSelect');
    if(matrixDiscountSelect){
      matrixDiscountSelect.value=state.settings.matrixDiscountMode||'';
      matrixDiscountSelect.addEventListener('change',event=>{state.settings.matrixDiscountMode=['current','active'].includes(event.target.value)?event.target.value:'';persistSettings();refreshAnalyticsScope('matrix');});
    }
    document.getElementById('refreshMatrixBtn')?.addEventListener('click',()=>refreshAnalyticsScope('matrix'));
    document.getElementById('companyCargoFilterOptions')?.addEventListener('change',handleCompanyFacetChange);
    document.getElementById('copyMatrixBtn')?.addEventListener('click',copyMatrix);
    document.getElementById('downloadMatrixXlsxBtn')?.addEventListener('click',downloadMatrixXlsx);
  }

  window.OPS_TOOLKIT_MODULE = {
    tool: 'calculator',
    isBusy() { return Boolean(state.running || state.orderView?.running); },
    switchProject(projectId) { switchProject(projectId); },
    async refreshCredentials() {
      const previousClient = projectSettings().userId;
      await hydrateToolkitCredentials();
      renderProjectTabs();
      renderQuickClientPanel();
      updateConnectionBadge();
      const nextClient = projectSettings().userId;
      if (String(previousClient || '') !== String(nextClient || '')) invalidateClientResults(nextClient);
    },
    invalidateClientResults,
    openSettings() { openSettings('calculation'); },
    openHelp() { openHelpModal(); },
    setTheme(theme) {
      state.settings.theme = theme;
      applyTheme(theme);
      try { persistSettings(); } catch { /* applying the theme must not depend on local storage */ }
    },
    getSettings() {
      const p = projectSettings();
      return {
        bestMethodMode: p.bestMethodMode || projectDef().defaultBestMethod,
        exclusions: [...(p.exclusions || [])], bestExclusions: [...(p.bestExclusions || [])],
        companies: partnerCompanyNames(currentProjectId()), concurrency: state.settings.concurrency,
        debounceMs: state.settings.debounceMs, calcTimeoutMs: state.settings.calcTimeoutMs,
        calcRetries: state.settings.calcRetries, density: state.settings.density,
        showServiceInfo: Boolean(state.settings.showServiceInfo), exportCompanySheets: state.settings.exportCompanySheets !== false,
        exportAnalyticsSheet: Boolean(state.settings.exportAnalyticsSheet), companySheetLayout: state.settings.companySheetLayout,
        exportMainCompanyColumns: Boolean(state.settings.exportMainCompanyColumns),
        mainExportPreset: state.settings.mainExportPreset, tariffExportPreset: state.settings.tariffExportPreset,
        mainExportFields: [...(state.settings.mainExportFields || [])], tariffExportFields: [...(state.settings.tariffExportFields || [])],
        overviewColumnOrder: state.settings.overviewColumnOrder || 'logistics',
        definitions: {
          mainFields: MAIN_EXPORT_FIELDS.map(field => ({ ...field })), tariffFields: TARIFF_EXPORT_FIELDS.map(field => ({ ...field })),
          mainPresets: Object.fromEntries(Object.entries(MAIN_EXPORT_PRESETS).map(([key, value]) => [key, [...value]])),
          tariffPresets: Object.fromEntries(Object.entries(TARIFF_EXPORT_PRESETS).map(([key, value]) => [key, [...value]])),
          defaultExclusions: [...DEFAULT_COMPANY_EXCLUSIONS]
        }
      };
    },
    updateSettings(next = {}) {
      const p = projectSettings();
      if (Object.prototype.hasOwnProperty.call(next, 'bestMethodMode')) p.bestMethodMode = next.bestMethodMode === 'all' ? 'all' : 'door';
      if (Array.isArray(next.exclusions)) p.exclusions = uniqueCompanyNames(next.exclusions);
      if (Array.isArray(next.bestExclusions)) p.bestExclusions = uniqueCompanyNames(next.bestExclusions);
      if (Object.prototype.hasOwnProperty.call(next, 'concurrency')) state.settings.concurrency = Math.min(6, Math.max(1, Number(next.concurrency) || 3));
      state.settings.debounceMs = 900;
      if (Object.prototype.hasOwnProperty.call(next, 'calcTimeoutMs')) state.settings.calcTimeoutMs = Math.min(180000, Math.max(30000, Number(next.calcTimeoutMs) || 120000));
      if (Object.prototype.hasOwnProperty.call(next, 'calcRetries')) state.settings.calcRetries = Math.min(3, Math.max(0, Number(next.calcRetries) || 0));
      if (Object.prototype.hasOwnProperty.call(next, 'density')) state.settings.density = ['micro','compact','medium','spacious'].includes(next.density) ? next.density : 'medium';
      if (Object.prototype.hasOwnProperty.call(next, 'showServiceInfo')) state.settings.showServiceInfo = Boolean(next.showServiceInfo);
      if (Object.prototype.hasOwnProperty.call(next, 'exportCompanySheets')) state.settings.exportCompanySheets = Boolean(next.exportCompanySheets);
      if (Object.prototype.hasOwnProperty.call(next, 'exportAnalyticsSheet')) state.settings.exportAnalyticsSheet = Boolean(next.exportAnalyticsSheet);
      if (Object.prototype.hasOwnProperty.call(next, 'companySheetLayout')) state.settings.companySheetLayout = next.companySheetLayout === 'long' ? 'long' : 'wide';
      if (Object.prototype.hasOwnProperty.call(next, 'exportMainCompanyColumns')) state.settings.exportMainCompanyColumns = Boolean(next.exportMainCompanyColumns);
      if (Array.isArray(next.mainExportFields)) state.settings.mainExportFields = sanitizeFieldSelection(next.mainExportFields, MAIN_EXPORT_FIELDS, MAIN_EXPORT_PRESETS.compact);
      if (Array.isArray(next.tariffExportFields)) state.settings.tariffExportFields = sanitizeFieldSelection(next.tariffExportFields, TARIFF_EXPORT_FIELDS, TARIFF_EXPORT_PRESETS.compact);
      if (Object.prototype.hasOwnProperty.call(next, 'mainExportPreset')) state.settings.mainExportPreset = ['compact','finance','full','custom'].includes(next.mainExportPreset) ? next.mainExportPreset : presetForSelection(state.settings.mainExportFields, MAIN_EXPORT_PRESETS);
      if (Object.prototype.hasOwnProperty.call(next, 'tariffExportPreset')) state.settings.tariffExportPreset = ['compact','finance','logistics','full','custom'].includes(next.tariffExportPreset) ? next.tariffExportPreset : presetForSelection(state.settings.tariffExportFields, TARIFF_EXPORT_PRESETS);
      if (Object.prototype.hasOwnProperty.call(next, 'overviewColumnOrder')) state.settings.overviewColumnOrder = COMPANY_COLUMN_ORDERS[next.overviewColumnOrder] ? next.overviewColumnOrder : 'logistics';
      persistSettings();
      applyDensity();
      fillSettingsForm();
      return this.getSettings();
    },
    runAction(action) {
      if (action === 'calculate') return calculateAll();
      if (action === 'stop') return stopCalculation();
      if (action === 'add-row') return addRows([createRow()], true);
      if (action === 'paste') return openPasteModal();
      if (action === 'import') return els.fileInput?.click();
      if (action === 'template') return downloadImportTemplate();
      if (action === 'example') return insertDemo();
      if (action === 'toggle-auto') { els.autoCalcToggle.checked = !els.autoCalcToggle.checked; els.autoCalcToggle.dispatchEvent(new Event('change', { bubbles: true })); return els.autoCalcToggle.checked; }
      if (action === 'help') return openHelpModal();
      if (action === 'settings') return openSettings('connections');
    },
    async refreshCompanies(force = true) {
      state.settingsProjectId = currentProjectId();
      await refreshPartnerCompanies(Boolean(force));
      return this.getSettings();
    },
    async clearLocalCache(category = 'all') {
      const normalized = normalizeCacheCategory(category);
      if (normalized === 'table-inputs') { clearSavedTableState(true); return; }
      let prefixes = null;
      if (normalized === 'dadata') prefixes = ['address:'];
      if (normalized === 'calculator') prefixes = ['calc:'];
      if (normalized !== 'geo' && normalized !== 'lk') await state.cache?.clear?.(prefixes);
    }
  };


  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initV22Ui,0));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initV25Ui,0));
  document.addEventListener('DOMContentLoaded',()=>{
    const managerColumnFields=document.getElementById('managerColumnFields');
    managerColumnFields?.addEventListener('click',event=>{
      const action=event.target.closest('[data-column-picker-action]')?.dataset.columnPickerAction;if(!action)return;
      state.settings.managerVisibleColumns=action==='all'?[]:['__none__'];
      persistSettings();
      renderManagerRecommendations();
    });
    managerColumnFields?.addEventListener('change',event=>{
      if(!event.target.matches('input[type="checkbox"]'))return;
      const selected=[...document.querySelectorAll('#managerColumnFields input:checked')].map(input=>input.value);
      const total=document.querySelectorAll('#managerColumnFields input[type="checkbox"]').length;
      state.settings.managerVisibleColumns=selected.length===total?[]:selected.length?selected:['__none__'];
      persistSettings();
      renderManagerRecommendations();
    });
    const matrixColumnFields=document.getElementById('matrixColumnFields');
    matrixColumnFields?.addEventListener('click',event=>{
      const action=event.target.closest('[data-column-picker-action]')?.dataset.columnPickerAction;if(!action)return;
      state.settings.matrixVisibleColumns=action==='all'?[]:['__none__'];
      persistSettings();
      renderMatrixPane();
    });
    matrixColumnFields?.addEventListener('change',event=>{
      if(!event.target.matches('input[type="checkbox"]'))return;
      const selected=[...document.querySelectorAll('#matrixColumnFields input:checked')].map(input=>input.value);
      const total=document.querySelectorAll('#matrixColumnFields input[type="checkbox"]').length;
      state.settings.matrixVisibleColumns=selected.length===total?[]:selected.length?selected:['__none__'];
      persistSettings();
      renderMatrixPane();
    });
  });
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>window.parent?.postMessage({type:'ops-toolkit-ready',tool:'calculator'},location.origin),0));
})();
