import React from 'react';
import { Award, Check, Sparkles, X } from 'lucide-react';

export default function EvalModal({
  isOpen,
  onClose,
  evalResult
}) {
  if (!isOpen || !evalResult) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] border border-yellow-500/30 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-yellow-400 font-bold">
            <Award size={20} />
            <span>Kết Quả Đánh Giá Năng Lực Học Tập</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-black text-yellow-400">
              {evalResult.score?.toFixed(1) || '8.0'}<span className="text-xs text-gray-400">/10</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Điểm tổng quan</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-black text-green-400">
              {((evalResult.faithfulness || 0.9) * 100).toFixed(0)}%
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Độ bám sát tài liệu</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-black text-blue-400">
              {((evalResult.context_precision || 0.85) * 100).toFixed(0)}%
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Độ chuẩn ngữ cảnh</div>
          </div>
        </div>

        {/* AI Feedback */}
        <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/10">
          <h4 className="text-xs font-semibold text-gray-300 mb-1">Nhận xét chi tiết từ AI:</h4>
          <p className="text-xs text-gray-400 leading-relaxed">{evalResult.feedback}</p>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20">
            <h5 className="font-semibold text-green-400 mb-1 flex items-center gap-1">
              <Check size={13} /> Điểm mạnh:
            </h5>
            <ul className="text-gray-300 space-y-1 list-disc list-inside">
              {evalResult.strengths?.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/20">
            <h5 className="font-semibold text-yellow-400 mb-1 flex items-center gap-1">
              <Sparkles size={13} /> Cần phát huy thêm:
            </h5>
            <ul className="text-gray-300 space-y-1 list-disc list-inside">
              {evalResult.weaknesses?.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
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
