'use strict';

const DEFAULT_EXCLUDED_COMPANIES = ['Достависта', 'Пешкарики', 'Dimex', 'FoxExpress', 'Яндекс Доставка', 'Global Delivery', 'TNT', 'UPS'];
const DEFAULT_EXCLUDED_COMPANY_IDS = [2, 6, 12, 14, 17, 19, 16, 15];
const NON_TRANSPORT_BEST_COMPANY_PATTERNS = ['достависта', 'пешкар', 'яндекс достав'];
const NON_TRANSPORT_BEST_COMPANY_IDS = new Set([2, 6, 17]);

const PROJECTS = {
  kd: {
    id: 'kd', label: 'Курьер Дисконт', shortLabel: 'КД', baseUrl: 'https://lk.kdiscont.ru', sortStrategy: 'company',
    targetOrder: ['OPS', 'CSE', 'MExpress', 'CDEK', 'DPD', 'Flip Post', 'PonyExpress', 'Деловые линии', 'Байкал Сервис'],
    hardExclusions: [], excludedCompanyIds: [], defaultExclusions: DEFAULT_EXCLUDED_COMPANIES, defaultExcludedCompanyIds: DEFAULT_EXCLUDED_COMPANY_IDS, defaultBestMethod: 'door'
  },
  me: {
    id: 'me', label: 'ME Express', shortLabel: 'ME', baseUrl: 'https://lk.m1express.ru', sortStrategy: 'urgency',
    targetOrder: [], hardExclusions: [], excludedCompanyIds: [], defaultExclusions: DEFAULT_EXCLUDED_COMPANIES, defaultExcludedCompanyIds: DEFAULT_EXCLUDED_COMPANY_IDS, defaultBestMethod: 'all'
  },
  ops: {
    id: 'ops', label: 'OPSPost', shortLabel: 'OPS', baseUrl: 'https://lk.opspost.ru', sortStrategy: 'urgency',
    targetOrder: [], hardExclusions: [], excludedCompanyIds: [], defaultExclusions: DEFAULT_EXCLUDED_COMPANIES, defaultExcludedCompanyIds: DEFAULT_EXCLUDED_COMPANY_IDS, defaultBestMethod: 'all'
  }
};
const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
const CARGO_TYPE = '4aab1fc6-fc2b-473a-8728-58bcd4ff79ba';
const DADATA_RATE_LIMIT_PER_SECOND = 30;
const LK_ADDRESS_RATE_LIMIT_PER_SECOND = 20;
const MAX_CALCULATION_CONCURRENCY = 6;
const MAX_CANCEL_CONCURRENCY = 5;
const memoryCache = new Map();
const inFlight = new Map();
let expiredEntries = 0;

