import React, { useState } from 'react';
import { X, Share2, Copy, Check, Download, BookOpen, Link, FileJson } from 'lucide-react';

export default function ShareModal({ isOpen, onClose, notebook, studyGuide, onExportJson, isDark = true }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopySummary = () => {
    if (!studyGuide) return;
    const text = `# ${notebook?.title || "NotebookLM Sổ tay"}\n\n## Tóm tắt Cốt lõi\n${studyGuide.summary || ""}\n\n## Thuật ngữ Quan trọng\n${studyGuide.glossary || ""}\n\n## Câu hỏi ôn tập\n${studyGuide.faq || ""}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className={`w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden p-6 transition-colors ${
        isDark ? 'bg-[#181a20] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold">Chia sẻ & Xuất Sổ tay</h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{notebook?.title || "Sổ tay nghiên cứu"}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 my-5">
          {/* Option 1: Share Link */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Link size={14} className="text-blue-400" /> Liên kết trực tiếp tới Sổ tay:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="w-full bg-black/40 text-xs px-3 py-2 rounded-xl text-gray-300 font-mono border border-white/10 outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1"
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? "Đã chép" : "Chép link"}</span>
              </button>
            </div>
          </div>

          {/* Option 2: Export JSON Bundle */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <FileJson size={14} className="text-green-400" /> Xuất bản sao lưu dữ liệu (.json)
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Bao gồm tài liệu, lịch sử chat, cẩm nang, thẻ Quizlet & tiến độ học.
              </p>
            </div>
            <button
              onClick={onExportJson}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 shadow"
            >
              <Download size={14} />
              <span>Tải .json</span>
            </button>
          </div>

          {/* Option 3: Copy Study Guide Markdown */}
          {studyGuide && (
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-purple-400" /> Sao chép Cẩm nang tóm tắt
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Dạng văn bản Markdown hoàn chỉnh để gửi qua tin nhắn hoặc in ấn.
                </p>
              </div>
              <button
                onClick={handleCopySummary}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 shadow"
              >
                {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedSummary ? "Đã chép" : "Chép tóm tắt"}</span>
              </button>
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
