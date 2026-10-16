import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Bot, User, FileText, ChevronRight, Paperclip, Loader, Headphones, 
  RefreshCw, BookOpen, Brain, Layers, X, Check, XCircle, Trash2, 
  Link as LinkIcon, Plus, ArrowLeft, Settings, Cpu, Cloud, Award, Sparkles,
  Copy, Download, Eye, SlidersHorizontal, FileDown, Sun, Moon, Mic, MicOff,
  Search, HelpCircle, Network, Scale, Clock, Share2, Flame, ArrowUp, ArrowDown,
  Square, ShieldAlert, ClipboardCheck, Volume2, VolumeX, Bookmark, BookmarkPlus, Shield
} from 'lucide-react';
import SettingsModal from '../components/SettingsModal';
import QuizletModal from '../components/QuizletModal';
import MarkdownRenderer from '../components/MarkdownRenderer';
import MindmapModal from '../components/MindmapModal';
import DocCompareModal from '../components/DocCompareModal';
import TimelineOutlineModal from '../components/TimelineOutlineModal';
import ShortcutsModal from '../components/ShortcutsModal';
import ShareModal from '../components/ShareModal';
import ModelManagerModal from '../components/ModelManagerModal';

function Studio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeNotebook, setActiveNotebook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [studyGuide, setStudyGuide] = useState(null);
  const [regeneratingGuide, setRegeneratingGuide] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [podcastGenerating, setPodcastGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  
  // Document selection for chat & generation context
  const [selectedDocs, setSelectedDocs] = useState(new Set());

  // Settings & Model Switching State
  const [showSettings, setShowSettings] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [availableLocalModels, setAvailableLocalModels] = useState([]);
  const [showModelManagerModal, setShowModelManagerModal] = useState(false);
  const [modelManagerInitialTab, setModelManagerInitialTab] = useState('recommend');
  const [customSavedModels, setCustomSavedModels] = useState([]);

  // Quiz & Flashcard state
  const [showQuiz, setShowQuiz] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Evaluation state
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [showEvalModal, setShowEvalModal] = useState(false);

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [uploadingDocs, setUploadingDocs] = useState([]);

  // Paste Raw Text Modal state
  const [showPasteTextModal, setShowPasteTextModal] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');

  // Custom Quizlet & Study Guide generation state
  const [showGuideConfigModal, setShowGuideConfigModal] = useState(false);
  const [guideConfig, setGuideConfig] = useState({
    quiz_count: 5,
    flashcards_count: 5,
    difficulty: 'medium',
    focus_topic: ''
  });

  // Custom Podcast state
  const [showPodcastModal, setShowPodcastModal] = useState(false);
  const [podcastConfig, setPodcastConfig] = useState({
    focus_topic: '',
    style: 'fun',
    voice_mode: 'duo'
  });

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Message copy state
  const [copiedMsgIdx, setCopiedMsgIdx] = useState(null);

  // Theme state ('dark' | 'light')
  const [theme, setTheme] = useState(() => localStorage.getItem('notebooklm_theme') || 'dark');
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('notebooklm_theme', nextTheme);
  };
  const isDark = theme === 'dark';

  // Mobile navigation tab ('docs' | 'chat' | 'studio')
  const [mobileActiveTab, setMobileActiveTab] = useState('chat');

  // Chat Search state
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // Chat Persona mode ('strict' | 'socratic' | 'critic')
  const [chatPersona, setChatPersona] = useState('strict');

  const PERSONA_CONFIGS = {
    strict: {
      id: 'strict',
      name: 'Bám sát nguồn',
      desc: 'Trả lời chính xác và chỉ dựa vào tài liệu được cung cấp, không suy diễn ngoài lề.',
      icon: Shield,
      prefix: '[Chế độ: Bám sát nguồn] Trả lời chính xác và chỉ dựa vào tài liệu được cung cấp, không suy diễn ngoài lề.\n\n'
    },
    socratic: {
      id: 'socratic',
      name: 'Gia sư Socratic',
      desc: 'Đặt câu hỏi gợi mở, hướng dẫn tư duy từng bước.',
      icon: Sparkles,
      prefix: '[Chế độ: Gia sư Socratic] Hãy đóng vai một gia sư Socratic thông thái. Đặt câu hỏi gợi mở, phân tích tư duy từng bước và giúp người học tự khám phá câu trả lời dựa trên tài liệu.\n\n'
    },
    critic: {
      id: 'critic',
      name: 'Phản biện sâu',
      desc: 'Phân tích đa chiều, chỉ ra các giả định, điểm mạnh và hạn chế trong tài liệu.',
      icon: Flame,
      prefix: '[Chế độ: Phản biện sâu] Hãy đóng vai chuyên gia phản biện học thuật sắc bén. Đánh giá đa chiều, chỉ ra các giả định ngầm, điểm mạnh và hạn chế trong tài liệu đối với câu hỏi sau.\n\n'
    }
  };

  // TTS per message state & methods
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState(null);

  const cleanTextForSpeech = (rawText) => {
    if (!rawText) return '';
    return rawText
      .replace(/\[\^?\d+\]/g, '')
      .replace(/```[\s\S]*?```/g, ' Đoạn mã. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_~#>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, '. ')
      .trim();
  };

  const handleSpeakMessage = (text, idx) => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ tính năng Web Speech Text-to-Speech.');
      return;
    }

    if (speakingMsgIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIdx(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingMsgIdx(null);
    };
    utterance.onerror = () => {
      setSpeakingMsgIdx(null);
    };

    setSpeakingMsgIdx(idx);
    window.speechSynthesis.speak(utterance);
  };

  // Pinned Notes (Bảng Ghi chú Nghiên cứu) State
  const [pinnedNotes, setPinnedNotes] = useState([]);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [isSynthesizingNotes, setIsSynthesizingNotes] = useState(false);
  const [convertingNoteId, setConvertingNoteId] = useState(null);

  // Toast Notification State
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (msg, duration = 3000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMsg(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
    }, duration);
  };

  const fetchPinnedNotes = async (nbId) => {
    if (!nbId) return;
    try {
      const res = await fetch(`/api/notebooks/${nbId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setPinnedNotes(data.notes || []);
      }
    } catch (err) {
      console.error("Lỗi lấy ghi chú ghim:", err);
    }
  };

  const handlePinNote = async (content, title = "Ghi chú", source = "manual") => {
    const targetNbId = activeNotebook?.id || id;
    if (!content || !targetNbId) return;
    try {
      const res = await fetch(`/api/notebooks/${targetNbId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title, source })
      });
      if (res.ok) {
        const data = await res.json();
        setPinnedNotes(data.notes || []);
        showToast("📌 Đã ghim vào Bảng Ghi chú!");
      }
    } catch (err) {
      console.error("Lỗi khi ghim ghi chú:", err);
      showToast("❌ Không thể ghim ghi chú: " + err.message);
    }
  };

  const handleDeleteNote = async (noteId) => {
    const targetNbId = activeNotebook?.id || id;
    if (!targetNbId || !noteId) return;
    try {
      const res = await fetch(`/api/notebooks/${targetNbId}/notes/${noteId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setPinnedNotes(data.notes || []);
        showToast("🗑️ Đã xóa ghi chú");
      }
    } catch (err) {
      console.error("Lỗi xóa ghi chú:", err);
    }
  };

  const handleSynthesizeNotes = async () => {
    const targetNbId = activeNotebook?.id || id;
    if (!targetNbId || pinnedNotes.length < 2) return;
    setIsSynthesizingNotes(true);
    try {
      const res = await fetch(`/api/notebooks/${targetNbId}/notes/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notebook-id': targetNbId
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Không thể tổng hợp ghi chú');
      }
      const data = await res.json();
      setCritiqueModal({
        isOpen: true,
        type: 'synthesis',
        title: data.title || 'Báo cáo Tổng hợp Ghi chú Nghiên cứu',
        content: data.markdown || '',
        loading: false
      });
      setShowNotesModal(false);
      showToast('✨ Đã tổng hợp Báo cáo Chuyên đề thành công!');
    } catch (err) {
      console.error("Lỗi tổng hợp ghi chú:", err);
      showToast(`❌ Lỗi: ${err.message || 'Không thể tổng hợp ghi chú'}`);
    } finally {
      setIsSynthesizingNotes(false);
    }
  };

  const handleConvertNoteToSource = async (note) => {
    const targetNbId = activeNotebook?.id || id;
    if (!targetNbId || !note) return;
    setConvertingNoteId(note.id);
    try {
      const rawTitle = (note.title || 'Ghi chú').trim();
      const docTitle = rawTitle.endsWith('.md') || rawTitle.endsWith('.txt') ? rawTitle : `${rawTitle}.md`;
      const res = await fetch('/api/ingest/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notebook-id': targetNbId
        },
        body: JSON.stringify({
          notebook_id: targetNbId,
          title: docTitle,
          text: note.content
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Không thể nạp ghi chú thành nguồn');
      }
      await fetchDocuments();
      setSelectedDocs(prev => new Set([...prev, docTitle]));
      showToast(`✅ Đã nạp "${docTitle}" thành tài liệu nguồn RAG!`);
    } catch (err) {
      console.error("Lỗi chuyển ghi chú thành nguồn:", err);
      showToast(`❌ Lỗi: ${err.message || 'Không thể chuyển ghi chú'}`);
    } finally {
      setConvertingNoteId(null);
    }
  };

  // Chat Search match indices & jump handlers
  const matchedIndices = useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    const q = chatSearchQuery.toLowerCase();
    const indices = [];
    messages.forEach((m, idx) => {
      if (m.content && m.content.toLowerCase().includes(q)) {
        indices.push(idx);
      }
    });
    return indices;
  }, [messages, chatSearchQuery]);

  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [chatSearchQuery]);

  const scrollToMatch = (matchIdx) => {
    if (matchedIndices.length === 0) return;
    const targetMsgIdx = matchedIndices[matchIdx];
    const el = document.getElementById(`msg-${targetMsgIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleNextMatch = () => {
    if (matchedIndices.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % matchedIndices.length;
    setCurrentMatchIdx(nextIdx);
    scrollToMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (matchedIndices.length === 0) return;
    const prevIdx = (currentMatchIdx - 1 + matchedIndices.length) % matchedIndices.length;
    setCurrentMatchIdx(prevIdx);
    scrollToMatch(prevIdx);
  };

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const voiceBaseTextRef = useRef('');
  const chatInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Mindmap state
  const [showMindmapModal, setShowMindmapModal] = useState(false);
  const [mindmapData, setMindmapData] = useState(null);
  const [loadingMindmap, setLoadingMindmap] = useState(false);

  // Document comparison state
  const [showDocCompareModal, setShowDocCompareModal] = useState(false);
  const [comparisonResult, setComparisonResult] = useState('');
  const [comparingDocs, setComparingDocs] = useState(false);

  // Timeline & Outline state
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineData, setTimelineData] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Shortcuts & Share modals
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Citation highlight snippet in preview
  const [highlightSnippet, setHighlightSnippet] = useState(null);

  // Source Inspector Modal State (Chunks viewer)
  const [inspectDoc, setInspectDoc] = useState(null);
  const [docChunks, setDocChunks] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkSearch, setChunkSearch] = useState('');

  // Critique & Action Plan State
  const [critiqueModal, setCritiqueModal] = useState({ isOpen: false, type: '', title: '', content: '', loading: false });

  // Tools definition for Studio Analysis
  const tools = [
    { id: 'critique', name: 'Phản biện AI', desc: 'Tìm lỗ hổng & góc nhìn phản biện', icon: ShieldAlert, endpoint: '/api/studio/critique', color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'action_plan', name: 'Kế hoạch hành động', desc: 'Action Matrix & Checklist thực thi', icon: ClipboardCheck, endpoint: '/api/studio/action-plan', color: 'text-lime-600', bg: 'bg-lime-50' },
  ];

  // Suggested questions extracted from studyGuide.faq
  const suggestedQuestions = useMemo(() => {
    if (!studyGuide?.faq) return [];
    const lines = studyGuide.faq.split('\n');
    const questions = [];
    for (const line of lines) {
      let clean = line.trim()
        .replace(/^#+\s*/, '')
        .replace(/^\*+\s*/, '')
        .replace(/^-\s*/, '')
        .replace(/^[0-9]+[.)]\s*/, '')
        .replace(/\*+/g, '')
        .trim();
      clean = clean.replace(/^[0-9]+[.)]\s*/, '').trim();
      if (clean.endsWith('?') && clean.length > 8 && clean.length < 140) {
        questions.push(clean);
      }
    }
    return questions.slice(0, 4);
  }, [studyGuide?.faq]);

  const messagesEndRef = useRef(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape closes open modals or stops generation
      if (e.key === 'Escape') {
        if (loading) {
          handleStopGenerating();
          return;
        }
        setShowModelPicker(false);
        setShowChatSearch(false);
        setShowSettings(false);
        setShowQuiz(false);
        setShowFlashcards(false);
        setShowEvalModal(false);
        setShowGuideConfigModal(false);
        setShowPodcastModal(false);
        setPreviewDoc(null);
        setShowMindmapModal(false);
        setShowDocCompareModal(false);
        setShowTimelineModal(false);
        setShowShortcutsModal(false);
        setShowShareModal(false);
        setShowModelManagerModal(false);
        setShowPasteTextModal(false);
        setShowNotesModal(false);
        setInspectDoc(null);
        setCritiqueModal(prev => ({ ...prev, isOpen: false }));
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          setSpeakingMsgIdx(null);
        }
        return;
      }

      // Check for Cmd/Ctrl modifier
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setShowModelPicker(prev => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setShowChatSearch(prev => !prev);
      } else if (e.key === '/') {
        e.preventDefault();
        chatInputRef.current?.focus();
      } else if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setShowSettings(prev => !prev);
      } else if (e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        setShowFlashcards(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch data khi mount
  useEffect(() => {
    if (!id) return;
    fetchNotebookDetails();
    fetchLocalModels();
  }, [id]);

  const fetchNotebookDetails = async () => {
    try {
      const nbRes = await fetch(`/api/notebooks/${id}`);
      if (!nbRes.ok) throw new Error("Không tìm thấy sổ tay");
      const nb = await nbRes.json();
      setActiveNotebook(nb);
      
      const msgRes = await fetch(`/api/notebooks/${nb.id}/messages`);
      const msgs = await msgRes.json();
      if (msgs && msgs.length > 0) {
        setMessages(msgs);
      } else {
        const modelLabel = nb.model_name ? ` (${nb.provider?.toUpperCase()}: ${nb.model_name})` : '';
        setMessages([{ 
          role: 'assistant', 
          content: `Xin chào! Bạn đang ở sổ tay "${nb.title}"${modelLabel}. Hãy tải tài liệu hoặc gửi link bài viết/YouTube để bắt đầu hỏi đáp nhé!`, 
          citations: [] 
        }]);
      }

      const guideRes = await fetch(`/api/notebooks/${nb.id}/study-guide`);
      if (guideRes.ok) {
        const guide = await guideRes.json();
        setStudyGuide(guide);
      }

      const docRes = await fetch(`/api/notebooks/${nb.id}/documents`);
      if (docRes.ok) {
        const docs = await docRes.json();
        setDocuments(docs);
        setSelectedDocs(new Set(docs.map(d => d.filename)));
      }
      fetchPinnedNotes(nb.id);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLocalModels = async () => {
    try {
      const res = await fetch('/api/llm/local-models');
      const data = await res.json();
      setAvailableLocalModels(data?.ollama?.models || []);
      
      const storedCustom = localStorage.getItem('custom_ai_models');
      if (storedCustom) {
        setCustomSavedModels(JSON.parse(storedCustom));
      }
    } catch (e) {
      console.error("Lỗi lấy local models:", e);
    }
  };

  // Switch model on the fly for active notebook
  const handleSwitchModel = async (newProvider, newModelName, newBaseUrl, newApiKey) => {
    setShowModelPicker(false);
    try {
      const payload = {
        provider: newProvider,
        model_name: newModelName,
        is_private: ['ollama', 'lm_studio', 'local_ai'].includes(newProvider)
      };
      if (newBaseUrl !== undefined) payload.base_url = newBaseUrl;
      if (newApiKey !== undefined) payload.api_key = newApiKey;

      const res = await fetch(`/api/notebooks/${activeNotebook.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveNotebook(updated.notebook);
      }
    } catch (e) {
      console.error("Lỗi đổi model:", e);
    }
  };

  // Quản lý việc chọn/bỏ chọn tài liệu làm ngữ cảnh
  const toggleSelectDoc = (filename) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const handleSelectAllDocs = () => {
    setSelectedDocs(new Set(documents.map(d => d.filename)));
  };

  const handleDeselectAllDocs = () => {
    setSelectedDocs(new Set());
  };

  // Polling Study Guide if it is null AND there are documents
  useEffect(() => {
    let intervalId;
    if (activeNotebook && !studyGuide && documents.length > 0) {
      intervalId = setInterval(async () => {
        try {
          const guideRes = await fetch(`/api/notebooks/${activeNotebook.id}/study-guide`);
          if (guideRes.ok) {
            const guide = await guideRes.json();
            if (guide) {
              setStudyGuide(guide);
              clearInterval(intervalId);
            }
          }
        } catch (e) {
          console.error("Lỗi khi poll Study Guide:", e);
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeNotebook, studyGuide, documents]);

  const handleRegenerateStudyGuide = async () => {
    if (!activeNotebook || regeneratingGuide) return;
    setRegeneratingGuide(true);
    try {
      await fetch(`/api/notebooks/${activeNotebook.id}/study-guide/regenerate`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...guideConfig,
          selected_documents: selectedDocs.size > 0 ? Array.from(selectedDocs) : (documents || []).map(d => d.filename)
        })
      });
      setStudyGuide(null); // Kích hoạt polling
    } catch (e) {
      alert("Lỗi khi yêu cầu tạo lại cẩm nang: " + e.message);
    } finally {
      setTimeout(() => setRegeneratingGuide(false), 2000);
    }
  };

  const handleGenerateCustomGuide = async () => {
    if (!activeNotebook || regeneratingGuide) return;
    setShowGuideConfigModal(false);
    setShowQuiz(false);
    setShowFlashcards(false);
    setRegeneratingGuide(true);
    try {
      await fetch(`/api/notebooks/${activeNotebook.id}/study-guide/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...guideConfig,
          selected_documents: selectedDocs.size > 0 ? Array.from(selectedDocs) : (documents || []).map(d => d.filename)
        })
      });
      setStudyGuide(null); // Kích hoạt polling cập nhật giao diện
    } catch (e) {
      alert("Lỗi khi tạo lại cẩm nang: " + e.message);
    } finally {
      setTimeout(() => setRegeneratingGuide(false), 2000);
    }
  };

  const generatePodcast = async () => {
    if (!activeNotebook) return;
    setPodcastGenerating(true);
    setShowPodcastModal(false);
    setAudioUrl(null);
    try {
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notebook_id: activeNotebook.id,
          focus_topic: podcastConfig.focus_topic,
          style: podcastConfig.style,
          voice_mode: podcastConfig.voice_mode || 'duo',
          selected_documents: selectedDocs.size > 0 ? Array.from(selectedDocs) : (documents || []).map(d => d.filename)
        })
      });
      if (!res.ok) throw new Error("Lỗi khi gọi API tạo Podcast");
      
      // Polling kiểm tra tiến trình Podcast mỗi 2s (tối đa 60 lần ~ 120 giây)
      let attempts = 0;
      const maxAttempts = 60;
      const pollAudio = setInterval(async () => {
        attempts += 1;
        try {
          // 1. Kiểm tra status endpoint
          const statusRes = await fetch(`/api/podcast/status/${activeNotebook.id}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.has_audio || statusData.status === 'completed') {
              clearInterval(pollAudio);
              setAudioUrl(`/api/podcast/audio/${activeNotebook.id}?t=${Date.now()}`);
              setPodcastGenerating(false);
              showToast("🎉 Podcast đã được tạo thành công!");
              return;
            }
            if (statusData.status === 'error') {
              clearInterval(pollAudio);
              setPodcastGenerating(false);
              showToast(`❌ Lỗi tạo Podcast: ${statusData.error || 'Thất bại'}`);
              return;
            }
          }

          // 2. Dự phòng kiểm tra trực tiếp file audio
          const checkRes = await fetch(`/api/podcast/audio/${activeNotebook.id}`);
          if (checkRes.ok && checkRes.status === 200) {
            clearInterval(pollAudio);
            setAudioUrl(`/api/podcast/audio/${activeNotebook.id}?t=${Date.now()}`);
            setPodcastGenerating(false);
            showToast("🎉 Podcast đã được tạo thành công!");
            return;
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollAudio);
            setPodcastGenerating(false);
            showToast("⚠️ Quá thời gian tạo Podcast. Vui lòng kiểm tra lại kết nối mô hình AI và thử lại.", 5000);
          }
        } catch (pollErr) {
          if (attempts >= maxAttempts) {
            clearInterval(pollAudio);
            setPodcastGenerating(false);
            showToast("⚠️ Quá thời gian tạo Podcast. Vui lòng thử lại.", 5000);
          }
        }
      }, 2000);
    } catch (e) {
      console.error(e);
      showToast("❌ Lỗi tạo podcast: " + e.message);
      setPodcastGenerating(false);
    }
  };

  const handleCopyMessage = (content, idx) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  };

  const handleExportChat = () => {
    if (!messages || messages.length === 0) {
      alert("Chưa có tin nhắn nào để xuất!");
      return;
    }
    let md = `# Sổ tay: ${activeNotebook?.title || 'NotebookLM'}\n\n`;
    md += `*Thời gian xuất: ${new Date().toLocaleString('vi-VN')}*\n`;
    md += `*Mô hình: ${currentProvider?.toUpperCase()}: ${currentModel}*\n\n`;
    md += `---\n\n`;

    messages.forEach((msg) => {
      const roleName = msg.role === 'user' ? '👤 **Người dùng:**' : '🤖 **Trợ lý AI:**';
      md += `${roleName}\n\n${msg.content || ''}\n\n`;
      if (msg.citations && msg.citations.length > 0) {
        md += `> **Trích dẫn nguồn:**\n`;
        msg.citations.forEach((c) => {
          md += `> - [${c.marker}] ${c.filename}\n`;
        });
        md += `\n`;
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (activeNotebook?.title || 'cuoc_tro_chuyen').replace(/[\s/\\?%*:|"<>]/g, '_');
    a.download = `${safeTitle}_chat_history.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Feature #5: Message Delete & Clear ---
  const handleDeleteMessage = async (msgId, index) => {
    if (msgId) {
      try {
        await fetch(`/api/notebooks/${activeNotebook.id}/messages/${msgId}`, { method: 'DELETE' });
      } catch (e) {
        console.error("Lỗi xóa tin nhắn:", e);
      }
    }
    setMessages(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAllMessages = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện của sổ tay này?")) return;
    try {
      await fetch(`/api/notebooks/${activeNotebook.id}/messages`, { method: 'DELETE' });
      setMessages([]);
    } catch (e) {
      console.error("Lỗi xóa toàn bộ hội thoại:", e);
    }
  };

  // --- Feature #10: Voice Input via Web Speech API ---
  const handleVoiceToggle = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói trực tiếp. Vui lòng dùng Chrome, Edge hoặc Cốc Cốc.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;

      // Lưu lại văn bản hiện có trước khi ghi âm để không bị ghi đè hoặc lặp
      voiceBaseTextRef.current = input.trim();

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalStr += item[0]?.transcript || '';
          } else {
            interimStr += item[0]?.transcript || '';
          }
        }
        const spoken = (finalStr + interimStr).trim();
        if (spoken) {
          const base = voiceBaseTextRef.current;
          setInput(base ? `${base} ${spoken}` : spoken);
        }
      };
      recognition.onerror = (e) => {
        console.error("Lỗi nhận diện âm thanh:", e);
        setIsRecording(false);
      };
      recognition.onend = () => setIsRecording(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };

  // --- Feature #13: Click Citation to Highlight in Preview ---
  const handleCitationClick = async (cit) => {
    setLoadingPreview(true);
    setHighlightSnippet(cit.snippet || null);
    setPreviewDoc({ filename: cit.filename, loading: true });
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/documents/preview?filename=${encodeURIComponent(cit.filename)}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewDoc(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPreview(false);
    }
  };

  // --- Feature #8: Mindmap Handlers ---
  const handleOpenMindmap = async () => {
    setShowMindmapModal(true);
    if (!mindmapData) {
      setLoadingMindmap(true);
      try {
        const res = await fetch(`/api/notebooks/${activeNotebook.id}/mindmap`);
        const data = await res.json();
        if (data.mindmap) {
          setMindmapData(data.mindmap);
        } else {
          await handleRegenerateMindmap();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMindmap(false);
      }
    }
  };

  const handleRegenerateMindmap = async (topic = "") => {
    setLoadingMindmap(true);
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/mindmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          focus_topic: topic,
          selected_documents: selectedDocs.size > 0 ? Array.from(selectedDocs) : (documents || []).map(d => d.filename)
        })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Lỗi máy chủ (${res.status})`);
      }
      const data = await res.json();
      if (data.mindmap) {
        setMindmapData(data.mindmap);
      }
    } catch (e) {
      alert("Lỗi tạo sơ đồ tư duy: " + e.message);
    } finally {
      setLoadingMindmap(false);
    }
  };

  // --- Feature #15: Timeline & Outline Handlers ---
  const handleOpenTimeline = async () => {
    setShowTimelineModal(true);
    if (!timelineData) {
      setLoadingTimeline(true);
      try {
        const res = await fetch(`/api/notebooks/${activeNotebook.id}/timeline-outline`);
        if (res.ok) {
          const data = await res.json();
          if (data.timeline_outline) {
            setTimelineData(data.timeline_outline);
          } else {
            await handleRegenerateTimeline();
          }
        } else {
          await handleRegenerateTimeline();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingTimeline(false);
      }
    }
  };

  const handleRegenerateTimeline = async (topic = "") => {
    setLoadingTimeline(true);
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/timeline-outline/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          focus_topic: topic,
          selected_documents: selectedDocs.size > 0 ? Array.from(selectedDocs) : (documents || []).map(d => d.filename)
        })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Lỗi máy chủ (${res.status})`);
      }
      const data = await res.json();
      if (data.timeline_outline) {
        setTimelineData(data.timeline_outline);
      }
    } catch (e) {
      alert("Lỗi trích xuất dòng thời gian & dàn ý: " + e.message);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // --- Feature #9: Document Comparison Handler ---
  const handleCompareDocs = async (selectedDocList, topic = "") => {
    setComparingDocs(true);
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/documents/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: selectedDocList, focus_topic: topic })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Lỗi máy chủ (${res.status})`);
      }
      const data = await res.json();
      if (data.comparison) {
        setComparisonResult(data.comparison);
      } else {
        alert("Không nhận được kết quả so sánh.");
      }
    } catch (e) {
      alert("Lỗi khi so sánh tài liệu: " + e.message);
    } finally {
      setComparingDocs(false);
    }
  };


  // --- Feature #12: Export Notebook JSON ---
  const handleExportNotebookJson = async () => {
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/export`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notebook-${(activeNotebook.title || 'backup').replace(/[\s/\\?%*:|"<>]/g, '_')}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Lỗi xuất dữ liệu: " + e.message);
    }
  };

  const handlePreviewDocument = async (filename) => {
    setHighlightSnippet(null);
    setLoadingPreview(true);
    setPreviewDoc({ filename, loading: true });
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/documents/preview?filename=${encodeURIComponent(filename)}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewDoc(data);
      } else {
        setPreviewDoc({ filename, preview_text: "Không thể lấy nội dung xem trước của tài liệu này." });
      }
    } catch (e) {
      setPreviewDoc({ filename, preview_text: "Lỗi kết nối khi xem trước tài liệu: " + e.message });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleInspectChunks = async (sourceName, e) => {
    if (e) e.stopPropagation();
    setInspectDoc(sourceName);
    setLoadingChunks(true);
    setChunkSearch('');
    try {
      const res = await fetch(`/api/documents/chunks?source=${encodeURIComponent(sourceName)}&notebook_id=${activeNotebook?.id || ''}`);
      if (res.ok) {
        const data = await res.json();
        setDocChunks(data.chunks || []);
      } else {
        setDocChunks([]);
      }
    } catch (err) {
      console.error("Lỗi tải chunks:", err);
      setDocChunks([]);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleRunStudioTool = async (toolId) => {
    const isCritique = toolId === 'critique';
    const nbId = activeNotebook?.id || id || '';
    const endpoint = isCritique 
      ? `/api/studio/critique?notebook_id=${encodeURIComponent(nbId)}` 
      : `/api/studio/action-plan?notebook_id=${encodeURIComponent(nbId)}`;
    const title = isCritique ? 'Báo Cáo Phản Biện & Tìm Lỗ Hổng (Peer Review)' : 'Kế Hoạch Hành Động Thực Tiễn (Action Plan)';
    
    setCritiqueModal({ isOpen: true, type: toolId, title, content: '', loading: true });
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-notebook-id': nbId
        },
        body: JSON.stringify({
          notebook_id: nbId,
          source_filter: selectedDocs.size === 1 ? Array.from(selectedDocs)[0] : null,
          selected_documents: selectedDocs.size > 0 ? Array.from(selectedDocs) : (documents || []).map(d => d.filename)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCritiqueModal({ isOpen: true, type: toolId, title, content: data.content || data.error || 'Không có kết quả phân tích.', loading: false });
      } else {
        const err = await res.json().catch(() => ({}));
        setCritiqueModal({ isOpen: true, type: toolId, title, content: err.detail || 'Lỗi khi gọi API phân tích.', loading: false });
      }
    } catch (e) {
      setCritiqueModal({ isOpen: true, type: toolId, title, content: 'Lỗi kết nối máy chủ: ' + e.message, loading: false });
    }
  };

  const deleteNotebook = async () => {
    if (!activeNotebook) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa sổ tay này và toàn bộ dữ liệu bên trong không?")) return;
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}`, { method: 'DELETE' });
      if (res.ok) {
        navigate('/dashboard');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInputValue.trim() || !activeNotebook) return;
    
    let urlToSubmit = urlInputValue.trim();
    if (!urlToSubmit.startsWith('http://') && !urlToSubmit.startsWith('https://')) {
      urlToSubmit = 'https://' + urlToSubmit;
    }

    setLoading(true);
    setShowUrlInput(false);
    setUploadingDocs(prev => [...prev, { filename: urlToSubmit }]);
    
    try {
      const formData = new FormData();
      formData.append('url', urlToSubmit);
      formData.append('notebook_id', activeNotebook.id);

      const res = await fetch('/api/ingest/url', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        throw new Error(`Mã lỗi từ máy chủ: ${res.status}`);
      }

      await res.json();
      setUrlInputValue('');
      
      const docRes = await fetch(`/api/notebooks/${activeNotebook.id}/documents`);
      if (docRes.ok) {
        const newDocs = await docRes.json();
        setDocuments(newDocs);
        setSelectedDocs(new Set(newDocs.map(d => d.filename)));
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Lỗi khi nạp link: ${e.message}`, citations: [] }]);
    } finally {
      setLoading(false);
      setUploadingDocs(prev => prev.filter(d => d.filename !== urlToSubmit));
    }
  };

  // Hỗ trợ tải lên NHIỀU FILE cùng lúc (Multi-file Upload)
  const handleFileUpload = async (e) => {
    if (!activeNotebook) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadingDocs(prev => [...prev, ...files.map(f => ({ filename: f.name }))]);

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('notebook_id', activeNotebook.id);

      try {
        const response = await fetch('/api/ingest/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error(`Upload failed: ${file.name}`);
        await response.json();
        setSelectedDocs(prev => new Set([...prev, file.name]));
      } catch (err) {
        console.error(err);
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Lỗi khi tải tệp "${file.name}": ${err.message}`, citations: [] }]);
      } finally {
        setUploadingDocs(prev => prev.filter(d => d.filename !== file.name));
      }
    }

    try {
      const docRes = await fetch(`/api/notebooks/${activeNotebook.id}/documents`);
      if (docRes.ok) {
        const newDocs = await docRes.json();
        setDocuments(newDocs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  // Nạp văn bản dán trực tiếp (Paste Text)
  const handlePasteTextSubmit = async () => {
    if (!pasteContent.trim() || !activeNotebook) return;
    const tempTitle = pasteTitle.trim() || `Ghi chú (${new Date().toLocaleTimeString('vi-VN')}).txt`;
    setShowPasteTextModal(false);
    setUploading(true);
    setUploadingDocs(prev => [...prev, { filename: tempTitle }]);

    try {
      const res = await fetch('/api/ingest/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebook_id: activeNotebook.id,
          title: tempTitle,
          text: pasteContent
        })
      });
      if (!res.ok) throw new Error(`Mã lỗi: ${res.status}`);
      const data = await res.json();
      setPasteTitle('');
      setPasteContent('');

      const docRes = await fetch(`/api/notebooks/${activeNotebook.id}/documents`);
      if (docRes.ok) {
        const newDocs = await docRes.json();
        setDocuments(newDocs);
        setSelectedDocs(prev => new Set([...prev, data.filename || tempTitle]));
      }
    } catch (e) {
      alert("Lỗi khi nạp văn bản: " + e.message);
    } finally {
      setUploading(false);
      setUploadingDocs(prev => prev.filter(d => d.filename !== tempTitle));
    }
  };

  const deleteDocument = async (filename) => {
    if (!activeNotebook) return;
    if (!window.confirm(`Bạn có chắc muốn xóa tài liệu "${filename}"?`)) return;
    
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/documents?filename=${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.filename !== filename));
        setSelectedDocs(prev => {
          const next = new Set(prev);
          next.delete(filename);
          return next;
        });
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeNotebook) return;
    
    // Hủy bỏ request trước đó nếu còn đang chạy
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '', citations: [] }]);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-notebook-id': activeNotebook.id
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({ 
          query: userMsg, 
          persona: chatPersona,
          notebook_id: activeNotebook.id,
          provider: activeNotebook.provider,
          model_name: activeNotebook.model_name,
          selected_documents: Array.from(selectedDocs)
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const events = buffer.split('\n\n');
        buffer = events.pop() || "";
        
        for (const event of events) {
          if (event.startsWith("data: ")) {
            const dataStr = event.substring(6);
            try {
              const data = JSON.parse(dataStr);
              
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                
                if (data.type === 'citations') {
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    citations: data.citations
                  };
                } else if (data.type === 'chunk') {
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: newMessages[lastIndex].content + data.text,
                    status: null
                  };
                } else if (data.type === 'status') {
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    status: data.message
                  };
                } else if (data.type === 'saved') {
                  if (lastIndex >= 1 && data.user_msg_id) {
                    newMessages[lastIndex - 1] = { ...newMessages[lastIndex - 1], id: data.user_msg_id };
                  }
                  if (data.assistant_msg_id) {
                    newMessages[lastIndex] = { ...newMessages[lastIndex], id: data.assistant_msg_id };
                  }
                }
                
                return newMessages;
              });
            } catch (e) {
              console.error("Lỗi parse JSON SSE", e);
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Đã dừng tạo phản hồi.");
        return;
      }
      console.error(err);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content: 'Xin lỗi, có lỗi xảy ra khi kết nối tới LLM Engine.'
        };
        return newMessages;
      });
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Tính năng: Dừng câu trả lời ngay lập tức
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const lastIndex = prev.length - 1;
      const lastMsg = prev[lastIndex];
      if (lastMsg && lastMsg.role === 'assistant') {
        const newMessages = [...prev];
        newMessages[lastIndex] = {
          ...lastMsg,
          content: (lastMsg.content || '') + (lastMsg.content ? ' _(Đã dừng câu trả lời)_' : '_(Đã dừng câu trả lời)_'),
          status: null
        };
        return newMessages;
      }
      return prev;
    });
  };

  const handleEvaluate = async () => {
    if (!activeNotebook) return;
    setEvaluating(true);
    try {
      const formData = new FormData();
      formData.append('notebook_id', activeNotebook.id);
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success' && data.metrics) {
        setEvalResult(data.metrics);
        setShowEvalModal(true);
      } else {
        alert("Lỗi đánh giá: " + (data.message || 'Không có kết quả'));
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi đánh giá: " + e.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) {
        handleSend();
      }
    }
  };

  if (!activeNotebook) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#131314] text-white">
        <Loader className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const currentProvider = activeNotebook.provider || (activeNotebook.is_private ? 'ollama' : 'gemini');
  const currentModel = activeNotebook.model_name || (currentProvider === 'ollama' ? 'qwen2.5:3b' : 'gemini-2.5-flash');

  return (
    <div className={`h-screen w-full flex overflow-hidden font-sans transition-colors ${
      isDark ? 'bg-[#101216] text-white selection:bg-blue-500/30' : 'bg-[#f8fafc] text-slate-900 selection:bg-blue-200'
    }`}>
      
      {/* Cột 1: Left Sidebar (Sources) */}
      <div className={`w-64 xl:w-72 flex-shrink-0 h-full border-r flex flex-col p-4 z-20 relative transition-colors ${
        isDark ? 'bg-[#14161a] border-white/5' : 'bg-white border-slate-200'
      } ${mobileActiveTab === 'docs' ? 'flex fixed inset-0 z-40 w-full md:relative md:w-64 xl:md:w-72' : 'hidden lg:flex'}`}>
        
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4 min-h-[44px]">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft size={16} /> Quay lại
          </button>
          {mobileActiveTab === 'docs' && (
            <button 
              onClick={() => setMobileActiveTab('chat')}
              className="lg:hidden text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white"
            >
              Đóng
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Layers size={17} className="text-blue-400" /> Nguồn ({documents.length})
          </h2>
          {documents.length >= 2 && (
            <button
              onClick={() => setShowDocCompareModal(true)}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-semibold transition"
              title="So sánh & đối chiếu các tài liệu đã tải lên"
            >
              <Scale size={11} /> So sánh
            </button>
          )}
        </div>

        {/* Thanh công cụ chọn tài liệu làm ngữ cảnh */}
        {documents.length > 0 && (
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[11px]">
            <span className="text-gray-400">
              Đang chọn: <strong className={selectedDocs.size > 0 ? "text-green-400" : "text-amber-400"}>{selectedDocs.size}/{documents.length}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllDocs}
                className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
              >
                Tất cả
              </button>
              <span className="text-gray-600">•</span>
              <button
                type="button"
                onClick={handleDeselectAllDocs}
                className="text-gray-400 hover:text-gray-200 font-medium hover:underline"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {documents.length === 0 && uploadingDocs.length === 0 ? (
            <div className="text-center text-gray-500 text-xs mt-12 px-4 leading-relaxed">
              Chưa có tài liệu nào.<br />Hãy tải tệp PDF, Word, Ảnh hoặc dán Link bài viết vào đây.
            </div>
          ) : (
            <>
              {uploadingDocs.map((doc, index) => (
                <div key={`up-${index}`} className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2.5 opacity-70">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <Loader size={16} className="animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-gray-200" title={doc.filename}>{doc.filename}</p>
                    <p className="text-[10px] text-blue-400 truncate mt-0.5">Đang xử lý & nhúng vector...</p>
                  </div>
                </div>
              ))}
              {documents.map((doc, index) => {
                const isSelected = selectedDocs.has(doc.filename);
                return (
                  <div 
                    key={`doc-${index}`} 
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 group transition cursor-pointer ${
                      isSelected 
                        ? 'bg-white/[0.04] border-white/15 hover:bg-white/[0.08]' 
                        : 'bg-black/20 border-white/5 opacity-50 hover:opacity-75'
                    }`}
                    onClick={() => toggleSelectDoc(doc.filename)}
                    title={isSelected ? "Đang chọn làm ngữ cảnh (Bấm để bỏ chọn)" : "Chưa chọn (Bấm để chọn làm ngữ cảnh)"}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectDoc(doc.filename);
                        }}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                          isSelected 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'border-white/30 bg-white/5 hover:border-white/50 text-transparent'
                        }`}
                        title={isSelected ? "Bỏ chọn" : "Chọn làm ngữ cảnh"}
                      >
                        <Check size={11} strokeWidth={3} />
                      </button>

                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                        {doc.filename.includes('http') || doc.filename.includes('YouTube') ? <LinkIcon size={14} /> : <FileText size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-gray-200' : 'text-gray-400'}`} title={doc.filename}>
                          {doc.filename}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{new Date(doc.created_at).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={(e) => handleInspectChunks(doc.filename, e)}
                        className="p-1.5 rounded text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                        title="Xem các đoạn (Chunks) đã bóc tách"
                      >
                        <Eye size={13} />
                      </button>
                      <button 
                        onClick={() => handlePreviewDocument(doc.filename)}
                        className="p-1.5 rounded text-gray-400 hover:text-blue-400 hover:bg-white/10 transition"
                        title="Xem toàn văn trích xuất"
                      >
                        <FileText size={13} />
                      </button>
                      <button 
                        onClick={() => deleteDocument(doc.filename)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-white/10 transition"
                        title="Xóa tài liệu"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="pt-3 mt-auto border-t border-white/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="bg-white/5 hover:bg-white/10 text-gray-200 py-2 rounded-xl flex justify-center items-center gap-1.5 font-medium text-xs transition border border-white/10"
            >
              <LinkIcon size={14} /> Link / YT
            </button>
            <button 
              onClick={() => setShowPasteTextModal(true)}
              className="bg-white/5 hover:bg-white/10 text-gray-200 py-2 rounded-xl flex justify-center items-center gap-1.5 font-medium text-xs transition border border-white/10"
            >
              <FileText size={14} /> Dán văn bản
            </button>
          </div>
          <button 
            onClick={() => document.getElementById('file-upload').click()}
            className="w-full bg-white text-black hover:bg-gray-200 py-2.5 rounded-xl flex justify-center items-center gap-2 font-semibold text-xs transition shadow-lg"
          >
            <Plus size={15} /> Tải tệp lên (Nhiều tệp)
          </button>
        </div>
      </div>

      {/* Cột 2: Center (Chat) */}
      <div className="flex-1 min-w-0 flex flex-col h-full border-r border-white/5 p-4 max-w-4xl mx-auto relative z-10">
        
        {/* Chat Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4 gap-2 flex-nowrap min-h-[44px]">
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <h2 className="text-sm sm:text-base font-bold flex items-center gap-2 text-white truncate max-w-[130px] sm:max-w-[180px]" title={activeNotebook.title}>
              <FileText className="text-blue-500 shrink-0" size={18}/>
              <span className="truncate">{activeNotebook.title}</span>
            </h2>

            {/* Quick Model Selector Chip */}
            <div className="relative shrink-0">
              <button 
                onClick={() => setShowModelPicker(!showModelPicker)}
                className={`h-8 flex items-center gap-1.5 text-xs font-semibold px-2.5 rounded-xl border transition cursor-pointer shadow-sm hover:brightness-110 ${
                  currentProvider === 'ollama' 
                    ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' 
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                }`}
                title="Bấm để đổi mô hình AI"
              >
                {currentProvider === 'ollama' ? <Cpu size={13} className="shrink-0 text-green-400" /> : <Cloud size={13} className="shrink-0 text-blue-400" />}
                <span className="font-mono text-xs max-w-[110px] sm:max-w-[160px] truncate">{currentProvider.toUpperCase()}: {currentModel}</span>
                <span className="text-[10px] opacity-60">▾</span>
              </button>

              {/* Model Picker Dropdown */}
              {showModelPicker && (
                <div className="absolute left-0 mt-2 w-72 bg-[#1c1e24] border border-white/15 rounded-xl shadow-2xl p-2 z-30 space-y-1 animate-fade-in max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Đổi Mô hình AI
                    </div>
                    <button
                      onClick={() => {
                        setShowModelPicker(false);
                        setModelManagerInitialTab('recommend');
                        setShowModelManagerModal(true);
                      }}
                      className="text-[10px] text-green-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Sparkles size={11} /> Gợi ý tải
                    </button>
                  </div>
                  
                  {/* Action buttons (fixed equal height) */}
                  <div className="grid grid-cols-2 gap-1.5 pb-1.5 border-b border-white/10">
                    <button
                      onClick={() => {
                        setShowModelPicker(false);
                        setModelManagerInitialTab('recommend');
                        setShowModelManagerModal(true);
                      }}
                      className="h-8 px-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-[11px] font-medium flex items-center justify-center gap-1 transition"
                    >
                      <Sparkles size={12} /> Gợi ý tải
                    </button>
                    <button
                      onClick={() => {
                        setShowModelPicker(false);
                        setModelManagerInitialTab('add_custom');
                        setShowModelManagerModal(true);
                      }}
                      className="h-8 px-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-[11px] font-medium flex items-center justify-center gap-1 transition"
                    >
                      <Plus size={12} /> Thêm model
                    </button>
                  </div>

                  {/* Ollama local models */}
                  <div className="flex items-center justify-between text-[10px] text-green-400 px-2 pt-1 font-medium">
                    <span>Ollama (Trên máy):</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchLocalModels();
                      }}
                      className="text-gray-400 hover:text-white flex items-center gap-0.5 text-[9px]"
                      title="Quét lại các mô hình Ollama trên máy"
                    >
                      <RefreshCw size={9} /> Quét lại
                    </button>
                  </div>

                  {availableLocalModels.length > 0 ? (
                    availableLocalModels.map(m => (
                      <button
                        key={m.name}
                        onClick={() => handleSwitchModel('ollama', m.name)}
                        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-white/10 transition ${
                          currentProvider === 'ollama' && currentModel === m.name ? 'bg-green-500/20 text-green-300 font-semibold' : 'text-gray-300'
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className="text-[10px] text-gray-500">{m.size_gb}GB</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-1 text-[11px] text-gray-500 italic">
                      Chưa có model Ollama nào.{' '}
                      <button 
                        onClick={() => {
                          setShowModelPicker(false);
                          setModelManagerInitialTab('recommend');
                          setShowModelManagerModal(true);
                        }}
                        className="text-green-400 underline font-normal"
                      >
                        Tải ngay (1-click)
                      </button>
                    </div>
                  )}

                  {/* Custom Saved Models */}
                  {customSavedModels.length > 0 && (
                    <>
                      <div className="text-[10px] text-purple-400 px-2 pt-2 font-medium">Model tùy chỉnh đã lưu:</div>
                      {customSavedModels.map((cm, idx) => {
                        const targetModel = cm.model_name || cm.model;
                        return (
                          <button
                            key={cm.id || idx}
                            onClick={() => handleSwitchModel(cm.provider, targetModel, cm.base_url, cm.api_key)}
                            className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition flex items-center justify-between ${
                              currentModel === targetModel ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'text-gray-300'
                            }`}
                          >
                            <span className="truncate">{cm.name || targetModel}</span>
                            <span className="text-[9px] uppercase bg-white/10 px-1 rounded text-gray-400">{cm.provider}</span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  <div className="text-[10px] text-orange-400 px-2 pt-2 font-medium">9Router Gateway (Mới nhất):</div>
                  <button
                    onClick={() => handleSwitchModel('9router', 'kr/claude-sonnet-4.5')}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition flex items-center justify-between ${
                      currentProvider === '9router' && currentModel === 'kr/claude-sonnet-4.5' ? 'bg-orange-500/20 text-orange-300 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    <span>Claude 3.7 / 4.5 Sonnet</span>
                    <span className="text-[9px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-mono">Top 1</span>
                  </button>
                  <button
                    onClick={() => handleSwitchModel('9router', 'kr/deepseek-3.2')}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition flex items-center justify-between ${
                      currentProvider === '9router' && currentModel === 'kr/deepseek-3.2' ? 'bg-orange-500/20 text-orange-300 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    <span>DeepSeek V3.2</span>
                    <span className="text-[9px] bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded font-mono">Mới</span>
                  </button>
                  <button
                    onClick={() => handleSwitchModel('9router', 'kr/auto')}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition flex items-center justify-between ${
                      currentProvider === '9router' && currentModel === 'kr/auto' ? 'bg-orange-500/20 text-orange-300 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    <span>Auto Router (Tự chọn model tốt)</span>
                    <span className="text-[9px] bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded font-mono">Auto</span>
                  </button>
                  <button
                    onClick={() => handleSwitchModel('9router', 'kr/glm-5')}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition ${
                      currentProvider === '9router' && currentModel === 'kr/glm-5' ? 'bg-orange-500/20 text-orange-300 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    GLM 5.0
                  </button>
                  <button
                    onClick={() => handleSwitchModel('9router', 'gemini-2.5-flash')}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition ${
                      currentProvider === '9router' && currentModel === 'gemini-2.5-flash' ? 'bg-orange-500/20 text-orange-300 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    Gemini 2.5 Flash
                  </button>

                  <div className="text-[10px] text-blue-400 px-2 pt-2 font-medium">Cloud AI:</div>
                  <button
                    onClick={() => handleSwitchModel('gemini', 'gemini-2.5-flash')}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition ${
                      currentProvider === 'gemini' ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    Google Gemini (2.5 Flash)
                  </button>
                  <button
                    onClick={() => handleSwitchModel('groq', 'llama-3.3-70b-versatile')}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition ${
                      currentProvider === 'groq' ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    Groq (Llama-3.3 70B)
                  </button>

                  <div className="pt-1.5 mt-1 border-t border-white/10 flex items-center justify-between">
                    <button
                      onClick={() => { setShowModelPicker(false); setShowSettings(true); }}
                      className="text-left text-[11px] text-blue-400 hover:underline px-2 py-1 flex items-center gap-1"
                    >
                      <Settings size={12} /> Cài đặt API...
                    </button>
                    <button
                      onClick={() => { 
                        setShowModelPicker(false); 
                        setModelManagerInitialTab('installed'); 
                        setShowModelManagerModal(true); 
                      }}
                      className="text-left text-[11px] text-gray-400 hover:text-white px-2 py-1 flex items-center gap-1"
                    >
                      <Cpu size={12} /> Quản lý máy...
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile Column Switchers */}
            <button
              onClick={() => setMobileActiveTab('docs')}
              className="lg:hidden h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white flex items-center justify-center shrink-0"
              title="Mở danh sách tài liệu"
            >
              <FileText size={14} />
            </button>
            <button
              onClick={() => setMobileActiveTab('studio')}
              className="lg:hidden h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white flex items-center justify-center shrink-0"
              title="Mở cẩm nang & công cụ học"
            >
              <BookOpen size={14} />
            </button>

            {/* Chat Search Toggle Button */}
            <button 
              onClick={() => {
                setShowChatSearch(prev => !prev);
                setChatSearchQuery('');
              }}
              className={`h-8 w-8 rounded-xl border transition flex items-center justify-center font-medium shrink-0 ${
                showChatSearch 
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300' 
                  : (isDark ? 'border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200')
              }`}
              title="Tìm kiếm trong lịch sử chat (Ctrl + F)"
            >
              <Search size={14} />
            </button>

            {/* Clear Chat Button */}
            <button 
              onClick={handleClearAllMessages}
              disabled={messages.length === 0}
              className={`h-8 w-8 rounded-xl border transition flex items-center justify-center font-medium disabled:opacity-30 shrink-0 ${
                isDark ? 'border-white/10 bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20' : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-red-500 hover:bg-red-50'
              }`}
              title="Xóa toàn bộ hội thoại chat"
            >
              <Trash2 size={14} />
            </button>

            {/* Share & Export Notebook Modal */}
            <button 
              onClick={() => setShowShareModal(true)}
              className={`h-8 w-8 rounded-xl border transition flex items-center justify-center font-medium shrink-0 ${
                isDark ? 'border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Chia sẻ & Xuất dữ liệu sổ tay"
            >
              <Share2 size={14} />
            </button>

            {/* Export Chat to Markdown */}
            <button 
              onClick={handleExportChat}
              className={`h-8 w-8 rounded-xl border transition flex items-center justify-center font-medium shrink-0 ${
                isDark ? 'border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Xuất toàn bộ đoạn chat ra file Markdown (.md)"
            >
              <FileDown size={14} />
            </button>

            {/* AI Evaluation */}
            <button 
              onClick={handleEvaluate}
              disabled={evaluating}
              className="h-8 text-xs px-2.5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition disabled:opacity-50 flex items-center gap-1.5 font-medium shrink-0"
              title="Đánh giá mức độ hiểu bài và chất lượng câu hỏi"
            >
              {evaluating ? <Loader size={13} className="animate-spin" /> : <Award size={13} />}
              <span className="hidden sm:inline">{evaluating ? "Đang chấm..." : "Đánh giá"}</span>
            </button>

            {/* Divider */}
            <div className={`w-[1px] h-4 my-auto shrink-0 mx-0.5 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

            {/* Theme Toggle (Dark / Light) */}
            <button 
              onClick={toggleTheme}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition shrink-0 border ${
                isDark ? 'text-amber-400 border-white/10 bg-white/5 hover:bg-white/10' : 'text-slate-700 border-slate-200 bg-slate-100 hover:bg-slate-200'
              }`}
              title={isDark ? "Chuyển sang Giao diện Sáng (Light Theme)" : "Chuyển sang Giao diện Tối (Dark Theme)"}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Shortcuts Help */}
            <button 
              onClick={() => setShowShortcutsModal(true)}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition shrink-0 border ${
                isDark ? 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Phím tắt nhanh (Shortcuts)"
            >
              <HelpCircle size={14} />
            </button>

            {/* Global Settings */}
            <button 
              onClick={() => setShowSettings(true)}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition shrink-0 border ${
                isDark ? 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Cài đặt mô hình AI"
            >
              <Settings size={14} />
            </button>

            {/* Delete Notebook */}
            <button 
              onClick={deleteNotebook}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition shrink-0 border ${
                isDark ? 'border-white/10 bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-red-500 hover:bg-red-50'
              }`}
              title="Xóa sổ tay này"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Feature #4: Chat Search Bar */}
        {showChatSearch && (
          <div className={`mb-3 px-3.5 py-2 rounded-2xl shadow-lg flex items-center justify-between gap-3 text-xs animate-fade-in border ${
            isDark ? 'bg-white/[0.04] border-blue-500/40 text-white' : 'bg-white border-blue-400 text-slate-800'
          }`}>
            <div className="flex items-center gap-2 flex-1">
              <Search size={14} className="text-blue-500 shrink-0" />
              <input
                type="text"
                autoFocus
                value={chatSearchQuery}
                onChange={e => setChatSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) handlePrevMatch();
                    else handleNextMatch();
                  }
                }}
                placeholder="Tìm kiếm trong các tin nhắn (Enter để tìm tiếp, Shift+Enter lùi)..."
                className={`w-full bg-transparent border-none outline-none text-xs ${
                  isDark ? 'text-white placeholder-gray-500' : 'text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            <div className={`flex items-center gap-2 shrink-0 font-mono text-[11px] ${
              isDark ? 'text-gray-400' : 'text-slate-500'
            }`}>
              {chatSearchQuery.trim() && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-blue-400">
                    {matchedIndices.length > 0 ? `${currentMatchIdx + 1}/${matchedIndices.length}` : '0/0'}
                  </span>
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    disabled={matchedIndices.length === 0}
                    className="p-1 hover:text-blue-400 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    title="Kết quả trước (Shift + Enter)"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    disabled={matchedIndices.length === 0}
                    className="p-1 hover:text-blue-400 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    title="Kết quả tiếp theo (Enter)"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowChatSearch(false);
                  setChatSearchQuery('');
                }}
                className="p-1 hover:text-red-400 rounded hover:bg-white/10 cursor-pointer"
                title="Đóng tìm kiếm (Esc)"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-5 pb-4">
          {messages.map((msg, idx) => {
            const isMatchedInSearch = chatSearchQuery.trim() && msg.content?.toLowerCase().includes(chatSearchQuery.toLowerCase());
            const isCurrentMatch = isMatchedInSearch && matchedIndices[currentMatchIdx] === idx;

            return (
              <div 
                key={idx} 
                id={`msg-${idx}`}
                className={`flex gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} ${
                  isMatchedInSearch 
                    ? (isCurrentMatch ? 'ring-2 ring-blue-400 bg-blue-500/15 rounded-2xl p-1' : 'ring-1 ring-blue-500/40 bg-blue-500/5 rounded-2xl p-1')
                    : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs ${
                  msg.role === 'user' ? 'bg-gradient-to-br from-purple-600 to-pink-500' : 'bg-gradient-to-br from-blue-600 to-cyan-500'
                }`}>
                  {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                </div>

                <div className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`group/msg relative px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-lg ${
                    msg.role === 'user' 
                      ? (isDark ? 'bg-[#252830] border border-white/10 text-white' : 'bg-blue-600 border border-blue-700 text-white') + ' rounded-tr-sm' 
                      : (isDark ? 'bg-[#181a20] border border-white/10 text-gray-100' : 'bg-white border border-slate-200 text-slate-800 shadow-sm') + ' rounded-tl-sm w-full'
                  }`}>
                    {/* Action buttons on message hover: TTS, Pin Note, Copy, Delete */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition z-10">
                      {msg.content && (
                        <>
                          {/* TTS Play/Stop Button */}
                          <button
                            type="button"
                            onClick={() => handleSpeakMessage(msg.content, idx)}
                            className={`p-1.5 rounded-lg backdrop-blur-sm transition shadow ${
                              speakingMsgIdx === idx 
                                ? 'bg-blue-600 text-white animate-pulse' 
                                : 'bg-black/60 hover:bg-black/90 text-gray-400 hover:text-white'
                            }`}
                            title={speakingMsgIdx === idx ? "Dừng đọc" : "Đọc to câu trả lời (TTS tiếng Việt)"}
                          >
                            {speakingMsgIdx === idx ? <VolumeX size={12} /> : <Volume2 size={12} />}
                          </button>

                          {/* Pin to Notes Button */}
                          <button
                            type="button"
                            onClick={() => handlePinNote(msg.content, `Ghi chú từ AI (${new Date().toLocaleTimeString('vi-VN')})`, 'chat')}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-amber-500/80 text-gray-400 hover:text-white transition shadow backdrop-blur-sm"
                            title="Ghim vào Bảng Ghi chú Nghiên cứu"
                          >
                            <BookmarkPlus size={12} />
                          </button>

                          {/* Copy Button */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.content, idx)}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-gray-400 hover:text-white transition shadow backdrop-blur-sm"
                            title="Sao chép nội dung tin nhắn"
                          >
                            {copiedMsgIdx === idx ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id, idx)}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-gray-400 hover:text-white transition shadow backdrop-blur-sm"
                        title="Xóa tin nhắn này"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Message Content: MarkdownRenderer for assistant */}
                    {msg.content ? (
                      <div className="pr-5">
                        {msg.role === 'assistant' ? (
                          <MarkdownRenderer content={msg.content} isDark={isDark} />
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                        {msg.role === 'assistant' && loading && idx === messages.length - 1 && (
                          <span className="inline-block w-2 h-3.5 bg-blue-500 animate-pulse ml-1 align-middle rounded-sm"></span>
                        )}
                        {/* Quick 1-click recovery buttons if Ollama is offline */}
                        {msg.content?.includes("Không thể kết nối tới Ollama") && (
                          <div className="mt-3 pt-3 border-t border-amber-500/20 flex flex-wrap gap-2">
                            <button
                              onClick={() => handleSwitchModel('9router', 'kr/auto')}
                              className="px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-semibold flex items-center gap-1.5 transition shadow cursor-pointer"
                            >
                              <Cloud size={13} /> Chuyển sang 9Router Gateway (Free Cloud)
                            </button>
                            <button
                              onClick={() => {
                                setModelManagerInitialTab('recommend');
                                setShowModelManagerModal(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-300 text-xs font-semibold flex items-center gap-1.5 transition shadow cursor-pointer"
                            >
                              <Cpu size={13} /> Quản lý & Tải Model cho máy
                            </button>
                          </div>
                        )}
                      </div>
                    ) : msg.role === 'assistant' && loading && idx === messages.length - 1 ? (
                      /* Feature #3: Streaming typing wave animation */
                      <div className="flex flex-col gap-2.5 py-1">
                        <div className="flex gap-1.5 items-center h-5">
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                          <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                        </div>
                        {msg.status && (
                          <div className="flex items-center gap-2 text-xs text-blue-400 font-medium px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 w-fit animate-pulse">
                            <Loader size={12} className="animate-spin" />
                            <span>{msg.status}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs italic">
                        (Không có nội dung phản hồi)
                      </div>
                    )}
                  </div>

                  {/* Feature #13: Clickable Citations with preview & highlight */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {msg.citations.map((cit, cidx) => (
                        <button 
                          key={cidx} 
                          onClick={() => handleCitationClick(cit)}
                          className="flex items-center gap-1 text-[11px] bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 px-2.5 py-0.5 rounded-full transition cursor-pointer shadow-sm"
                          title="Bấm để xem đoạn trích dẫn trong tài liệu gốc"
                        >
                          <span className="font-semibold text-blue-400">{cit.marker}</span>
                          <ChevronRight size={10} className="opacity-50" />
                          <span className="truncate max-w-[150px]">{cit.filename}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar with Feature #10: Voice Input */}
        <div className="pt-2">
          {/* Active Document Context Pill */}
          {documents.length > 0 && (
            <div className="flex items-center justify-between px-2 pb-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 text-gray-400">
                <span className={`w-2 h-2 rounded-full ${
                  selectedDocs.size === 0 
                    ? 'bg-amber-400 animate-pulse' 
                    : selectedDocs.size === documents.length 
                      ? 'bg-blue-400' 
                      : 'bg-emerald-400'
                }`}></span>
                <span className="font-medium">Ngữ cảnh:</span>
                {selectedDocs.size === 0 ? (
                  <span className="text-amber-400 font-semibold">Chưa chọn tài liệu nào (Hỏi đáp kiến thức chung)</span>
                ) : selectedDocs.size === documents.length ? (
                  <span className="text-blue-300 font-semibold">Tất cả tài liệu ({selectedDocs.size}/{documents.length})</span>
                ) : (
                  <span className="text-emerald-300 font-semibold">Đã chọn lọc {selectedDocs.size}/{documents.length} tài liệu</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {selectedDocs.size < documents.length ? (
                  <button
                    onClick={handleSelectAllDocs}
                    className="text-blue-400 hover:text-blue-300 hover:underline transition font-medium"
                    title="Dùng tất cả tài liệu làm ngữ cảnh"
                  >
                    Dùng tất cả
                  </button>
                ) : (
                  <button
                    onClick={handleDeselectAllDocs}
                    className="text-gray-400 hover:text-gray-300 hover:underline transition"
                    title="Bỏ chọn tất cả tài liệu"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Floating Stop Generating Indicator */}
          {loading && (
            <div className="flex justify-center pb-2 animate-fade-in">
              <button
                type="button"
                onClick={handleStopGenerating}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 hover:text-white text-xs font-medium shadow-lg transition backdrop-blur-sm cursor-pointer"
                title="Bấm hoặc nhấn Escape để dừng ngay lập tức"
              >
                <Square size={12} className="fill-current text-red-400" />
                <span>Dừng tạo câu trả lời</span>
                <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-gray-300 font-mono">Esc</span>
              </button>
            </div>
          )}
          {/* Suggested Questions Chips from FAQ */}
          {suggestedQuestions.length > 0 && !loading && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2 px-1 animate-fade-in">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1 font-semibold">
                <Sparkles size={11} className="text-yellow-400" /> Gợi ý:
              </span>
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(q);
                    chatInputRef.current?.focus();
                  }}
                  className="max-w-[260px] truncate px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 rounded-full text-[11px] text-gray-300 hover:text-white transition whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
                  title={q}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Feature: AI Persona Mode Bar & Pinned Notes button */}
          <div className="flex items-center justify-between pb-2 px-1 text-xs gap-2 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[11px] font-medium mr-1 flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                <Bot size={13} className="text-blue-500" /> Chế độ:
              </span>
              {[
                { id: 'strict', name: 'Bám sát nguồn', desc: 'Trực tiếp 100% tài liệu', icon: Shield, activeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
                { id: 'socratic', name: 'Gia sư Socratic', desc: 'Gợi mở, hướng dẫn tư duy', icon: Sparkles, activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50' },
                { id: 'critic', name: 'Phản biện sâu', desc: 'Đánh giá đa chiều & điểm mù', icon: Flame, activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50' },
              ].map(p => {
                const Icon = p.icon;
                const isSelected = chatPersona === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setChatPersona(p.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition cursor-pointer ${
                      isSelected 
                        ? p.activeClass 
                        : (isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                    }`}
                    title={p.desc}
                  >
                    <Icon size={12} />
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Pinned Notes shortcut button */}
            <button
              type="button"
              onClick={() => setShowNotesModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition cursor-pointer shrink-0 ${
                pinnedNotes.length > 0 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : (isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900')
              }`}
              title="Xem và quản lý các ghi chú đã ghim của sổ tay này"
            >
              <Bookmark size={12} className="text-amber-400" />
              <span>Ghi chú ({pinnedNotes.length})</span>
            </button>
          </div>

          <div className={`p-2 flex items-end gap-2 rounded-2xl relative group focus-within:border-blue-500/60 transition-all duration-300 border ${
            isDark ? 'bg-[#181a20] border-white/15' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            
            <div className="relative">
              {showUrlInput && (
                <div className={`absolute bottom-full left-0 mb-2 p-2.5 rounded-xl shadow-2xl flex gap-2 z-20 w-80 border ${
                  isDark ? 'bg-[#1c1f26] border-white/15' : 'bg-white border-slate-200'
                }`}>
                  <input 
                    type="text" 
                    value={urlInputValue}
                    onChange={(e) => setUrlInputValue(e.target.value)}
                    placeholder="Dán link Website hoặc YouTube..." 
                    className={`flex-1 text-xs px-3 py-2 rounded-lg outline-none border focus:border-blue-500 ${
                      isDark ? 'bg-black/40 text-white border-white/15' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  />
                  <button 
                    onClick={handleUrlSubmit}
                    className="bg-blue-600 px-3 rounded-lg text-white hover:bg-blue-500 transition cursor-pointer"
                  >
                    <Check size={14}/>
                  </button>
                </div>
              )}
              <button 
                onClick={() => setShowUrlInput(!showUrlInput)}
                className={`p-2.5 rounded-xl transition ${
                  isDark ? 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                }`}
                title="Nhập Link Website hoặc YouTube"
              >
                <LinkIcon size={18} />
              </button>
            </div>
            
            <button 
              onClick={() => document.getElementById('file-upload').click()}
              className={`p-2.5 rounded-xl transition ${
                isDark ? 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
              }`}
              title="Tải lên PDF/Doc/Audio/Ảnh"
            >
              <Paperclip size={18} />
            </button>
            <input 
              type="file" 
              id="file-upload" 
              multiple
              className="hidden" 
              onChange={handleFileUpload}
              accept=".pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a"
            />

            <textarea 
              ref={chatInputRef}
              className={`flex-1 bg-transparent border-none px-2 py-2.5 text-sm focus:outline-none resize-none min-h-[44px] max-h-[140px] scrollbar-hide ${
                isDark ? 'text-white placeholder-gray-500' : 'text-slate-900 placeholder-slate-400'
              }`}
              placeholder="Đặt câu hỏi về tài liệu của bạn (Nhấn Ctrl+/ để focus)..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />

            {/* Voice Input Microphone Button */}
            <button
              type="button"
              onClick={handleVoiceToggle}
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' 
                  : (isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900')
              }`}
              title={isRecording ? "Đang ghi âm giọng nói (Bấm để dừng)..." : "Nói để nhập câu hỏi (Voice Input)"}
            >
              {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            {loading ? (
              <button 
                type="button"
                className="w-10 h-10 rounded-xl bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-lg shadow-red-500/30 group cursor-pointer"
                onClick={handleStopGenerating} 
                title="Dừng tạo câu trả lời (Esc)"
              >
                <Square size={15} className="fill-current group-hover:scale-110 transition-transform" />
              </button>
            ) : (
              <button 
                type="button"
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  input.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg cursor-pointer' 
                    : (isDark ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed')
                }`}
                onClick={handleSend} 
                disabled={!input.trim()}
                title="Gửi câu hỏi (Enter)"
              >
                <Send size={16} className={input.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
              </button>
            )}
          </div>
          <div className={`text-center mt-2 text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
            NotebookLM Mini • Nhấn Ctrl+Enter để gửi • Ctrl+K đổi mô hình AI • Ctrl+F tìm kiếm
          </div>
        </div>
      </div>

      {/* Cột 3: Right Sidebar (Study Guide, Podcast, Mindmap, Timeline) */}
      <div className={`w-80 xl:w-88 flex-shrink-0 h-full p-4 overflow-y-auto scrollbar-hide flex flex-col gap-4 border-l transition-colors ${
        isDark ? 'bg-[#14161a] border-white/5' : 'bg-white border-slate-200'
      } ${mobileActiveTab === 'studio' ? 'flex fixed inset-0 z-40 w-full md:relative md:w-80 xl:md:w-88' : 'hidden lg:flex'}`}>
        
        {/* Top Header Bar - aligned with Col 1 & Col 2 */}
        <div className={`flex justify-between items-center pb-3.5 mb-1 min-h-[44px] border-b ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            <span className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>Studio Học Tập</span>
          </div>
          {mobileActiveTab === 'studio' ? (
            <button onClick={() => setMobileActiveTab('chat')} className="lg:hidden text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white">
              Đóng
            </button>
          ) : (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              isDark ? 'text-gray-400 bg-white/5 border-white/10' : 'text-slate-500 bg-slate-100 border-slate-200'
            }`}>
              AI Copilot
            </span>
          )}
        </div>
        
        {/* Study Guide Card */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#181a20] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-500 flex items-center gap-1.5">
              <BookOpen size={16} /> Cẩm Nang Học Tập
            </h3>
            {documents.length > 0 && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowGuideConfigModal(true)}
                  disabled={regeneratingGuide}
                  className="text-[11px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  title="Tùy chỉnh số lượng câu hỏi, flashcards và chủ đề"
                >
                  <SlidersHorizontal size={11} /> Tùy chỉnh
                </button>
                <button 
                  onClick={handleRegenerateStudyGuide}
                  disabled={regeneratingGuide}
                  className={`text-[11px] p-1 rounded-lg transition cursor-pointer ${
                    isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                  title="Làm mới nhanh"
                >
                  <RefreshCw size={12} className={regeneratingGuide ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </div>
          
          {documents.length === 0 ? (
            <div className={`text-xs py-6 text-center leading-relaxed ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
              Tải lên tài liệu ở cột bên trái để AI tự động trích xuất bản tóm tắt và câu hỏi ôn tập.
            </div>
          ) : !studyGuide ? (
            <div className={`flex flex-col items-center justify-center py-8 gap-2.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              <Loader className="animate-spin text-blue-500" size={20} />
              <span className="text-xs">Đang đọc & phân tích tài liệu...</span>
            </div>
          ) : (
            <div className="space-y-3.5 text-xs">
              {studyGuide.summary && (
                <div>
                  <h4 className={`font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>Tóm tắt cốt lõi:</h4>
                  <div className={`leading-relaxed max-h-36 overflow-y-auto scrollbar-hide text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    <MarkdownRenderer content={studyGuide.summary.replace(/^#+\s*(Tóm tắt|Summary)[^\n]*\n+/i, '').trim()} isDark={isDark} />
                  </div>
                </div>
              )}
              {studyGuide.faq && (
                <div className={`pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  <h4 className={`font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>Câu hỏi thường gặp:</h4>
                  <div className={`leading-relaxed max-h-36 overflow-y-auto scrollbar-hide text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    <MarkdownRenderer content={studyGuide.faq.replace(/^#+\s*(Câu hỏi thường gặp|FAQ)[^\n]*\n+/i, '').trim()} isDark={isDark} />
                  </div>
                </div>
              )}
              {studyGuide.glossary && studyGuide.glossary !== "N/A" && !studyGuide.glossary.startsWith("⚠️") && (
                <div className={`pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  <h4 className={`font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>Thuật ngữ cốt lõi (Glossary):</h4>
                  <div className={`leading-relaxed max-h-32 overflow-y-auto scrollbar-hide text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    <MarkdownRenderer content={studyGuide.glossary.replace(/^#+\s*(Thuật ngữ|Glossary)[^\n]*\n+/i, '').trim()} isDark={isDark} />
                  </div>
                </div>
              )}

              <div className={`pt-3 grid grid-cols-2 gap-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <button 
                  onClick={() => setShowQuiz(true)}
                  disabled={!studyGuide.quiz || studyGuide.quiz.length === 0}
                  className="min-w-0 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 font-semibold text-xs disabled:opacity-40 cursor-pointer"
                >
                  <Brain size={14} className="shrink-0" /> 
                  <span className="truncate">Trắc nghiệm ({studyGuide.quiz?.length || 0})</span>
                </button>
                <button 
                  onClick={() => setShowFlashcards(true)}
                  disabled={!studyGuide.flashcards || studyGuide.flashcards.length === 0}
                  className="min-w-0 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border border-purple-500/30 py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 font-semibold text-xs disabled:opacity-40 cursor-pointer"
                  title="Mở bộ thẻ lật 3D, game ghép thẻ và xuất Quizlet"
                >
                  <Layers size={14} className="shrink-0" /> 
                  <span className="truncate">Quizlet ({studyGuide.flashcards?.length || 0})</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Feature #8: Mind Map Card */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#181a20] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">
              <Network size={16} /> Sơ Đồ Tư Duy (Mind Map)
            </h3>
            {documents.length > 0 && (
              <button
                onClick={() => handleRegenerateMindmap()}
                disabled={loadingMindmap}
                className={`text-[11px] p-1 rounded-lg transition cursor-pointer ${
                  isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="Tái tạo sơ đồ tư duy"
              >
                <RefreshCw size={12} className={loadingMindmap ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
          <p className={`text-xs mb-3 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Trực quan hóa mạng lưới khái niệm và luận điểm trọng tâm trong tài liệu.
          </p>
          <button
            onClick={handleOpenMindmap}
            disabled={documents.length === 0}
            className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold text-xs py-2.5 rounded-xl transition disabled:opacity-40 flex justify-center items-center gap-2 cursor-pointer"
          >
            <Network size={14} /> Mở Sơ đồ tư duy 2D
          </button>
        </div>

        {/* Feature #15: Timeline & Outline Card */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#181a20] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <Clock size={16} /> Dòng Thời Gian & Dàn Ý
            </h3>
            {documents.length > 0 && (
              <button
                onClick={() => handleRegenerateTimeline()}
                disabled={loadingTimeline}
                className={`text-[11px] p-1 rounded-lg transition cursor-pointer ${
                  isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="Tái tạo tiến trình & dàn ý"
              >
                <RefreshCw size={12} className={loadingTimeline ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
          <p className={`text-xs mb-3 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Xem niên biểu các mốc sự kiện và dàn ý phân cấp cấu trúc của tài liệu.
          </p>
          <button
            onClick={handleOpenTimeline}
            disabled={documents.length === 0}
            className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-xs py-2.5 rounded-xl transition disabled:opacity-40 flex justify-center items-center gap-2 cursor-pointer"
          >
            <Clock size={14} /> Xem Niên biểu & Dàn bài
          </button>
        </div>

        {/* Podcast Card */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#181a20] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-bold text-purple-400 flex items-center gap-1.5">
              <Headphones size={16} /> Trò Chuyện Audio (Podcast)
            </h3>
            {documents.length > 0 && (
              <button 
                onClick={() => setShowPodcastModal(true)}
                disabled={podcastGenerating}
                className="text-[11px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                title="Tùy chỉnh chủ đề và phong cách Podcast"
              >
                <SlidersHorizontal size={11} /> Tùy chỉnh
              </button>
            )}
          </div>
          
          <p className={`text-xs mb-3 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            AI tự động viết kịch bản và thảo luận bằng âm thanh giữa 2 người dẫn chương trình.
          </p>

          {!audioUrl ? (
            <button 
              onClick={generatePodcast}
              disabled={podcastGenerating || documents.length === 0}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white font-semibold text-xs py-2.5 rounded-xl transition disabled:opacity-40 flex justify-center items-center gap-2 cursor-pointer shadow"
            >
              {podcastGenerating ? <RefreshCw className="animate-spin" size={14} /> : <Headphones size={14} />}
              {podcastGenerating ? "Đang tạo âm thanh (vui lòng đợi)..." : "Tạo Podcast AI"}
            </button>
          ) : (
            <div className="space-y-2">
              <audio controls className="w-full h-9 rounded outline-none" src={audioUrl} />
              <button 
                onClick={() => setShowPodcastModal(true)}
                disabled={podcastGenerating}
                className={`w-full py-1.5 text-[11px] rounded-lg transition text-center cursor-pointer ${
                  isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                Tạo bản thu khác (Tùy chỉnh)
              </button>
            </div>
          )}
        </div>

        {/* Feature: Phản biện AI (Deep Critique) */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#181a20] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
              <ShieldAlert size={16} /> Phản Biện AI (Peer Review)
            </h3>
          </div>
          <p className={`text-xs mb-3 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Tìm điểm mù, lỗ hổng lập luận, thiếu sót dữ liệu và các câu hỏi phản biện sắc bén.
          </p>
          <button
            onClick={() => handleRunStudioTool('critique')}
            disabled={documents.length === 0}
            className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs py-2.5 rounded-xl transition disabled:opacity-40 flex justify-center items-center gap-2 cursor-pointer"
          >
            <ShieldAlert size={14} /> Tạo Báo cáo Phản biện
          </button>
        </div>

        {/* Feature: Kế hoạch hành động (Action Plan) */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#181a20] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-lime-500 flex items-center gap-1.5">
              <ClipboardCheck size={16} /> Kế Hoạch Hành Động
            </h3>
          </div>
          <p className={`text-xs mb-3 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Chuyển hóa lý thuyết thành ma trận hành động (Action Matrix) và checklist thực thi.
          </p>
          <button
            onClick={() => handleRunStudioTool('action_plan')}
            disabled={documents.length === 0}
            className="w-full bg-lime-500/10 hover:bg-lime-500/20 text-lime-500 border border-lime-500/30 font-semibold text-xs py-2.5 rounded-xl transition disabled:opacity-40 flex justify-center items-center gap-2 cursor-pointer"
          >
            <ClipboardCheck size={14} /> Lập Kế hoạch Thực thi
          </button>
        </div>

      </div>

      {/* MODAL: QUIZ */}
      {showQuiz && studyGuide?.quiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in font-sans">
          <div className="bg-[#181a20] border border-blue-500/30 w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-blue-500/10">
              <h2 className="text-base font-bold flex items-center gap-2 text-white">
                <Brain className="text-blue-400" size={18} /> Ôn tập trắc nghiệm ({studyGuide.quiz.length} câu)
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setShowQuiz(false); setShowGuideConfigModal(true); }}
                  className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-xl transition font-medium flex items-center gap-1"
                  title="Thay đổi số câu hoặc chủ đề đề thi"
                >
                  <SlidersHorizontal size={12}/> Đổi số câu / Đề
                </button>
                <button onClick={() => { setShowQuiz(false); setQuizAnswers({}); setQuizSubmitted(false); }} className="text-gray-400 hover:text-white">
                  <X size={20}/>
                </button>
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-5 scrollbar-hide">
              {studyGuide.quiz.map((q, idx) => (
                <div key={idx} className="bg-white/[0.03] p-4 rounded-xl border border-white/10">
                  <p className="font-semibold text-sm mb-3 text-gray-100">{idx + 1}. {q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, oIdx) => {
                      const isSelected = quizAnswers[idx] === oIdx;
                      const isCorrect = q.answer === oIdx;
                      let btnClass = "w-full text-left p-2.5 rounded-lg border text-xs transition-all ";
                      
                      if (!quizSubmitted) {
                        btnClass += isSelected ? "border-blue-500 bg-blue-500/20 text-white" : "border-white/10 hover:bg-white/10 text-gray-300";
                      } else {
                        if (isCorrect) btnClass += "border-green-500 bg-green-500/20 text-white";
                        else if (isSelected && !isCorrect) btnClass += "border-red-500 bg-red-500/20 text-white";
                        else btnClass += "border-white/5 text-gray-500 opacity-40";
                      }

                      return (
                        <button 
                          key={oIdx} 
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers({...quizAnswers, [idx]: oIdx})}
                          className={btnClass}
                        >
                          <div className="flex justify-between items-center">
                            <span>{opt}</span>
                            {quizSubmitted && isCorrect && <Check size={14} className="text-green-400" />}
                            {quizSubmitted && isSelected && !isCorrect && <XCircle size={14} className="text-red-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
              {!quizSubmitted ? (
                <button 
                  onClick={() => setQuizSubmitted(true)}
                  disabled={Object.keys(quizAnswers).length !== studyGuide.quiz.length}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition"
                >
                  Nộp bài chấm điểm
                </button>
              ) : (
                <button 
                  onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }}
                  className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Làm lại
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUIZLET SUITE (Flashcards 3D, Anki SRS, Practice Timer, Match Game, Export) */}
      <QuizletModal
        isOpen={showFlashcards}
        onClose={() => setShowFlashcards(false)}
        flashcards={studyGuide?.flashcards || []}
        title={activeNotebook?.title || "Bộ thẻ học tập"}
        onOpenConfig={() => setShowGuideConfigModal(true)}
        notebookId={activeNotebook?.id}
        isDark={isDark}
      />

      {/* MODAL: EVALUATION RESULTS */}
      {showEvalModal && evalResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in font-sans">
          <div className="bg-[#181a20] border border-yellow-500/30 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-yellow-400 font-bold">
                <Award size={20} />
                <span>Kết Quả Đánh Giá Năng Lực Học Tập</span>
              </div>
              <button onClick={() => setShowEvalModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Scores Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-2xl font-black text-yellow-400">{evalResult.score?.toFixed(1) || '8.0'}<span className="text-xs text-gray-400">/10</span></div>
                <div className="text-[11px] text-gray-400 mt-0.5">Điểm tổng quan</div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-2xl font-black text-green-400">{((evalResult.faithfulness || 0.9) * 100).toFixed(0)}%</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Độ bám sát tài liệu</div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-2xl font-black text-blue-400">{((evalResult.context_precision || 0.85) * 100).toFixed(0)}%</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Độ chuẩn ngữ cảnh</div>
              </div>
            </div>

            {/* AI Feedback */}
            <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/10">
              <h4 className="text-xs font-semibold text-gray-300 mb-1">Nhận xét chi tiết từ AI:</h4>
              <p className="text-xs text-gray-400 leading-relaxed">{evalResult.feedback}</p>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20">
                <h5 className="font-semibold text-green-400 mb-1 flex items-center gap-1">
                  <Check size={13} /> Điểm mạnh:
                </h5>
                <ul className="text-gray-300 space-y-1 list-disc list-inside">
                  {evalResult.strengths?.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/20">
                <h5 className="font-semibold text-yellow-400 mb-1 flex items-center gap-1">
                  <Sparkles size={13} /> Cần phát huy thêm:
                </h5>
                <ul className="text-gray-300 space-y-1 list-disc list-inside">
                  {evalResult.weaknesses?.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setShowEvalModal(false)}
                className="bg-white text-black px-5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM STUDY GUIDE & QUIZLET CONFIG */}
      {showGuideConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
          <div className="bg-[#181a20] border border-blue-500/40 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-blue-400 font-bold text-base">
                <SlidersHorizontal size={20} />
                <span>Tùy Chỉnh Bộ Học Tập & Quizlet</span>
              </div>
              <button 
                onClick={() => setShowGuideConfigModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Config Fields */}
            <div className="space-y-4 text-xs">
              {/* Quiz Count */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                    <Brain size={14} className="text-blue-400" /> Số câu hỏi Trắc nghiệm (Quiz):
                  </label>
                  <span className="font-bold text-blue-400 font-mono text-sm">{guideConfig.quiz_count} câu</span>
                </div>
                <div className="flex gap-2">
                  {[3, 5, 10, 15, 20].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setGuideConfig({...guideConfig, quiz_count: cnt})}
                      className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold transition ${
                        guideConfig.quiz_count === cnt 
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flashcards Count */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                    <Layers size={14} className="text-purple-400" /> Số thẻ nhớ Quizlet (Flashcards):
                  </label>
                  <span className="font-bold text-purple-400 font-mono text-sm">{guideConfig.flashcards_count} thẻ</span>
                </div>
                <div className="flex gap-2">
                  {[5, 10, 15, 20, 30].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setGuideConfig({...guideConfig, flashcards_count: cnt})}
                      className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold transition ${
                        guideConfig.flashcards_count === cnt 
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md' 
                          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="font-semibold text-gray-300 block mb-1.5">
                  Mức độ khó của câu hỏi:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'easy', label: 'Cơ bản', sub: 'Nhận biết, nhớ từ khóa' },
                    { key: 'medium', label: 'Trung bình', sub: 'Hiểu & áp dụng' },
                    { key: 'hard', label: 'Nâng cao', sub: 'Tình huống, bẫy logic' }
                  ].map(lvl => (
                    <button
                      key={lvl.key}
                      type="button"
                      onClick={() => setGuideConfig({...guideConfig, difficulty: lvl.key})}
                      className={`p-2 rounded-xl border text-left transition ${
                        guideConfig.difficulty === lvl.key 
                          ? 'bg-blue-500/20 border-blue-500 text-white shadow' 
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-semibold text-xs text-gray-200">{lvl.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{lvl.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Topic */}
              <div>
                <label className="font-semibold text-gray-300 block mb-1.5">
                  Chủ đề / Yêu cầu trọng tâm (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={guideConfig.focus_topic}
                  onChange={e => setGuideConfig({...guideConfig, focus_topic: e.target.value})}
                  placeholder="Ví dụ: Tập trung vào kiến thức Docker, các lệnh CLI, câu hỏi tình huống..."
                  className="w-full bg-black/40 text-xs px-3.5 py-2.5 rounded-xl text-white border border-white/15 focus:border-blue-500 outline-none transition"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  AI sẽ tự động lọc các đoạn tài liệu liên quan đến chủ đề này để thiết kế câu hỏi.
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowGuideConfigModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleGenerateCustomGuide}
                disabled={regeneratingGuide}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles size={14} />
                {regeneratingGuide ? "Đang xử lý..." : "Tạo Cẩm Nang & Quizlet Mới"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM PODCAST CONFIG */}
      {showPodcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
          <div className="bg-[#181a20] border border-purple-500/40 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-purple-400 font-bold text-base">
                <Headphones size={20} />
                <span>Tùy Chỉnh Podcast Âm Thanh AI</span>
              </div>
              <button 
                onClick={() => setShowPodcastModal(false)}
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
                  placeholder="Ví dụ: Tóm tắt 3 điểm cốt lõi để đi thi, giải thích thuật ngữ..."
                  className="w-full bg-black/40 text-xs px-3.5 py-2.5 rounded-xl text-white border border-white/15 focus:border-purple-500 outline-none transition"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowPodcastModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={generatePodcast}
                disabled={podcastGenerating}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Headphones size={14} />
                {podcastGenerating ? "Đang tạo..." : "Bắt đầu tạo Podcast"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT PREVIEW */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
          <div className="bg-[#181a20] border border-white/15 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <FileText className="text-blue-400 shrink-0" size={18} />
                <h3 className="font-semibold text-sm truncate text-white" title={previewDoc.filename}>
                  {previewDoc.filename}
                </h3>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick stats */}
            <div className="px-5 py-2.5 bg-black/30 border-b border-white/10 flex gap-6 text-xs text-gray-400">
              <div>Đoạn phân rã (Chunks): <span className="font-mono text-blue-400 font-bold">{previewDoc.chunk_count || 0}</span></div>
              <div>Ký tự trích xuất: <span className="font-mono text-green-400 font-bold">{previewDoc.character_count?.toLocaleString() || 0}</span></div>
            </div>

            {/* Highlighted Citation Snippet if opened from a Citation click */}
            {highlightSnippet && (
              <div className="mx-5 mt-4 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 space-y-1">
                <div className="font-bold text-blue-400 uppercase tracking-wider text-[10px] flex items-center justify-between">
                  <span>✨ Đoạn trích dẫn được AI sử dụng:</span>
                  <button onClick={() => setHighlightSnippet(null)} className="text-gray-400 hover:text-white">✕</button>
                </div>
                <p className="leading-relaxed italic text-gray-200">"{highlightSnippet}..."</p>
              </div>
            )}

            {/* Content body */}
            <div className="p-5 overflow-y-auto flex-1 font-mono text-xs text-gray-300 leading-relaxed whitespace-pre-wrap select-text bg-[#121316] scrollbar-hide">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400 font-sans">
                  <Loader size={18} className="animate-spin text-blue-400" />
                  <span>Đang trích xuất dữ liệu từ bộ nhớ vector...</span>
                </div>
              ) : (
                previewDoc.preview_text || "Không có nội dung hiển thị."
              )}
            </div>

            <div className="p-3.5 border-t border-white/10 bg-black/20 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  deleteDocument(previewDoc.filename);
                  setPreviewDoc(null);
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Xóa tài liệu này
              </button>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-1.5 rounded-xl text-xs font-semibold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => {
          setShowSettings(false);
          fetchNotebookDetails();
          fetchLocalModels();
        }}
      />

      {/* Feature #8: Mindmap Modal */}
      <MindmapModal
        isOpen={showMindmapModal}
        onClose={() => setShowMindmapModal(false)}
        mindmapData={mindmapData}
        onRegenerate={handleRegenerateMindmap}
        loading={loadingMindmap}
        isDark={isDark}
      />

      {/* Feature #9: Document Comparison Modal */}
      <DocCompareModal
        isOpen={showDocCompareModal}
        onClose={() => setShowDocCompareModal(false)}
        documents={documents}
        onCompare={handleCompareDocs}
        comparisonResult={comparisonResult}
        comparing={comparingDocs}
        isDark={isDark}
      />

      {/* Feature #15: Timeline & Outline Modal */}
      <TimelineOutlineModal
        isOpen={showTimelineModal}
        onClose={() => setShowTimelineModal(false)}
        data={timelineData}
        onRegenerate={handleRegenerateTimeline}
        loading={loadingTimeline}
        onAskAboutTopic={(topic) => {
          setInput(topic);
          chatInputRef.current?.focus();
        }}
        isDark={isDark}
      />

      {/* Feature #14: Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        isDark={isDark}
      />

      {/* Feature #12: Share & Export Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        notebook={activeNotebook}
        studyGuide={studyGuide}
        onExportJson={handleExportNotebookJson}
        isDark={isDark}
      />

      {/* Model Manager: Gợi ý tải cho máy, Model trên máy, Model tùy chỉnh */}
      <ModelManagerModal
        isOpen={showModelManagerModal}
        onClose={() => {
          setShowModelManagerModal(false);
          fetchNotebookDetails();
          fetchLocalModels();
        }}
        activeNotebook={activeNotebook}
        onSelectModel={handleSwitchModel}
        initialTab={modelManagerInitialTab}
      />

      {/* MODAL: PASTE RAW TEXT */}
      {showPasteTextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
          <div className="bg-[#181a20] border border-white/15 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <FileText size={18} className="text-blue-400" /> Dán văn bản / Ghi chú trực tiếp
              </h3>
              <button onClick={() => setShowPasteTextModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Tiêu đề nguồn (Tùy chọn):</label>
                <input
                  type="text"
                  value={pasteTitle}
                  onChange={e => setPasteTitle(e.target.value)}
                  placeholder="VD: Ghi chú họp, Bài báo khoa học..."
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Nội dung văn bản:</label>
                <textarea
                  rows={8}
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  placeholder="Dán nội dung văn bản hoặc Markdown vào đây..."
                  className="w-full bg-black/40 border border-white/15 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowPasteTextModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
              >
                Hủy
              </button>
              <button
                onClick={handlePasteTextSubmit}
                disabled={!pasteContent.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition"
              >
                Nạp vào Sổ tay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Chunks Gốc của Tài liệu (Source Inspector Modal) */}
      {inspectDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-[#181a20] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-white/15 overflow-hidden">
            <div className="p-4 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 truncate">
                <Eye className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <h3 className="font-bold text-sm text-white truncate">Chi tiết Phân mảnh (Chunks): {inspectDoc}</h3>
                  <p className="text-[11px] text-gray-400">Tổng cộng {docChunks.length} đoạn dữ liệu đã lưu trong Vector & BM25</p>
                </div>
              </div>
              <button onClick={() => setInspectDoc(null)} className="p-1.5 text-gray-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-white/10 bg-white/[0.02]">
              <input
                type="text"
                value={chunkSearch}
                onChange={(e) => setChunkSearch(e.target.value)}
                placeholder="Lọc nhanh nội dung chunk theo từ khóa..."
                className="w-full px-3 py-1.5 text-xs bg-black/40 text-white border border-white/15 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 scrollbar-hide">
              {loadingChunks ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  <Loader className="w-5 h-5 animate-spin mr-2 text-blue-500" /> Đang tải các đoạn văn bản...
                </div>
              ) : docChunks.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs">Không tìm thấy chunk nào cho tài liệu này.</div>
              ) : (
                docChunks
                  .filter(c => !chunkSearch.trim() || (c.content && c.content.toLowerCase().includes(chunkSearch.toLowerCase())))
                  .map((chunk, i) => (
                    <div key={chunk.chunk_id || i} className="bg-white/[0.03] p-3.5 rounded-xl border border-white/10 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5 pb-1.5 border-b border-white/5">
                        <span className="font-semibold text-blue-400">Chunk #{i + 1} ({chunk.type || 'text'})</span>
                        <div className="flex items-center gap-2">
                          {chunk.breadcrumbs && (
                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-300 max-w-[200px] truncate" title={chunk.breadcrumbs}>
                              {chunk.breadcrumbs}
                            </span>
                          )}
                          <span>Trang: {chunk.page || 1} • {(chunk.content || '').length} ký tự</span>
                        </div>
                      </div>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{chunk.content}</pre>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Phản biện AI & Kế hoạch hành động */}
      {critiqueModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-[#181a20] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-white/15 overflow-hidden">
            <div className={`p-4 border-b border-white/10 flex items-center justify-between ${
              critiqueModal.type === 'critique' 
                ? 'bg-rose-500/10' 
                : critiqueModal.type === 'synthesis'
                ? 'bg-purple-500/10'
                : 'bg-lime-500/10'
            }`}>
              <div className="flex items-center space-x-2.5 truncate">
                {critiqueModal.type === 'critique' ? (
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                ) : critiqueModal.type === 'synthesis' ? (
                  <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
                ) : (
                  <ClipboardCheck className="w-5 h-5 text-lime-400 shrink-0" />
                )}
                <h3 className="font-bold text-sm text-white truncate">{critiqueModal.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {critiqueModal.content && !critiqueModal.loading && (
                  <>
                    <button 
                      type="button"
                      onClick={() => handlePinNote(critiqueModal.content, critiqueModal.title, critiqueModal.type)}
                      className="p-1.5 text-gray-400 hover:text-amber-300 rounded-lg hover:bg-white/10 transition flex items-center gap-1 text-xs cursor-pointer"
                      title="Ghim vào Bảng Ghi chú"
                    >
                      <BookmarkPlus size={16} />
                      <span className="hidden sm:inline">Ghim</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(critiqueModal.content);
                        showToast("📋 Đã sao chép nội dung vào Clipboard!");
                      }}
                      className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                      title="Sao chép nội dung"
                    >
                      <Copy size={16} />
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setCritiqueModal(prev => ({ ...prev, isOpen: false }))} className="p-1.5 text-gray-400 hover:text-white rounded-lg cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 scrollbar-hide text-sm text-gray-200">
              {critiqueModal.loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <Loader className="w-7 h-7 animate-spin text-purple-400" />
                  <p className="text-xs">Đang đọc tài liệu và phân tích chuyên sâu...</p>
                </div>
              ) : (
                <MarkdownRenderer content={critiqueModal.content} isDark={isDark} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pinned Notes (Bảng Ghi chú Nghiên cứu) */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className={`rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border overflow-hidden ${
            isDark ? 'bg-[#181a20] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'border-white/10 bg-amber-500/10' : 'border-slate-200 bg-amber-50'
            }`}>
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base">Bảng Ghi chú Nghiên cứu ({pinnedNotes.length})</h3>
              </div>
              <div className="flex items-center gap-2">
                {pinnedNotes.length >= 2 && (
                  <button
                    type="button"
                    onClick={handleSynthesizeNotes}
                    disabled={isSynthesizingNotes}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow transition disabled:opacity-50 cursor-pointer"
                    title="Tổng hợp các ghi chú thành Báo cáo chuyên đề AI"
                  >
                    {isSynthesizingNotes ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{isSynthesizingNotes ? 'Đang tổng hợp...' : '✨ Tổng hợp Báo cáo AI'}</span>
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setShowNotesModal(false)} 
                  className={`p-1.5 rounded-lg transition cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className={`p-4 border-b space-y-2.5 ${isDark ? 'border-white/10 bg-white/[0.01]' : 'border-slate-200 bg-slate-50/50'}`}>
              <input 
                type="text"
                value={newNoteTitle}
                onChange={e => setNewNoteTitle(e.target.value)}
                placeholder="Tiêu đề ghi chú mới (tùy chọn)..."
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                  isDark ? 'bg-black/40 border-white/10 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <div className="flex gap-2">
                <textarea
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                  placeholder="Viết ghi chú cá nhân hoặc nhận định của bạn..."
                  rows={2}
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border outline-none resize-none ${
                    isDark ? 'bg-black/40 border-white/10 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newNoteContent.trim()) return;
                    setSavingNote(true);
                    await handlePinNote(newNoteContent, newNoteTitle || 'Ghi chú tự tạo', 'manual');
                    setNewNoteContent('');
                    setNewNoteTitle('');
                    setSavingNote(false);
                  }}
                  disabled={savingNote || !newNoteContent.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold self-end transition disabled:opacity-50 cursor-pointer shadow"
                >
                  {savingNote ? 'Đang lưu...' : 'Thêm'}
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 scrollbar-hide">
              {pinnedNotes.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs leading-relaxed">
                  <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                  Chưa có ghi chú nào được ghim.<br />Hãy bấm biểu tượng ghim trên tin nhắn AI hoặc Studio tools để lưu lại!
                </div>
              ) : (
                pinnedNotes.map((note) => (
                  <div 
                    key={note.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isDark ? 'bg-white/[0.03] border-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-amber-500 truncate max-w-[200px]">{note.title || 'Ghi chú'}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500">{note.created_at}</span>
                        <button
                          type="button"
                          onClick={() => handleConvertNoteToSource(note)}
                          disabled={convertingNoteId === note.id}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                          title="Chuyển ghi chú này thành tài liệu nguồn RAG"
                        >
                          {convertingNoteId === note.id ? (
                            <Loader className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Plus size={11} />
                          )}
                          <span>Thành nguồn</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(note.content);
                            showToast("📋 Đã sao chép ghi chú!");
                          }}
                          className={`p-1 rounded cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                          title="Sao chép"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className={`p-1 rounded cursor-pointer ${isDark ? 'text-gray-400 hover:text-red-400' : 'text-slate-500 hover:text-red-600'}`}
                          title="Xóa ghi chú"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p className={`text-xs whitespace-pre-wrap leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                      {note.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/95 text-white text-xs font-medium border border-white/20 shadow-2xl backdrop-blur-md animate-fade-in pointer-events-none">
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}

export default Studio;
