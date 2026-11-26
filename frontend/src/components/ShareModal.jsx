import { useState, useEffect, useRef } from 'react';
import { X, Share2, Copy, Check, Download, BookOpen, Link, FileJson } from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { getErrorMessage } from '../lib/api';

export default function ShareModal({ isOpen, onClose, notebook, studyGuide, onExportJson, isDark = true }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const pendingRef = useRef(false);
  const copiedTimerRef = useRef(null);
  useDialog(dialogRef, onClose, isOpen);
  useEffect(() => {
    setCopiedLink(false);
    setCopiedSummary(false);
    setError('');
    return () => clearTimeout(copiedTimerRef.current);
  }, [isOpen, notebook?.id, studyGuide]);

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const copyText = async (text, kind) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(kind);
    setError('');
    setCopiedLink(false);
    setCopiedSummary(false);
    try {
      await navigator.clipboard.writeText(text);
      if (kind === 'link') setCopiedLink(true);
      else setCopiedSummary(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => { setCopiedLink(false); setCopiedSummary(false); }, 2000);
    } catch {
      setError('Không sao chép được. Hãy kiểm tra quyền truy cập bộ nhớ tạm của trình duyệt.');
    } finally {
      pendingRef.current = false;
      setPending('');
    }
  };

  const handleCopySummary = () => {
    if (!studyGuide) return;
    const text = `# ${notebook?.title || "NotebookLM Sổ tay"}\n\n## Tóm tắt Cốt lõi\n${studyGuide.summary || ""}\n\n## Thuật ngữ Quan trọng\n${studyGuide.glossary || ""}\n\n## Câu hỏi ôn tập\n${studyGuide.faq || ""}`;
    return copyText(text, 'summary');
  };

  const handleExport = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending('export');
    setError('');
    try {
      if (await onExportJson() === false) setError('Chưa xuất được dữ liệu. Vui lòng thử lại.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không xuất được dữ liệu.'));
    } finally {
      pendingRef.current = false;
      setPending('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Chia sẻ và xuất sổ tay" tabIndex={-1} className={`w-full max-w-lg max-h-[calc(100dvh-2rem)] rounded-3xl shadow-2xl border overflow-y-auto p-4 sm:p-6 transition-colors ${
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
             aria-label="Đóng chia sẻ sổ tay"
             className="text-gray-500 hover:text-blue-500 p-2 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 my-5">
          {/* Option 1: Share Link */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Link size={14} className="text-blue-400" /> Liên kết trực tiếp tới Sổ tay:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label="Liên kết sổ tay"
                readOnly
                value={currentUrl}
                className={`min-w-0 w-full text-xs px-3 py-2 rounded-xl font-mono border outline-none select-all ${isDark ? 'bg-black/40 text-gray-300 border-white/10' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
              />
              <button
                onClick={() => copyText(currentUrl, 'link')}
                disabled={!!pending}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1"
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? "Đã chép" : "Chép link"}</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-500">Liên kết mở sổ tay trên máy chủ hiện tại; người nhận cần truy cập được máy chủ này.</p>
          </div>

          {/* Option 2: Export JSON Bundle */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                <FileJson size={14} className="text-green-400" /> Xuất bản sao lưu dữ liệu (.json)
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Gồm thông tin nguồn, lịch sử chat, cẩm nang và tiến độ học. Tệp nguồn gốc không nằm trong bản JSON.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={!!pending || !onExportJson}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 shadow"
            >
              <Download size={14} />
              <span>{pending === 'export' ? 'Đang xuất...' : 'Tải .json'}</span>
            </button>
          </div>

          {/* Option 3: Copy Study Guide Markdown */}
          {studyGuide && (
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  <BookOpen size={14} className="text-purple-400" /> Sao chép Cẩm nang tóm tắt
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Dạng văn bản Markdown hoàn chỉnh để gửi qua tin nhắn hoặc in ấn.
                </p>
              </div>
              <button
                 onClick={handleCopySummary}
                 disabled={!!pending}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 shadow"
              >
                {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedSummary ? "Đã chép" : "Chép tóm tắt"}</span>
              </button>
            </div>
          )}
        </div>
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-semibold transition ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
