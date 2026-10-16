import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

export default function ShortcutsModal({ isOpen, onClose, isDark = true }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Ctrl / ⌘ + Enter", desc: "Gửi tin nhắn trong khung trò chuyện" },
    { key: "Ctrl / ⌘ + B", desc: "Ẩn / Hiện thanh Nguồn tài liệu bên trái" },
    { key: "Ctrl / ⌘ + J", desc: "Ẩn / Hiện thanh Studio Học tập bên phải" },
    { key: "Ctrl / ⌘ + K", desc: "Mở bảng chọn nhanh Mô hình AI (Model Picker)" },
    { key: "Ctrl / ⌘ + F", desc: "Mở thanh tìm kiếm tin nhắn trong lịch sử chat" },
    { key: "Ctrl / ⌘ + /", desc: "Tập trung con trỏ (Focus) vào ô nhập tin nhắn" },
    { key: "Ctrl / ⌘ + Shift + S", desc: "Mở Cài đặt hệ thống (Settings)" },
    { key: "Ctrl / ⌘ + Shift + Q", desc: "Mở Bộ thẻ ghi nhớ & Ôn tập Quizlet" },
    { key: "Escape", desc: "Đóng cửa sổ modal đang mở / Dừng tạo câu trả lời" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className={`w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden p-6 transition-colors ${
        isDark ? 'bg-[#181a20] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Keyboard size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold">Phím tắt nhanh (Shortcuts)</h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Tăng tốc độ thao tác trên NotebookLM</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="divide-y divide-white/10 my-4">
          {shortcuts.map((sc, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{sc.desc}</span>
              <kbd className="px-2.5 py-1 rounded-lg font-mono text-[11px] bg-white/10 border border-white/15 text-purple-300 font-bold shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
