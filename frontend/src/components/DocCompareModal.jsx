import React, { useState } from 'react';
import { X, Scale, FileText, Check, Copy, Download, Loader, Sparkles, AlertCircle } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export default function DocCompareModal({ 
  isOpen, 
  onClose, 
  documents = [], 
  onCompare, 
  comparisonResult, 
  comparing, 
  isDark = true 
}) {
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [focusTopic, setFocusTopic] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const toggleDoc = (filename) => {
    setSelectedDocs(prev => 
      prev.includes(filename) ? prev.filter(f => f !== filename) : [...prev, filename]
    );
  };

  const selectAll = () => {
    setSelectedDocs(documents.map(d => d.filename));
  };

  const handleStartCompare = () => {
    if (selectedDocs.length < 2) return;
    onCompare(selectedDocs, focusTopic);
  };

  const handleCopy = () => {
    if (!comparisonResult) return;
    navigator.clipboard.writeText(comparisonResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!comparisonResult) return;
    const blob = new Blob([comparisonResult], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `so-sanh-tai-lieu-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className={`w-full max-w-4xl h-[88vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden transition-colors ${
        isDark ? 'bg-[#14151a] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl text-white shadow-md">
              <Scale size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                So sánh & Đối chiếu Tài liệu
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Multi-Doc Analysis
                </span>
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Đối chiếu tương đồng, dị biệt và tổng hợp luận điểm giữa nhiều nguồn tài liệu
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-black'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Document Selection Strip */}
        <div className={`p-4 border-b space-y-3 ${
          isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50/70 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <span>Chọn tài liệu đối chiếu (Tối thiểu 2):</span>
              <span className="text-amber-400 font-mono">({selectedDocs.length}/{documents.length})</span>
            </span>
            <button
              onClick={selectAll}
              className="text-[11px] text-blue-400 hover:underline font-medium"
            >
              Chọn tất cả
            </button>
          </div>

          {/* Doc Pills */}
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto scrollbar-hide">
            {documents.length === 0 ? (
              <span className="text-xs text-gray-400 italic">Chưa có tài liệu nào trong sổ tay để so sánh.</span>
            ) : (
              documents.map(doc => {
                const isSelected = selectedDocs.includes(doc.filename);
                return (
                  <button
                    key={doc.filename}
                    onClick={() => toggleDoc(doc.filename)}
                    type="button"
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition ${
                      isSelected 
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-sm'
                        : isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-black'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                      isSelected ? 'bg-amber-500 border-amber-500 text-black font-bold' : 'border-gray-500'
                    }`}>
                      {isSelected && <Check size={10} />}
                    </div>
                    <FileText size={13} className="shrink-0" />
                    <span className="truncate max-w-[200px]">{doc.filename}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Topic & Compare Button */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400 shrink-0" />
              <input
                type="text"
                value={focusTopic}
                onChange={e => setFocusTopic(e.target.value)}
                placeholder="Tiêu chí hoặc câu hỏi trọng tâm muốn đối chiếu (tùy chọn)..."
                className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none transition ${
                  isDark ? 'bg-white/5 border-white/10 text-white focus:border-amber-500' : 'bg-white border-gray-200 text-black focus:border-amber-600'
                }`}
              />
            </div>
            <button
              onClick={handleStartCompare}
              disabled={selectedDocs.length < 2 || comparing}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 disabled:opacity-40 text-black font-bold px-5 py-2 rounded-xl text-xs shadow-lg transition flex items-center gap-1.5 shrink-0"
            >
              {comparing ? (
                <>
                  <Loader size={14} className="animate-spin text-black" />
                  <span>Đang phân tích đối chiếu...</span>
                </>
              ) : (
                <>
                  <Scale size={14} />
                  <span>So sánh {selectedDocs.length} tài liệu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {comparing ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Loader size={30} className="animate-spin text-amber-400" />
              <p className="text-sm font-medium">AI đang trích xuất dữ liệu và xây dựng bảng đối chiếu chuyên sâu...</p>
            </div>
          ) : !comparisonResult ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 max-w-md mx-auto text-center">
              <Scale size={42} className="text-amber-500/60" />
              <h4 className="text-sm font-semibold text-white">Chưa có kết quả đối chiếu</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Hãy tích chọn ít nhất 2 tài liệu ở trên và nhấn nút <span className="text-amber-400 font-semibold">"So sánh tài liệu"</span> để nhận phân tích chi tiết từ AI.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Kết quả Phân tích Đối chiếu
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition"
                  >
                    {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    <span>{copied ? "Đã chép" : "Sao chép"}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition"
                  >
                    <Download size={13} />
                    <span>Tải về .md</span>
                  </button>
                </div>
              </div>

              <div className="p-2">
                <MarkdownRenderer content={comparisonResult} isDark={isDark} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
