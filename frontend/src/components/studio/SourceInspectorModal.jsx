import { useRef } from 'react';
import { Eye, Loader, X } from 'lucide-react';
import useDialog from '../../hooks/useDialog';

export default function SourceInspectorModal({
  isOpen,
  onClose,
  inspectDoc,
  docChunks = [],
  chunkSearch = '',
  setChunkSearch,
  loadingChunks = false,
  isDark = true
}) {
  const dialogRef = useRef(null);
  useDialog(dialogRef, onClose, isOpen && !!inspectDoc);
  if (!isOpen || !inspectDoc) return null;

  const chunks = Array.isArray(docChunks) ? docChunks.filter(Boolean) : [];
  const search = chunkSearch.trim().toLocaleLowerCase();
  const filteredChunks = chunks.map((chunk, index) => ({ ...chunk, sourceIndex: index + 1 })).filter(c =>
    !search || (typeof c.content === 'string' && c.content.toLocaleLowerCase().includes(search))
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Chi tiết nguồn ${inspectDoc}`} tabIndex={-1} className={`rounded-2xl max-w-3xl w-full max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl border overflow-hidden ${isDark ? 'bg-[#181a20] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
        <div className="p-4 bg-white/[0.03] border-b border-white/10 flex shrink-0 gap-3 items-center justify-between">
          <div className="flex items-center space-x-2.5 truncate">
            <Eye className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <h3 className="font-bold text-sm truncate">Các đoạn văn bản: {inspectDoc}</h3>
              <p className="text-[11px] text-gray-500" role="status">{search ? `Tìm thấy ${filteredChunks.length}/${chunks.length} đoạn` : `Tổng cộng ${chunks.length} đoạn văn bản`}</p>
            </div>
          </div>
          <button type="button" aria-label="Đóng chi tiết nguồn" onClick={onClose} className="p-2 text-gray-500 hover:text-emerald-500 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 border-b border-white/10 bg-white/[0.02] shrink-0">
          <input
             type="text"
             aria-label="Tìm trong các đoạn văn bản"
            value={chunkSearch}
            onChange={(e) => setChunkSearch(e.target.value)}
            placeholder="Lọc nhanh nội dung chunk theo từ khóa..."
             className={`w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-blue-500 ${isDark ? 'bg-black/40 text-white border-white/15' : 'bg-gray-50 text-gray-900 border-gray-200'}`}
          />
        </div>

        <div className="p-4 overflow-y-auto min-h-0 flex-1 space-y-3">
          {loadingChunks ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              <Loader className="w-5 h-5 animate-spin mr-2 text-blue-500" /> Đang tải các đoạn văn bản...
            </div>
          ) : chunks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">Không tìm thấy chunk nào cho tài liệu này.</div>
          ) : filteredChunks.length === 0 ? (
            <p className="text-center py-12 text-gray-500 text-xs">Không có đoạn văn bản nào khớp từ khóa.</p>
          ) : (
            filteredChunks.map((chunk, i) => (
              <div key={chunk.chunk_id || i} className="bg-white/[0.03] p-3.5 rounded-xl border border-white/10 shadow-sm">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5 pb-1.5 border-b border-white/5">
                  <span className="font-semibold text-blue-500">Đoạn #{chunk.sourceIndex} ({chunk.type || 'text'})</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {chunk.breadcrumbs && (
                      <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-300 max-w-[200px] truncate" title={chunk.breadcrumbs}>
                        {Array.isArray(chunk.breadcrumbs) ? chunk.breadcrumbs.join(' / ') : chunk.breadcrumbs}
                      </span>
                    )}
                    <span>Trang: {chunk.page ?? 'Chưa có'} • {(chunk.content || '').length} ký tự</span>
                  </div>
                </div>
                <pre className={`text-xs whitespace-pre-wrap break-words font-sans leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{chunk.content}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
