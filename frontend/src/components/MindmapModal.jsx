import { useState, useEffect, useRef } from 'react';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, Copy, Check, Sparkles, Network, 
  RefreshCw, ChevronRight, Layers, FileCode, Info, CheckCircle2
} from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { getErrorMessage } from '../lib/api';

export default function MindmapModal({ isOpen, onClose, mindmapData, onRegenerate, loading, isDark = true }) {
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'cards' | 'mermaid'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const pendingRef = useRef(false);
  const copiedTimerRef = useRef(null);
  useDialog(dialogRef, () => selectedNode ? setSelectedNode(null) : onClose(), isOpen);
  useEffect(() => {
    setSelectedNode(null);
    setCopiedMermaid(false);
    setError('');
    return () => clearTimeout(copiedTimerRef.current);
  }, [isOpen, mindmapData]);
  const busy = loading || submitting;

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(Number((prev + 0.15).toFixed(2)), 2));
  const handleZoomOut = () => setZoom(prev => Math.max(Number((prev - 0.15).toFixed(2)), 0.5));
  const handleResetZoom = () => setZoom(1);

  // Generate mermaid representation
  const generateMermaid = (node) => {
    if (!node) return '';
    let res = 'graph TD\n';
    let index = 0;
    const label = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\/g, '&#92;').replace(/[\r\n]+/g, ' ');
    const traverse = (parent) => {
      const id = `n${index++}`;
      res += `  ${id}["${label(parent.name)}"]\n`;
      if (Array.isArray(parent.children)) parent.children.filter(Boolean).forEach(child => {
        const childId = traverse(child);
        res += `  ${id} --> ${childId}\n`;
      });
      return id;
    };
    traverse(node);
    return res;
  };

  const handleCopyMermaid = async () => {
    if (!mindmapData) return;
    const mermaid = generateMermaid(mindmapData);
    setCopiedMermaid(false);
    setError('');
    try {
      await navigator.clipboard.writeText(mermaid);
      setCopiedMermaid(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedMermaid(false), 2000);
    } catch {
      setError('Không sao chép được. Chọn chế độ Mermaid để chép mã trực tiếp.');
    }
  };

  const regenerate = async () => {
    if (busy || pendingRef.current) return;
    pendingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      if (await onRegenerate(customTopic.trim()) === false) setError('Chưa tạo được sơ đồ. Vui lòng thử lại.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được sơ đồ tư duy.'));
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  };

  const branches = Array.isArray(mindmapData?.children) ? mindmapData.children.filter(Boolean) : [];

  const branchColors = [
    {
      border: 'border-blue-500/40',
      bg: 'bg-blue-500/10',
      headerBg: 'bg-blue-500/20 text-blue-300',
      badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      dot: 'bg-blue-400',
      accent: '#3b82f6'
    },
    {
      border: 'border-purple-500/40',
      bg: 'bg-purple-500/10',
      headerBg: 'bg-purple-500/20 text-purple-300',
      badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      dot: 'bg-purple-400',
      accent: '#a855f7'
    },
    {
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-500/10',
      headerBg: 'bg-emerald-500/20 text-emerald-300',
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-400',
      accent: '#10b981'
    },
    {
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/10',
      headerBg: 'bg-amber-500/20 text-amber-300',
      badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      dot: 'bg-amber-400',
      accent: '#f59e0b'
    },
    {
      border: 'border-rose-500/40',
      bg: 'bg-rose-500/10',
      headerBg: 'bg-rose-500/20 text-rose-300',
      badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      dot: 'bg-rose-400',
      accent: '#f43f5e'
    },
    {
      border: 'border-cyan-500/40',
      bg: 'bg-cyan-500/10',
      headerBg: 'bg-cyan-500/20 text-cyan-300',
      badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      dot: 'bg-cyan-400',
      accent: '#06b6d4'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Sơ đồ tư duy" tabIndex={-1} className={`w-full max-w-6xl h-[92dvh] max-h-[calc(100dvh-1.5rem)] flex flex-col rounded-3xl shadow-2xl border overflow-hidden transition-colors ${
        isDark ? 'bg-[#121316] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-xl text-white shadow-md shrink-0">
              <Network size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2 truncate">
                <span>Sơ đồ tư duy & Bản đồ tri thức</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                  Mind Map AI
                </span>
              </h2>
              <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Trực quan hóa cấu trúc kiến thức & liên kết khái niệm từ tài liệu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Segmented Control */}
            <div className={`flex items-center rounded-xl p-1 border text-xs font-medium ${
              isDark ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'
            }`}>
              <button
                 onClick={() => setViewMode('tree')}
                 aria-pressed={viewMode === 'tree'}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition ${
                  viewMode === 'tree'
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
                }`}
                title="Xem dạng sơ đồ cây liên kết"
              >
                <Network size={13} />
                <span className="hidden md:inline">Cây sơ đồ</span>
              </button>
              <button
                 onClick={() => setViewMode('cards')}
                 aria-pressed={viewMode === 'cards'}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition ${
                  viewMode === 'cards'
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
                }`}
                title="Xem dạng lưới thẻ tổng quan"
              >
                <Layers size={13} />
                <span className="hidden md:inline">Lưới thẻ</span>
              </button>
              <button
                 onClick={() => setViewMode('mermaid')}
                 aria-pressed={viewMode === 'mermaid'}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition ${
                  viewMode === 'mermaid'
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
                }`}
                title="Xem mã nguồn Mermaid"
              >
                <FileCode size={13} />
                <span className="hidden md:inline">Mermaid</span>
              </button>
            </div>

            {/* Zoom controls */}
            {viewMode !== 'mermaid' && (
              <div className={`hidden sm:flex items-center gap-1 border rounded-xl p-1 ${
                isDark ? 'border-white/10 bg-black/30' : 'border-gray-200 bg-gray-100'
              }`}>
                <button 
                  onClick={handleZoomOut} 
                  className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
                  title="Thu nhỏ"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-[11px] font-mono px-1.5 min-w-[42px] text-center font-semibold">
                  {Math.round(zoom * 100)}%
                </span>
                <button 
                  onClick={handleZoomIn} 
                  className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
                  title="Phóng to"
                >
                  <ZoomIn size={14} />
                </button>
                <button 
                  onClick={handleResetZoom} 
                  className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
                  title="Về 100%"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            )}

            {/* Copy Mermaid */}
            <button
              onClick={handleCopyMermaid}
              disabled={!mindmapData || busy}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                isDark ? 'border-white/15 bg-white/5 hover:bg-white/10 text-gray-200' : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title="Sao chép sơ đồ dưới dạng mã Mermaid"
            >
              {copiedMermaid ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copiedMermaid ? "Đã chép" : "Xuất Mermaid"}</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Đóng sơ đồ tư duy"
              className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-black'}`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Bar for Regenerating */}
        <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 ${
          isDark ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex-1 flex items-center gap-2 max-w-xl">
            <Sparkles size={14} className="text-purple-400 shrink-0" />
            <input
              type="text"
              aria-label="Chủ đề trọng tâm của sơ đồ"
              disabled={busy}
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="Nhập chủ đề trọng tâm để tái tạo sơ đồ chuyên sâu (tùy chọn)..."
              className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none transition ${
                isDark ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-200 text-black focus:border-purple-600'
              }`}
            />
          </div>
          <button
            onClick={regenerate}
            disabled={busy}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 disabled:opacity-50 text-white px-4 py-1.5 rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
            <span>{busy ? "Đang tạo sơ đồ..." : "Tái tạo Sơ đồ"}</span>
          </button>
        </div>

        {/* Canvas Area */}
        {error && <p role="alert" className="px-4 pt-2 text-xs text-red-400 shrink-0">{error}</p>}
        <div className="flex-1 min-h-0 relative overflow-auto p-4 sm:p-8 flex items-start justify-start">
          {busy ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 my-auto">
              <RefreshCw size={32} className="animate-spin text-purple-400" />
              <p className="text-sm font-medium">AI đang phân tích tài liệu và dựng cây sơ đồ tri thức...</p>
            </div>
          ) : !mindmapData ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 my-auto">
              <Network size={44} className="text-gray-500" />
              <p className="text-sm font-medium">Chưa có dữ liệu sơ đồ tư duy cho sổ tay này.</p>
              <button
                onClick={regenerate}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow transition"
              >
                Tạo sơ đồ tư duy ngay
              </button>
            </div>
          ) : viewMode === 'mermaid' ? (
            /* Mermaid Source Code View */
            <div className="w-full max-w-4xl p-4 bg-black/60 rounded-2xl border border-white/10 font-mono text-xs overflow-x-auto">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-gray-400">
                <span>Mermaid Diagram Definition:</span>
                <button
                  onClick={handleCopyMermaid}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white flex items-center gap-1.5 text-xs transition"
                >
                  {copiedMermaid ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  <span>{copiedMermaid ? "Đã chép" : "Sao chép"}</span>
                </button>
              </div>
              <pre className="text-purple-300 leading-relaxed select-all">
                {generateMermaid(mindmapData)}
              </pre>
            </div>
          ) : viewMode === 'tree' ? (
            /* Visual Tree Mind Map */
            <div 
               style={{ zoom, transformOrigin: 'top left' }}
              className="w-full max-w-5xl flex flex-col items-center select-none pb-12"
            >
              {/* Central Root Node */}
              <button type="button"
                onClick={() => setSelectedNode(mindmapData)}
                className="cursor-pointer group relative px-6 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-xl shadow-purple-500/25 max-w-lg text-center hover:scale-[1.02] transition transform border border-white/25 z-10"
              >
                <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-purple-200 font-bold px-2 py-0.5 rounded-full bg-black/20 mb-1">
                  <Sparkles size={11} /> Chủ đề Cốt lõi
                </div>
                <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                  {mindmapData.name || "Chủ đề chính"}
                </h3>
                {mindmapData.desc && (
                  <p className="text-xs text-purple-100/90 mt-1 line-clamp-2 leading-relaxed">
                    {mindmapData.desc}
                  </p>
                )}
              </button>

              {/* Central Trunk Line */}
              <div className="w-0.5 h-7 bg-gradient-to-b from-indigo-500 to-purple-400"></div>

              {/* Branching Distribution Bar */}
              <div className="w-full max-w-3xl flex items-center justify-between relative px-8">
                <div className="absolute left-8 right-8 top-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-60"></div>
              </div>

              {/* Branches Grid with Connectors */}
              <div className={`w-full grid gap-5 mt-3 ${
                branches.length <= 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' :
                branches.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
                'grid-cols-1 md:grid-cols-2'
              }`}>
                {branches.map((branch, idx) => {
                  const style = branchColors[idx % branchColors.length];
                  return (
                    <div 
                      key={branch.id || idx}
                      className={`rounded-2xl border ${style.border} ${style.bg} backdrop-blur-sm p-4 flex flex-col justify-between shadow-lg hover:border-opacity-100 transition relative group`}
                    >
                      {/* Top connector stem */}
                      <div 
                        className="w-0.5 h-3 absolute -top-3 left-1/2 -translate-x-1/2"
                        style={{ backgroundColor: style.accent }}
                      ></div>

                      {/* Branch Header */}
                      <div className="mb-3">
                        <div 
                          onClick={() => setSelectedNode(branch)}
                          className="cursor-pointer flex items-start justify-between gap-2 pb-2.5 border-b border-white/10"
                        >
                          <div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isDark ? style.badge : 'bg-purple-50 text-purple-700'}`}>
                              Nhánh {idx + 1}
                            </span>
                            <h4 className={`text-sm font-bold mt-1 transition flex items-center gap-1.5 ${isDark ? 'text-white group-hover:text-purple-300' : 'text-gray-900 group-hover:text-purple-700'}`}>
                              {branch.name}
                            </h4>
                          </div>
                          <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedNode(branch); }}
                            className="p-1 rounded-lg text-gray-400 group-hover:text-white group-hover:bg-white/10 transition shrink-0"
                            title="Xem chi tiết nhánh"
                          >
                            <Info size={14} />
                          </button>
                        </div>

                        {branch.desc && (
                          <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {branch.desc}
                          </p>
                        )}
                      </div>

                      {/* Sub-concepts List */}
                      {Array.isArray(branch.children) && branch.children.length > 0 && (
                        <div className="pt-2.5 border-t border-white/10 space-y-1.5 mt-auto">
                          <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between">
                            <span>Khái niệm chi tiết ({branch.children.length}):</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {branch.children.map((sub, sIdx) => (
                              <button type="button"
                                key={sub.id || sIdx}
                                onClick={() => setSelectedNode(sub)}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition cursor-pointer flex items-start gap-2 shadow-sm ${isDark ? 'bg-black/40 hover:bg-black/70 border-white/10 hover:border-white/20 text-gray-200' : 'bg-white/80 hover:bg-white border-gray-200 text-gray-800'}`}
                              >
                                <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${style.dot}`}></span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold truncate">{sub.name}</div>
                                  {sub.desc && (
                                    <div className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{sub.desc}</div>
                                  )}
                                </div>
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
          ) : (
            /* Cards View (Dạng Lưới Thẻ) */
            <div 
              style={{ zoom, transformOrigin: 'top left' }}
              className="w-full max-w-5xl flex flex-col gap-6 select-none pb-12"
            >
              {/* Summary Card */}
              <button type="button"
                onClick={() => setSelectedNode(mindmapData)}
                className={`p-5 rounded-2xl border border-purple-500/30 flex flex-wrap text-left items-center justify-between gap-4 cursor-pointer hover:border-purple-500/60 transition ${isDark ? 'bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/40' : 'bg-purple-50'}`}
              >
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">Chủ đề chính</span>
                  <h3 className={`text-base font-bold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{mindmapData.name}</h3>
                  {mindmapData.desc && <p className={`text-xs mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{mindmapData.desc}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-mono">
                    {branches.length} Nhánh chính
                  </span>
                </div>
              </button>

              {/* Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map((branch, idx) => {
                  const style = branchColors[idx % branchColors.length];
                  return (
                    <div 
                      key={branch.id || idx}
                      className={`p-4.5 rounded-2xl border ${style.border} ${style.bg} flex flex-col justify-between`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isDark ? style.badge : 'bg-purple-50 text-purple-700'}`}>
                            Nhánh {idx + 1}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {branch.children?.length || 0} mục
                          </span>
                        </div>
                        <button type="button"
                          onClick={() => setSelectedNode(branch)}
                          className={`text-left text-sm font-bold cursor-pointer transition ${isDark ? 'text-white hover:text-purple-300' : 'text-gray-900 hover:text-purple-700'}`}
                        >
                          {branch.name}
                        </button>
                        {branch.desc && (
                          <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{branch.desc}</p>
                        )}
                      </div>

                      {Array.isArray(branch.children) && branch.children.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
                          {branch.children.map((sub, sIdx) => (
                            <button type="button"
                              key={sub.id || sIdx}
                              onClick={() => setSelectedNode(sub)}
                              className={`w-full text-left p-2 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 text-xs ${isDark ? 'bg-black/30 hover:bg-black/50 border-white/5 hover:border-white/15' : 'bg-white/80 hover:bg-white border-gray-200'}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}></span>
                                <span className={`font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{sub.name}</span>
                              </div>
                              <ChevronRight size={13} className="text-gray-500 shrink-0" />
                            </button>
                          ))}
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
            <aside aria-label="Chi tiết khái niệm" className={`fixed bottom-4 right-4 max-w-sm w-[calc(100vw-2rem)] max-h-[60dvh] overflow-y-auto p-5 rounded-2xl border shadow-2xl backdrop-blur-xl animate-fade-in z-30 ${
              isDark ? 'bg-[#181a20]/95 border-purple-500/40 text-white' : 'bg-white/95 border-purple-400 text-gray-900'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-purple-400 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                    Chi tiết Khái niệm
                  </span>
                </div>
                <button 
                   onClick={() => setSelectedNode(null)}
                   aria-label="Đóng chi tiết khái niệm"
                  className="text-gray-500 hover:text-purple-500 p-2 rounded-lg transition"
                >
                  <X size={15} />
                </button>
              </div>
              <h4 className={`text-sm font-bold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedNode.name}</h4>
              <p className={`text-xs leading-relaxed max-h-48 overflow-y-auto ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {selectedNode.desc || "Khái niệm này được tự động trích xuất từ tài liệu nghiên cứu của bạn."}
              </p>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
