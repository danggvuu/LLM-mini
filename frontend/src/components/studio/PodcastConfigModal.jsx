import { useRef, useState } from 'react';
import { Headphones, Check, X } from 'lucide-react';
import useDialog from '../../hooks/useDialog';
import { getErrorMessage } from '../../lib/api';

export default function PodcastConfigModal({
  isOpen,
  onClose,
  podcastConfig,
  setPodcastConfig,
  onGenerate,
  podcastGenerating,
  isDark = true
}) {
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useDialog(dialogRef, onClose, isOpen);
  const busy = podcastGenerating || submitting;
  const handleGenerate = async () => {
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      if (await onGenerate() === false) setError('Chưa tạo được podcast. Vui lòng thử lại.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được podcast.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Tùy chỉnh podcast" tabIndex={-1} className={`border border-purple-500/40 w-full max-w-md max-h-[calc(100dvh-2rem)] rounded-3xl shadow-2xl overflow-y-auto p-4 sm:p-6 space-y-5 ${isDark ? 'bg-[#181a20] text-white' : 'bg-white text-gray-900'}`}>
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 text-purple-400 font-bold text-base">
            <Headphones size={20} />
            <span>Tùy Chỉnh Podcast Âm Thanh AI</span>
          </div>
          <button 
             onClick={onClose}
             aria-label="Đóng tùy chỉnh podcast"
            className="text-gray-500 hover:text-purple-500 p-2 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        <fieldset disabled={busy} className="space-y-4 text-xs">
          {/* Style selection */}
          <div>
            <span className={`font-semibold block mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Phong cách trò chuyện:
            </span>
            <div className="space-y-2">
              {[
                { key: 'fun', label: 'Hài hước & Sôi nổi', desc: 'Sử dụng ngôn từ đời thường dí dỏm, tràn đầy năng lượng' },
                { key: 'academic', label: 'Học thuật & Chuyên sâu', desc: 'Tập trung phân tích kỹ thuật, bản chất vấn đề và tính logic' },
                { key: 'debate', label: 'Tranh luận & Phản biện', desc: 'Một người nêu giả thiết, một người phản biện và mở rộng' }
              ].map(s => (
                <button
                  key={s.key}
                   type="button"
                   aria-pressed={podcastConfig.style === s.key}
                  onClick={() => setPodcastConfig({...podcastConfig, style: s.key})}
                  className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                    podcastConfig.style === s.key 
                      ? `bg-purple-500/20 border-purple-500 ${isDark ? 'text-white' : 'text-purple-900'}`
                      : isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs">{s.label}</div>
                    <div className="text-[10px] text-gray-400">{s.desc}</div>
                  </div>
                  {podcastConfig.style === s.key && <Check size={14} className="text-purple-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Voice selection */}
          <div>
            <span className={`font-semibold block mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Giọng đọc Podcast:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'duo', label: 'Nam và nữ', desc: 'Minh và My đối thoại, có khoảng ngắt nghỉ' },
                { key: 'female', label: 'Giọng nữ (Hoài My)', desc: 'Giọng đọc nhẹ nhàng, truyền cảm' },
                { key: 'male', label: 'Giọng nam (Nam Minh)', desc: 'Giọng đọc trầm, rõ ràng' },
                { key: 'gtts', label: 'Giọng Google (gTTS)', desc: 'Giọng đọc tiếng Việt của Google' }
              ].map(v => (
                <button
                  key={v.key}
                   type="button"
                   aria-pressed={(podcastConfig.voice_mode || 'duo') === v.key}
                  onClick={() => setPodcastConfig({...podcastConfig, voice_mode: v.key})}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    (podcastConfig.voice_mode || 'duo') === v.key 
                      ? `bg-purple-500/20 border-purple-500 ${isDark ? 'text-white' : 'text-purple-900'}`
                      : isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-[11px]">{v.label}</span>
                    {(podcastConfig.voice_mode || 'duo') === v.key && <Check size={12} className="text-purple-400" />}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 leading-snug">{v.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Focus Topic */}
          <div>
            <label htmlFor="podcast-focus-topic" className={`font-semibold block mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Chủ đề trọng tâm (Tùy chọn):
            </label>
            <input
              id="podcast-focus-topic"
               aria-label="Chủ đề trọng tâm của podcast"
               type="text"
               value={podcastConfig.focus_topic ?? ''}
              onChange={e => setPodcastConfig({...podcastConfig, focus_topic: e.target.value})}
              placeholder="Ví dụ: Tóm tắt 3 điểm cốt lõi để ôn tập, giải thích thuật ngữ..."
              className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:border-purple-500 outline-none transition ${isDark ? 'bg-black/40 text-white border-white/15' : 'bg-gray-50 text-gray-900 border-gray-200'}`}
            />
          </div>
        </fieldset>
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

        <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-purple-500 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Headphones size={14} />
            {busy ? "Đang tạo..." : "Bắt đầu tạo Podcast"}
          </button>
        </div>
      </div>
    </div>
  );
}
