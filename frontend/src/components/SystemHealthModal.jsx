import { useState, useEffect, useEffectEvent, useRef } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Cpu, Database, Sparkles, Volume2, Layout, ExternalLink, X, HelpCircle,
} from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { requestJson, getErrorMessage } from '../lib/api';

const healthComponents = [
  { id: 'llm', label: 'LLM AI Engine', icon: Cpu, verified: 'Đã phát hiện / cấu hình', scope: 'Phát hiện dịch vụ hoặc API key chưa xác nhận model có thể trả lời. Dùng Kiểm tra kết nối trong Cài đặt để thử phản hồi.' },
  { id: 'vector_store', label: 'Lưu trữ vector', icon: Sparkles, verified: 'Kiểm tra lưu trữ đạt', scope: 'Kiểm tra thư mục lưu trữ chưa xác nhận truy vấn vector hay mô hình embedding hoạt động.' },
  { id: 'database', label: 'Database & Sổ tay', icon: Database, verified: 'Truy vấn thành công' },
  { id: 'audio_tts', label: 'Podcast & Giọng đọc', icon: Volume2, verified: 'Đã cài thư viện', scope: 'Kiểm tra thư viện TTS chưa thử tạo hoặc phát âm thanh; dịch vụ giọng đọc có thể cần mạng.' },
  { id: 'frontend', label: 'Giao diện ứng dụng', icon: Layout, verified: 'Có bản build', scope: 'Kiểm tra bản build trên máy chủ chưa xác nhận mọi thao tác trong trình duyệt.' },
];

function componentMessage(id, component) {
  if (!component) return 'Máy chủ chưa trả về kết quả cho hạng mục này.';
  if (component.status === 'healthy') {
    if (id === 'audio_tts') return 'Backend nhập được thư viện TTS.';
    if (id === 'vector_store') return 'Máy chủ tìm thấy thư mục lưu trữ vector.';
    if (id === 'frontend') return 'Máy chủ tìm thấy bản build giao diện.';
  }
  return typeof component.message === 'string' && component.message.trim()
    ? component.message : 'Chưa có thông tin chi tiết. Hãy thử quét lại.';
}