function now() { return Date.now(); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function clampInteger(value, fallback, min, max) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function createRateLimiter(limit, intervalMs) {
  const starts = [];
  const queue = [];
  let timer = null;
  function drain() {
    if (timer) return;
    const timestamp = now();
    while (starts.length && timestamp - starts[0] >= intervalMs) starts.shift();
    while (queue.length && starts.length < limit) {
      const job = queue.shift();
      starts.push(now());
      Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(drain);
    }
    if (queue.length && !timer) {
      const oldest = starts[0] || timestamp;
      const delay = Math.max(1, intervalMs - (timestamp - oldest));
      timer = setTimeout(() => { timer = null; drain(); }, delay);
    }
  }
  return {
    run(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        drain();
      });
    },
    stats() { return { queued: queue.length, recentStarts: starts.length }; }
  };
}
function createConcurrencyLimiter(defaultMax) {
  let max = clampInteger(defaultMax, MAX_CALCULATION_CONCURRENCY, 1, MAX_CALCULATION_CONCURRENCY);
  let active = 0;
  const queue = [];
  const limiter = {
    setMax(value) {
      max = clampInteger(value, max, 1, MAX_CALCULATION_CONCURRENCY);
      drain();
    },
    run(fn, maxOverride) {
      if (maxOverride !== undefined) limiter.setMax(maxOverride);
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        drain();
      });
    },
    stats() { return { active, queued: queue.length, max }; }
  };
  function drain() {
    while (queue.length && active < max) {
      const job = queue.shift();
      active += 1;
      Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => {
        active -= 1;
        drain();
      });
    }
  }
  return limiter;
}
const dadataRequestLimiter = createRateLimiter(DADATA_RATE_LIMIT_PER_SECOND, 1000);
const lkAddressRequestLimiter = createRateLimiter(LK_ADDRESS_RATE_LIMIT_PER_SECOND, 1000);
const calculationRequestLimiter = createConcurrencyLimiter(MAX_CALCULATION_CONCURRENCY);
const orderRequestLimiter = createConcurrencyLimiter(MAX_CALCULATION_CONCURRENCY);
const cancelRequestLimiter = createConcurrencyLimiter(MAX_CANCEL_CONCURRENCY);
function normalize(value) { return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function stableNumber(value, fallback) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function projectConfig(projectId) { return PROJECTS[projectId] || PROJECTS.kd; }
function apiUrl(project, path) { return `${project.baseUrl}${path}`; }
function getCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= now()) {
    memoryCache.delete(key);
    expiredEntries += 1;
    return null;
  }
  return item.value;
}
function putCache(key, value, ttlMs) {
  memoryCache.set(key, { value, expiresAt: now() + ttlMs, createdAt: now() });
  if (memoryCache.size > 1800) {
    const oldest = [...memoryCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt).slice(0, 300);
    oldest.forEach(([cacheKey]) => memoryCache.delete(cacheKey));
  }
}
function coalesce(key, factory) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = Promise.resolve().then(factory).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
function makeError(message, code = 'API_ERROR', status = 0) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
function cacheCategory(key) {
  if (key.startsWith('auth:')) return 'auth';
  if (key.startsWith('user:')) return 'users';
  if (key.startsWith('dadata:')) return 'dadata';
  if (key.startsWith('geo:')) return 'geo';
  if (key.startsWith('companies:')) return 'companies';
  if (key.startsWith('address:')) return 'addresses';
  if (key.startsWith('calc:')) return 'calculations';
  return 'other';
}
function cacheCategoriesFor(category) {
  if (category === 'lk') return ['auth', 'users', 'companies'];
  if (category === 'calculator') return ['calculations'];
  if (category === 'all') return ['all'];
  return [category || 'all'];
}
function cacheProjectMatches(key, projectId) {
  if (!projectId) return true;
  return key.includes(`:${projectId}:`) || key.endsWith(`:${projectId}`) || key.startsWith(`companies:${projectId}`);
}
function estimateBytes(value) {
  try { return new Blob([JSON.stringify(value)]).size; } catch { return String(value ?? '').length * 2; }
}
function getCacheStats() {
  const timestamp = now();
  const groups = {};
  for (const [key, entry] of [...memoryCache.entries()]) {
    if (entry.expiresAt <= timestamp) {
      memoryCache.delete(key);
      expiredEntries += 1;
      continue;
    }
    const category = cacheCategory(key);
    if (!groups[category]) groups[category] = { entries: 0, bytes: 0, minTtlMs: Infinity, maxTtlMs: 0 };
    const group = groups[category];
    group.entries += 1;
    group.bytes += estimateBytes({ key, value: entry.value });
    const ttl = Math.max(0, entry.expiresAt - timestamp);
    group.minTtlMs = Math.min(group.minTtlMs, ttl);
    group.maxTtlMs = Math.max(group.maxTtlMs, ttl);
  }
  Object.values(groups).forEach(group => { if (!Number.isFinite(group.minTtlMs)) group.minTtlMs = 0; });
  return { groups, totalEntries: memoryCache.size, totalBytes: [...memoryCache.entries()].reduce((sum, [key, entry]) => sum + estimateBytes({ key, value: entry.value }), 0), inFlight: inFlight.size, expiredEntries };
}
function clearCache(payload = {}) {
  const category = payload.category || 'all';
  const categories = cacheCategoriesFor(category);
  const projectId = payload.projectId || '';
  for (const key of [...memoryCache.keys()]) {
    const matchesCategory = categories.includes('all') || categories.includes(cacheCategory(key));
    const matchesProject = cacheProjectMatches(key, projectId) || (category === 'dadata' && !projectId);
    if (matchesCategory && matchesProject) memoryCache.delete(key);
  }
  if (category === 'all') inFlight.clear();
  return { cleared: true, stats: getCacheStats() };
}

async function fetchJson(url, options = {}, config = {}) {
  const retries = Number.isInteger(config.retries) ? config.retries : 2;
  const timeoutMs = config.timeoutMs || 25000;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let timer = null;
    try {
      const request = () => {
        timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { ...options, signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      };
      const response = config.limiter ? await config.limiter.run(request, config.maxConcurrent) : await request();
      const text = await response.text();
      let body = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < retries) {
          const retryAfter = Number(response.headers.get('retry-after')) || 0;
          await sleep(Math.max(retryAfter * 1000, 650 * (2 ** attempt)) + Math.floor(Math.random() * 250));
          continue;
        }
        throw makeError(body.message || body.error || `HTTP ${response.status}`, 'HTTP_ERROR', response.status);
      }
      return body;
    } catch (error) {
      lastError = error;
      const retryable = error.name === 'AbortError' || error instanceof TypeError || error.status >= 500 || error.status === 429;
      if (!retryable || attempt >= retries) break;
      await sleep(650 * (2 ** attempt) + Math.floor(Math.random() * 250));
    } finally { if (timer) clearTimeout(timer); }
  }
  if (lastError?.name === 'AbortError') throw makeError('Превышено время ожидания ответа API', 'TIMEOUT');
  throw lastError || makeError('Неизвестная ошибка сети');
}

