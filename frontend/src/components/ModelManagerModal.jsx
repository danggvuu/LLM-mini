import { useState, useEffect, useEffectEvent, useRef } from 'react';
import {
  X, Cpu, Download, Check, RefreshCw, Plus, Trash2,
  Sparkles, AlertCircle, HardDrive, Info, Loader,
} from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { requestJson, getErrorMessage, readSSE } from '../lib/api';
import { getCustomModels, saveCustomModels } from '../lib/customModels';

const keyedProviders = new Set(['gemini', 'openai', 'groq', 'openrouter']);

export default function ModelManagerModal({
  isOpen, onClose, activeNotebook, onSelectModel, initialTab = 'recommend', isDark = true,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [recommendations, setRecommendations] = useState([]);
  const [localModels, setLocalModels] = useState([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(null);
  const [loadingScan, setLoadingScan] = useState(true);
  const [scanError, setScanError] = useState('');
  const [actionError, setActionError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [pullingModel, setPullingModel] = useState(null);
  const [pullProgress, setPullProgress] = useState({ percent: 0, statusText: '', detail: '' });
  const [customProvider, setCustomProvider] = useState('ollama');
  const [customModelName, setCustomModelName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [savedCustomModels, setSavedCustomModels] = useState([]);
  const [keyRequest, setKeyRequest] = useState(null);
  const [sessionApiKey, setSessionApiKey] = useState('');
  const dialogRef = useRef(null);
  const scanController = useRef(null);
  const actionController = useRef(null);
  const pendingRef = useRef(false);

  const handleClose = () => {
    if (pendingAction?.startsWith('select:')) return;
    onClose();
  };
  useDialog(dialogRef, handleClose, isOpen);

  const loadCustomModels = () => {
    try {
      setSavedCustomModels(getCustomModels());
      setStorageError('');
      return true;
    } catch (error) {
      setStorageError(getErrorMessage(error, 'Không đọc được danh sách model đã lưu. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.'));
      return false;
    }
  };

  const persistModels = models => {
    try {
      const saved = saveCustomModels(models);
      setSavedCustomModels(saved);
      setStorageError('');
      return saved;
    } catch (error) {
      setStorageError(getErrorMessage(error, 'Không lưu được danh sách model. Hãy kiểm tra dung lượng hoặc quyền lưu trữ rồi thử lại.'));
      return null;
    }
  };

  const loadAllData = async () => {
    scanController.current?.abort();
    const controller = new AbortController();
    scanController.current = controller;
    setLoadingScan(true);
    setScanError('');
    setOllamaAvailable(null);
    const results = await Promise.allSettled([
      requestJson('/api/llm/recommendations', { signal: controller.signal }),
      requestJson('/api/llm/local-models', { signal: controller.signal }),
    ]);
    if (controller.signal.aborted) return;
    const errors = [];
    const [recommended, local] = results;
    if (recommended.status === 'fulfilled' && Array.isArray(recommended.value?.recommendations)) {
      setRecommendations(recommended.value.recommendations);
    } else {
      setRecommendations([]);
      errors.push(`Gợi ý model: ${getErrorMessage(recommended.reason, 'Phản hồi không hợp lệ.')}`);
    }
    if (local.status === 'fulfilled' && Array.isArray(local.value?.ollama?.models)) {
      setLocalModels(local.value.ollama.models);
      setOllamaAvailable(local.value.ollama.available === true);
    } else {
      setLocalModels([]);
      errors.push(`Kết nối Ollama: ${getErrorMessage(local.reason, 'Phản hồi không hợp lệ.')}`);
    }
    setScanError(errors.join(' '));
    setLoadingScan(false);
  };

  const openModal = useEffectEvent(() => {
    setActiveTab(initialTab);
    setActionError('');
    setNotice('');
    setPendingAction(null);
    setPullingModel(null);
    setKeyRequest(null);
    setSessionApiKey('');
    setCustomApiKey('');
    setTestResult(null);
    pendingRef.current = false;
    loadCustomModels();
    void loadAllData();
  });

  useEffect(() => {
    if (!isOpen) return;
    openModal();
    return () => {
      scanController.current?.abort();
      actionController.current?.abort();
    };
  }, [isOpen, initialTab]);

  const runModelAction = async (model, action) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const controller = new AbortController();
    actionController.current = controller;
    setPendingAction(`${action}:${model.id || model.model_name}`);
    setActionError('');
    setNotice('');
    setTestResult(null);
    try {
      if (action === 'test') {
        const result = await requestJson('/api/llm/test-connection', {
          method: 'POST', signal: controller.signal,
          body: JSON.stringify({ provider: model.provider, model_name: model.model_name, base_url: model.base_url, api_key: model.api_key }),
        });
        if (controller.signal.aborted) return;
        if (typeof result?.success !== 'boolean') throw new Error('Máy chủ chưa trả về kết quả kiểm tra model.');
        setTestResult({ ...result, model: model.model_name });
      } else {
        const result = await onSelectModel(model.provider, model.model_name, model.base_url, model.api_key);
        if (controller.signal.aborted) return;
        if (result === false) throw new Error('Chưa đổi được model của sổ tay. Hãy kiểm tra kết nối rồi thử lại.');
        setCustomApiKey('');
        setSessionApiKey('');
        onClose();
      }
    } catch (error) {
      if (!controller.signal.aborted) setActionError(getErrorMessage(error, 'Không hoàn tất được thao tác với model. Hãy thử lại.'));
    } finally {
      if (!controller.signal.aborted) {
        pendingRef.current = false;
        setPendingAction(null);
      }
    }
  };

  const requestModelAction = (model, action, isSaved = true) => {
    if (pendingRef.current) return;
    setActionError('');
    if (!model.api_key && (model.requires_api_key || keyedProviders.has(model.provider))) {
      setKeyRequest({ model, action, isSaved });
      setSessionApiKey('');
      return;
    }
    void runModelAction(model, action);
  };

  const continueWithKey = inherit => {
    if (!keyRequest || pendingRef.current) return;
    const key = inherit ? undefined : sessionApiKey.trim();
    if (!inherit && !key) return;
    const model = { ...keyRequest.model, api_key: key };
    if (keyRequest.isSaved && key) {
      if (!persistModels(savedCustomModels.map(saved => saved.id === model.id ? model : saved))) return;
    } else if (!keyRequest.isSaved && key) {
      setCustomApiKey(key);
    }
    const action = keyRequest.action;
    setKeyRequest(null);
    setSessionApiKey('');
    void runModelAction(model, action);
  };

  const buildCustomModel = () => {
    const name = customModelName.trim();
    if (!name) throw new Error('Vui lòng nhập tên Model ID.');
    const baseUrl = customBaseUrl.trim();
    if (baseUrl) {
      let url;
      try { url = new URL(baseUrl); } catch { throw new Error('Base URL phải là địa chỉ http:// hoặc https:// đầy đủ.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Base URL chỉ chứa địa chỉ HTTP(S) và đường dẫn. Nhập thông tin xác thực ở ô API Key.');
      }
    }
    const existing = savedCustomModels.find(model => model.provider === customProvider && model.model_name === name && (model.base_url || '') === baseUrl);
    return {
      id: existing?.id || crypto.randomUUID(), name, model: name, model_name: name,
      provider: customProvider, base_url: baseUrl || undefined,
      ...(customApiKey.trim() ? { api_key: customApiKey.trim() } : existing?.api_key ? { api_key: existing.api_key } : {}),
      requires_api_key: Boolean(existing?.requires_api_key || customApiKey.trim() || keyedProviders.has(customProvider)),
      created_at: existing?.created_at || new Date().toISOString(),
    };
  };

  const handleCustomAction = (event, action) => {
    event.preventDefault();
    if (pendingRef.current) return;
    setActionError('');
    try {
      const model = buildCustomModel();
      if (action === 'select') {
        if (!persistModels([model, ...savedCustomModels.filter(saved => saved.id !== model.id)])) return;
        requestModelAction(model, action);
      } else {
        requestModelAction(model, action, false);
      }
    } catch (error) {
      setActionError(getErrorMessage(error, 'Kiểm tra lại thông tin model.'));
    }
  };

  const handleStartPull = async modelName => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const controller = new AbortController();
    actionController.current = controller;
    setPullingModel(modelName);
    setActionError('');
    setNotice('');
    setPullProgress({ percent: 0, statusText: 'Đang kết nối tới Ollama...', detail: '' });
    try {
      const response = await fetch('/api/llm/ollama/pull', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: modelName }),
      });
      let completed = false;
      for await (const data of readSSE(response)) {
        if (data.status === 'error' || data.error) throw new Error(data.message || data.error || 'Ollama không tải được model.');
        if (data.status === 'success') {
          completed = true;
          setPullProgress({ percent: 100, statusText: 'Đã tải xong. Đang kích hoạt model...', detail: '' });
          break;
        }
        const percent = data.total > 0 ? Math.max(0, Math.min(100, Math.round((Number(data.completed) || 0) / data.total * 100))) : 0;
        setPullProgress({
          percent, statusText: data.status || 'Đang tải...',
          detail: data.total > 0 ? `${((Number(data.completed) || 0) / 1048576).toFixed(1)} / ${(data.total / 1048576).toFixed(1)} MB` : data.message || '',
        });
      }
      if (!completed) throw new Error('Luồng tải bị ngắt trước khi Ollama xác nhận hoàn tất. Hãy quét lại hoặc thử tải lại.');
      await loadAllData();
      if (controller.signal.aborted) return;
      setPendingAction(`select:${modelName}`);
      const result = await onSelectModel('ollama', modelName);
      if (controller.signal.aborted) return;
      if (result === false) throw new Error('Model đã tải về nhưng chưa kích hoạt được. Chọn lại trong tab Model trên máy.');
      onClose();
    } catch (error) {
      if (!controller.signal.aborted) setActionError(getErrorMessage(error, 'Không tải được model. Kiểm tra Ollama rồi thử lại.'));
    } finally {
      if (!controller.signal.aborted) {
        pendingRef.current = false;
        setPullingModel(null);
        setPendingAction(null);
      }
    }
  };

  if (!isOpen) return null;

  const busy = Boolean(pendingAction || pullingModel);
  const selecting = pendingAction?.startsWith('select:');
  const currentProvider = (activeNotebook?.provider || (activeNotebook?.is_private ? 'ollama' : 'gemini')).toLowerCase();
  const currentModel = activeNotebook?.model_name || '';
  const muted = isDark ? 'text-gray-400' : 'text-slate-600';
  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200';
  const input = `w-full min-w-0 rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'bg-[#131314] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'}`;
  const secondaryButton = `rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quản lý và tải mô hình AI" tabIndex={-1}
        className={`border rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden ${isDark ? 'bg-[#18191e] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className={`p-4 border-b flex items-start justify-between gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <Cpu size={24} className="text-green-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Quản lý & Tải Mô hình AI</h2>
              <p className={`text-xs mt-1 ${muted}`}>Quét, kiểm tra kết nối và chọn model cho sổ tay.</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={loadAllData} disabled={loadingScan || busy} className={secondaryButton} aria-label="Quét lại model" title="Quét lại model">
              <RefreshCw size={15} className={loadingScan ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleClose} disabled={selecting} aria-label="Đóng quản lý model" className={secondaryButton}><X size={18} /></button>
          </div>
        </div>

        <div role="status" className={`px-4 py-3 text-xs border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${loadingScan || ollamaAvailable === null ? 'bg-gray-400' : ollamaAvailable ? 'bg-green-500' : 'bg-amber-500'}`} />
          {loadingScan ? 'Đang kiểm tra kết nối và model trên máy...' : ollamaAvailable === true
            ? `Kết nối được Ollama; tìm thấy ${localModels.length} model. Chọn Kiểm tra để thử phản hồi.`
            : ollamaAvailable === false ? 'Chưa kết nối được Ollama. Mở Ollama rồi quét lại, hoặc thêm model từ nhà cung cấp khác.'
              : 'Chưa xác định được kết nối Ollama. Hãy thử quét lại.'}
        </div>

        <nav aria-label="Các nhóm model" className={`flex shrink-0 overflow-x-auto border-b px-2 sm:px-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          {[
            ['recommend', Sparkles, 'Gợi ý tải'], ['installed', HardDrive, `Model trên máy (${localModels.length})`], ['add_custom', Plus, 'Model tùy chỉnh'],
          ].map(([tab, Icon, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} aria-pressed={activeTab === tab}
              className={`shrink-0 py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 ${activeTab === tab ? `border-green-500 ${isDark ? 'text-green-400' : 'text-green-700'}` : `border-transparent ${muted}`}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {scanError && <div role="alert" className={`p-3 rounded-xl border text-xs space-y-2 ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'}`}><p>{scanError}</p><button onClick={loadAllData} disabled={loadingScan || busy} className="underline disabled:opacity-50">Thử quét lại</button></div>}
          {storageError && <div role="alert" className={`p-3 rounded-xl border text-xs space-y-2 ${isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-900'}`}><p>{storageError}</p><button onClick={loadCustomModels} disabled={busy} className="underline disabled:opacity-50">Đọc lại danh sách đã lưu</button></div>}
          {actionError && <div role="alert" className={`p-3 rounded-xl border text-xs flex items-start gap-2 break-words ${isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-900'}`}><AlertCircle size={15} className="shrink-0" /><p>{actionError}</p></div>}
          {notice && <p role="status" className={`text-xs ${muted}`}>{notice}</p>}
          {testResult && <div role="status" className={`p-3 rounded-xl border text-xs break-words ${testResult.success ? isDark ? 'bg-green-500/10 border-green-500/30 text-green-200' : 'bg-green-50 border-green-300 text-green-900' : isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-900'}`}><strong>{testResult.model}: </strong>{testResult.message || (testResult.success ? 'Model đã phản hồi khi kiểm tra.' : 'Kiểm tra thất bại. Kiểm tra endpoint, key và tên model rồi thử lại.')}</div>}
          {pendingAction && <p role="status" className={`text-xs flex items-center gap-2 ${muted}`}><Loader size={14} className="animate-spin" />{selecting ? 'Đang lưu lựa chọn model...' : 'Đang kiểm tra phản hồi từ model...'}</p>}

          {keyRequest && (
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
              <h3 className="text-sm font-semibold break-words">API key cho {keyRequest.model.model_name}</h3>
              <p className={`text-xs leading-relaxed ${muted}`}>Trình duyệt chỉ giữ key tùy chỉnh trong phiên trang này. Nhập lại key hoặc dùng key đã lưu trong Cài đặt. Khi chọn model cùng nhà cung cấp, sổ tay cũng có thể giữ key hiện có.</p>
              <label htmlFor="model-session-key" className="sr-only">API key cho phiên trang hiện tại</label>
              <input id="model-session-key" type="password" autoComplete="off" value={sessionApiKey} onChange={event => setSessionApiKey(event.target.value)} className={input} placeholder="Nhập API key cho phiên này" disabled={busy} />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => continueWithKey(false)} disabled={busy || !sessionApiKey.trim()} className={`${secondaryButton} border border-purple-500/40`}>Nhập key & tiếp tục</button>
                <button onClick={() => continueWithKey(true)} disabled={busy} className={secondaryButton}>{keyRequest.action === 'test' ? 'Dùng key nhà cung cấp đã lưu' : 'Kế thừa key đã lưu'}</button>
                <button onClick={() => { setKeyRequest(null); setSessionApiKey(''); }} disabled={busy} className={secondaryButton}>Hủy</button>
              </div>
            </div>
          )}

          {pullingModel && (
            <div role="status" className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
              <p className="text-xs font-semibold flex items-center gap-2 break-all"><Loader size={14} className="animate-spin shrink-0" />Đang tải {pullingModel}: {pullProgress.percent}%</p>
              <div role="progressbar" aria-label={`Tải ${pullingModel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pullProgress.percent} className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-green-100'}`}><div className="bg-green-500 h-full transition-all" style={{ width: `${pullProgress.percent}%` }} /></div>
              <p className={`text-xs break-words ${muted}`}>{pullProgress.statusText} {pullProgress.detail}</p>
              <p className={`text-[11px] ${muted}`}>Đóng cửa sổ sẽ ngừng theo dõi; Ollama có thể vẫn tiếp tục tải.</p>
            </div>
          )}

          {activeTab === 'recommend' && (
            <div className="space-y-3">
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'}`}><Info size={16} className="shrink-0" /><p>Tham khảo dung lượng và RAM trước khi tải. Cần kết nối mạng để tải model; sau đó Ollama có thể chạy cục bộ.</p></div>
              {!loadingScan && recommendations.length === 0 && <p className={`py-5 text-center text-xs ${muted}`}>{scanError ? 'Chưa tải được danh sách gợi ý. Thử quét lại.' : 'Chưa có model gợi ý. Bạn có thể thêm Model ID trong tab Model tùy chỉnh.'}</p>}
              {recommendations.map(rec => {
                const current = currentProvider === 'ollama' && currentModel === rec.name;
                const model = { provider: 'ollama', model_name: rec.name };
                const installed = rec.installed || localModels.some(local => local.name === rec.name);
                return (
                  <div key={rec.name} className={`p-3.5 rounded-xl border space-y-3 ${card}`}>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-sm">{rec.displayName || rec.name}</h3><span className={`text-[10px] font-mono break-all ${muted}`}>{rec.name}</span>{rec.badge && <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-800'}`}>{rec.badge}</span>}</div>
                      <p className={`text-xs leading-relaxed ${muted}`}>{rec.description}</p>
                      <p className={`text-[11px] ${muted}`}>Dung lượng: {rec.size || 'Chưa xác định'} · RAM: {rec.min_ram || 'Chưa xác định'}</p>
                    </div>
                    <div className="flex flex-wrap justify-end items-center gap-2">
                      {installed ? <><span className={`text-[11px] ${isDark ? 'text-green-400' : 'text-green-700'}`}>Đã có trên máy</span><button disabled={busy || loadingScan || ollamaAvailable !== true} onClick={() => requestModelAction(model, 'test')} className={secondaryButton}>Kiểm tra</button><button disabled={busy || current || loadingScan || ollamaAvailable !== true} onClick={() => requestModelAction(model, 'select')} className={secondaryButton}>{current ? 'Đang dùng' : 'Chọn dùng'}</button></> : <button onClick={() => handleStartPull(rec.name)} disabled={busy || loadingScan || ollamaAvailable !== true} className="px-3 py-2 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"><Download size={13} />{pullingModel === rec.name ? 'Đang tải...' : 'Tải & dùng'}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'installed' && (
            <div className="space-y-3">
              <p className={`text-xs ${muted}`}>Model được Ollama liệt kê. Kiểm tra phản hồi trước khi chọn dùng.</p>
              {!loadingScan && localModels.length === 0 && <div className={`p-6 text-center border border-dashed rounded-xl text-xs space-y-3 ${card}`}><Cpu size={28} className={`mx-auto ${muted}`} /><p>{ollamaAvailable === true ? 'Ollama đang chạy nhưng chưa có model. Xem gợi ý để tải model đầu tiên.' : 'Chưa đọc được model trên máy. Mở Ollama rồi quét lại.'}</p><button onClick={() => setActiveTab('recommend')} className={secondaryButton}>Xem gợi ý tải</button></div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {localModels.map(model => {
                  const current = currentProvider === 'ollama' && currentModel === model.name;
                  const selection = { provider: 'ollama', model_name: model.name };
                  return <div key={model.name} className={`p-3.5 rounded-xl border space-y-3 min-w-0 ${card}`}><h3 className="text-sm font-semibold break-all">{model.name}</h3><p className={`text-[11px] ${muted}`}>{model.size_gb != null ? `${model.size_gb} GB` : 'Chưa rõ dung lượng'} · {model.details?.family || 'Ollama'}</p><div className="flex flex-wrap gap-2"><button disabled={busy || loadingScan || ollamaAvailable !== true} onClick={() => requestModelAction(selection, 'test')} className={secondaryButton}>Kiểm tra</button><button disabled={busy || current || loadingScan || ollamaAvailable !== true} onClick={() => requestModelAction(selection, 'select')} className={secondaryButton}>{current ? 'Đang dùng' : 'Chọn dùng'}</button></div></div>;
                })}
              </div>
            </div>
          )}

          {activeTab === 'add_custom' && (
            <div className="space-y-5">
              <form onSubmit={event => handleCustomAction(event, 'select')} className={`p-4 rounded-xl border space-y-3.5 ${card}`}>
                <fieldset disabled={busy || Boolean(keyRequest)} className="space-y-3.5 min-w-0 disabled:opacity-60">
                  <legend className="text-sm font-semibold mb-3">Thêm model tùy chỉnh</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><label htmlFor="custom-model-provider" className={`block text-xs mb-1 ${muted}`}>Nhà cung cấp</label><select id="custom-model-provider" value={customProvider} onChange={event => { setCustomProvider(event.target.value); setCustomApiKey(''); }} className={input}><option value="ollama">Ollama (trên máy)</option><option value="lm_studio">LM Studio / vLLM</option><option value="9router">9Router Gateway</option><option value="openrouter">OpenRouter</option><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="custom">OpenAI-compatible khác</option></select></div>
                    <div className="sm:col-span-2"><label htmlFor="custom-model-name" className={`block text-xs mb-1 ${muted}`}>Model ID / Tên model (bắt buộc)</label><input id="custom-model-name" required value={customModelName} onChange={event => setCustomModelName(event.target.value)} placeholder="Ví dụ: qwen2.5:3b hoặc gpt-4o" className={input} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label htmlFor="custom-model-url" className={`block text-xs mb-1 ${muted}`}>Base URL (để trống dùng mặc định)</label><input id="custom-model-url" type="url" value={customBaseUrl} onChange={event => setCustomBaseUrl(event.target.value)} placeholder={customProvider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://.../v1'} className={input} /></div>
                    <div><label htmlFor="custom-model-key" className={`block text-xs mb-1 ${muted}`}>API Key (chỉ giữ trong phiên trang)</label><input id="custom-model-key" type="password" autoComplete="off" value={customApiKey} onChange={event => setCustomApiKey(event.target.value)} placeholder="Để trống để kế thừa key đã cấu hình" className={input} /></div>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${muted}`}>Trình duyệt chỉ lưu tên model và endpoint. Key tùy chỉnh mất khi tải lại trang; khi đó bạn có thể nhập lại hoặc kế thừa key cùng nhà cung cấp đã lưu.</p>
                  <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={event => handleCustomAction(event, 'test')} className={secondaryButton}>Kiểm tra kết nối</button><button type="submit" disabled={Boolean(storageError)} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"><Plus size={13} />Lưu model & chọn dùng</button></div>
                </fieldset>
              </form>
              {savedCustomModels.length > 0 && <div className="space-y-2"><h3 className={`text-xs font-semibold ${muted}`}>Model đã lưu ({savedCustomModels.length})</h3>{savedCustomModels.map(model => <div key={model.id} className={`p-3 rounded-xl border min-w-0 space-y-2 ${card}`}><div className="flex flex-wrap items-center gap-2"><span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{model.provider}</span><span className="text-xs font-semibold break-all">{model.model_name}</span></div><p className={`text-[11px] ${muted}`}>{model.api_key ? 'Có key trong phiên trang hiện tại' : model.requires_api_key ? 'Nhập lại key hoặc kế thừa key đã cấu hình khi dùng' : 'Dùng cấu hình mặc định nếu để trống key'}</p><div className="flex flex-wrap items-center gap-2"><button disabled={busy || Boolean(keyRequest)} onClick={() => requestModelAction(model, 'test')} className={secondaryButton}>Kiểm tra</button><button disabled={busy || Boolean(keyRequest)} onClick={() => requestModelAction(model, 'select')} className={secondaryButton}>Chọn dùng</button>{model.api_key && <button disabled={busy} onClick={() => { if (persistModels(savedCustomModels.map(saved => saved.id === model.id ? { ...saved, api_key: '' } : saved))) setNotice('Đã xóa key khỏi bộ nhớ phiên trang.'); }} className={secondaryButton}>Xóa key phiên</button>}<button disabled={busy || Boolean(keyRequest)} onClick={() => persistModels(savedCustomModels.filter(saved => saved.id !== model.id))} className={`${secondaryButton} ml-auto`} aria-label={`Xóa model ${model.model_name}`} title="Xóa khỏi danh sách model"><Trash2 size={14} /></button></div></div>)}</div>}
            </div>
          )}
        </div>

        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <p className={`text-xs min-w-0 break-all ${muted}`}>Model của sổ tay: <strong className={isDark ? 'text-green-400' : 'text-green-700'}>{activeNotebook ? `${currentProvider.toUpperCase()}: ${currentModel || 'Theo cấu hình mặc định'}` : 'Chưa chọn sổ tay'}</strong></p>
          <button onClick={handleClose} disabled={selecting} className={secondaryButton}><Check size={13} className="inline mr-1" />Đóng</button>
        </div>
      </div>
    </div>
  );
}
