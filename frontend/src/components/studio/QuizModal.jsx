import React from 'react';
import { Brain, Printer, SlidersHorizontal, X, Check, XCircle } from 'lucide-react';

export default function QuizModal({
  isOpen,
  onClose,
  quiz = [],
  quizAnswers = {},
  setQuizAnswers,
  quizSubmitted,
  setQuizSubmitted,
  onOpenConfig,
  onPrintExam
}) {
  if (!isOpen || !quiz || quiz.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] border border-blue-500/30 w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-blue-500/10">
          <h2 className="text-base font-bold flex items-center gap-2 text-white">
            <Brain className="text-blue-400" size={18} /> Ôn tập trắc nghiệm ({quiz.length} câu)
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
              onClick={() => { onClose(); setQuizAnswers({}); setQuizSubmitted(false); }} 
              className="text-gray-400 hover:text-white"
            >
              <X size={20}/>
            </button>
          </div>
        </div>
        
        {/* Question List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 scrollbar-hide">
          {quiz.map((q, idx) => (
            <div key={idx} className="bg-white/[0.03] p-4 rounded-xl border border-white/10">
              <p className="font-semibold text-sm mb-3 text-gray-100">{idx + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oIdx) => {
                  const isSelected = quizAnswers[idx] === oIdx;
                  const isCorrect = q.answer === oIdx;
                  let btnClass = "w-full text-left p-2.5 rounded-lg border text-xs transition-all ";
                  
                  if (!quizSubmitted) {
                    btnClass += isSelected ? "border-blue-500 bg-blue-500/20 text-white" : "border-white/10 hover:bg-white/10 text-gray-300";
                  } else {
                    if (isCorrect) btnClass += "border-green-500 bg-green-500/20 text-white";
                    else if (isSelected && !isCorrect) btnClass += "border-red-500 bg-red-500/20 text-white";
                    else btnClass += "border-white/5 text-gray-500 opacity-40";
                  }

                  return (
                    <button 
                      key={oIdx} 
                      disabled={quizSubmitted}
                      onClick={() => setQuizAnswers({...quizAnswers, [idx]: oIdx})}
                      className={btnClass}
                    >
                      <div className="flex justify-between items-center">
                        <span>{opt}</span>
                        {quizSubmitted && isCorrect && <Check size={14} className="text-green-400" />}
                        {quizSubmitted && isSelected && !isCorrect && <XCircle size={14} className="text-red-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
          {!quizSubmitted ? (
            <button 
              onClick={() => setQuizSubmitted(true)}
              disabled={Object.keys(quizAnswers).length !== quiz.length}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition"
            >
              Nộp bài chấm điểm
            </button>
          ) : (
            <button 
              onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
            >
              Làm lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