async function getAuthToken(projectId, email, password, force = false) {
  const project = projectConfig(projectId);
  if (!email || !password) throw makeError(`Укажите email и пароль проекта «${project.label}»`, 'AUTH_REQUIRED');
  const key = `auth:${project.id}:${normalize(email)}`;
  if (!force) {
    const cached = getCache(key);
    if (cached) return cached;
  }
  return coalesce(key, async () => {
    const url = new URL(apiUrl(project, '/api/auth/getToken'));
    url.searchParams.set('email', String(email).trim());
    url.searchParams.set('password', password);
    const json = await fetchJson(url.toString(), { method: 'GET' }, { retries: 1, timeoutMs: 30000 });
    if (!json.status || !json.authToken) throw makeError('Ошибка авторизации. Проверьте логин и пароль.', 'AUTH_FAILED');
    putCache(key, json.authToken, 38 * 60 * 1000);
    return json.authToken;
  });
}

function normalizeDeliveryCompanies(json) {
  const labels = json?.labels && typeof json.labels === 'object' ? json.labels : {};
  return Object.entries(labels).map(([id, label]) => ({
    id: Number(id),
    label: String(label || '').trim()
  })).filter(item => item.label).sort((a, b) => {
    const idA = Number.isFinite(a.id) ? a.id : Number.POSITIVE_INFINITY;
    const idB = Number.isFinite(b.id) ? b.id : Number.POSITIVE_INFINITY;
    return idA - idB || a.label.localeCompare(b.label, 'ru');
  });
}

function fallbackDeliveryCompanies(project) {
  const labels = [...new Set([...(project.targetOrder || []), ...(project.defaultExclusions || [])].filter(Boolean))];
  return labels.map(label => ({ id: null, label }));
}

async function getDeliveryCompanies(project, authToken, force = false) {
  const cacheKey = `companies:${project.id}`;
  if (!force) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  } else memoryCache.delete(cacheKey);
  return coalesce(cacheKey, async () => {
    const url = new URL(apiUrl(project, '/api/cse/referenceDeliveryCompany'));
    url.searchParams.set('authToken', authToken);
    const json = await fetchJson(url.toString(), { method: 'GET' }, { retries: 1, timeoutMs: 30000 });
    const companies = normalizeDeliveryCompanies(json);
    if (!json.status || !companies.length) throw makeError('Не удалось получить список ТК партнёра', 'DELIVERY_COMPANIES_EMPTY');
    putCache(cacheKey, companies, 6 * 60 * 60 * 1000);
    return companies;
  });
}

async function deliveryCompanies(payload) {
  const project = projectConfig(payload.projectId);
  const authToken = await getAuthToken(project.id, payload.email, payload.password, Boolean(payload.force));
  const companies = await getDeliveryCompanies(project, authToken, Boolean(payload.force));
  return { projectId: project.id, companies };
}

