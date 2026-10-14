import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Layers, Play, Check, RotateCcw, Shuffle, Timer, Trophy, 
  ExternalLink, Copy, CheckCheck, Sparkles, ArrowRight, ArrowLeft 
} from 'lucide-react';

export default function QuizletModal({ isOpen, onClose, flashcards = [], title = "Bộ thẻ học tập" }) {
  const [mode, setMode] = useState('flashcards'); // 'flashcards', 'match', 'export'

  // --- Flashcards State ---
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState(new Set());
  const [learningCards, setLearningCards] = useState(new Set());

  // --- Match Game State ---
  const [matchTiles, setMatchTiles] = useState([]);
  const [selectedTile, setSelectedTile] = useState(null);
  const [matchedIds, setMatchedIds] = useState(new Set());
  const [wrongTileId, setWrongTileId] = useState(null);
  const [gameTimer, setGameTimer] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const timerRef = useRef(null);

  // --- Export State ---
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (flashcards && flashcards.length > 0) {
      setCards([...flashcards]);
      setCurrentIndex(0);
      setFlipped(false);
      setKnownCards(new Set());
      setLearningCards(new Set());
    }
  }, [flashcards, isOpen]);

  // Keyboard Navigation for Flashcards
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen || mode !== 'flashcards') return;
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, currentIndex, cards.length]);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setFlipped(false);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
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

  // --- Match Game Logic ---
  const startMatchGame = () => {
    const activeCards = cards.slice(0, 6); // Lấy tối đa 6 cặp cho bảng match 12 ô
    const tiles = [];
    activeCards.forEach((c, idx) => {
      tiles.push({ id: `front-${idx}`, pairId: idx, text: c.front, type: 'front' });
      tiles.push({ id: `back-${idx}`, pairId: idx, text: c.back, type: 'back' });
    });
    // Shuffle tiles
    tiles.sort(() => Math.random() - 0.5);
    setMatchTiles(tiles);
    setSelectedTile(null);
    setMatchedIds(new Set());
    setWrongTileId(null);
    setGameTimer(0);
    setGameFinished(false);
    setGameActive(true);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setGameTimer(t => t + 1);
    }, 1000);
  };

  const handleTileClick = (tile) => {
    if (!gameActive || matchedIds.has(tile.pairId)) return;

    if (!selectedTile) {
      setSelectedTile(tile);
      return;
    }

    if (selectedTile.id === tile.id) {
      setSelectedTile(null);
      return;
    }

    // Check match
    if (selectedTile.pairId === tile.pairId && selectedTile.type !== tile.type) {
      // Đúng cặp!
      const newMatched = new Set(matchedIds);
      newMatched.add(tile.pairId);
      setMatchedIds(newMatched);
      setSelectedTile(null);

      // Kiểm tra thắng game
      if (newMatched.size * 2 >= matchTiles.length) {
        clearInterval(timerRef.current);
        setGameActive(false);
        setGameFinished(true);
      }
    } else {
      // Sai cặp
      setWrongTileId(tile.id);
      setTimeout(() => {
        setWrongTileId(null);
        setSelectedTile(null);
      }, 500);
    }
  };

  // --- Export Logic ---
  const getExportText = () => {
    return cards.map(c => `${c.front}\t${c.back}`).join('\n');
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(getExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] border border-purple-500/30 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Quizlet Learning Studio</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">PRO</span>
              </div>
              <p className="text-xs text-gray-400">{title} • {cards.length} thẻ ghi nhớ</p>
            </div>
          </div>
          
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 px-5 bg-black/20 gap-2">
          <button
            onClick={() => { setMode('flashcards'); if (gameActive) clearInterval(timerRef.current); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              mode === 'flashcards' ? 'border-purple-500 text-purple-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers size={14} /> Thẻ ghi nhớ (Flashcards)
          </button>
          <button
            onClick={() => { setMode('match'); startMatchGame(); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              mode === 'match' ? 'border-blue-500 text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Play size={14} /> Ghép thẻ (Match Game)
          </button>
          <button
            onClick={() => { setMode('export'); if (gameActive) clearInterval(timerRef.current); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              mode === 'export' ? 'border-green-500 text-green-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ExternalLink size={14} /> Xuất ra Quizlet.com
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center">
          
          {/* MODE 1: FLASHCARDS */}
          {mode === 'flashcards' && cards.length > 0 && (
            <div className="w-full max-w-xl flex flex-col items-center space-y-5 animate-fade-in">
              
              {/* Progress & Quick Stats */}
              <div className="w-full flex items-center justify-between text-xs text-gray-400 px-1">
                <div className="flex gap-4">
                  <span className="text-green-400 font-medium">✓ Đã thuộc: {knownCards.size}</span>
                  <span className="text-yellow-400 font-medium">● Đang học: {learningCards.size}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span>{currentIndex + 1} / {cards.length}</span>
                  <button 
                    onClick={handleShuffle} 
                    className="p-1 hover:text-white transition"
                    title="Xáo trộn thứ tự thẻ"
                  >
                    <Shuffle size={14} />
                  </button>
                </div>
              </div>

              {/* 3D Flip Card */}
              <div 
                className="w-full h-80 bg-gradient-to-br from-[#1d1f27] to-[#14151b] border border-white/10 hover:border-purple-500/50 rounded-3xl p-8 flex flex-col justify-between items-center text-center cursor-pointer shadow-2xl transition-all duration-300 hover:shadow-purple-500/10 group select-none relative"
                onClick={() => setFlipped(!flipped)}
              >
                <div className="text-[11px] font-bold uppercase tracking-widest text-purple-400/80">
                  {flipped ? "Định nghĩa / Giải thích" : "Thuật ngữ / Khái niệm"}
                </div>

                <div className="flex-1 flex items-center justify-center px-4">
                  <h3 className={`font-bold transition-all ${flipped ? 'text-lg text-gray-200 font-normal leading-relaxed' : 'text-2xl text-white'}`}>
                    {flipped ? cards[currentIndex].back : cards[currentIndex].front}
                  </h3>
                </div>

                <div className="text-[11px] text-gray-500 flex items-center gap-2">
                  <span>Chạm vào thẻ hoặc bấm <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono text-[10px]">Space</kbd> để lật</span>
                </div>
              </div>

              {/* Controls */}
              <div className="w-full flex items-center justify-between pt-2">
                <button
                  onClick={() => markLearning(currentIndex)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 transition flex items-center gap-1.5"
                >
                  <RotateCcw size={13} /> Cần ôn lại
                </button>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30 transition"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button 
                    onClick={handleNext}
                    disabled={currentIndex === cards.length - 1}
                    className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30 transition"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>

                <button
                  onClick={() => markKnown(currentIndex)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition flex items-center gap-1.5"
                >
                  <Check size={13} /> Đã thuộc
                </button>
              </div>

            </div>
          )}

          {/* MODE 2: MATCH GAME (Ghép thẻ tính giờ phong cách Quizlet) */}
          {mode === 'match' && (
            <div className="w-full flex flex-col items-center animate-fade-in space-y-4">
              
              {/* Game Status */}
              <div className="w-full flex items-center justify-between px-2 text-xs">
                <div className="flex items-center gap-2 text-blue-400 font-mono font-bold text-sm">
                  <Timer size={16} />
                  <span>{Math.floor(gameTimer / 60)}:{gameTimer % 60 < 10 ? '0' : ''}{gameTimer % 60}s</span>
                </div>
                <div className="text-gray-400">
                  Ghép xong: {matchedIds.size} / {matchTiles.length / 2} cặp
                </div>
                <button 
                  onClick={startMatchGame}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 hover:underline"
                >
                  <RotateCcw size={12} /> Bắt đầu lại
                </button>
              </div>

              {!gameFinished ? (
                /* Grid of Tiles */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
                  {matchTiles.map((tile) => {
                    const isMatched = matchedIds.has(tile.pairId);
                    const isSelected = selectedTile?.id === tile.id;
                    const isWrong = wrongTileId === tile.id;

                    if (isMatched) {
                      return (
                        <div 
                          key={tile.id} 
                          className="h-28 rounded-2xl bg-white/[0.01] border border-white/5 opacity-0 transition-opacity duration-300 pointer-events-none"
                        />
                      );
                    }

                    return (
                      <div
                        key={tile.id}
                        onClick={() => handleTileClick(tile)}
                        className={`h-28 rounded-2xl p-3 flex items-center justify-center text-center cursor-pointer select-none transition-all duration-200 border text-xs font-medium leading-snug shadow-md ${
                          isSelected 
                            ? 'bg-blue-600/30 border-blue-400 text-white scale-105 shadow-blue-500/30' 
                            : isWrong
                            ? 'bg-red-500/30 border-red-500 text-white animate-shake'
                            : 'bg-[#1e2027] border-white/10 text-gray-200 hover:border-white/25 hover:bg-[#252832]'
                        }`}
                      >
                        <span className="line-clamp-4">{tile.text}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Winner Screen */
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

          {/* MODE 3: EXPORT TO QUIZLET.COM */}
          {mode === 'export' && (
            <div className="w-full max-w-xl space-y-5 animate-fade-in">
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
                  <label className="text-xs font-semibold text-gray-400">Dữ liệu định dạng Tab-Separated:</label>
                  <button
                    onClick={handleCopyExport}
                    className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 transition"
                  >
                    {copied ? <CheckCheck size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied ? "Đã sao chép!" : "Sao chép toàn bộ"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={getExportText()}
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
        <div className="p-4 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-xs text-gray-500">
          <span>Tính năng học tập thông minh dựa trên kỹ thuật Spaced Repetition (Lặp lại ngắt quãng).</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 transition font-medium">
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
