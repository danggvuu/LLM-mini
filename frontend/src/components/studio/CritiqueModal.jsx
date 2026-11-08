import React from 'react';
import { ShieldAlert, Sparkles, ClipboardCheck, BookmarkPlus, Copy, X, Loader } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';

export default function CritiqueModal({
  isOpen,
  onClose,
  critiqueModal,
  onPinNote,
  onShowToast,
  isDark = true
}) {
  if (!isOpen || !critiqueModal.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-white/15 overflow-hidden">
        <div className={`p-4 border-b border-white/10 flex items-center justify-between ${
          critiqueModal.type === 'critique' 
            ? 'bg-rose-500/10' 
            : critiqueModal.type === 'synthesis'
            ? 'bg-purple-500/10'
            : 'bg-lime-500/10'
        }`}>
          <div className="flex items-center space-x-2.5 truncate">
            {critiqueModal.type === 'critique' ? (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            ) : critiqueModal.type === 'synthesis' ? (
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
            ) : (
              <ClipboardCheck className="w-5 h-5 text-lime-400 shrink-0" />
            )}
            <h3 className="font-bold text-sm text-white truncate">{critiqueModal.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {critiqueModal.content && !critiqueModal.loading && (
              <>
                {onPinNote && (
                  <button 
                    type="button"
                    onClick={() => onPinNote(critiqueModal.content, critiqueModal.title, critiqueModal.type)}
                    className="p-1.5 text-gray-400 hover:text-amber-300 rounded-lg hover:bg-white/10 transition flex items-center gap-1 text-xs cursor-pointer"
                    title="Ghim vào Bảng Ghi chú"
                  >
                    <BookmarkPlus size={16} />
                    <span className="hidden sm:inline">Ghim</span>
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(critiqueModal.content);
                    onShowToast && onShowToast("📋 Đã sao chép nội dung vào Clipboard!");
                  }}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                  title="Sao chép nội dung"
                >
                  <Copy size={16} />
                </button>
              </>
            )}
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 text-gray-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 scrollbar-hide text-sm text-gray-200">
          {critiqueModal.loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Loader className="w-7 h-7 animate-spin text-purple-400" />
              <p className="text-xs">Đang đọc tài liệu và phân tích chuyên sâu...</p>
            </div>
          ) : (
            <MarkdownRenderer content={critiqueModal.content} isDark={isDark} />
          )}
        </div>
      </div>
    </div>
  );
}
