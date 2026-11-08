import React from 'react';
import { Eye, Loader, X } from 'lucide-react';

export default function SourceInspectorModal({
  isOpen,
  onClose,
  inspectDoc,
  docChunks = [],
  chunkSearch = '',
  setChunkSearch,
  loadingChunks = false
}) {
  if (!isOpen || !inspectDoc) return null;

  const filteredChunks = docChunks.filter(c => 
    !chunkSearch.trim() || (c.content && c.content.toLowerCase().includes(chunkSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-white/15 overflow-hidden">
        <div className="p-4 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 truncate">
            <Eye className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <h3 className="font-bold text-sm text-white truncate">Chi tiết Phân mảnh (Chunks): {inspectDoc}</h3>
              <p className="text-[11px] text-gray-400">Tổng cộng {docChunks.length} đoạn dữ liệu đã lưu trong Vector & BM25</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 border-b border-white/10 bg-white/[0.02]">
          <input
            type="text"
            value={chunkSearch}
            onChange={(e) => setChunkSearch(e.target.value)}
            placeholder="Lọc nhanh nội dung chunk theo từ khóa..."
            className="w-full px-3 py-1.5 text-xs bg-black/40 text-white border border-white/15 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3 scrollbar-hide">
          {loadingChunks ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              <Loader className="w-5 h-5 animate-spin mr-2 text-blue-500" /> Đang tải các đoạn văn bản...
            </div>
          ) : docChunks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">Không tìm thấy chunk nào cho tài liệu này.</div>
          ) : (
            filteredChunks.map((chunk, i) => (
              <div key={chunk.chunk_id || i} className="bg-white/[0.03] p-3.5 rounded-xl border border-white/10 shadow-sm">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5 pb-1.5 border-b border-white/5">
                  <span className="font-semibold text-blue-400">Chunk #{i + 1} ({chunk.type || 'text'})</span>
                  <div className="flex items-center gap-2">
                    {chunk.breadcrumbs && (
                      <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-300 max-w-[200px] truncate" title={chunk.breadcrumbs}>
                        {chunk.breadcrumbs}
                      </span>
                    )}
                    <span>Trang: {chunk.page || 1} • {(chunk.content || '').length} ký tự</span>
                  </div>
                </div>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{chunk.content}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
