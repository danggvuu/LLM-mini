import React from 'react';
import { SlidersHorizontal, Brain, Layers, Sparkles, X } from 'lucide-react';

export default function GuideConfigModal({
  isOpen,
  onClose,
  guideConfig,
  setGuideConfig,
  onGenerate,
  regeneratingGuide
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] border border-blue-500/40 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 text-blue-400 font-bold text-base">
            <SlidersHorizontal size={20} />
            <span>Tùy Chỉnh Bộ Học Tập & Quizlet</span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Config Fields */}
        <div className="space-y-4 text-xs">
          {/* Quiz Count */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Brain size={14} className="text-blue-400" /> Số câu hỏi Trắc nghiệm (Quiz):
              </label>
              <span className="font-bold text-blue-400 font-mono text-sm">{guideConfig.quiz_count} câu</span>
            </div>
            <div className="flex gap-2">
              {[3, 5, 10, 15, 20].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setGuideConfig({...guideConfig, quiz_count: cnt})}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    guideConfig.quiz_count === cnt 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Flashcards Count */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Layers size={14} className="text-purple-400" /> Số thẻ nhớ Quizlet (Flashcards):
              </label>
              <span className="font-bold text-purple-400 font-mono text-sm">{guideConfig.flashcards_count} thẻ</span>
            </div>
            <div className="flex gap-2">
              {[5, 10, 15, 20, 30].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setGuideConfig({...guideConfig, flashcards_count: cnt})}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    guideConfig.flashcards_count === cnt 
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md' 
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="font-semibold text-gray-300 block mb-1.5">
              Mức độ khó của câu hỏi:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'easy', label: 'Cơ bản', sub: 'Nhận biết, nhớ từ khóa' },
                { key: 'medium', label: 'Trung bình', sub: 'Hiểu & áp dụng' },
                { key: 'hard', label: 'Nâng cao', sub: 'Tình huống, bẫy logic' }
              ].map(lvl => (
                <button
                  key={lvl.key}
                  type="button"
                  onClick={() => setGuideConfig({...guideConfig, difficulty: lvl.key})}
                  className={`p-2 rounded-xl border text-left transition ${
                    guideConfig.difficulty === lvl.key 
                      ? 'bg-blue-500/20 border-blue-500 text-white shadow' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold text-xs text-gray-200">{lvl.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{lvl.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Focus Topic */}
          <div>
            <label className="font-semibold text-gray-300 block mb-1.5">
              Chủ đề / Yêu cầu trọng tâm (Tùy chọn):
            </label>
            <input
              type="text"
              value={guideConfig.focus_topic}
              onChange={e => setGuideConfig({...guideConfig, focus_topic: e.target.value})}
              placeholder="Ví dụ: Tập trung vào kiến thức trọng tâm, câu hỏi tình huống..."
              className="w-full bg-black/40 text-xs px-3.5 py-2.5 rounded-xl text-white border border-white/15 focus:border-blue-500 outline-none transition"
            />
            <span className="text-[10px] text-gray-500 mt-1 block">
              AI sẽ tự động lọc các đoạn tài liệu liên quan đến chủ đề này để thiết kế câu hỏi.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={regeneratingGuide}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {regeneratingGuide ? "Đang xử lý..." : "Tạo Cẩm Nang & Quizlet Mới"}
          </button>
        </div>
      </div>
    </div>
  );
}
