import { useState, useEffect, useEffectEvent, useRef } from 'react';
import { 
  X, Layers, Play, Check, RotateCcw, Shuffle, Timer, Trophy, 
  ExternalLink, Copy, CheckCheck, Sparkles, ArrowRight, ArrowLeft,
  Flame, BrainCircuit
} from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { requestJson, getErrorMessage } from '../lib/api';

const EMPTY_CARDS = [];

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function QuizletModal({ 
  isOpen, 
  onClose, 
  flashcards = EMPTY_CARDS,
  title = "Bộ thẻ học tập", 
  onOpenConfig,
  notebookId,
  isDark = true
}) {
  const [mode, setMode] = useState('flashcards'); // 'flashcards', 'srs', 'practice', 'match', 'export'
  const dialogRef = useRef(null);
  useDialog(dialogRef, onClose, isOpen);
  const sessionRef = useRef(0);
  const reviewRef = useRef(null);
  const wrongTileTimerRef = useRef(null);
  const copiedTimerRef = useRef(null);
  const [error, setError] = useState('');
  const [copying, setCopying] = useState(false);

  // --- Flashcards State ---
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState(new Set());
  const [learningCards, setLearningCards] = useState(new Set());

  // --- SRS (Spaced Repetition) State ---
  const [srsData, setSrsData] = useState({});
  const [srsLoading, setSrsLoading] = useState(false);

  // --- Practice / Timer State ---
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceTimeLeft, setPracticeTimeLeft] = useState(60);
  const [practiceDuration, setPracticeDuration] = useState(60);
  const [practiceStreak, setPracticeStreak] = useState(0);
  const [practiceMaxStreak, setPracticeMaxStreak] = useState(0);
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceFinished, setPracticeFinished] = useState(false);
  const practiceDeadlineRef = useRef(0);
  const practiceAnsweredRef = useRef(new Set());

  // --- Match Game State ---
  const [matchTiles, setMatchTiles] = useState([]);
  const [selectedTile, setSelectedTile] = useState(null);
  const [matchedIds, setMatchedIds] = useState(new Set());
  const [wrongTileId, setWrongTileId] = useState(null);
  const [gameTimer, setGameTimer] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);

  // --- Export State ---
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    sessionRef.current += 1;
    reviewRef.current?.abort();
    reviewRef.current = null;
    clearTimeout(wrongTileTimerRef.current);
    clearTimeout(copiedTimerRef.current);
    setCards((Array.isArray(flashcards) ? flashcards : []).map((card, card_index) => ({ ...card, card_index }))
      .filter(card => typeof card.front === 'string' && typeof card.back === 'string'));
    setMode('flashcards');
    setCurrentIndex(0);
    setFlipped(false);
    setKnownCards(new Set());
    setLearningCards(new Set());
    setSrsData({});
    setSrsLoading(false);
    setPracticeActive(false);
    setPracticeFinished(false);
    setGameActive(false);
    setGameFinished(false);
    setMatchTiles([]);
    setSelectedTile(null);
    setWrongTileId(null);
    setCopied(false);
    setError('');
    return () => {
      sessionRef.current += 1;
      reviewRef.current?.abort();
      clearTimeout(wrongTileTimerRef.current);
      clearTimeout(copiedTimerRef.current);
    };
  }, [flashcards, isOpen, notebookId]);

  // Fetch SRS progress from backend
  useEffect(() => {
    if (!isOpen || !notebookId) return;
    const controller = new AbortController();
    requestJson(`/api/notebooks/${encodeURIComponent(notebookId)}/srs`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setSrsData(data || {}); })
      .catch(err => {
        if (!controller.signal.aborted) setError(getErrorMessage(err, 'Không tải được tiến độ ôn tập.'));
      });
    return () => controller.abort();
  }, [isOpen, notebookId]);

  const handleKeyboard = useEffectEvent((e) => {
    if (!isOpen || !['flashcards', 'srs'].includes(mode) || !cards.length || srsLoading) return;
    if (e.target.closest?.('input, textarea, select, button, a, [contenteditable="true"], [role="button"]')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setFlipped(prev => !prev);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => handleKeyboard(e);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== 'practice' || !practiceActive) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((practiceDeadlineRef.current - Date.now()) / 1000));
      setPracticeTimeLeft(remaining);
      if (remaining === 0) {
        setPracticeFinished(true);
        setPracticeActive(false);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [isOpen, mode, practiceActive]);

  useEffect(() => {
    if (!isOpen || mode !== 'match' || !gameActive) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setGameTimer(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(timer);
  }, [isOpen, mode, gameActive]);

  const handleNext = () => {
    if (!reviewRef.current && currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setFlipped(false);
    }
  };

  const handlePrev = () => {
    if (!reviewRef.current && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setFlipped(false);
    }
  };

  const handleShuffle = () => {
    setCards(shuffle(cards));
    setCurrentIndex(0);
    setFlipped(false);
  };

  const markKnown = (idx) => {
    const nextKnown = new Set(knownCards);
    nextKnown.add(idx);
    setKnownCards(nextKnown);

    const nextLearning = new Set(learningCards);
    nextLearning.delete(idx);
    setLearningCards(nextLearning);

    handleNext();
  };

  const markLearning = (idx) => {
    const nextLearning = new Set(learningCards);
    nextLearning.add(idx);
    setLearningCards(nextLearning);

    const nextKnown = new Set(knownCards);
    nextKnown.delete(idx);
    setKnownCards(nextKnown);

    handleNext();
  };

  // --- SRS Review Handler ---
  const handleSrsReview = async (rating) => {
    const card = cards[currentIndex];
    if (!notebookId || !card || !flipped || reviewRef.current) return;
    const controller = new AbortController();
    reviewRef.current = controller;
    const session = sessionRef.current;
    setSrsLoading(true);
    setError('');
    try {
      const data = await requestJson(`/api/notebooks/${encodeURIComponent(notebookId)}/srs/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_index: card.card_index, rating }),
        signal: controller.signal
      });
      if (!data?.card) throw new Error('Chưa nhận được tiến độ đã lưu. Vui lòng thử lại.');
      if (session !== sessionRef.current) return;
      setSrsData(prev => ({ ...prev, [card.card_index]: data.card }));
      setFlipped(false);
      setCurrentIndex(prev => (prev + 1) % cards.length);
    } catch (e) {
      if (!controller.signal.aborted && session === sessionRef.current) {
        setError(getErrorMessage(e, 'Không lưu được tiến độ. Vui lòng thử lại.'));
      }
    } finally {
      if (reviewRef.current === controller) {
        reviewRef.current = null;
        setSrsLoading(false);
      }
    }
  };

  // --- Practice / Timer Game ---
  const startPractice = (durationSeconds = 60) => {
    if (!cards.length) return;
    practiceDeadlineRef.current = Date.now() + durationSeconds * 1000;
    practiceAnsweredRef.current = new Set();
    setPracticeDuration(durationSeconds);
    setPracticeTimeLeft(durationSeconds);
    setPracticeScore(0);
    setPracticeStreak(0);
    setPracticeMaxStreak(0);
    setPracticeActive(true);
    setPracticeFinished(false);
    setCurrentIndex(0);
    setFlipped(false);

  };

  const handlePracticeAnswer = (correct) => {
    const cardId = cards[currentIndex]?.card_index;
    if (!practiceActive || !flipped || Date.now() >= practiceDeadlineRef.current || practiceAnsweredRef.current.has(cardId)) return;
    practiceAnsweredRef.current.add(cardId);
    if (correct) {
      const newStreak = practiceStreak + 1;
      setPracticeStreak(newStreak);
      if (newStreak > practiceMaxStreak) setPracticeMaxStreak(newStreak);
      const points = 10 * (1 + Math.floor(newStreak / 3));
      setPracticeScore(prev => prev + points);
    } else {
      setPracticeStreak(0);
    }

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setFlipped(false);
    } else {
      setPracticeFinished(true);
      setPracticeActive(false);
    }
  };

  // --- Match Game ---
  const startMatchGame = () => {
    if (!cards.length) return;
    clearTimeout(wrongTileTimerRef.current);
    const selected = cards.slice(0, 6);
    const tiles = [];
    selected.forEach(c => {
      tiles.push({ id: `front-${c.card_index}`, pairId: c.card_index, text: c.front, type: 'front' });
      tiles.push({ id: `back-${c.card_index}`, pairId: c.card_index, text: c.back, type: 'back' });
    });
    setMatchTiles(shuffle(tiles));
    setSelectedTile(null);
    setMatchedIds(new Set());
    setWrongTileId(null);
    setGameTimer(0);
    setGameActive(true);
    setGameFinished(false);

  };

  const handleTileClick = (tile) => {
    if (!gameActive || wrongTileId !== null || matchedIds.has(tile.pairId)) return;
    if (!selectedTile) {
      setSelectedTile(tile);
      return;
    }
    if (selectedTile.id === tile.id) {
      setSelectedTile(null);
      return;
    }
    if (selectedTile.pairId === tile.pairId && selectedTile.type !== tile.type) {
      const nextMatched = new Set(matchedIds);
      nextMatched.add(tile.pairId);
      setMatchedIds(nextMatched);
      setSelectedTile(null);
      if (nextMatched.size === matchTiles.length / 2) {
        setGameActive(false);
        setGameFinished(true);
      }
    } else {
      setWrongTileId(tile.id);
      wrongTileTimerRef.current = setTimeout(() => {
        setWrongTileId(null);
        setSelectedTile(null);
      }, 600);
    }
  };

  const changeMode = (nextMode) => {
    if (mode === nextMode || reviewRef.current) return;
    clearTimeout(wrongTileTimerRef.current);
    setWrongTileId(null);
    setSelectedTile(null);
    setPracticeActive(false);
    setGameActive(false);
    setFlipped(false);
    setMode(nextMode);
    if (nextMode === 'practice') startPractice(60);
    if (nextMode === 'match') startMatchGame();
  };

  const exportText = cards.map(c => `${c.front.replace(/[\t\r\n]+/g, ' ')}\t${c.back.replace(/[\t\r\n]+/g, ' ')}`).join('\n');
  const handleCopyExport = async () => {
    if (copying || !cards.length) return;
    const session = sessionRef.current;
    setCopying(true);
    setError('');
    setCopied(false);
    try {
      await navigator.clipboard.writeText(exportText);
      if (session !== sessionRef.current) return;
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (session === sessionRef.current) setError('Không sao chép được. Hãy chọn và chép văn bản trong ô bên dưới.');
    } finally {
      setCopying(false);
    }
  };

  const currentCard = cards[currentIndex];
  const srsInfo = srsData[currentCard?.card_index];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Bộ thẻ và luyện tập" tabIndex={-1} className={`w-full max-w-4xl h-[88dvh] max-h-[calc(100dvh-2rem)] flex flex-col rounded-3xl shadow-2xl border overflow-hidden transition-colors ${
        isDark ? 'bg-[#121316] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        
        {/* Header */}
        <div className={`p-4 border-b flex flex-wrap gap-3 shrink-0 items-center justify-between ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-xl text-white shadow-md">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Bộ thẻ & Luyện thi thông minh
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  {cards.length} thẻ
                </span>
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenConfig && (
              <button
                onClick={onOpenConfig}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/15 text-purple-300 transition flex items-center gap-1.5"
                title="Tùy biến số lượng và độ khó của thẻ học"
              >
                <Sparkles size={13} />
                <span>Tùy chỉnh tạo thẻ</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Đóng bộ thẻ"
              className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-black'}`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={`px-4 pt-3 border-b flex shrink-0 gap-4 overflow-x-auto whitespace-nowrap text-xs font-semibold ${
          isDark ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'
        }`}>
          <button
            onClick={() => changeMode('flashcards')}
            aria-pressed={mode === 'flashcards'}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
              mode === 'flashcards' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers size={14} /> Thẻ lật 3D
          </button>
          <button
            onClick={() => changeMode('srs')}
            aria-pressed={mode === 'srs'}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
              mode === 'srs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <BrainCircuit size={14} /> Ôn tập Anki (SRS)
          </button>
          <button
            onClick={() => changeMode('practice')}
            aria-pressed={mode === 'practice'}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
              mode === 'practice' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Timer size={14} /> Thi thử (Timer)
          </button>
          <button
            onClick={() => changeMode('match')}
            aria-pressed={mode === 'match'}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
              mode === 'match' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Play size={14} /> Trò chơi Ghép thẻ
          </button>
          <button
            onClick={() => changeMode('export')}
            aria-pressed={mode === 'export'}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
              mode === 'export' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ExternalLink size={14} /> Xuất Quizlet.com
          </button>
        </div>

        {/* Content Area */}
        {error && <p role="alert" className="px-4 py-2 text-xs text-red-400 shrink-0">{error}</p>}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col items-center">
          {!cards.length && mode !== 'flashcards' && mode !== 'export' && <p className="my-auto text-sm text-gray-400">Chưa có thẻ nào để luyện tập.</p>}

          {/* MODE 1: STANDARD 3D FLASHCARDS */}
          {mode === 'flashcards' && (
            cards.length === 0 ? (
              <div className="text-gray-400 text-xs">Chưa có thẻ nào trong bộ học tập này.</div>
            ) : (
              <div className="w-full max-w-xl flex flex-col items-center gap-5 my-auto">
                {/* Stats */}
                <div className="w-full flex justify-between text-xs text-gray-400 font-medium px-2">
                  <span>Thẻ {currentIndex + 1} / {cards.length}</span>
                  <div className="flex gap-4">
                    <span className="text-green-400">Đã nhớ: {knownCards.size}</span>
                    <span className="text-orange-400">Đang học: {learningCards.size}</span>
                  </div>
                </div>

                {/* 3D Flip Card */}
                <button type="button" aria-label={flipped ? 'Xem mặt trước' : 'Lật thẻ xem đáp án'} aria-pressed={flipped}
                  onClick={() => setFlipped(!flipped)}
                  className="w-full h-72 cursor-pointer perspective-1000 group select-none"
                >
                  <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${flipped ? 'rotate-y-180' : ''}`}>
                    {/* FRONT */}
                    <div aria-hidden={flipped} className={`absolute inset-0 backface-hidden rounded-3xl border p-5 sm:p-8 flex flex-col justify-between shadow-2xl backdrop-blur-sm ${isDark ? 'border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex justify-between items-center text-xs text-purple-400 font-bold tracking-wider uppercase">
                        <span>Mặt trước (Khái niệm)</span>
                        <span className="text-gray-500 font-normal">Nhấn để xem đáp án ↺</span>
                      </div>
                      <div className={`text-xl md:text-2xl font-bold text-center my-auto leading-relaxed overflow-y-auto ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {currentCard?.front}
                      </div>
                      <div className="text-center text-[11px] text-gray-500 font-mono">
                        (Phím cách để lật thẻ • Mũi tên trái/phải để chuyển)
                      </div>
                    </div>

                    {/* BACK */}
                    <div aria-hidden={!flipped} className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl border border-purple-500/40 bg-gradient-to-br from-purple-900 to-black p-5 sm:p-8 flex flex-col justify-between shadow-2xl backdrop-blur-sm">
                      <div className="flex justify-between items-center text-xs text-purple-300 font-bold tracking-wider uppercase">
                        <span>Mặt sau (Giải nghĩa)</span>
                        <span className="text-gray-400 font-normal">Nhấn để quay lại ↺</span>
                      </div>
                      <div className="text-sm md:text-base text-gray-200 text-center my-auto leading-relaxed overflow-y-auto max-h-44 scrollbar-hide">
                        {currentCard?.back}
                      </div>
                      <div className="text-center text-[11px] text-purple-400/80 font-mono">
                        ✓ Hãy tự đánh giá mức độ ghi nhớ bên dưới
                      </div>
                    </div>
                  </div>
                </button>

                {/* Navigation and Marking */}
                <div className="flex flex-wrap justify-center items-center gap-2">
                  <button 
                    onClick={() => markLearning(currentCard.card_index)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/30 transition flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Chưa thuộc
                  </button>

                  <button aria-label="Thẻ trước" onClick={handlePrev} disabled={currentIndex === 0} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition">
                    <ArrowLeft size={16} />
                  </button>
                  <button onClick={handleShuffle} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition" title="Xáo trộn thẻ">
                    <Shuffle size={16} />
                  </button>
                  <button aria-label="Thẻ tiếp theo" onClick={handleNext} disabled={currentIndex === cards.length - 1} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition">
                    <ArrowRight size={16} />
                  </button>

                  <button 
                    onClick={() => markKnown(currentCard.card_index)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-500/15 hover:bg-green-500/25 text-green-300 border border-green-500/30 transition flex items-center gap-1.5"
                  >
                    <Check size={14} /> Đã nhớ
                  </button>
                </div>
              </div>
            )
          )}

          {/* MODE 2: ANKI SPACED REPETITION (SRS) */}
          {mode === 'srs' && cards.length > 0 && (
            <div className="w-full max-w-xl flex flex-col items-center gap-5 animate-fade-in my-auto">
              <div className="w-full flex justify-between items-center text-xs text-gray-400 px-2 pb-1 border-b border-white/10">
                <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                  <BrainCircuit size={14} /> Ôn tập theo thuật toán SuperMemo-2 (SM-2)
                </span>
                <span className="font-mono">Thẻ {currentIndex + 1} / {cards.length}</span>
              </div>

              {/* Flashcard Card */}
              <button type="button" aria-label={flipped ? 'Xem khái niệm' : 'Xem đáp án'} aria-pressed={flipped} disabled={srsLoading}
                onClick={() => setFlipped(!flipped)}
                className="w-full h-64 cursor-pointer rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 to-black/60 p-7 flex flex-col justify-between shadow-xl"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-400 font-bold uppercase tracking-wider">
                    {flipped ? "Định nghĩa / Giải thích" : "Khái niệm cần nhớ"}
                  </span>
                  <span className="text-gray-500 text-[11px] font-mono">
                    {srsInfo ? `Đã ôn ${srsInfo.repetitions} lần • Khoảng cách: ${srsInfo.interval_days} ngày` : "Thẻ mới"}
                  </span>
                </div>
                <div className="text-lg md:text-xl font-bold text-center text-white my-auto leading-relaxed overflow-y-auto">
                  {flipped ? currentCard?.back : currentCard?.front}
                </div>
                <div className="text-center text-[11px] text-gray-500">
                  {flipped ? "Bấm vào các nút bên dưới để ghi nhận tiến độ" : "Nhấn để lật xem đáp án"}
                </div>
              </button>
              <p className="text-xs text-gray-400" role="status">{!notebookId ? 'Cần mở một sổ tay để lưu tiến độ.' : srsLoading ? 'Đang lưu tiến độ...' : !flipped ? 'Lật thẻ trước khi tự đánh giá.' : 'Chọn mức ghi nhớ để lưu và sang thẻ tiếp theo.'}</p>

              {/* 4 SRS Rating Buttons */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <button
                  onClick={() => handleSrsReview(1)}
                  disabled={srsLoading || !flipped || !notebookId}
                  className="p-3 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-bold transition flex flex-col items-center gap-1 shadow-sm"
                >
                  <span>Lại (Again)</span>
                  <span className="text-[10px] font-normal text-red-400 font-mono">1 phút</span>
                </button>
                <button
                  onClick={() => handleSrsReview(2)}
                  disabled={srsLoading || !flipped || !notebookId}
                  className="p-3 rounded-2xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-bold transition flex flex-col items-center gap-1 shadow-sm"
                >
                  <span>Khó (Hard)</span>
                  <span className="text-[10px] font-normal text-orange-400">Ôn thường xuyên hơn</span>
                </button>
                <button
                  onClick={() => handleSrsReview(3)}
                  disabled={srsLoading || !flipped || !notebookId}
                  className="p-3 rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-bold transition flex flex-col items-center gap-1 shadow-sm"
                >
                  <span>Tốt (Good)</span>
                  <span className="text-[10px] font-normal text-blue-400">Theo tiến độ</span>
                </button>
                <button
                  onClick={() => handleSrsReview(4)}
                  disabled={srsLoading || !flipped || !notebookId}
                  className="p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition flex flex-col items-center gap-1 shadow-sm"
                >
                  <span>Dễ (Easy)</span>
                  <span className="text-[10px] font-normal text-emerald-400">Giãn lịch ôn</span>
                </button>
              </div>
            </div>
          )}

          {/* MODE 3: PRACTICE MODE WITH TIMER & STREAKS */}
          {mode === 'practice' && cards.length > 0 && (
            <div className="w-full max-w-xl animate-fade-in flex flex-col items-center my-auto">
              {practiceFinished ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-xl">
                    <Trophy size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Hoàn thành bài thi thử!</h3>
                  <div className="flex justify-center gap-6 text-sm font-mono pt-2">
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="text-gray-400 text-xs">Tổng điểm</div>
                      <div className="text-2xl font-extrabold text-amber-400">{practiceScore}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="text-gray-400 text-xs">Chuỗi đúng nhất</div>
                      <div className="text-2xl font-extrabold text-orange-400">{practiceMaxStreak}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => startPractice(practiceDuration)}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-6 py-2.5 rounded-full transition shadow-lg mt-4"
                  >
                    Thi lại lần nữa
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {/* Timer bar & Stats */}
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <div className="flex items-center gap-2">
                      <Timer size={16} className={practiceTimeLeft < 15 ? "text-red-400 animate-pulse" : "text-amber-400"} />
                      <span className={practiceTimeLeft < 15 ? "text-red-400" : "text-amber-300"}>
                        {practiceTimeLeft}s
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-orange-400">
                      <Flame size={16} className={practiceStreak > 2 ? "animate-bounce" : ""} />
                      <span>Chuỗi đúng: {practiceStreak}</span>
                    </div>

                    <div className="text-green-400">
                      Điểm: {practiceScore}
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${practiceTimeLeft < 15 ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${(practiceTimeLeft / practiceDuration) * 100}%` }}
                    />
                  </div>

                  {/* Flashcard in practice mode */}
                  <button type="button" aria-label={flipped ? 'Xem câu hỏi' : 'Xem đáp án'} aria-pressed={flipped}
                    onClick={() => setFlipped(!flipped)}
                    className="w-full h-60 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-black/70 p-6 flex flex-col justify-between cursor-pointer shadow-xl select-none"
                  >
                    <div className="flex justify-between text-xs text-amber-400 font-bold uppercase">
                      <span>{flipped ? "Đáp án:" : "Câu hỏi / Khái niệm:"}</span>
                      <span className="text-gray-400 text-[11px] font-normal">Nhấn để lật</span>
                    </div>
                    <div className="text-lg md:text-xl font-bold text-center text-white my-auto leading-relaxed overflow-y-auto">
                      {flipped ? currentCard?.back : currentCard?.front}
                    </div>
                    <div className="text-center text-[11px] text-gray-500">
                      Thẻ {currentIndex + 1} / {cards.length}
                    </div>
                  </button>

                  {/* Yes / No Answer Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => handlePracticeAnswer(false)}
                      disabled={!flipped || !practiceActive}
                      className="py-3 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold text-xs transition"
                    >
                      ✕ Trả lời sai (0đ)
                    </button>
                    <button
                      onClick={() => handlePracticeAnswer(true)}
                      disabled={!flipped || !practiceActive}
                      className="py-3 rounded-2xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-300 font-bold text-xs transition"
                    >
                      ✓ Trả lời đúng (+{10 * (1 + Math.floor((practiceStreak + 1) / 3))}đ)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 4: MATCH GAME */}
          {mode === 'match' && cards.length > 0 && (
            <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in my-auto">
              <div className="w-full flex justify-between items-center text-xs font-mono mb-4 text-gray-400">
                <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                  <Timer size={14} /> Thời gian: {gameTimer}s
                </span>
                <span>Đã ghép: {matchedIds.size} / {Math.min(cards.length, 6)}</span>
              </div>

              {!gameFinished ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                  {matchTiles.map(tile => {
                    const isMatched = matchedIds.has(tile.pairId);
                    const isSelected = selectedTile?.id === tile.id;
                    const isWrong = wrongTileId === tile.id;

                    if (isMatched) {
                      return (
                        <div key={tile.id} className="h-24 rounded-2xl border border-green-500/20 bg-green-500/5 opacity-30 flex items-center justify-center p-3 text-center text-xs text-green-300 font-medium">
                          ✓ Đã ghép đúng
                        </div>
                      );
                    }

                    return (
                      <button type="button" disabled={!gameActive || wrongTileId !== null} aria-pressed={isSelected}
                        key={tile.id}
                        onClick={() => handleTileClick(tile)}
                        className={`h-24 rounded-2xl p-3 flex items-center justify-center text-center text-xs font-semibold cursor-pointer select-none transition-all duration-200 border ${
                          isWrong 
                            ? 'bg-red-500/30 border-red-500 text-red-200 animate-shake'
                            : isSelected
                            ? 'bg-blue-600/30 border-blue-500 text-white scale-105 shadow-lg'
                            : 'bg-white/5 border-white/10 hover:border-white/25 text-gray-300 hover:text-white'
                        }`}
                      >
                        <span className="line-clamp-3">{tile.text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center mx-auto shadow-xl">
                    <Trophy size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Xuất sắc! Bạn đã ghép xong</h3>
                  <p className="text-gray-400 text-sm">
                    Thời gian hoàn thành: <span className="text-yellow-400 font-bold font-mono text-base">{gameTimer} giây</span>
                  </p>
                  <button
                    onClick={startMatchGame}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-6 py-2.5 rounded-full transition shadow-lg shadow-blue-600/30"
                  >
                    Chơi lại để phá kỷ lục
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODE 5: EXPORT TO QUIZLET.COM */}
          {mode === 'export' && (
            <div className="w-full max-w-xl space-y-5 animate-fade-in my-auto">
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl text-xs text-purple-200 space-y-2">
                <h4 className="font-bold flex items-center gap-1.5 text-purple-300">
                  <ExternalLink size={14} /> Cách nạp nhanh vào Quizlet.com:
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-300">
                  <li>Bấm nút <strong>"Sao chép toàn bộ thẻ"</strong> bên dưới.</li>
                  <li>Truy cập <a href="https://quizlet.com/create-set" target="_blank" rel="noreferrer" className="text-purple-400 underline font-semibold">quizlet.com/create-set</a></li>
                  <li>Bấm vào <strong>"Nhập từ Word, Excel, Google Docs"</strong> và dán (Ctrl+V / Cmd+V) vào ô. Xong!</li>
                </ol>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="quizlet-export" className="text-xs font-semibold text-gray-400">Dữ liệu định dạng Tab-Separated:</label>
                  <button
                    onClick={handleCopyExport}
                    disabled={copying || !cards.length}
                    className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 transition"
                  >
                    {copied ? <CheckCheck size={14} className="text-green-400" /> : <Copy size={14} />}
                    <span>{copied ? "Đã sao chép!" : "Sao chép toàn bộ"}</span>
                  </button>
                </div>
                <textarea
                  id="quizlet-export"
                  readOnly
                  value={exportText}
                  rows={8}
                  className="w-full bg-black/40 border border-white/15 rounded-xl p-3 font-mono text-xs text-gray-300 focus:outline-none select-all"
                />
              </div>

              <div className="flex justify-end">
                <a
                  href="https://quizlet.com/create-set"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg"
                >
                  Mở trang tạo học phần Quizlet.com <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex shrink-0 gap-3 items-center justify-between text-xs ${
          isDark ? 'border-white/10 bg-white/[0.01] text-gray-500' : 'border-gray-200 bg-gray-50 text-gray-500'
        }`}>
          <span>Hỗ trợ ôn luyện ghi nhớ ngắt quãng Spaced Repetition & Ghép thẻ tương tác.</span>
          <button onClick={onClose} className={`px-4 py-1.5 rounded-xl transition font-medium ${isDark ? 'bg-white/10 hover:bg-white/20 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}>
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
