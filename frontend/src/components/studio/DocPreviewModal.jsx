import { useRef, useState } from 'react';
import { FileText, Loader, Trash2, X } from 'lucide-react';
import useDialog from '../../hooks/useDialog';
import { getErrorMessage } from '../../lib/api';

export default function DocPreviewModal({
  isOpen,
  onClose,
  previewDoc,
  loadingPreview,
  highlightSnippet,
  setHighlightSnippet,
  onDeleteDocument,
  isDark = true
}) {
  const dialogRef = useRef(null);
  const deletingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  useDialog(dialogRef, onClose, isOpen && !!previewDoc);
  if (!isOpen || !previewDoc) return null;

  const handleDelete = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setError('');
    try {
      if (await onDeleteDocument(previewDoc.filename) !== false) onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Không xóa được tài liệu.'));
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Xem tài liệu ${previewDoc.filename}`} tabIndex={-1} className={`border w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#181a20] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex shrink-0 justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <FileText className="text-blue-400 shrink-0" size={18} />
            <h3 className="font-semibold text-sm truncate" title={previewDoc.filename}>
              {previewDoc.filename}
            </h3>
          </div>
          <button 
             onClick={onClose}
             aria-label="Đóng xem tài liệu"
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick stats */}
        <div className={`px-5 py-2.5 border-b border-white/10 flex flex-wrap shrink-0 gap-3 text-xs text-gray-500 ${isDark ? 'bg-black/30' : 'bg-gray-50'}`}>
          <div>Đoạn phân rã (Chunks): <span className="font-mono text-blue-400 font-bold">{previewDoc.chunk_count || 0}</span></div>
          <div>Ký tự trích xuất: <span className="font-mono text-green-400 font-bold">{previewDoc.character_count?.toLocaleString() || 0}</span></div>
        </div>

        {/* Highlighted Citation Snippet if opened from a Citation click */}
        {highlightSnippet && (
          <div className="mx-4 mt-4 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs shrink-0 max-h-[25dvh] overflow-y-auto space-y-1">
            <div className="font-bold text-blue-400 uppercase tracking-wider text-[10px] flex items-center justify-between">
              <span>Đoạn trích dẫn được AI sử dụng:</span>
              <button type="button" aria-label="Ẩn đoạn trích dẫn" onClick={() => setHighlightSnippet?.(null)} className="text-gray-500 hover:text-blue-500 p-1"><X size={14} /></button>
            </div>
            <p className={`leading-relaxed italic ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>"{highlightSnippet}"</p>
          </div>
        )}

        {/* Content body */}
        {error && <p role="alert" className="px-4 pt-3 text-xs text-red-400 shrink-0">{error}</p>}
        <div className={`p-4 sm:p-5 overflow-y-auto min-h-0 flex-1 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words select-text ${isDark ? 'bg-[#121316] text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
          {loadingPreview ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400 font-sans">
              <Loader size={18} className="animate-spin text-blue-400" />
              <span>Đang trích xuất dữ liệu từ bộ nhớ vector...</span>
            </div>
          ) : (
            previewDoc.preview_text || "Không có nội dung hiển thị."
          )}
        </div>

        <div className={`p-3.5 border-t border-white/10 flex flex-wrap shrink-0 gap-3 justify-between items-center ${isDark ? 'bg-black/20' : 'bg-gray-50'}`}>
          {onDeleteDocument ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || loadingPreview}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Trash2 size={13} /> {deleting ? 'Đang xóa...' : 'Xóa tài liệu này'}
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-1.5 rounded-xl text-xs font-semibold transition ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
