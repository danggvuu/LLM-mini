import React from 'react';
import { FileText, Loader, Trash2, X } from 'lucide-react';

export default function DocPreviewModal({
  isOpen,
  onClose,
  previewDoc,
  loadingPreview,
  highlightSnippet,
  setHighlightSnippet,
  onDeleteDocument
}) {
  if (!isOpen || !previewDoc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] border border-white/15 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <FileText className="text-blue-400 shrink-0" size={18} />
            <h3 className="font-semibold text-sm truncate text-white" title={previewDoc.filename}>
              {previewDoc.filename}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick stats */}
        <div className="px-5 py-2.5 bg-black/30 border-b border-white/10 flex gap-6 text-xs text-gray-400">
          <div>Đoạn phân rã (Chunks): <span className="font-mono text-blue-400 font-bold">{previewDoc.chunk_count || 0}</span></div>
          <div>Ký tự trích xuất: <span className="font-mono text-green-400 font-bold">{previewDoc.character_count?.toLocaleString() || 0}</span></div>
        </div>

        {/* Highlighted Citation Snippet if opened from a Citation click */}
        {highlightSnippet && (
          <div className="mx-5 mt-4 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 space-y-1">
            <div className="font-bold text-blue-400 uppercase tracking-wider text-[10px] flex items-center justify-between">
              <span>✨ Đoạn trích dẫn được AI sử dụng:</span>
              <button onClick={() => setHighlightSnippet && setHighlightSnippet(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <p className="leading-relaxed italic text-gray-200">"{highlightSnippet}..."</p>
          </div>
        )}

        {/* Content body */}
        <div className="p-5 overflow-y-auto flex-1 font-mono text-xs text-gray-300 leading-relaxed whitespace-pre-wrap select-text bg-[#121316] scrollbar-hide">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400 font-sans">
              <Loader size={18} className="animate-spin text-blue-400" />
              <span>Đang trích xuất dữ liệu từ bộ nhớ vector...</span>
            </div>
          ) : (
            previewDoc.preview_text || "Không có nội dung hiển thị."
          )}
        </div>

        <div className="p-3.5 border-t border-white/10 bg-black/20 flex justify-between items-center">
          {onDeleteDocument ? (
            <button
              type="button"
              onClick={() => {
                onDeleteDocument(previewDoc.filename);
                onClose();
              }}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Trash2 size={13} /> Xóa tài liệu này
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white px-5 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
