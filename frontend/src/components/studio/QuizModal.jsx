import { useRef } from 'react';
import { Brain, Printer, SlidersHorizontal, X, Check, XCircle } from 'lucide-react';
import useDialog from '../../hooks/useDialog';

export default function QuizModal({
  isOpen,
  onClose,
  quiz = [],
  quizAnswers = {},
  setQuizAnswers,
  quizSubmitted,
  setQuizSubmitted,
  onOpenConfig,
  onPrintExam,
  isDark = true
}) {
  const dialogRef = useRef(null);
  useDialog(dialogRef, onClose, isOpen);
  if (!isOpen) return null;
  const questions = Array.isArray(quiz) ? quiz : [];
  const correctAnswer = (question) => {
    const answer = question?.answer;
    const options = Array.isArray(question?.options) ? question.options : [];
    if (Number.isInteger(answer) && answer >= 0 && answer < options.length) return answer;
    // Imported notebooks may contain the numeric string or option label from the model.
    if (typeof answer === 'string') {
      const value = answer.trim();
      if (/^\d+$/.test(value) && Number(value) < options.length) return Number(value);
      const letter = /^[A-Z]$/i.test(value) ? value.toUpperCase().charCodeAt(0) - 65 : -1;
      if (letter >= 0 && letter < options.length) return letter;
      const matches = options.flatMap((option, index) => option === answer ? [index] : []);
      if (matches.length === 1) return matches[0];
    }
    return null;
  };
  const answered = questions.filter((q, idx) => Array.isArray(q?.options) && Number.isInteger(quizAnswers[idx]) && quizAnswers[idx] >= 0 && quizAnswers[idx] < q.options.length).length;
  const gradable = questions.filter(q => correctAnswer(q) !== null).length;
  const correct = questions.filter((q, idx) => correctAnswer(q) !== null && quizAnswers[idx] === correctAnswer(q)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Ôn tập trắc nghiệm" tabIndex={-1} className={`border border-blue-500/30 w-full max-w-xl max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#181a20] text-white' : 'bg-white text-gray-900'}`}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex flex-wrap shrink-0 gap-3 justify-between items-center bg-blue-500/10">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Brain className="text-blue-400" size={18} /> Ôn tập trắc nghiệm ({questions.length} câu)
          </h2>
          <div className="flex items-center gap-2">
            {onPrintExam && (
              <button 
                type="button"
                onClick={onPrintExam}
                className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-xl transition font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="In hoặc xuất đề thi trắc nghiệm kèm bảng đáp án cho giáo viên"
              >
                <Printer size={13}/> In / Xuất Đề Thi
              </button>
            )}
            {onOpenConfig && (
              <button 
                onClick={() => { onClose(); onOpenConfig(); }}
                className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-xl transition font-medium flex items-center gap-1"
                title="Thay đổi số câu hoặc chủ đề đề thi"
              >
                <SlidersHorizontal size={12}/> Đổi số câu / Đề
              </button>
            )}
            <button 
              onClick={onClose}
              aria-label="Đóng bài trắc nghiệm"
              className="text-gray-400 hover:text-white"
            >
              <X size={20}/>
            </button>
          </div>
        </div>
        
        {/* Question List */}
        <div className="p-4 sm:p-5 overflow-y-auto min-h-0 flex-1 space-y-5">
          {!questions.length && <p className="text-sm text-gray-500">Chưa có câu hỏi. Hãy tạo bộ học tập để bắt đầu.</p>}
          {questions.map((q, idx) => (
            <div key={idx} className="bg-white/[0.03] p-4 rounded-xl border border-white/10">
              <p id={`quiz-question-${idx}`} className={`font-semibold text-sm mb-3 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{idx + 1}. {q?.question || 'Câu hỏi thiếu nội dung'}</p>
              <div className="space-y-2" role="group" aria-labelledby={`quiz-question-${idx}`}>
                {(Array.isArray(q?.options) ? q.options : []).map((opt, oIdx) => {
                  const isSelected = quizAnswers[idx] === oIdx;
                  const isCorrect = correctAnswer(q) === oIdx;
                  let btnClass = "w-full text-left p-2.5 rounded-lg border text-xs transition-all ";
                  
                  if (!quizSubmitted) {
                    btnClass += isSelected ? `border-blue-500 bg-blue-500/20 ${isDark ? 'text-white' : 'text-blue-900'}` : isDark ? "border-white/10 hover:bg-white/10 text-gray-300" : "border-gray-200 hover:bg-gray-100 text-gray-700";
                  } else {
                    if (isCorrect) btnClass += `border-green-500 bg-green-500/20 ${isDark ? 'text-white' : 'text-green-900'}`;
                    else if (isSelected && correctAnswer(q) === null) btnClass += "border-amber-500 bg-amber-500/10 text-amber-500";
                    else if (isSelected && !isCorrect) btnClass += `border-red-500 bg-red-500/20 ${isDark ? 'text-white' : 'text-red-900'}`;
                    else btnClass += "border-white/5 text-gray-500 opacity-40";
                  }

                  return (
                    <button 
                      key={oIdx} 
                      type="button"
                      aria-pressed={isSelected}
                      disabled={quizSubmitted}
                      onClick={() => setQuizAnswers(prev => ({...prev, [idx]: oIdx}))}
                      className={btnClass}
                    >
                      <div className="flex justify-between items-center">
                        <span>{opt}</span>
                        {quizSubmitted && isCorrect && <Check size={14} className="text-green-400" />}
                        {quizSubmitted && isSelected && !isCorrect && correctAnswer(q) !== null && <XCircle size={14} className="text-red-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {quizSubmitted && correctAnswer(q) === null && <p className="text-xs text-amber-500 mt-3">Câu này chưa có đáp án hợp lệ để chấm.</p>}
              {quizSubmitted && typeof q?.explanation === 'string' && <p className="mt-3 text-xs text-gray-500 leading-relaxed">{q.explanation}</p>}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className={`p-4 border-t border-white/10 flex flex-wrap shrink-0 gap-3 justify-between items-center ${isDark ? 'bg-black/20' : 'bg-gray-50'}`}>
          <p role="status" className="text-xs text-gray-500">{quizSubmitted ? `Đúng ${correct}/${gradable} câu có đáp án${gradable < questions.length ? `; ${questions.length - gradable} câu chưa chấm` : ''}.` : `Đã trả lời ${answered}/${questions.length} câu.`}</p>
          {!quizSubmitted ? (
            <button 
              onClick={() => { if (questions.length > 0 && answered === questions.length) setQuizSubmitted(true); }}
              disabled={!questions.length || answered !== questions.length}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition"
            >
              Nộp bài chấm điểm
            </button>
          ) : (
            <button 
              onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }}
              className={`px-5 py-2 rounded-xl text-xs font-semibold transition ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
            >
              Làm lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
