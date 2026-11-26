import { useRef, useState } from 'react';
import { ShieldAlert, Sparkles, ClipboardCheck, BookmarkPlus, Copy, X, Loader } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import useDialog from '../../hooks/useDialog';
import { getErrorMessage } from '../../lib/api';

export default function CritiqueModal({
  isOpen,
  onClose,
  critiqueModal,
  onPinNote,
  onShowToast,
  isDark = true
}) {
  const dialogRef = useRef(null);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  useDialog(dialogRef, onClose, isOpen && !!critiqueModal?.isOpen);
  if (!isOpen || !critiqueModal?.isOpen) return null;

  const runAction = async (action) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(action);
    setError('');
    try {
      if (action === 'copy') {
        await navigator.clipboard.writeText(critiqueModal.content);
        onShowToast?.('Đã sao chép nội dung.');
      } else if (await onPinNote(critiqueModal.content, critiqueModal.title, critiqueModal.type) === false) {
        setError('Chưa ghim được nội dung. Vui lòng thử lại.');
      }
    } catch (err) {
      setError(action === 'copy' ? 'Không sao chép được nội dung. Hãy chọn và chép trực tiếp.' : getErrorMessage(err, 'Không ghim được nội dung.'));
    } finally {
      pendingRef.current = false;
      setPending('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={critiqueModal.title || 'Phân tích tài liệu'} tabIndex={-1} className={`rounded-2xl max-w-3xl w-full max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl border overflow-hidden ${isDark ? 'bg-[#181a20] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
        <div className={`p-4 border-b border-white/10 shrink-0 flex flex-wrap gap-3 items-center justify-between ${
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
            <h3 className="font-bold text-sm truncate">{critiqueModal.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {critiqueModal.content && !critiqueModal.loading && (
              <>
                {onPinNote && (
                  <button 
                    type="button"
                    onClick={() => runAction('pin')}
                    disabled={!!pending}
                    className="p-1.5 text-gray-400 hover:text-amber-300 rounded-lg hover:bg-white/10 transition flex items-center gap-1 text-xs cursor-pointer"
                    title="Ghim vào Bảng Ghi chú"
                  >
                    <BookmarkPlus size={16} />
                    <span className="hidden sm:inline">Ghim</span>
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => runAction('copy')}
                  disabled={!!pending}
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
               aria-label="Đóng phân tích tài liệu"
              className="p-1.5 text-gray-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && <p role="alert" className="px-4 pt-3 text-xs text-red-400 shrink-0">{error}</p>}
        <div className="p-4 sm:p-5 overflow-y-auto min-h-0 flex-1 text-sm">
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
