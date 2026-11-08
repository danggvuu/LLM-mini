import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  Cpu, Database, Sparkles, Volume2, Layout, ExternalLink, X 
} from 'lucide-react';

export default function SystemHealthModal({ isOpen, onClose, onOpenSettings, onOpenModelManager }) {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      setError(err.message || 'Không thể kết nối đến máy chủ Backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const components = healthData?.components || {};

  const getStatusBadge = (status) => {
    if (status === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" /> Hoạt động tốt
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5" /> Cần lưu ý
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XCircle className="w-3.5 h-3.5" /> Gặp sự cố
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Chẩn Đoán Sức Khỏe Hệ Thống
                <span className="text-xs font-normal text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-800">
                  Self-Diagnostics
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Kiểm tra kết nối AI, Vector DB, Database và Bộ công cụ</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading && !healthData && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
              <p className="text-sm">Đang quét toàn diện các dịch vụ trên máy...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
              <XCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-medium">Mất kết nối với Backend API</p>
                <p className="text-xs mt-1 text-rose-400/80">{error}</p>
                <p className="text-xs mt-2 text-zinc-300">
                  Hãy kiểm tra xem terminal backend đã chạy chưa: <code className="px-1 py-0.5 bg-black/40 rounded">python3 -m uvicorn src.api.api:app --reload</code>
                </p>
              </div>
            </div>
          )}

          {healthData && (
            <div className="space-y-3">
              {/* Overall status banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                healthData.status === 'ok' 
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' 
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
              }`}>
                <div className="flex items-center gap-3">
                  {healthData.status === 'ok' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {healthData.status === 'ok' ? 'Mọi hệ thống đã sẵn sàng' : 'Một số tính năng đang ở chế độ dự phòng'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {healthData.status === 'ok' 
                        ? 'Bạn có thể học tập, chat RAG và tạo đề thi bình thường.' 
                        : 'Kiểm tra chi tiết bên dưới để kích hoạt đầy đủ tính năng.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={fetchHealth}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Quét lại
                </button>
              </div>

              {/* Component Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* 1. LLM Engine */}
                <div className="p-4 bg-zinc-800/40 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-200 font-medium text-sm">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      LLM AI Engine
                    </div>
                    {getStatusBadge(components.llm?.status || 'warning')}
                  </div>
                  <p className="text-xs text-zinc-400">{components.llm?.message || 'Chưa xác định'}</p>
                  <div className="pt-2 flex items-center gap-2">
                    {onOpenModelManager && (
                      <button
                        onClick={() => { onClose(); onOpenModelManager(); }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-2"
                      >
                        Quản lý & Tải Model <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Vector Store & Embedder */}
                <div className="p-4 bg-zinc-800/40 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-200 font-medium text-sm">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Vector DB (Qdrant)
                    </div>
                    {getStatusBadge(components.vector_store?.status || 'healthy')}
                  </div>
                  <p className="text-xs text-zinc-400">{components.vector_store?.message || 'Qdrant in-memory sẵn sàng'}</p>
                  <div className="pt-2 text-[11px] text-zinc-500 font-mono">
                    Lưu trữ: {components.vector_store?.storage_path || 'storage/qdrant_data'}
                  </div>
                </div>

                {/* 3. SQLite Database */}
                <div className="p-4 bg-zinc-800/40 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-200 font-medium text-sm">
                      <Database className="w-4 h-4 text-blue-400" />
                      Database & Sổ tay
                    </div>
                    {getStatusBadge(components.database?.status || 'healthy')}
                  </div>
                  <p className="text-xs text-zinc-400">{components.database?.message || 'SQLite Database hoạt động'}</p>
                  <div className="pt-2 text-[11px] text-zinc-500">
                    Sổ tay hiện có: <span className="text-zinc-300 font-semibold">{components.database?.notebooks_count ?? 0}</span>
                  </div>
                </div>

                {/* 4. Podcast & TTS Audio */}
                <div className="p-4 bg-zinc-800/40 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-200 font-medium text-sm">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      Podcast & Voice Audio
                    </div>
                    {getStatusBadge(components.audio_tts?.status || 'healthy')}
                  </div>
                  <p className="text-xs text-zinc-400">{components.audio_tts?.message || 'TTS sẵn sàng'}</p>
                  <div className="pt-2 text-[11px] text-zinc-500">
                    Hỗ trợ giọng đọc Edge-TTS tiếng Việt (Hoài My, Nam Minh)
                  </div>
                </div>
              </div>

              {/* 5. Frontend & UI Build */}
              <div className="p-3 bg-zinc-800/20 border border-zinc-800/60 rounded-xl flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Layout className="w-4 h-4 text-sky-400" />
                  <span>Frontend React SPA: <strong className="text-zinc-200">{components.frontend?.message}</strong></span>
                </div>
                {onOpenSettings && (
                  <button
                    onClick={() => { onClose(); onOpenSettings(); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                  >
                    Cài đặt API Keys
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </motion.div>
    </div>
  );
}
