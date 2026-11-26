import { useState, useEffect, useEffectEvent, useRef } from 'react';
import { X, Check, Server, Cpu, Cloud, RefreshCw, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { requestJson, getErrorMessage } from '../lib/api';

const initialSettings = {
  default_provider: 'ollama', default_model: 'qwen2.5:3b',
  ollama_base_url: 'http://localhost:11434', lm_studio_base_url: 'http://localhost:1234/v1',
  gemini_api_key: '', gemini_api_key_configured: false, gemini_model: 'gemini-2.5-flash',
  openai_api_key: '', openai_api_key_configured: false, openai_model: 'gpt-4o-mini',
  groq_api_key: '', groq_api_key_configured: false, groq_model: 'llama-3.3-70b-versatile',
  openrouter_api_key: '', openrouter_api_key_configured: false, openrouter_model: 'deepseek/deepseek-r1',
  router9_base_url: 'http://localhost:20128/v1', router9_api_key: '', router9_api_key_configured: false, router9_model: 'claude-3-5-sonnet',
  custom_base_url: '', custom_api_key: '', custom_api_key_configured: false, custom_model: '',
};

const providers = [
  { id: 'ollama', title: 'Ollama', tab: 'local', model: 'default_model', url: 'ollama_base_url', scan: 'ollama', placeholder: 'qwen2.5:3b', href: 'https://ollama.com', hint: 'Mở Ollama và tải một model. Bạn có thể sửa endpoint rồi kiểm tra trực tiếp, kể cả khi quét chưa tìm thấy dịch vụ.' },
  { id: 'lm_studio', title: 'LM Studio / vLLM / LocalAI', tab: 'local', model: 'custom_model', url: 'lm_studio_base_url', scan: 'lm_studio', placeholder: 'local-model', hint: 'Nạp model và bật Local Server. Tên model này cũng được dùng cho cấu hình OpenAI-compatible tùy chỉnh.' },
  { id: '9router', title: '9Router AI Gateway', tab: '9router', model: 'router9_model', url: 'router9_base_url', key: 'router9_api_key', scan: 'router9', placeholder: 'kr/claude-sonnet-4.5', href: 'https://github.com/9router/9router', hint: 'Nhập endpoint và Model ID do gateway cung cấp. API key có thể để trống nếu gateway không yêu cầu.' },
  { id: 'gemini', title: 'Google Gemini', tab: 'cloud', model: 'gemini_model', key: 'gemini_api_key', placeholder: 'gemini-2.5-flash', href: 'https://aistudio.google.com', hint: 'Nhập Model ID đang có quyền sử dụng trong tài khoản Google AI.' },
  { id: 'openai', title: 'OpenAI', tab: 'cloud', model: 'openai_model', key: 'openai_api_key', placeholder: 'gpt-4o-mini', href: 'https://platform.openai.com/api-keys' },
  { id: 'groq', title: 'Groq', tab: 'cloud', model: 'groq_model', key: 'groq_api_key', placeholder: 'llama-3.3-70b-versatile', href: 'https://console.groq.com/keys' },
  { id: 'openrouter', title: 'OpenRouter', tab: 'cloud', model: 'openrouter_model', key: 'openrouter_api_key', placeholder: 'deepseek/deepseek-r1', href: 'https://openrouter.ai/keys' },
  { id: 'custom', title: 'OpenAI-compatible tùy chỉnh', tab: 'cloud', model: 'custom_model', url: 'custom_base_url', key: 'custom_api_key', placeholder: 'Model ID của endpoint', hint: 'Nhập Base URL đầy đủ, thường kết thúc bằng /v1. Có thể để trống API key nếu server không yêu cầu.' },
];

const apiKeyFields = providers.map(provider => provider.key).filter(Boolean);

function maskedSettings(data) {
  const next = { ...initialSettings };
  for (const field of Object.keys(initialSettings)) {
    if (data[field] != null) next[field] = data[field];
  }
  for (const field of apiKeyFields) {
    next[`${field}_configured`] = Boolean(data[`${field}_configured`] ?? data[field]);
    next[field] = '';
  }
  return next;
}

export default function SettingsModal({ isOpen, onClose, onSettingsSaved, isDark = true }) {
  const [activeTab, setActiveTab] = useState('local');
  const [settings, setSettings] = useState(initialSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [localStatus, setLocalStatus] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [scanError, setScanError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [testResult, setTestResult] = useState({});
  const [testingProvider, setTestingProvider] = useState(null);
  const [showKeys, setShowKeys] = useState({});
  const [clearApiKeys, setClearApiKeys] = useState([]);
  const dialogRef = useRef(null);
  const settingsController = useRef(null);
  const scanController = useRef(null);
  const actionController = useRef(null);
  const pendingRef = useRef(false);

  const handleClose = () => {
    if (!saving) onClose();
  };
  useDialog(dialogRef, handleClose, isOpen);

  const loadSettings = async () => {
    settingsController.current?.abort();
    const controller = new AbortController();
    settingsController.current = controller;
    setLoadingSettings(true);
    setSettingsLoaded(false);
    setSettingsError('');
    try {
      const data = await requestJson('/api/settings', { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Phản hồi cài đặt không hợp lệ.');
      setSettings(maskedSettings(data));
      setClearApiKeys([]);
      setShowKeys({});
      setTestResult({});
      setSaveError('');
      setSettingsLoaded(true);
    } catch (error) {
      if (!controller.signal.aborted) setSettingsError(`Không tải được cài đặt. ${getErrorMessage(error, 'Kiểm tra kết nối và thử lại.')}`);
    } finally {
      if (!controller.signal.aborted) setLoadingSettings(false);
    }
  };

  const scanLocalModels = async () => {
    scanController.current?.abort();
    const controller = new AbortController();
    scanController.current = controller;
    setScanning(true);
    setScanError('');
    setLocalStatus(null);
    try {
      const data = await requestJson('/api/llm/local-models', { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!data || typeof data !== 'object' || !data.ollama || !data.lm_studio) throw new Error('Phản hồi quét model không hợp lệ.');
      setLocalStatus(data);
    } catch (error) {
      if (!controller.signal.aborted) setScanError(`Không quét được dịch vụ trên máy. ${getErrorMessage(error, 'Hãy thử lại.')}`);
    } finally {
      if (!controller.signal.aborted) setScanning(false);
    }
  };

  const openModal = useEffectEvent(() => {
    pendingRef.current = false;
    setSaving(false);
    setTestingProvider(null);
    setSaveError('');
    setShowKeys({});
    setClearApiKeys([]);
    setTestResult({});
    setSettings(initialSettings);
    void loadSettings();
    void scanLocalModels();
  });

  useEffect(() => {
    if (!isOpen) return;
    openModal();
    return () => {
      settingsController.current?.abort();
      scanController.current?.abort();
      actionController.current?.abort();
    };
  }, [isOpen]);

  const changeSetting = (field, value) => {
    setSettings(previous => ({ ...previous, [field]: value }));
    setTestResult({});
    setSaveError('');
    if (apiKeyFields.includes(field)) setClearApiKeys(previous => previous.filter(key => key !== field));
  };

  const toggleClearKey = field => {
    setSettings(previous => ({ ...previous, [field]: '' }));
    setClearApiKeys(previous => previous.includes(field) ? previous.filter(key => key !== field) : [...previous, field]);
    setTestResult({});
    setShowKeys({});
    setSaveError('');
  };

  const handleTestConnection = async provider => {
    if (pendingRef.current || !settingsLoaded) return;
    const modelName = String(settings[provider.model] || '').trim();
    if (!modelName) {
      setTestResult(previous => ({ ...previous, [provider.id]: { success: false, message: 'Nhập Model ID trước khi kiểm tra kết nối.' } }));
      return;
    }
    if (clearApiKeys.includes(provider.key)) {
      setTestResult(previous => ({ ...previous, [provider.id]: { success: false, message: 'Key đang được đánh dấu xóa. Lưu cài đặt hoặc giữ lại key trước khi kiểm tra.' } }));
      return;
    }
    pendingRef.current = true;
    const controller = new AbortController();
    actionController.current = controller;
    setTestingProvider(provider.id);
    setTestResult(previous => ({ ...previous, [provider.id]: null }));
    try {
      const result = await requestJson('/api/llm/test-connection', {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ provider: provider.id, model_name: modelName, api_key: provider.key ? settings[provider.key]?.trim() : undefined, base_url: provider.url ? settings[provider.url]?.trim() : undefined }),
      });
      if (controller.signal.aborted) return;
      if (typeof result?.success !== 'boolean') throw new Error('Máy chủ chưa trả về kết quả kiểm tra.');
      setTestResult(previous => ({ ...previous, [provider.id]: { ...result, message: result.message || (result.success ? 'Model đã phản hồi khi kiểm tra.' : 'Chưa nhận được phản hồi hợp lệ từ model. Kiểm tra key, endpoint và Model ID rồi thử lại.') } }));
    } catch (error) {
      if (!controller.signal.aborted) setTestResult(previous => ({ ...previous, [provider.id]: { success: false, message: getErrorMessage(error, 'Không kiểm tra được kết nối. Hãy thử lại.') } }));
    } finally {
      if (!controller.signal.aborted) {
        pendingRef.current = false;
        setTestingProvider(null);
      }
    }
  };

  const handleSave = async () => {
    if (pendingRef.current || !settingsLoaded || loadingSettings) return;
    setSaveError('');
    const selectedProvider = providers.find(provider => provider.id === settings.default_provider || (settings.default_provider === 'local_ai' && provider.id === 'lm_studio'));
    if (!selectedProvider || !String(settings[selectedProvider.model] || '').trim()) {
      setSaveError('Chọn nhà cung cấp mặc định và nhập Model ID tương ứng trước khi lưu.');
      if (selectedProvider) setActiveTab(selectedProvider.tab);
      return;
    }
    for (const field of ['ollama_base_url', 'lm_studio_base_url', 'router9_base_url', 'custom_base_url']) {
      const value = String(settings[field] || '').trim();
      if (!value) continue;
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('invalid URL');
      } catch {
        setSaveError('Endpoint phải là URL HTTP(S) đầy đủ, không chứa key hoặc thông tin đăng nhập.');
        setActiveTab(providers.find(provider => provider.url === field)?.tab || 'local');
        return;
      }
    }
    pendingRef.current = true;
    const controller = new AbortController();
    actionController.current = controller;
    setSaving(true);
    let saved = false;
    try {
      const payload = { clear_api_keys: clearApiKeys };
      for (const [field, value] of Object.entries(settings)) {
        if (field.endsWith('_api_key_configured')) continue;
        if (apiKeyFields.includes(field) && !String(value || '').trim()) continue;
        payload[field] = typeof value === 'string' ? value.trim() : value;
      }
      const response = await requestJson('/api/settings', { method: 'POST', signal: controller.signal, body: JSON.stringify(payload) });
      if (controller.signal.aborted) return;
      if (response?.status !== 'success' || !response.settings || typeof response.settings !== 'object') throw new Error('Máy chủ chưa xác nhận cài đặt đã lưu. Tải lại cài đặt để kiểm tra.');
      const savedSettings = maskedSettings(response.settings);
      saved = true;
      setSettings(savedSettings);
      setClearApiKeys([]);
      setShowKeys({});
      await onSettingsSaved?.(savedSettings);
      if (!controller.signal.aborted) onClose();
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(`${saved ? 'Cài đặt đã lưu nhưng chưa cập nhật được giao diện.' : 'Không lưu được cài đặt.'} ${getErrorMessage(error, 'Vui lòng thử lại.')}`);
    } finally {
      if (!controller.signal.aborted) {
        pendingRef.current = false;
        setSaving(false);
      }
    }
  };

  if (!isOpen) return null;

  const busy = loadingSettings || saving || Boolean(testingProvider);
  const muted = isDark ? 'text-gray-400' : 'text-slate-600';
  const border = isDark ? 'border-white/10' : 'border-slate-200';
  const input = `w-full min-w-0 rounded-xl border px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-[#121316] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'}`;
  const secondaryButton = `px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Cấu hình Bộ Não AI" tabIndex={-1}
        className={`border rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden ${border} ${isDark ? 'bg-[#181a20] text-white' : 'bg-white text-slate-900'}`}>
        <div className={`p-4 sm:p-5 border-b flex items-start justify-between gap-3 ${border}`}>
          <div className="flex items-center gap-3 min-w-0"><Cpu size={24} className="text-blue-500 shrink-0" /><div><h2 className="text-lg font-bold">Cấu hình Bộ Não AI</h2><p className={`text-xs mt-1 ${muted}`}>Chọn nhà cung cấp, kiểm tra phản hồi và lưu cài đặt.</p></div></div>
          <button onClick={handleClose} disabled={saving} aria-label="Đóng cài đặt" className={secondaryButton}><X size={20} /></button>
        </div>

        <nav aria-label="Nhóm nhà cung cấp AI" className={`flex overflow-x-auto shrink-0 border-b px-2 sm:px-5 ${border}`}>
          {[
            ['local', Server, 'AI trên máy'], ['9router', Cpu, '9Router Gateway'], ['cloud', Cloud, 'Cloud / API'],
          ].map(([tab, Icon, label]) => <button key={tab} onClick={() => setActiveTab(tab)} aria-pressed={activeTab === tab} className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 shrink-0 ${activeTab === tab ? `border-blue-500 ${isDark ? 'text-blue-400' : 'text-blue-700'}` : `border-transparent ${muted}`}`}><Icon size={15} />{label}</button>)}
        </nav>

        <div className="p-4 sm:p-6 overflow-y-auto min-h-0 flex-1 space-y-4">
          {loadingSettings && <p role="status" className={`text-sm flex items-center gap-2 ${muted}`}><RefreshCw size={16} className="animate-spin" />Đang tải cài đặt đã lưu...</p>}
          {settingsError && <div role="alert" className={`p-3 rounded-xl border text-xs space-y-2 ${isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-900'}`}><p>{settingsError}</p><button onClick={loadSettings} disabled={busy} className="underline disabled:opacity-50">Thử tải lại cài đặt</button></div>}
          {saveError && <div role="alert" className={`p-3 rounded-xl border text-xs flex gap-2 ${isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-900'}`}><AlertCircle size={15} className="shrink-0" /><p className="break-words">{saveError}</p></div>}

          <fieldset disabled={busy || !settingsLoaded} className="space-y-5 min-w-0 disabled:opacity-60">
            <div className="space-y-2">
              <label htmlFor="settings-default-provider" className="block text-xs font-semibold">Nhà cung cấp mặc định</label>
              <select id="settings-default-provider" value={settings.default_provider} onChange={event => { changeSetting('default_provider', event.target.value); setActiveTab(providers.find(provider => provider.id === event.target.value)?.tab || 'local'); }} className={input}>
                {providers.map(provider => <option key={provider.id} value={provider.id}>{provider.title}</option>)}
                {settings.default_provider === 'local_ai' && <option value="local_ai">LocalAI (OpenAI-compatible)</option>}
              </select>
              <p className={`text-[11px] leading-relaxed ${muted}`}>Cài đặt mặc định áp dụng khi sổ tay chưa có cấu hình riêng. Nhập Model ID tương ứng bên dưới. Kiểm tra kết nối sẽ gửi một yêu cầu ngắn tới nhà cung cấp.</p>
            </div>

            {(activeTab === 'local' || activeTab === '9router') && <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className={`text-xs ${muted}`}>{scanning ? 'Đang quét dịch vụ trên máy...' : 'Lần quét dùng các endpoint đã lưu trong Cài đặt.'}</p><button type="button" onClick={scanLocalModels} disabled={scanning || busy} className={`${secondaryButton} flex items-center gap-1.5`}><RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />Quét lại</button></div>{scanError && <p role="alert" className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{scanError} Bạn vẫn có thể nhập endpoint và kiểm tra trực tiếp.</p>}</div>}

            {providers.filter(provider => provider.tab === activeTab).map(provider => {
              const detected = localStatus?.[provider.scan];
              const scannedModels = Array.isArray(detected?.models) ? detected.models : [];
              const result = testResult[provider.id];
              const clearing = clearApiKeys.includes(provider.key);
              const configured = provider.key && settings[`${provider.key}_configured`];
              return (
                <section key={provider.id} className={`p-4 rounded-xl border space-y-3 ${border} ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`} aria-label={provider.title}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm">{provider.title}</h3>
                    {provider.scan && <span className={`text-[11px] ${scanning || !detected ? muted : detected.available ? isDark ? 'text-green-400' : 'text-green-700' : isDark ? 'text-amber-300' : 'text-amber-800'}`}>{scanning ? 'Đang quét...' : !detected ? 'Chưa xác định kết nối' : detected.available ? `Đã thấy dịch vụ (${scannedModels.length} model)` : 'Chưa kết nối được'}</span>}
                    {provider.href && <a href={provider.href} target="_blank" rel="noreferrer" className={`text-xs flex items-center gap-1 underline underline-offset-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>Tài liệu / API key<ExternalLink size={11} /></a>}
                  </div>
                  {provider.hint && <p className={`text-xs leading-relaxed ${muted}`}>{provider.hint}</p>}
                  {provider.url && <div><label htmlFor={`settings-${provider.id}-url`} className={`block text-xs mb-1 ${muted}`}>Endpoint / Base URL</label><input id={`settings-${provider.id}-url`} type="url" value={settings[provider.url] || ''} onChange={event => changeSetting(provider.url, event.target.value)} placeholder={initialSettings[provider.url] || 'https://.../v1'} className={`${input} font-mono`} /></div>}
                  <div><label htmlFor={`settings-${provider.id}-model`} className={`block text-xs mb-1 ${muted}`}>Model ID / Tên model</label><input id={`settings-${provider.id}-model`} value={settings[provider.model] || ''} onChange={event => changeSetting(provider.model, event.target.value)} placeholder={provider.placeholder} list={provider.scan ? `settings-${provider.id}-models` : undefined} className={`${input} font-mono`} />{provider.scan && <datalist id={`settings-${provider.id}-models`}>{scannedModels.map(model => <option key={model.name || model.id} value={model.name || model.id} />)}</datalist>}</div>
                  {provider.key && <div className="space-y-2"><label htmlFor={`settings-${provider.id}-key`} className={`block text-xs ${muted}`}>API key {configured ? '(đã lưu, nội dung được ẩn)' : '(chưa có key đã lưu)'}</label><div className="relative"><input id={`settings-${provider.id}-key`} type={showKeys[provider.id] ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={settings[provider.key] || ''} onChange={event => changeSetting(provider.key, event.target.value)} placeholder={clearing ? 'Key sẽ bị xóa khi lưu' : configured ? 'Để trống để giữ nguyên key đã lưu' : 'Nhập key mới hoặc để trống nếu không cần'} className={`${input} pr-11 font-mono`} /><button type="button" onClick={() => setShowKeys(previous => ({ ...previous, [provider.id]: !previous[provider.id] }))} aria-label={`${showKeys[provider.id] ? 'Ẩn' : 'Hiện'} key mới của ${provider.title}`} aria-pressed={Boolean(showKeys[provider.id])} className={`absolute right-3 top-3 ${muted}`}>{showKeys[provider.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>{configured && <button type="button" onClick={() => toggleClearKey(provider.key)} className={`text-[11px] underline underline-offset-2 ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>{clearing ? 'Hủy xóa, giữ key đã lưu' : 'Đánh dấu xóa key đã lưu'}</button>}{clearing && <p className={`text-[11px] ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>Key chỉ bị xóa sau khi bấm Lưu Cài Đặt. Nhập key mới sẽ hủy yêu cầu xóa.</p>}</div>}
                  <button type="button" onClick={() => handleTestConnection(provider)} disabled={busy || clearing} className={`${secondaryButton} border ${border} flex items-center gap-1.5`}>{testingProvider === provider.id ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}{testingProvider === provider.id ? 'Đang chờ phản hồi...' : `Kiểm tra ${provider.title}`}</button>
                  {result && <div role={result.success ? 'status' : 'alert'} className={`p-3 rounded-lg border text-xs break-words ${result.success ? isDark ? 'bg-green-500/10 text-green-200 border-green-500/30' : 'bg-green-50 text-green-900 border-green-300' : isDark ? 'bg-rose-500/10 text-rose-200 border-rose-500/30' : 'bg-rose-50 text-rose-900 border-rose-300'}`}>{result.message}</div>}
                </section>
              );
            })}
          </fieldset>
        </div>

        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-3 ${border}`}>
          <p className={`text-[11px] leading-relaxed flex-1 min-w-[180px] ${muted}`}>Cài đặt và key được lưu trên máy chủ ứng dụng. Trình duyệt không lưu API key vào localStorage. Để trống key sẽ giữ nguyên key đã lưu.</p>
          <div className="flex gap-2 ml-auto"><button onClick={handleClose} disabled={saving} className={secondaryButton}>Đóng</button><button onClick={handleSave} disabled={busy || !settingsLoaded} className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}{saving ? 'Đang lưu...' : 'Lưu Cài Đặt'}</button></div>
        </div>
      </div>
    </div>
  );
}
