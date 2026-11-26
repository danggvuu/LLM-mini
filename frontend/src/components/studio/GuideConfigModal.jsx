import { useRef, useState } from 'react';
import { SlidersHorizontal, Brain, Layers, Sparkles, X } from 'lucide-react';
import useDialog from '../../hooks/useDialog';
import { getErrorMessage } from '../../lib/api';

export default function GuideConfigModal({
  isOpen,
  onClose,
  guideConfig,
  setGuideConfig,
  onGenerate,
  regeneratingGuide,
  isDark = true
}) {
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useDialog(dialogRef, onClose, isOpen);
  const busy = regeneratingGuide || submitting;
  const handleGenerate = async () => {
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      if (await onGenerate() === false) setError('Chưa tạo được bộ học tập. Vui lòng thử lại.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được bộ học tập.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Tùy chỉnh bộ học tập" tabIndex={-1} className={`border border-blue-500/40 w-full max-w-lg max-h-[calc(100dvh-2rem)] rounded-3xl shadow-2xl overflow-y-auto p-4 sm:p-6 space-y-5 ${isDark ? 'bg-[#181a20] text-white' : 'bg-white text-gray-900'}`}>
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 text-blue-400 font-bold text-base">
            <SlidersHorizontal size={20} />
            <span>Tùy Chỉnh Bộ Học Tập & Quizlet</span>
          </div>
          <button 
             onClick={onClose}
             aria-label="Đóng tùy chỉnh bộ học tập"
            className="text-gray-500 hover:text-blue-500 p-2 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Config Fields */}
        <fieldset disabled={busy} className="space-y-4 text-xs">
          {/* Quiz Count */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className={`font-semibold flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Brain size={14} className="text-blue-400" /> Số câu hỏi Trắc nghiệm (Quiz):
              </span>
              <span className="font-bold text-blue-400 font-mono text-sm">{guideConfig.quiz_count} câu</span>
            </div>
            <div className="flex gap-2">
              {[3, 5, 10, 15, 20].map(cnt => (
                <button
                  key={cnt}
                   type="button"
                   aria-pressed={guideConfig.quiz_count === cnt}
                  onClick={() => setGuideConfig({...guideConfig, quiz_count: cnt})}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    guideConfig.quiz_count === cnt 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                      : isDark ? 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
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
              <span className={`font-semibold flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Layers size={14} className="text-purple-400" /> Số thẻ nhớ Quizlet (Flashcards):
              </span>
              <span className="font-bold text-purple-400 font-mono text-sm">{guideConfig.flashcards_count} thẻ</span>
            </div>
            <div className="flex gap-2">
              {[5, 10, 15, 20, 30].map(cnt => (
                <button
                  key={cnt}
                   type="button"
                   aria-pressed={guideConfig.flashcards_count === cnt}
                  onClick={() => setGuideConfig({...guideConfig, flashcards_count: cnt})}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    guideConfig.flashcards_count === cnt 
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md' 
                      : isDark ? 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <span className={`font-semibold block mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Mức độ khó của câu hỏi:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'easy', label: 'Cơ bản', sub: 'Nhận biết, nhớ từ khóa' },
                { key: 'medium', label: 'Trung bình', sub: 'Hiểu & áp dụng' },
                { key: 'hard', label: 'Nâng cao', sub: 'Tình huống, bẫy logic' }
              ].map(lvl => (
                <button
                  key={lvl.key}
                   type="button"
                   aria-pressed={guideConfig.difficulty === lvl.key}
                  onClick={() => setGuideConfig({...guideConfig, difficulty: lvl.key})}
                  className={`p-2 rounded-xl border text-left transition ${
                    guideConfig.difficulty === lvl.key 
                      ? `bg-blue-500/20 border-blue-500 shadow ${isDark ? 'text-white' : 'text-blue-900'}`
                      : isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-semibold text-xs">{lvl.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{lvl.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Focus Topic */}
          <div>
            <label htmlFor="guide-focus-topic" className={`font-semibold block mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Chủ đề / Yêu cầu trọng tâm (Tùy chọn):
            </label>
             <input
               id="guide-focus-topic"
               aria-label="Chủ đề trọng tâm của bộ học tập"
               type="text"
               value={guideConfig.focus_topic ?? ''}
              onChange={e => setGuideConfig({...guideConfig, focus_topic: e.target.value})}
              placeholder="Ví dụ: Tập trung vào kiến thức trọng tâm, câu hỏi tình huống..."
              className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:border-blue-500 outline-none transition ${isDark ? 'bg-black/40 text-white border-white/15' : 'bg-gray-50 text-gray-900 border-gray-200'}`}
            />
            <span className="text-[10px] text-gray-500 mt-1 block">
              AI sẽ tự động lọc các đoạn tài liệu liên quan đến chủ đề này để thiết kế câu hỏi.
            </span>
          </div>
        </fieldset>
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

        {/* Actions */}
        <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-blue-500 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {busy ? "Đang xử lý..." : "Tạo bộ học tập mới"}
          </button>
        </div>
      </div>
    </div>
  );
}
