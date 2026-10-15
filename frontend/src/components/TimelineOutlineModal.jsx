import React, { useState } from 'react';
import { X, Clock, ListTree, RefreshCw, Sparkles, MessageSquare, ChevronDown, ChevronRight, Tag } from 'lucide-react';

export default function TimelineOutlineModal({ 
  isOpen, 
  onClose, 
  data, 
  onRegenerate, 
  loading, 
  onAskAboutTopic, 
  isDark = true 
}) {
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'outline'
  const [focusTopic, setFocusTopic] = useState('');
  const [expandedSections, setExpandedSections] = useState({ 0: true, 1: true });

  if (!isOpen) return null;

  const timelineItems = data?.timeline || [];
  const outlineItems = data?.outline || [];

  const toggleSection = (idx) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
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
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-xl text-white shadow-md">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Dòng thời gian & Dàn ý Bài học
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Timeline & Outline
                </span>
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Trích xuất niên biểu tiến trình và dàn ý phân cấp có hệ thống từ tài liệu
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

        {/* Action & Tab Header */}
        <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50/70 border-gray-200'
        }`}>
          {/* Tab Switcher */}
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'timeline' 
                  ? 'bg-emerald-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Clock size={14} />
              <span>Dòng thời gian ({timelineItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('outline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'outline' 
                  ? 'bg-emerald-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ListTree size={14} />
              <span>Dàn ý phân cấp ({outlineItems.length})</span>
            </button>
          </div>

          {/* Regenerate controls */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <input
              type="text"
              value={focusTopic}
              onChange={e => setFocusTopic(e.target.value)}
              placeholder="Chủ đề trọng tâm cần tập trung..."
              className={`px-3 py-1.5 rounded-xl text-xs border outline-none w-full max-w-[220px] transition ${
                isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-white border-gray-200 text-black'
              }`}
            />
            <button
              onClick={() => onRegenerate(focusTopic)}
              disabled={loading}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span>{loading ? "Đang tạo..." : "Tái tạo"}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <RefreshCw size={30} className="animate-spin text-emerald-400" />
              <p className="text-sm font-medium">AI đang trích xuất mốc sự kiện và xây dựng khung dàn ý...</p>
            </div>
          ) : activeTab === 'timeline' ? (
            /* Timeline View */
            timelineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                <Clock size={36} className="text-gray-500" />
                <p className="text-sm">Chưa có dữ liệu dòng thời gian. Nhấn "Tái tạo" để bắt đầu.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 max-w-2xl mx-auto before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-teal-500 before:to-emerald-500/20">
                {timelineItems.map((item, idx) => (
                  <div key={idx} className="relative group">
                    {/* Node Dot */}
                    <div className="absolute -left-[27px] top-1.5 w-4 h-4 rounded-full bg-emerald-500 border-4 border-[#14151a] shadow-md group-hover:scale-125 transition"></div>

                    {/* Card */}
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 transition shadow-sm space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                          {item.period || `Mốc ${idx + 1}`}
                        </span>
                        {item.tag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                            <Tag size={10} />
                            {item.tag}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                        {item.title}
                      </h4>

                      <p className="text-xs text-gray-300 leading-relaxed pt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Outline View */
            outlineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                <ListTree size={36} className="text-gray-500" />
                <p className="text-sm">Chưa có dàn ý bài học. Nhấn "Tái tạo" để bắt đầu.</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-2xl mx-auto">
                {outlineItems.map((section, idx) => {
                  const isExpanded = !!expandedSections[idx];
                  return (
                    <div 
                      key={section.id || idx}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
                    >
                      {/* Section Header */}
                      <div 
                        onClick={() => toggleSection(idx)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          {isExpanded ? <ChevronDown size={18} className="text-emerald-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                          <div>
                            <h4 className="text-sm font-bold text-white">{section.title}</h4>
                            {section.summary && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{section.summary}</p>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskAboutTopic(`Hãy giải thích chi tiết và đưa ra ví dụ về: "${section.title}"`);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition shrink-0"
                          title="Gửi câu hỏi này sang khung trò chuyện AI"
                        >
                          <MessageSquare size={12} />
                          <span>Hỏi AI</span>
                        </button>
                      </div>

                      {/* Subsections */}
                      {isExpanded && section.subsections && (
                        <div className="p-4 pt-1 border-t border-white/10 space-y-3 bg-black/20">
                          {section.subsections.map((sub, sIdx) => (
                            <div key={sub.id || sIdx} className="pl-3 border-l-2 border-emerald-500/40 space-y-1">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold text-gray-200">{sub.title}</h5>
                                <button
                                  onClick={() => {
                                    onAskAboutTopic(`Phân tích chuyên sâu về: "${sub.title}"`);
                                    onClose();
                                  }}
                                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                  <MessageSquare size={11} /> Hỏi mục này
                                </button>
                              </div>
                              {sub.points && sub.points.length > 0 && (
                                <ul className="list-disc list-inside text-xs text-gray-400 space-y-0.5 pl-1">
                                  {sub.points.map((pt, pIdx) => (
                                    <li key={pIdx}>{pt}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
