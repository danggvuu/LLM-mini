import React from 'react';
import { Headphones, Check, X } from 'lucide-react';

export default function PodcastConfigModal({
  isOpen,
  onClose,
  podcastConfig,
  setPodcastConfig,
  onGenerate,
  podcastGenerating
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] border border-purple-500/40 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 text-purple-400 font-bold text-base">
            <Headphones size={20} />
            <span>Tùy Chỉnh Podcast Âm Thanh AI</span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Style selection */}
          <div>
            <label className="font-semibold text-gray-300 block mb-1.5">
              Phong cách trò chuyện:
            </label>
            <div className="space-y-2">
              {[
                { key: 'fun', label: 'Hài hước & Sôi nổi', desc: 'Sử dụng ngôn từ đời thường dí dỏm, tràn đầy năng lượng' },
                { key: 'academic', label: 'Học thuật & Chuyên sâu', desc: 'Tập trung phân tích kỹ thuật, bản chất vấn đề và tính logic' },
                { key: 'debate', label: 'Tranh luận & Phản biện', desc: 'Một người nêu giả thiết, một người phản biện và mở rộng' }
              ].map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setPodcastConfig({...podcastConfig, style: s.key})}
                  className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                    podcastConfig.style === s.key 
                      ? 'bg-purple-500/20 border-purple-500 text-white' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs text-gray-200">{s.label}</div>
                    <div className="text-[10px] text-gray-400">{s.desc}</div>
                  </div>
                  {podcastConfig.style === s.key && <Check size={14} className="text-purple-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Voice selection */}
          <div>
            <label className="font-semibold text-gray-300 block mb-1.5">
              Giọng đọc Podcast:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'duo', label: '👫 Song ca Nam & Nữ', desc: 'Minh & My đối thoại tự nhiên, có khoảng ngắt nghỉ' },
                { key: 'female', label: '👩 Giọng Nữ (Hoài My)', desc: 'Ngọt ngào, truyền cảm, chuẩn sách nói' },
                { key: 'male', label: '👨 Giọng Nam (Nam Minh)', desc: 'Trầm ấm, đĩnh đạc, bản tin phân tích' },
                { key: 'gtts', label: '🤖 Chị Google (gTTS)', desc: 'Giọng đọc quen thuộc, hài hước' }
              ].map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setPodcastConfig({...podcastConfig, voice_mode: v.key})}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    (podcastConfig.voice_mode || 'duo') === v.key 
                      ? 'bg-purple-500/20 border-purple-500 text-white' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-[11px] text-gray-200">{v.label}</span>
                    {(podcastConfig.voice_mode || 'duo') === v.key && <Check size={12} className="text-purple-400" />}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 leading-snug">{v.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Focus Topic */}
          <div>
            <label className="font-semibold text-gray-300 block mb-1.5">
              Chủ đề trọng tâm (Tùy chọn):
            </label>
            <input
              type="text"
              value={podcastConfig.focus_topic}
              onChange={e => setPodcastConfig({...podcastConfig, focus_topic: e.target.value})}
              placeholder="Ví dụ: Tóm tắt 3 điểm cốt lõi để ôn tập, giải thích thuật ngữ..."
              className="w-full bg-black/40 text-xs px-3.5 py-2.5 rounded-xl text-white border border-white/15 focus:border-purple-500 outline-none transition"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={podcastGenerating}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Headphones size={14} />
            {podcastGenerating ? "Đang tạo..." : "Bắt đầu tạo Podcast"}
          </button>
        </div>
      </div>
    </div>
  );
}