export default function SystemHealthModal({ isOpen, onClose, onOpenSettings, onOpenModelManager, isDark = true }) {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState(null);
  const dialogRef = useRef(null);
  const requestController = useRef(null);
  useDialog(dialogRef, onClose, isOpen);

  const fetchHealth = async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await requestJson('/api/system/health', { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!data?.components || typeof data.components !== 'object' || Array.isArray(data.components)) throw new Error('Máy chủ trả về dữ liệu chẩn đoán không hợp lệ.');
      setHealthData(data);
      setCheckedAt(new Date());
    } catch (requestError) {
      if (!controller.signal.aborted) setError(getErrorMessage(requestError, 'Không kết nối được máy chủ ứng dụng. Kiểm tra ứng dụng đang chạy rồi thử lại.'));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const openModal = useEffectEvent(() => {
    setHealthData(null);
    setCheckedAt(null);
    void fetchHealth();
  });

  useEffect(() => {
    if (!isOpen) return;
    openModal();
    return () => requestController.current?.abort();
  }, [isOpen]);

  if (!isOpen) return null;

  const components = healthData?.components || {};
  const knownStatuses = new Set(['healthy', 'warning', 'error', 'unhealthy', 'degraded']);
  const missingCount = healthComponents.filter(component => !knownStatuses.has(components[component.id]?.status)).length;
  const issueCount = healthComponents.filter(component => ['warning', 'error', 'unhealthy', 'degraded'].includes(components[component.id]?.status)).length;
  const hasIssues = issueCount > 0 || ['degraded', 'error'].includes(healthData?.status);
  const muted = isDark ? 'text-zinc-400' : 'text-slate-600';
  const border = isDark ? 'border-zinc-800' : 'border-slate-200';
  const secondaryButton = `px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`;

  const getStatusBadge = (status, verifiedLabel) => {
    const healthy = status === 'healthy';
    const warning = status === 'warning' || status === 'degraded';
    const failed = status === 'error' || status === 'unhealthy';
    const Icon = healthy ? CheckCircle2 : warning ? AlertTriangle : failed ? XCircle : HelpCircle;
    const colors = healthy
      ? isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : warning ? isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-900 border-amber-200'
        : failed ? isDark ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-rose-50 text-rose-900 border-rose-200'
          : isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border ${colors}`}><Icon className="w-3.5 h-3.5 shrink-0" />{healthy ? verifiedLabel : warning ? 'Cần kiểm tra' : failed ? 'Gặp sự cố' : 'Chưa xác định'}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Chẩn đoán sức khỏe hệ thống" tabIndex={-1}
        className={`w-full max-w-2xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] ${border} ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className={`flex items-start justify-between gap-3 p-4 sm:px-6 border-b ${border}`}>
          <div className="flex items-center gap-3 min-w-0"><Activity className="w-6 h-6 text-indigo-500 shrink-0" /><div><h2 className="text-base sm:text-lg font-semibold">Chẩn Đoán Sức Khỏe Hệ Thống</h2><p className={`text-xs mt-1 ${muted}`}>Kiểm tra cấu hình AI, lưu trữ và công cụ trên máy chủ.</p></div></div>
          <button onClick={onClose} aria-label="Đóng chẩn đoán hệ thống" className={secondaryButton}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto min-h-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className={`text-xs ${muted}`}>{loading ? 'Đang kiểm tra các dịch vụ...' : checkedAt ? `Nhận kết quả lúc ${checkedAt.toLocaleTimeString('vi-VN')}` : 'Chưa nhận được kết quả kiểm tra.'}</p><button onClick={fetchHealth} disabled={loading} className={`${secondaryButton} flex items-center gap-1.5`}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Đang quét...' : 'Quét lại'}</button></div>

          {loading && !healthData && <div role="status" className={`py-10 flex flex-col items-center gap-3 ${muted}`}><RefreshCw className="w-7 h-7 animate-spin text-indigo-500" /><p className="text-sm">Đang đọc trạng thái từ máy chủ...</p></div>}

          {error && <div role="alert" className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-900'}`}><XCircle className="w-5 h-5 shrink-0 mt-0.5" /><div className="min-w-0 space-y-2"><p className="font-medium">Chưa tải được chẩn đoán mới</p><p className="text-xs break-words">{error}</p><button onClick={fetchHealth} disabled={loading} className="text-xs underline underline-offset-2 disabled:opacity-50">Thử lại</button></div></div>}

          {healthData && <div className="space-y-3">
            {(loading || error) && <p role="status" className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>Kết quả bên dưới thuộc lần kiểm tra trước. {loading ? 'Đang chờ dữ liệu mới.' : 'Lần kiểm tra mới chưa thành công.'}</p>}
            <div className={`p-4 rounded-xl border space-y-2 ${hasIssues ? isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50 border-amber-200' : isDark ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'}`}>
              <h3 className="text-sm font-semibold">{hasIssues ? issueCount > 0 ? `${issueCount} hạng mục cần kiểm tra thêm` : 'Máy chủ báo hệ thống cần kiểm tra thêm' : missingCount > 0 ? `${missingCount} hạng mục chưa có kết quả` : 'Đã nhận kết quả kiểm tra cơ bản'}</h3>
              <p className={`text-xs leading-relaxed ${muted}`}>Kết quả này phản ánh cấu hình và khả năng phát hiện dịch vụ tại thời điểm quét. Khả năng chat, xử lý tài liệu và tạo âm thanh cần được kiểm tra bằng từng chức năng.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {healthComponents.map(({ id, label, icon: Icon, verified, scope }) => {
                const component = components[id];
                return <section key={id} aria-label={label} className={`p-4 border rounded-xl space-y-2 min-w-0 ${border} ${isDark ? 'bg-zinc-800/40' : 'bg-slate-50'}`}>
                  <h3 className="flex items-center gap-2 font-medium text-sm"><Icon className="w-4 h-4 text-indigo-500 shrink-0" />{label}</h3>
                  {getStatusBadge(component?.status, verified)}
                  <p className={`text-xs break-words leading-relaxed ${muted}`}>{componentMessage(id, component)}</p>
                  {scope && <p className={`text-[11px] leading-relaxed ${muted}`}>{scope}</p>}
                  {id === 'database' && <p className={`text-[11px] ${muted}`}>Sổ tay: {typeof component?.notebooks_count === 'number' ? component.notebooks_count : 'Chưa có số liệu'}</p>}
                  {id === 'vector_store' && component?.storage_path && <p className={`text-[11px] font-mono break-all ${muted}`}>Lưu trữ: {component.storage_path}</p>}
                  {id === 'llm' && component?.active_provider && <p className={`text-[11px] ${muted}`}>Nhà cung cấp mặc định: {component.active_provider}</p>}
                </section>;
              })}
            </div>
          </div>}
        </div>

        <div className={`px-4 sm:px-6 py-3.5 border-t flex flex-wrap justify-end items-center gap-2 ${border}`}>
          {onOpenModelManager && <button onClick={() => { onClose(); onOpenModelManager(); }} className={`${secondaryButton} flex items-center gap-1.5`}>Quản lý model<ExternalLink size={12} /></button>}
          {onOpenSettings && <button onClick={() => { onClose(); onOpenSettings(); }} className={`${secondaryButton} flex items-center gap-1.5`}>Cài đặt & kiểm tra AI<ExternalLink size={12} /></button>}
          <button onClick={onClose} className={secondaryButton}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
