import React, { useState, useEffect } from 'react';
import { 
  X, Cpu, Cloud, Download, Check, RefreshCw, Plus, Trash2, 
  Sparkles, AlertCircle, ArrowRight, HardDrive, Zap, Info, Loader
} from 'lucide-react';

export default function ModelManagerModal({ 
  isOpen, 
  onClose, 
  activeNotebook, 
  onSelectModel,
  initialTab = 'recommend'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [recommendations, setRecommendations] = useState([]);
  const [localModels, setLocalModels] = useState([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [loadingScan, setLoadingScan] = useState(false);
  
  // Trạng thái tải model qua Ollama
  const [pullingModel, setPullingModel] = useState(null);
  const [pullProgress, setPullProgress] = useState({ percent: 0, statusText: '', detail: '' });

  // Custom model form
  const [customProvider, setCustomProvider] = useState('ollama');
  const [customModelName, setCustomModelName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [savedCustomModels, setSavedCustomModels] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadAllData();
      loadCustomModels();
    }
  }, [isOpen, initialTab]);

  const loadCustomModels = () => {
    try {
      const stored = localStorage.getItem('custom_ai_models');
      if (stored) {
        setSavedCustomModels(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveCustomModelsToStorage = (newList) => {
    setSavedCustomModels(newList);
    localStorage.setItem('custom_ai_models', JSON.stringify(newList));
  };

  const loadAllData = async () => {
    setLoadingScan(true);
    try {
      // 1. Quét recommendations
      const recRes = await fetch('/api/llm/recommendations');
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData.recommendations || []);
        setOllamaAvailable(recData.ollama_available || false);
      }

      // 2. Quét local models
      const localRes = await fetch('/api/llm/local-models');
      if (localRes.ok) {
        const localData = await localRes.json();
        const oModels = localData?.ollama?.models || [];
        setLocalModels(oModels);
        if (localData?.ollama?.available) {
          setOllamaAvailable(true);
        }
      }
    } catch (e) {
      console.error("Lỗi quét models:", e);
    } finally {
      setLoadingScan(false);
    }
  };

  // Bắt đầu kéo/tải model Ollama qua SSE
  const handleStartPull = async (modelName) => {
    if (pullingModel) {
      alert("Đang có tiến trình tải model khác, vui lòng đợi...");
      return;
    }

    setPullingModel(modelName);
    setPullProgress({ percent: 0, statusText: 'Đang kết nối tới Ollama...', detail: '' });

    try {
      const response = await fetch('/api/llm/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const ev of events) {
          if (ev.startsWith('data: ')) {
            try {
              const data = JSON.parse(ev.substring(6));
              
              if (data.status === 'success') {
                setPullProgress({ percent: 100, statusText: 'Hoàn tất tải về!', detail: 'Đã sẵn sàng sử dụng.' });
                setTimeout(() => {
                  setPullingModel(null);
                  loadAllData();
                  // Tự động kích hoạt dùng model vừa tải
                  onSelectModel('ollama', modelName);
                }, 1200);
                return;
              }

              if (data.status === 'error') {
                alert("Lỗi tải model: " + (data.message || 'Không rõ nguyên nhân'));
                setPullingModel(null);
                return;
              }

              let pct = 0;
              let detailStr = data.status || '';
              if (data.total && data.completed) {
                pct = Math.round((data.completed / data.total) * 100);
                const mbCompleted = (data.completed / (1024 * 1024)).toFixed(1);
                const mbTotal = (data.total / (1024 * 1024)).toFixed(1);
                detailStr = `${mbCompleted} MB / ${mbTotal} MB (${pct}%)`;
              }

              setPullProgress({
                percent: pct,
                statusText: data.status || 'Đang tải...',
                detail: detailStr
              });
            } catch (err) {
              console.debug(err);
            }
          }
        }
      }
    } catch (e) {
      alert("Lỗi kết nối khi tải model: " + e.message);
      setPullingModel(null);
    }
  };

  // Thêm custom model
  const handleAddCustomModel = (e) => {
    e.preventDefault();
    const trimmed = customModelName.trim();
    if (!trimmed) {
      alert("Vui lòng nhập tên model!");
      return;
    }

    const newModel = {
      id: Date.now().toString(),
      name: trimmed,
      provider: customProvider,
      model: trimmed,
      model_name: trimmed,
      base_url: customBaseUrl.trim() || undefined,
      api_key: customApiKey.trim() || undefined,
      created_at: new Date().toISOString()
    };

    const updated = [newModel, ...savedCustomModels.filter(m => m.model_name !== trimmed || m.provider !== customProvider)];
    saveCustomModelsToStorage(updated);
    
    // Áp dụng ngay
    onSelectModel(customProvider, trimmed, newModel.base_url, newModel.api_key);
    setCustomModelName('');
    setCustomBaseUrl('');
    setCustomApiKey('');
    onClose();
  };

  const handleDeleteCustomModel = (id, e) => {
    e.stopPropagation();
    const updated = savedCustomModels.filter(m => m.id !== id);
    saveCustomModelsToStorage(updated);
  };

  if (!isOpen) return null;

  const currentProvider = (activeNotebook?.provider || (activeNotebook?.is_private ? 'ollama' : 'gemini')).toLowerCase();
  const currentModel = activeNotebook?.model_name || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#18191e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-green-500/20 to-blue-500/20 border border-green-500/30 flex items-center justify-center text-green-400">
              <Cpu size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Quản lý & Tải Mô hình AI
              </h2>
              <p className="text-xs text-gray-400">
                Tự động quét model trên máy, gợi ý tải 1-click & thêm model tùy chỉnh
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={loadAllData}
              disabled={loadingScan}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium"
              title="Quét lại các model trên máy tính"
            >
              <RefreshCw size={13} className={loadingScan ? "animate-spin text-blue-400" : ""} />
              <span className="hidden sm:inline">Quét lại</span>
            </button>
            <button 
              onClick={onClose} 
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Ollama Status Alert Banner */}
        <div className="px-5 py-2.5 bg-black/40 border-b border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${ollamaAvailable ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
            {ollamaAvailable ? (
              <span className="text-green-300 font-medium">
                Ollama đang chạy • Đã tìm thấy <strong>{localModels.length}</strong> mô hình trên máy bạn
              </span>
            ) : (
              <span className="text-amber-300 font-medium">
                Ollama chưa bật hoặc chưa cài đặt • Bạn có thể mở ứng dụng Ollama hoặc dùng 9Router Gateway
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            {activeNotebook?.title ? `Sổ tay: "${activeNotebook.title}"` : ''}
          </span>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-white/10 px-5 bg-white/[0.01]">
          <button
            onClick={() => setActiveTab('recommend')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'recommend'
                ? 'border-green-500 text-green-400 font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles size={14} /> Gợi ý tải cho máy
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'installed'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <HardDrive size={14} /> Model trên máy ({localModels.length})
          </button>
          <button
            onClick={() => setActiveTab('add_custom')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'add_custom'
                ? 'border-purple-500 text-purple-400 font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Plus size={14} /> Thêm model tùy chỉnh
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* TAB 1: GỢI Ý TẢI MODEL CHO MÁY */}
          {activeTab === 'recommend' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <Info size={16} className="shrink-0 mt-0.5 text-blue-400" />
                <div className="leading-relaxed">
                  Các mô hình dưới đây được tối ưu riêng cho <strong>macOS Apple Silicon (M1/M2/M3/M4)</strong> với RAM từ 8GB đến 16GB.
                  Bấm <strong>Tải về máy</strong> để tải tự động qua Ollama và sử dụng hoàn toàn Offline bảo mật!
                </div>
              </div>

              {/* Progress bar khi đang tải */}
              {pullingModel && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 space-y-2.5 animate-pulse">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-green-300 flex items-center gap-2">
                      <Loader size={14} className="animate-spin text-green-400" />
                      Đang tải mô hình: <code className="text-white bg-black/40 px-1.5 py-0.5 rounded">{pullingModel}</code>
                    </span>
                    <span className="text-white font-mono">{pullProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${pullProgress.percent}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>{pullProgress.statusText}</span>
                    <span>{pullProgress.detail}</span>
                  </div>
                </div>
              )}

              {/* Danh sách model gợi ý */}
              <div className="space-y-3">
                {recommendations.map((rec) => {
                  const isCurrent = currentProvider === 'ollama' && (currentModel === rec.name || currentModel.startsWith(rec.name.split(':')[0]));
                  const isPullingThis = pullingModel === rec.name;

                  return (
                    <div 
                      key={rec.name}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCurrent 
                          ? 'bg-green-500/10 border-green-500/40 shadow-lg' 
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm text-white">{rec.displayName}</h3>
                            <span className="text-[10px] font-mono bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                              {rec.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                              {rec.badge}
                            </span>
                            <span className="text-[10px] text-amber-400">{rec.rating}</span>
                          </div>
                          
                          <p className="text-xs text-gray-400 leading-relaxed pt-1">
                            {rec.description}
                          </p>

                          <div className="flex items-center gap-3 pt-2 text-[11px] text-gray-400">
                            <span>Dung lượng: <strong className="text-gray-200">{rec.size}</strong></span>
                            <span>•</span>
                            <span>Yêu cầu RAM: <strong className="text-gray-200">{rec.min_ram}</strong></span>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-2">
                          {rec.installed ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="text-[11px] text-green-400 font-medium flex items-center gap-1">
                                <Check size={12} strokeWidth={3} /> Đã có trên máy
                              </span>
                              <button
                                onClick={() => {
                                  onSelectModel('ollama', rec.name);
                                  onClose();
                                }}
                                disabled={isCurrent}
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                                  isCurrent
                                    ? 'bg-green-500/20 text-green-300 border border-green-500/30 cursor-default'
                                    : 'bg-white text-black hover:bg-gray-200'
                                }`}
                              >
                                {isCurrent ? 'Đang dùng' : 'Chọn dùng'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartPull(rec.name)}
                              disabled={isPullingThis || !ollamaAvailable}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
                                !ollamaAvailable 
                                  ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-500 text-white shadow-lg'
                              }`}
                              title={!ollamaAvailable ? 'Vui lòng khởi động Ollama trước' : 'Tải về máy qua Ollama'}
                            >
                              <Download size={13} />
                              {isPullingThis ? 'Đang tải...' : 'Tải về máy'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CÁC MODEL HIỆN CÓ TRÊN MÁY */}
          {activeTab === 'installed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Danh sách mô hình đã tải về lưu cục bộ trên máy tính của bạn:
                </p>
                <button
                  onClick={loadAllData}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={11} className={loadingScan ? "animate-spin" : ""} /> Quét lại
                </button>
              </div>

              {localModels.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs border border-dashed border-white/10 rounded-xl space-y-3">
                  <Cpu size={28} className="mx-auto text-gray-600 opacity-70" />
                  <div>
                    Chưa phát hiện mô hình nào được cài đặt trong Ollama.<br />
                    Hãy chuyển sang tab <strong>"Gợi ý tải cho máy"</strong> để tải 1-click hoặc mở app Ollama.
                  </div>
                  <button
                    onClick={() => setActiveTab('recommend')}
                    className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 font-medium text-xs transition"
                  >
                    Xem gợi ý tải ngay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {localModels.map((m) => {
                    const isCurrent = currentProvider === 'ollama' && currentModel === m.name;
                    return (
                      <div
                        key={m.name}
                        onClick={() => {
                          onSelectModel('ollama', m.name);
                          onClose();
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isCurrent
                            ? 'bg-green-500/15 border-green-500/40 text-green-300 font-medium shadow-md'
                            : 'bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06] text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-white truncate" title={m.name}>
                            {m.name}
                          </span>
                          <span className="text-[10px] font-mono bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                            {m.size_gb} GB
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-white/5">
                          <span>{m.details?.family || 'gguf'}</span>
                          <span className="text-blue-400 font-medium flex items-center gap-1">
                            {isCurrent ? '✓ Đang sử dụng' : 'Bấm để dùng'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: THÊM MODEL TÙY CHỈNH */}
          {activeTab === 'add_custom' && (
            <div className="space-y-5">
              <form onSubmit={handleAddCustomModel} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3.5">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Plus size={14} className="text-purple-400" /> Thêm mô hình mới
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Nhà cung cấp (Provider):</label>
                    <select
                      value={customProvider}
                      onChange={(e) => setCustomProvider(e.target.value)}
                      className="w-full bg-[#131314] border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="ollama">Ollama (Local trên máy)</option>
                      <option value="9router">9Router AI Gateway</option>
                      <option value="openrouter">OpenRouter AI</option>
                      <option value="groq">Groq Cloud (Siêu tốc)</option>
                      <option value="openai">OpenAI (GPT-4o/o3...)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="custom">Tùy chỉnh khác (OpenAI-compatible)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Tên Model ID / Model Name: <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: deepseek-r1:1.5b hoặc kr/claude-sonnet-4.5 hoặc gpt-4o"
                      value={customModelName}
                      onChange={(e) => setCustomModelName(e.target.value)}
                      className="w-full bg-[#131314] border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Base URL (Tùy chọn, để trống dùng mặc định):</label>
                    <input
                      type="text"
                      placeholder={customProvider === 'ollama' ? 'http://127.0.0.1:11434' : 'Để trống nếu dùng mặc định'}
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      className="w-full bg-[#131314] border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">API Key (Tùy chọn):</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="w-full bg-[#131314] border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-lg shadow-purple-600/20"
                  >
                    <Plus size={13} /> Thêm & Dùng ngay cho Sổ tay
                  </button>
                </div>
              </form>

              {/* Danh sách custom models đã lưu */}
              {savedCustomModels.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Mô hình đã thêm gần đây ({savedCustomModels.length}):
                  </h4>
                  <div className="space-y-1.5">
                    {savedCustomModels.map((cm) => (
                      <div
                        key={cm.id}
                        onClick={() => {
                          onSelectModel(cm.provider, cm.model_name, cm.base_url, cm.api_key);
                          onClose();
                        }}
                        className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between gap-2 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {cm.provider}
                          </span>
                          <span className="text-xs text-white font-medium truncate">
                            {cm.model_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-blue-400 hover:underline">Chọn</span>
                          <button
                            onClick={(e) => handleDeleteCustomModel(cm.id, e)}
                            className="p-1 text-gray-500 hover:text-red-400 rounded transition"
                            title="Xóa model này khỏi danh sách lưu"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between bg-white/[0.01]">
          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <span>Mô hình đang kích hoạt:</span>
            <strong className="text-green-400 font-mono">
              {currentProvider.toUpperCase()}: {currentModel || 'qwen2.5:3b'}
            </strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
