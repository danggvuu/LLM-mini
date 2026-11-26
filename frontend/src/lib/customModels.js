const STORAGE_KEY = 'custom_ai_models';
const runtimeKeys = new Map();
const keyedProviders = new Set(['gemini', 'openai', 'groq', 'openrouter']);

function modelIdentity(model) {
  return JSON.stringify([model.id, model.provider, model.model_name, model.base_url || '']);
}

function sanitizeModels(models) {
  if (!Array.isArray(models)) throw new Error('Danh sách model đã lưu không hợp lệ.');
  return models.filter(model => model && typeof model === 'object').map(model => {
    const provider = String(model.provider || 'ollama').trim().toLowerCase();
    const name = String(model.model_name || model.model || model.name || '').trim();
    const metadata = {
      id: String(model.id || `${provider}:${name}`),
      name: String(model.name || name),
      provider,
      model: name,
      model_name: name,
      ...(typeof model.base_url === 'string' && model.base_url.trim() ? { base_url: model.base_url.trim() } : {}),
      ...(typeof model.created_at === 'string' ? { created_at: model.created_at } : {}),
      requires_api_key: Boolean(model.requires_api_key || model.api_key || keyedProviders.has(provider)),
    };
    if (runtimeKeys.has(modelIdentity(metadata))) metadata.requires_api_key = true;
    return metadata;
  }).filter(model => model.model_name);
}

function rememberKeys(models, metadata) {
  const identities = new Set(metadata.map(modelIdentity));
  for (const identity of runtimeKeys.keys()) {
    if (!identities.has(identity)) runtimeKeys.delete(identity);
  }
  for (const model of models) {
    if (!model || typeof model !== 'object' || !Object.hasOwn(model, 'api_key')) continue;
    const normalized = sanitizeModels([model])[0];
    if (!normalized) continue;
    const identity = modelIdentity(normalized);
    const key = typeof model.api_key === 'string' ? model.api_key.trim() : '';
    if (key) runtimeKeys.set(identity, key);
    else runtimeKeys.delete(identity);
  }
}

function withRuntimeKeys(models) {
  return models.map(model => {
    const apiKey = runtimeKeys.get(modelIdentity(model));
    return { ...model, ...(apiKey ? { api_key: apiKey } : {}) };
  });
}

export function getCustomModels() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let records;
  try {
    records = JSON.parse(stored || '[]');
  } catch {
    throw new Error('Danh sách model đã lưu bị lỗi định dạng. Không thể đọc model hoặc key từ dữ liệu này.');
  }
  const metadata = sanitizeModels(records);
  rememberKeys(records, metadata);
  const sanitized = JSON.stringify(metadata);
  if (stored && stored !== sanitized) {
    // Migrate legacy credentials into this page's memory before stripping storage.
    try {
      localStorage.setItem(STORAGE_KEY, sanitized);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      throw error;
    }
  }
  return withRuntimeKeys(metadata);
}

export function saveCustomModels(models) {
  const metadata = sanitizeModels(models);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
  // An omitted api_key preserves the session key; an explicit empty value clears it.
  rememberKeys(models, metadata);
  return withRuntimeKeys(metadata);
}
