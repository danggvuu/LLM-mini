import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Copy, Check, Sparkles, Network, RefreshCw, ChevronRight } from 'lucide-react';

export default function MindmapModal({ isOpen, onClose, mindmapData, onRegenerate, loading, isDark = true }) {
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [customTopic, setCustomTopic] = useState('');

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.5));
  const handleResetZoom = () => setZoom(1);

  // Generate mermaid representation
  const generateMermaid = (node) => {
    if (!node) return '';
    let res = 'graph TD\n';
    const sanitize = (str) => (str || '').replace(/["()[\]{}]/g, '');
    const traverse = (parent) => {
      if (!parent.children) return;
      parent.children.forEach(child => {
        res += `  ${sanitize(parent.id)}["${sanitize(parent.name)}"] --> ${sanitize(child.id)}["${sanitize(child.name)}"]\n`;
        traverse(child);
      });
    };
    traverse(node);
    return res;
  };

  const handleCopyMermaid = () => {
    if (!mindmapData) return;
    const mermaid = generateMermaid(mindmapData);
    navigator.clipboard.writeText(mermaid);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  const branches = mindmapData?.children || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className={`w-full max-w-5xl h-[88vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden transition-colors ${
        isDark ? 'bg-[#121316] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-xl text-white shadow-md">
              <Network size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Sơ đồ tư duy & Bản đồ tri thức (Mind Map)
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  AI Generated
                </span>
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Trực quan hóa các mối quan hệ khái niệm cốt lõi trong tài liệu của bạn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className={`flex items-center gap-1 border rounded-xl p-1 ${
              isDark ? 'border-white/10 bg-black/30' : 'border-gray-200 bg-gray-100'
            }`}>
              <button 
                onClick={handleZoomOut} 
                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
                title="Thu nhỏ"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-[11px] font-mono px-1 min-w-[40px] text-center font-semibold">
                {Math.round(zoom * 100)}%
              </span>
              <button 
                onClick={handleZoomIn} 
                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
                title="Phóng to"
              >
                <ZoomIn size={15} />
              </button>
              <button 
                onClick={handleResetZoom} 
                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
                title="Đặt lại zoom"
              >
                <RotateCcw size={15} />
              </button>
            </div>

            {/* Copy Mermaid */}
            <button
              onClick={handleCopyMermaid}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                isDark ? 'border-white/15 bg-white/5 hover:bg-white/10 text-gray-200' : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title="Sao chép sơ đồ dưới dạng mã Mermaid"
            >
              {copiedMermaid ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              <span>{copiedMermaid ? "Đã chép Mermaid" : "Xuất Mermaid"}</span>
            </button>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-black'}`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action Bar for Regenerating */}
        <div className={`px-5 py-2.5 border-b flex items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex-1 flex items-center gap-2 max-w-lg">
            <Sparkles size={14} className="text-purple-400 shrink-0" />
            <input
              type="text"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="Chủ đề trọng tâm cần tập trung tạo sơ đồ (tùy chọn)..."
              className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none transition ${
                isDark ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-200 text-black focus:border-purple-600'
              }`}
            />
          </div>
          <button
            onClick={() => onRegenerate(customTopic)}
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 disabled:opacity-50 text-white px-4 py-1.5 rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Đang tạo sơ đồ..." : "Tái tạo Sơ đồ"}</span>
          </button>
        </div>

        {/* Content Canvas */}
        <div className="flex-1 relative overflow-auto p-8 select-none flex items-start justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <RefreshCw size={28} className="animate-spin text-purple-400" />
              <p className="text-sm font-medium">AI đang phân tích tài liệu và dựng cây sơ đồ tri thức...</p>
            </div>
          ) : !mindmapData ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Network size={40} className="text-gray-500" />
              <p className="text-sm">Chưa có dữ liệu sơ đồ tư duy cho sổ tay này.</p>
              <button
                onClick={() => onRegenerate()}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Tạo sơ đồ tư duy ngay
              </button>
            </div>
          ) : (
            <div 
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-out' }}
              className="w-full max-w-4xl flex flex-col items-center gap-8 py-6"
            >
              {/* Root Node */}
              <div 
                onClick={() => setSelectedNode(mindmapData)}
                className="cursor-pointer group relative p-5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-xl shadow-purple-500/20 max-w-md text-center hover:scale-105 transition transform border border-white/20"
              >
                <div className="text-[11px] uppercase tracking-wider text-purple-200 font-bold mb-1">Chủ đề Trung tâm</div>
                <h3 className="text-lg font-extrabold">{mindmapData.name || "Chủ đề chính"}</h3>
                {mindmapData.desc && (
                  <p className="text-xs text-purple-100/90 mt-1 line-clamp-2">{mindmapData.desc}</p>
                )}
              </div>

              {/* Connecting curve indicator */}
              <div className="w-0.5 h-8 bg-gradient-to-b from-indigo-500 to-transparent"></div>

              {/* Level 1: Branches Grid */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                {branches.map((branch, idx) => {
                  const colors = [
                    'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400',
                    'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400',
                    'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
                    'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
                    'from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-400',
                  ];
                  const colorScheme = colors[idx % colors.length];

                  return (
                    <div 
                      key={branch.id || idx}
                      className={`rounded-2xl border p-4.5 bg-gradient-to-b ${colorScheme} backdrop-blur-sm shadow-lg flex flex-col justify-between`}
                    >
                      {/* Branch Header */}
                      <div>
                        <div 
                          onClick={() => setSelectedNode(branch)}
                          className="cursor-pointer group flex items-start justify-between gap-2 mb-2 pb-2 border-b border-white/10"
                        >
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                              Nhánh {idx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition">
                              {branch.name}
                            </h4>
                          </div>
                          <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-1 transition shrink-0 mt-1" />
                        </div>

                        {branch.desc && (
                          <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                            {branch.desc}
                          </p>
                        )}
                      </div>

                      {/* Sub-branches */}
                      {branch.children && branch.children.length > 0 && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-white/10">
                          <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
                            Khái niệm chi tiết ({branch.children.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {branch.children.map((sub, sIdx) => (
                              <button
                                key={sub.id || sIdx}
                                onClick={() => setSelectedNode(sub)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/40 hover:bg-black/60 border border-white/10 text-gray-200 transition text-left flex items-center gap-1.5 shadow-sm"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                <span className="truncate max-w-[160px]">{sub.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Node Detail Popup Drawer */}
          {selectedNode && (
            <div className={`absolute bottom-6 right-6 max-w-sm w-full p-4.5 rounded-2xl border shadow-2xl backdrop-blur-md animate-fade-in ${
              isDark ? 'bg-[#181a20]/95 border-purple-500/40 text-white' : 'bg-white/95 border-purple-400 text-gray-900'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Chi tiết Khái niệm</span>
                  <h4 className="text-sm font-bold mt-0.5">{selectedNode.name}</h4>
                </div>
                <button 
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg"
                >
                  <X size={15} />
                </button>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {selectedNode.desc || "Không có mô tả chi tiết thêm cho nút này."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
