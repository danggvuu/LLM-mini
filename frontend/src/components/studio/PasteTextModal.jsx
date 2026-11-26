import { useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import useDialog from '../../hooks/useDialog';
import { getErrorMessage } from '../../lib/api';

export default function PasteTextModal({
  isOpen,
  onClose,
  pasteTitle,
  setPasteTitle,
  pasteContent,
  setPasteContent,
  onSubmit,
  isDark = true
}) {
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useDialog(dialogRef, onClose, isOpen);
  const handleSubmit = async () => {
    if (submittingRef.current || !pasteContent?.trim()) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      if (await onSubmit() === false) setError('Chưa nạp được văn bản. Nội dung vẫn được giữ để thử lại.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không nạp được văn bản. Vui lòng thử lại.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Thêm nguồn từ văn bản" tabIndex={-1} className={`border w-full max-w-lg max-h-[calc(100dvh-2rem)] rounded-3xl shadow-2xl overflow-y-auto p-4 sm:p-6 space-y-4 ${isDark ? 'bg-[#181a20] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <h3 className="font-bold text-base flex items-center gap-2">
            <FileText size={18} className="text-blue-400" /> Dán văn bản / Ghi chú trực tiếp
          </h3>
          <button type="button" aria-label="Đóng cửa sổ thêm văn bản" onClick={onClose} className="text-gray-500 hover:text-blue-500 p-2 shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label htmlFor="paste-source-title" className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Tiêu đề nguồn (Tùy chọn):</label>
            <input
              type="text"
              id="paste-source-title"
              disabled={submitting}
              value={pasteTitle ?? ''}
              onChange={e => setPasteTitle(e.target.value)}
              placeholder="VD: Ghi chú họp, Bài báo khoa học..."
              className={`w-full border rounded-xl px-3.5 py-2 outline-none focus:border-blue-500 ${isDark ? 'bg-black/40 border-white/15 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
            />
          </div>
          <div>
            <label htmlFor="paste-source-content" className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Nội dung văn bản:</label>
            <textarea
              rows={8}
              id="paste-source-content"
              disabled={submitting}
              value={pasteContent ?? ''}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="Dán nội dung văn bản hoặc Markdown vào đây..."
              className={`w-full border rounded-xl p-3.5 outline-none focus:border-blue-500 resize-none ${isDark ? 'bg-black/40 border-white/15 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
            />
          </div>
        </div>
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-blue-500"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !pasteContent?.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition"
          >
            {submitting ? 'Đang nạp...' : 'Nạp vào Sổ tay'}
          </button>
        </div>
      </div>
    </div>
  );
}
