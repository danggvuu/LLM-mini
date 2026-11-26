import { useRef } from 'react';
import { Award, Check, Sparkles, X } from 'lucide-react';
import useDialog from '../../hooks/useDialog';

export default function EvalModal({
  isOpen,
  onClose,
  evalResult,
  isDark = true
}) {
  const dialogRef = useRef(null);
  useDialog(dialogRef, onClose, isOpen);
  if (!isOpen) return null;

  const metrics = evalResult?.metrics ?? evalResult ?? {};
  const formatMetric = (value, max, percent = false) => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
      ? percent ? `${(value * 100).toFixed(0)}%` : value.toFixed(1)
      : 'Chưa có'
  );
  const strengths = Array.isArray(metrics.strengths) ? metrics.strengths.filter(item => typeof item === 'string') : [];
  const weaknesses = Array.isArray(metrics.weaknesses) ? metrics.weaknesses.filter(item => typeof item === 'string') : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Kết quả đánh giá học tập" tabIndex={-1} className={`border border-yellow-500/30 w-full max-w-lg max-h-[calc(100dvh-2rem)] rounded-2xl shadow-2xl overflow-y-auto p-4 sm:p-6 space-y-4 ${isDark ? 'bg-[#181a20] text-white' : 'bg-white text-gray-900'}`}>
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-yellow-400 font-bold">
            <Award size={20} />
            <span>Kết Quả Đánh Giá Năng Lực Học Tập</span>
          </div>
           <button type="button" aria-label="Đóng kết quả đánh giá" onClick={onClose} className="text-gray-400 hover:text-yellow-500 shrink-0 p-2">
            <X size={18} />
          </button>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-black text-yellow-400">
              {formatMetric(metrics.score, 10)}<span className="text-xs text-gray-400"> /10</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Điểm tổng quan</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-black text-green-400">
              {formatMetric(metrics.faithfulness, 1, true)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Độ bám sát tài liệu</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-black text-blue-400">
              {formatMetric(metrics.context_precision, 1, true)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Độ chuẩn ngữ cảnh</div>
          </div>
        </div>

        {/* AI Feedback */}
        <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/10">
          <h4 className="text-xs font-semibold text-gray-300 mb-1">Nhận xét chi tiết từ AI:</h4>
          <p className="text-xs text-gray-500 leading-relaxed">{typeof metrics.feedback === 'string' && metrics.feedback.trim() ? metrics.feedback : 'Chưa có nhận xét từ AI.'}</p>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20">
            <h5 className="font-semibold text-green-400 mb-1 flex items-center gap-1">
              <Check size={13} /> Điểm mạnh:
            </h5>
            <ul className={`space-y-1 list-disc list-inside ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {strengths.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
            {!strengths.length && <p className="text-gray-500">Chưa có thông tin.</p>}
          </div>

          <div className="bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/20">
            <h5 className="font-semibold text-yellow-400 mb-1 flex items-center gap-1">
              <Sparkles size={13} /> Cần phát huy thêm:
            </h5>
            <ul className={`space-y-1 list-disc list-inside ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {weaknesses.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
            {!weaknesses.length && <p className="text-gray-500">Chưa có thông tin.</p>}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-white text-black px-5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