async function searchUser(payload) {
  const project = projectConfig(payload.projectId);
  const { email, password, inn } = payload;
  if (!String(inn || '').trim()) throw makeError('Введите ИНН контрагента', 'INN_REQUIRED');
  const authToken = await getAuthToken(project.id, email, password);
  const cacheKey = `user:${project.id}:${normalize(email)}:${normalize(inn)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  return coalesce(cacheKey, async () => {
    const url = new URL(apiUrl(project, '/api/user/list'));
    url.searchParams.set('authToken', authToken);
    url.searchParams.set('attributes[inn]', String(inn).trim());
    const json = await fetchJson(url.toString());
    if (!json.status || !Array.isArray(json.items) || !json.items.length) {
      throw makeError(`Пользователь с ИНН ${inn} не найден.`, 'USER_NOT_FOUND');
    }
    const result = { id: json.items[0].id, display: json.items[0].display || 'Без имени', inn: String(inn).trim(), projectId: project.id };
    putCache(cacheKey, result, 60 * 60 * 1000);
    return result;
  });
}

async function resolveAddress(payload) {
  const project = projectConfig(payload.projectId);
  const query = String(payload.query || '').trim();
  const token = String(payload.tokenDaData || '').trim();
  if (query.length < 3) throw makeError('Введите минимум 3 символа адреса', 'ADDRESS_TOO_SHORT');
  if (!token) throw makeError('Не указан токен DaData', 'DADATA_REQUIRED');
  const finalKey = `address:${project.id}:${normalize(query)}`;
  const finalCached = getCache(finalKey);
  if (finalCached) return { ...finalCached, cached: true, cacheSource: 'dadata' };

  const dadataKey = `dadata:${normalize(query)}`;
  let suggestionData = getCache(dadataKey);
  if (!suggestionData) {
    suggestionData = await coalesce(dadataKey, async () => {
      const dadata = await fetchJson(DADATA_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({ from_bound: { value: 'city' }, to_bound: { value: 'house' }, count: 1, query })
      }, { limiter: dadataRequestLimiter });
      const suggestion = dadata.suggestions?.[0];
      if (!suggestion) throw makeError(`Адрес «${query}» не найден`, 'ADDRESS_NOT_FOUND');
      const data = suggestion.data || {};
      const fiasId = data.settlement_fias_id || data.city_fias_id || '';
      if (!fiasId) throw makeError('DaData не вернула FIAS ID города/населённого пункта', 'FIAS_NOT_FOUND');
      const compact = { unrestrictedValue: suggestion.unrestricted_value || suggestion.value || query, suggestionValue: suggestion.value || query, fiasId };
      putCache(dadataKey, compact, 7 * 24 * 60 * 60 * 1000);
      return compact;
    });
  }

  const geoKey = `geo:${project.id}:${suggestionData.fiasId}`;
  let geo = getCache(geoKey);
  if (!geo) {
    geo = await coalesce(geoKey, async () => {
      const url = new URL(apiUrl(project, '/ajax/autocompleteCseGeoObject'));
      url.searchParams.set('fias_id', suggestionData.fiasId);
      const json = await fetchJson(url.toString(), {}, { limiter: lkAddressRequestLimiter });
      const item = json.items?.[0];
      if (!item?.id) throw makeError(`Город не найден в справочнике «${project.label}»`, 'PROJECT_GEO_NOT_FOUND');
      const parts = [item.text, item.area, item.region].filter(Boolean);
      const resolved = { placeId: item.id, placeText: parts.join(', ') || item.text || suggestionData.suggestionValue };
      putCache(geoKey, resolved, 7 * 24 * 60 * 60 * 1000);
      return resolved;
    });
  }
  const result = {
    query, projectId: project.id, unrestrictedValue: suggestionData.unrestrictedValue, fiasId: suggestionData.fiasId,
    placeId: geo.placeId, placeText: geo.placeText,
    kdId: geo.placeId, kdText: geo.placeText
  };
  putCache(finalKey, result, 7 * 24 * 60 * 60 * 1000);
  return result;
}

function optionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function calculateDiscount(userPrice, retailPrice) {
  const user = optionalNumber(userPrice);
  const retail = optionalNumber(retailPrice);
  if (!(user > 0) || !(retail > 0)) return null;
  if (user >= retail) return 0;
  return Math.ceil(((retail - user) / retail) * 100);
}
function deliveryMethodLabel(item) {
  if (item.deliveryMethodLabel) return String(item.deliveryMethodLabel).trim();
  if (item.deliveryMethodName) return String(item.deliveryMethodName).trim();
  return ({ 1: 'дверь-дверь', 8: 'дверь-склад', 6: 'склад-дверь', 7: 'склад-склад', 2: 'склад-склад', 3: 'склад-дверь', 4: 'дверь-склад' })[item.deliveryMethod] || `режим ${item.deliveryMethod}`;
}
function isFullAddressCompany(value) {
  const name = normalize(value);
  return name.includes('достависта') || name.includes('пешкар') || (name.includes('яндекс') && name.includes('достав'));
}
function isTransportBestCandidate(item) {
  const companyId = Number(item?.deliveryCompany);
  const companyName = normalize(item?.deliveryCompanyLabel);
  if (NON_TRANSPORT_BEST_COMPANY_IDS.has(companyId)) return false;
  return !NON_TRANSPORT_BEST_COMPANY_PATTERNS.some(pattern => companyName.includes(pattern));
}
function compactParamOptions(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  return [];
}
function compactService(service) {
  const params = Array.isArray(service?.params) ? service.params.map(param => ({
    key: param?.key || param?.name || param?.code || '',
    caption: param?.caption || param?.title || param?.label || param?.key || '',
    type: param?.type || param?.valueType || '',
    valueType: param?.valueType || param?.type || '',
    value: param?.value ?? param?.defaultValue ?? '',
    defaultValue: param?.defaultValue ?? param?.value ?? '',
    required: Boolean(param?.required),
    rules: Array.isArray(param?.rules) ? param.rules : [],
    options: compactParamOptions(param?.options),
    values: compactParamOptions(param?.values)
  })).filter(param => param.key) : [];
  const incompatibleServices = Array.isArray(service?.incompatibleServices)
    ? service.incompatibleServices.map(String).filter(Boolean)
    : [];
  return {
    key: service?.key || service?.name || service?.code || service?.id || '',
    enabled: Boolean(service?.enabled), required: Boolean(service?.required), caption: service?.caption || service?.title || service?.key || '',
    description: service?.description || '', price: service?.price ?? '', individualPrice: Boolean(service?.individualPrice),
    params, incompatibleServices
  };
}
function deliveryCompanyMaps(companies = []) {
  const byId = new Map();
  const byName = new Map();
  companies.forEach(company => {
    const label = String(company?.label || '').trim();
    if (!label) return;
    const id = Number(company.id);
    if (Number.isFinite(id)) byId.set(id, label);
    byName.set(normalize(label), Number.isFinite(id) ? id : null);
  });
  return { byId, byName };
}
function compactTariff(item, calculatorOrder = 0, companyLabelsById = new Map()) {
  const inputPrice = optionalNumber(item.input_price ?? item.inputPrice);
  const retailPrice = optionalNumber(item.retailPrice ?? item.retail_price);
  const userPriceWithoutDiscount = optionalNumber(item.user_price_without_discount);
  const minPrice = optionalNumber(item.minPrice);
  const inputPricePercent = optionalNumber(item.inputPricePercent);
  const minPricePercent = optionalNumber(item.minPricePercent);
  const servicesPrice = optionalNumber(item.servicesPrice);
  const returnService = item.return_service || {};
  const deliveryCompanyId = item.deliveryCompany ?? '';
  const referenceLabel = companyLabelsById.get(Number(deliveryCompanyId));
  const deliveryCompanyLabel = String(referenceLabel || item.deliveryCompanyLabel || '').trim();
  return {
    calculatorOrder, tariffId: item.tariffId || '', deliveryCompany: deliveryCompanyId, tariffName: item.tariffName || '',
    urgencyId: item.urgencyId || '', urgencyLabel: item.urgencyIdLabel || '', activeDiscount: optionalNumber(item.activeDiscount),
    tariffCaption: item.tariffCaption || item.urgencyIdLabel || item.tariffName || '', tariffDescription: item.tariffDescription || '',
    deliveryCompanyLabel, deliveryCompanyIcon: item.deliveryCompanyIcon || '',
    deliveryMethod: item.deliveryMethod, deliveryMethodLabel: deliveryMethodLabel(item), deliveryType: item.deliveryType ?? '',
    deliveryTypeLabel: item.deliveryTypeLabel || deliveryMethodLabel(item), hasError: Boolean(item.hasError),
    minPeriod: optionalNumber(item.minPeriod ?? item.periodMin ?? item.min_period ?? item.deliveryPeriodMin ?? item.delivery_period_min), maxPeriod: optionalNumber(item.maxPeriod ?? item.periodMax ?? item.max_period ?? item.deliveryPeriodMax ?? item.delivery_period_max),
    userPrice: optionalNumber(item.user_price) ?? 0, userPriceWithoutDiscount,
    inputPrice, inputPricePercent, retailPrice, minPrice, minPricePercent,
    ratePrice: optionalNumber(item.ratePrice), ratePricePercent: optionalNumber(item.ratePricePercent),
    rateName: item.rateName || '', rateId: item.rateId || '',
    basePrice: optionalNumber(item.basePrice), basePricePercent: optionalNumber(item.basePricePercent),
    periodSort: optionalNumber(item.periodSort), emptyTermText: item.emptyTermText || '',
    forceEmptyTermText: Boolean(item.forceEmptyTermText), filteredReason: item.filteredReason || '',
    sort: optionalNumber(item.sort), isAgent: Boolean(item.isAgent), priority: item.priority || null,
    servicesPrice, discountPercent: optionalNumber(item.discountPercent),
    discount: calculateDiscount(item.user_price, retailPrice), returnServiceAllowed: Boolean(returnService.allowed),
    returnServicePrice: optionalNumber(returnService.price), services: Array.isArray(item.services) ? item.services.map(compactService) : []
  };
}
function compactOrderCreatorService(service) {
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
function compactOrderCreatorTariff(item, index = 0) {
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
    minPeriod: optionalNumber(item?.minPeriod), maxPeriod: optionalNumber(item?.maxPeriod),
    userPrice: optionalNumber(item?.userPrice) ?? 0,
    returnServiceAllowed: Boolean(item?.returnServiceAllowed),
    returnServicePrice: optionalNumber(item?.returnServicePrice),
    services: Array.isArray(item?.services) ? item.services.map(compactOrderCreatorService) : []
  };
}
function compactOrderCreatorResult(result) {
  const allTariffs = (Array.isArray(result?.allTariffs) ? result.allTariffs : [])
    .filter(item => Number(item?.deliveryMethod) === 1 && Number(item?.userPrice) > 0 && !item?.hasError)
    .map(compactOrderCreatorTariff);
  return {
    projectId: result?.projectId || '',
    projectLabel: result?.projectLabel || '',
    sortStrategy: result?.sortStrategy || '',
    bestMethodMode: result?.bestMethodMode || 'door',
    calculatedAt: result?.calculatedAt || new Date().toISOString(),
    allTariffs
  };
}
function urgencyRank(label) {
  const value = normalize(label);
  if (!value) return 90;
  if (value.includes('сверхсроч') || value.includes('super')) return 0;
  if (value.includes('сроч')) return 10;
  if (value.includes('экспресс') || value.includes('express')) return 20;
  if (value.includes('стандарт')) return 30;
  if (value.includes('эконом')) return 40;
  if (value.includes('автомоб')) return 50;
  return 60;
}
function sortTariffs(project, tariffs) {
  if (project.sortStrategy !== 'urgency') return tariffs;
  return [...tariffs].sort((a, b) => {
    const rank = urgencyRank(a.urgencyLabel) - urgencyRank(b.urgencyLabel);
    if (rank) return rank;
    const urgency = String(a.urgencyLabel || '').localeCompare(String(b.urgencyLabel || ''), 'ru');
    if (urgency) return urgency;
    const periodA = Number(a.maxPeriod) > 0 ? Number(a.maxPeriod) : Number.POSITIVE_INFINITY;
    const periodB = Number(b.maxPeriod) > 0 ? Number(b.maxPeriod) : Number.POSITIVE_INFINITY;
    if (periodA !== periodB) return periodA - periodB;
    if (a.userPrice !== b.userPrice) return a.userPrice - b.userPrice;
    return a.calculatorOrder - b.calculatorOrder;
  }).map((item, index) => ({ ...item, calculatorOrder: index }));
}
function processCalculation(project, json, exclusions = [], bestExclusions = [], bestMethodMode = '', partnerCompanies = []) {
  if (!json.status || !Array.isArray(json.data) || !json.data.length) throw makeError('Нет доступных тарифов', 'NO_TARIFFS');
  const companyMaps = deliveryCompanyMaps(partnerCompanies);
  const configuredExclusions = Array.isArray(exclusions) ? exclusions : (project.defaultExclusions || []);
  const excludedNames = new Set(configuredExclusions.map(normalize));
  const excludedIds = new Set(Array.isArray(exclusions) ? [] : (project.defaultExcludedCompanyIds || []));
  configuredExclusions.forEach(name => {
    const id = companyMaps.byName.get(normalize(name));
    if (Number.isFinite(id)) excludedIds.add(id);
  });
  const isExcluded = item => excludedNames.has(normalize(item.deliveryCompanyLabel)) || excludedIds.has(Number(item.deliveryCompany));
  const rawTariffs = json.data.map((item, index) => compactTariff(item, index, companyMaps.byId));
  const allTariffs = sortTariffs(project, rawTariffs.filter(item => !isExcluded(item)));
  const mode = bestMethodMode || project.defaultBestMethod;
  const selectionPool = mode === 'all' ? allTariffs : allTariffs.filter(item => Number(item.deliveryMethod) === 1);
  if (!selectionPool.length) throw makeError(mode === 'all' ? 'Нет доступных тарифов' : 'Нет тарифов с методом дверь-дверь', 'NO_SELECTED_TARIFFS');
  const bestExcludedNames = new Set((Array.isArray(bestExclusions) ? bestExclusions : []).map(normalize));
  const bestExcludedIds = new Set((Array.isArray(bestExclusions) ? bestExclusions : []).map(name => companyMaps.byName.get(normalize(name))).filter(Number.isFinite));
  const transportPool = selectionPool.filter(item => isTransportBestCandidate(item)
    && !bestExcludedNames.has(normalize(item.deliveryCompanyLabel))
    && !bestExcludedIds.has(Number(item.deliveryCompany)));
  const candidates = transportPool.filter(item => item.userPrice > 0 && !item.hasError);
  const cheapest = candidates.length ? candidates.reduce((best, item) => item.userPrice < best.userPrice ? item : best) : null;
  const companies = {};
  selectionPool.forEach(item => {
    const name = item.deliveryCompanyLabel || 'Неизвестная ТК';
    if (item.userPrice > 0 && (!companies[name] || item.userPrice < companies[name].userPrice)) companies[name] = item;
  });
  const referenceOrder = partnerCompanies.map(company => company.label).filter(Boolean);
  const preferredOrder = referenceOrder.length ? referenceOrder : project.targetOrder;
  const targetOrder = preferredOrder.length
    ? [...preferredOrder.filter(name => companies[name]), ...Object.keys(companies).filter(name => !preferredOrder.includes(name))]
    : Object.keys(companies);
  return {
    projectId: project.id, projectLabel: project.label, sortStrategy: project.sortStrategy,
    best: cheapest || { deliveryCompanyLabel: 'Нет транспортных тарифов', tariffCaption: 'Нет подходящего транспортного варианта', maxPeriod: null, userPrice: 0, inputPrice: null, retailPrice: null, minPrice: null, discount: null, deliveryMethodLabel: '—', deliveryTypeLabel: '—' },
    companies, targetOrder, allTariffs, bestMethodMode: mode, calculatedAt: new Date().toISOString()
  };
}

async function calculate(payload) {
  const project = projectConfig(payload.projectId);
  const email = String(payload.email || '').trim();
  const password = String(payload.password || '');
  const userId = String(payload.userId || '').trim();
  const senderCity = String(payload.senderCity || '').trim();
  const recipientCity = String(payload.recipientCity || '').trim();
  if (!userId) throw makeError('Не выбран контрагент', 'USER_REQUIRED');
  if (!senderCity || !recipientCity) throw makeError('Не удалось определить оба города', 'CITY_REQUIRED');
  const cargoWeight = stableNumber(payload.cargoWeight, 0.1);
  const cargoSeats = Math.max(1, Math.round(stableNumber(payload.cargoSeats, 1)));
  const cargoLength = stableNumber(payload.cargoLength, 10);
  const cargoWidth = stableNumber(payload.cargoWidth, 10);
  const cargoHeight = stableNumber(payload.cargoHeight, 10);
  const cargoType = String(payload.cargoType || CARGO_TYPE).trim() || CARGO_TYPE;
  const exclusions = Array.isArray(payload.exclusions) ? [...payload.exclusions].sort() : [...(project.defaultExclusions || [])].sort();
  const bestExclusions = Array.isArray(payload.bestExclusions) ? [...payload.bestExclusions].sort() : [];
  const bestMethodMode = payload.bestMethodMode || project.defaultBestMethod;
  const timeoutMs = Math.min(180000, Math.max(30000, Number(payload.timeoutMs) || 90000));
  const retries = Math.min(3, Math.max(0, payload.retries === undefined ? 2 : Number(payload.retries) || 0));
  const compactForOrderCreator = Boolean(payload.orderCreatorCompact);
  const cacheKey = ['calc:v15', compactForOrderCreator ? 'order' : 'full', project.id, userId, senderCity, recipientCity, cargoType, cargoSeats, cargoWeight, cargoLength, cargoWidth, cargoHeight, bestMethodMode, exclusions.join(','), bestExclusions.join(',')].join('|');
  const calculationContext = { projectId: project.id, clientId: userId, signature: cacheKey };
  if (!payload.force) {
    const cached = getCache(cacheKey);
    if (cached) return { ...cached, cached: true, cacheSource: 'calculator', calculationContext };
  } else memoryCache.delete(cacheKey);
  return coalesce(cacheKey, async () => {
    const authToken = await getAuthToken(project.id, email, password);
    let partnerCompanies = [];
    try {
      partnerCompanies = await getDeliveryCompanies(project, authToken);
    } catch {
      partnerCompanies = fallbackDeliveryCompanies(project);
    }
    const url = new URL(apiUrl(project, '/api/cse/calc'));
    const attributes = {
      sender_city: senderCity, recipient_city: recipientCity, cargo_type: cargoType,
      cargo_seats_number: cargoSeats, cargo_weight: cargoWeight, cargo_length: cargoLength,
      cargo_width: cargoWidth, cargo_height: cargoHeight, user_id: userId, deliveryCompany: 0
    };
    Object.entries(attributes).forEach(([key, value]) => url.searchParams.set(`attributes[${key}]`, String(value)));
    url.searchParams.set('authToken', authToken);
    const maxConcurrent = clampInteger(payload.maxConcurrentCalculations, MAX_CALCULATION_CONCURRENCY, 1, MAX_CALCULATION_CONCURRENCY);
    const json = await fetchJson(url.toString(), { method: 'GET' }, { retries, timeoutMs, limiter: calculationRequestLimiter, maxConcurrent });
    const result = compactForOrderCreator
      ? compactOrderCreatorResult(processCalculation(project, json, exclusions, bestExclusions, bestMethodMode, partnerCompanies))
      : processCalculation(project, json, exclusions, bestExclusions, bestMethodMode, partnerCompanies);
    result.calculationContext = calculationContext;
    putCache(cacheKey, result, 2 * 24 * 60 * 60 * 1000);
    return result;
  });
}

function cleanOrderAttributes(attributes = {}) {
  const result = {};
  Object.entries(attributes || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    result[key] = value;
  });
  return result;
}
function collectApiMessages(value, prefix = '') {
  if (value === undefined || value === null || value === '' || value === false) return [];
  if (typeof value === 'string' || typeof value === 'number') return [`${prefix ? `${prefix}: ` : ''}${value}`];
  if (Array.isArray(value)) return value.flatMap(item => collectApiMessages(item, prefix));
  if (typeof value === 'object') {
    const direct = [value.message, value.error, value.title].filter(Boolean).map(message => `${prefix ? `${prefix}: ` : ''}${message}`);
    const nested = Object.entries(value)
      .filter(([key]) => !['message', 'error', 'title'].includes(key))
      .flatMap(([key, item]) => collectApiMessages(item, key));
    return [...direct, ...nested];
  }
  return [];
}
function orderApiErrorMessage(json) {
  const messages = [
    ...collectApiMessages(json?.error),
    ...collectApiMessages(json?.errors),
    ...collectApiMessages(json?.message)
  ].filter(Boolean);
  return [...new Set(messages)].join('; ') || 'ЛК вернул ошибку создания заказа';
}
function orderResponseId(json) {
  return json?.id || json?.orderId || json?.requestId || json?.attributes?.id || json?.data?.id || json?.result?.id || null;
}
function assertOrderCreated(json) {
  const id = orderResponseId(json);
  if (id) return { ...json, id, raw: json };
  const hasErrors = collectApiMessages(json?.errors).length > 0 || Boolean(json?.error);
  if (json?.status === false || json?.success === false || hasErrors) {
    throw makeError(orderApiErrorMessage(json), 'ORDER_CREATE_FAILED');
  }
  return { ...json, id, raw: json };
}

async function createOrder(payload) {
  const project = projectConfig(payload.projectId);
  const email = String(payload.email || '').trim();
  const password = String(payload.password || '');
  const attributes = cleanOrderAttributes(payload.attributes);
  if (!email || !password) throw makeError('Не заполнены логин и пароль проекта', 'AUTH_REQUIRED');
  if (!attributes.user_id) throw makeError('Не выбран контрагент', 'USER_REQUIRED');
  if (!attributes.sender_city || !attributes.recipient_city) throw makeError('Не распознаны города отправителя и получателя', 'CITY_REQUIRED');
  const authToken = await getAuthToken(project.id, email, password);
  const url = new URL(apiUrl(project, '/api/cse/add'));
  url.searchParams.set('authToken', authToken);
  Object.entries(attributes).forEach(([key, value]) => url.searchParams.set(`attributes[${key}]`, String(value)));
  const maxConcurrent = clampInteger(payload.maxConcurrentOrders, MAX_CALCULATION_CONCURRENCY, 1, MAX_CALCULATION_CONCURRENCY);
  const json = await fetchJson(url.toString(), { method: 'GET' }, { retries: 1, timeoutMs: 90000, limiter: orderRequestLimiter, maxConcurrent });
  return assertOrderCreated(json);
}
async function cancelOrder(payload) {
  const project = projectConfig(payload.projectId);
  const email = String(payload.email || '').trim();
  const password = String(payload.password || '');
  const id = String(payload.id || '').trim();
  if (!email || !password) throw makeError('Не заполнены логин и пароль проекта', 'AUTH_REQUIRED');
  if (!id) throw makeError('Не указан ID заказа для отмены', 'ORDER_ID_REQUIRED');
  const authToken = await getAuthToken(project.id, email, password);
  const url = new URL(apiUrl(project, '/api/cse/cancel'));
  url.searchParams.set('authToken', authToken);
  url.searchParams.set('id', id);
  const maxConcurrent = clampInteger(payload.maxConcurrentCancels, MAX_CANCEL_CONCURRENCY, 1, MAX_CANCEL_CONCURRENCY);
  const json = await fetchJson(url.toString(), { method: 'GET' }, { retries: 1, timeoutMs: 90000, limiter: cancelRequestLimiter, maxConcurrent });
  const hasErrors = collectApiMessages(json?.errors).length > 0 || Boolean(json?.error);
  if (json?.status === false || json?.success === false || hasErrors) {
    throw makeError(orderApiErrorMessage(json) || 'ЛК вернул ошибку отмены заказа', 'ORDER_CANCEL_FAILED');
  }
  return { ...json, id, message: json?.message || json?.data?.message || 'Заказ отменён', raw: json };
}

async function dispatch(action, payload = {}) {
  switch (action) {
    case 'ping': return { mode: 'extension', version: chrome.runtime.getManifest().version, projects: Object.values(PROJECTS).map(({ id, label, shortLabel }) => ({ id, label, shortLabel })) };
    case 'auth': return { token: await getAuthToken(payload.projectId, payload.email, payload.password, payload.force) };
    case 'deliveryCompanies': return deliveryCompanies(payload);
    case 'searchUser': return searchUser(payload);
    case 'resolveAddress': return resolveAddress(payload);
    case 'calculate': return calculate(payload);
    case 'createOrder': return createOrder(payload);
    case 'cancelOrder': return cancelOrder(payload);
    case 'cacheStats': return getCacheStats();
    case 'clearCache': return clearCache(payload);
    default: throw makeError(`Неизвестное действие: ${action}`, 'UNKNOWN_ACTION');
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  dispatch(message?.action, message?.payload)
    .then(data => sendResponse({ ok: true, data }))
    .catch(error => sendResponse({ ok: false, error: error.message || String(error), code: error.code, status: error.status }));
  return true;
});

chrome.action?.onClicked?.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app/index.html') });
});
