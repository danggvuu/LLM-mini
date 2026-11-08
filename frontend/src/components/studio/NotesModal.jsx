import React from 'react';
import { Bookmark, Sparkles, Loader, X, Plus, Copy, Trash2 } from 'lucide-react';

export default function NotesModal({
  isOpen,
  onClose,
  pinnedNotes = [],
  newNoteTitle,
  setNewNoteTitle,
  newNoteContent,
  setNewNoteContent,
  onAddNote,
  savingNote,
  onDeleteNote,
  onSynthesizeNotes,
  isSynthesizingNotes,
  onConvertNoteToSource,
  convertingNoteId,
  onShowToast,
  isDark = true
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className={`rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border overflow-hidden ${
        isDark ? 'bg-[#181a20] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? 'border-white/10 bg-amber-500/10' : 'border-slate-200 bg-amber-50'
        }`}>
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base">Bảng Ghi chú Nghiên cứu ({pinnedNotes.length})</h3>
          </div>
          <div className="flex items-center gap-2">
            {pinnedNotes.length >= 2 && (
              <button
                type="button"
                onClick={onSynthesizeNotes}
                disabled={isSynthesizingNotes}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow transition disabled:opacity-50 cursor-pointer"
                title="Tổng hợp các ghi chú thành Báo cáo chuyên đề AI"
              >
                {isSynthesizingNotes ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isSynthesizingNotes ? 'Đang tổng hợp...' : '✨ Tổng hợp Báo cáo AI'}</span>
              </button>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className={`p-1.5 rounded-lg transition cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Input new note */}
        <div className={`p-4 border-b space-y-2.5 ${isDark ? 'border-white/10 bg-white/[0.01]' : 'border-slate-200 bg-slate-50/50'}`}>
          <input 
            type="text"
            value={newNoteTitle}
            onChange={e => setNewNoteTitle(e.target.value)}
            placeholder="Tiêu đề ghi chú mới (tùy chọn)..."
            className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
              isDark ? 'bg-black/40 border-white/10 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
          <div className="flex gap-2">
            <textarea
              value={newNoteContent}
              onChange={e => setNewNoteContent(e.target.value)}
              placeholder="Viết ghi chú cá nhân hoặc nhận định của bạn..."
              rows={2}
              className={`flex-1 px-3 py-2 text-xs rounded-xl border outline-none resize-none ${
                isDark ? 'bg-black/40 border-white/10 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
            <button
              type="button"
              onClick={onAddNote}
              disabled={savingNote || !newNoteContent.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold self-end transition disabled:opacity-50 cursor-pointer shadow"
            >
              {savingNote ? 'Đang lưu...' : 'Thêm'}
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 scrollbar-hide">
          {pinnedNotes.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs leading-relaxed">
              <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
              Chưa có ghi chú nào được ghim.<br />Hãy bấm biểu tượng ghim trên tin nhắn AI hoặc Studio tools để lưu lại!
            </div>
          ) : (
            pinnedNotes.map((note) => (
              <div 
                key={note.id}
                className={`p-3.5 rounded-xl border transition ${
                  isDark ? 'bg-white/[0.03] border-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-amber-500 truncate max-w-[200px]">{note.title || 'Ghi chú'}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">{note.created_at}</span>
                    <button
                      type="button"
                      onClick={() => onConvertNoteToSource(note)}
                      disabled={convertingNoteId === note.id}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                      title="Chuyển ghi chú này thành tài liệu nguồn RAG"
                    >
                      {convertingNoteId === note.id ? (
                        <Loader className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Plus size={11} />
                      )}
                      <span>Thành nguồn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(note.content);
                        onShowToast && onShowToast("📋 Đã sao chép ghi chú!");
                      }}
                      className={`p-1 rounded cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                      title="Sao chép"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      className={`p-1 rounded cursor-pointer ${isDark ? 'text-gray-400 hover:text-red-400' : 'text-slate-500 hover:text-red-600'}`}
                      title="Xóa ghi chú"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className={`text-xs whitespace-pre-wrap leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  {note.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
