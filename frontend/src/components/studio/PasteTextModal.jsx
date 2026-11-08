import React from 'react';
import { FileText, X } from 'lucide-react';

export default function PasteTextModal({
  isOpen,
  onClose,
  pasteTitle,
  setPasteTitle,
  pasteContent,
  setPasteContent,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] border border-white/15 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <FileText size={18} className="text-blue-400" /> Dán văn bản / Ghi chú trực tiếp
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-gray-300 mb-1">Tiêu đề nguồn (Tùy chọn):</label>
            <input
              type="text"
              value={pasteTitle}
              onChange={e => setPasteTitle(e.target.value)}
              placeholder="VD: Ghi chú họp, Bài báo khoa học..."
              className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-300 mb-1">Nội dung văn bản:</label>
            <textarea
              rows={8}
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="Dán nội dung văn bản hoặc Markdown vào đây..."
              className="w-full bg-black/40 border border-white/15 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
          >
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={!pasteContent.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition"
          >
            Nạp vào Sổ tay
          </button>
        </div>
      </div>
    </div>
  );
}
