import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Bot, User, FileText, ChevronRight, Paperclip, Loader, Headphones, 
  RefreshCw, BookOpen, Brain, Layers, X, Check, XCircle, Trash2, 
  Link as LinkIcon, Plus, ArrowLeft, Settings, Cpu, Cloud, Award, Sparkles,
  Copy, Download, Eye, SlidersHorizontal, FileDown
} from 'lucide-react';
import SettingsModal from '../components/SettingsModal';
import QuizletModal from '../components/QuizletModal';

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
  
  // Settings & Model Switching State
  const [showSettings, setShowSettings] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [availableLocalModels, setAvailableLocalModels] = useState([]);

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
    style: 'fun'
  });

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Message copy state
  const [copiedMsgIdx, setCopiedMsgIdx] = useState(null);

  const messagesEndRef = useRef(null);

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
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLocalModels = async () => {
    try {
      const res = await fetch('/api/llm/local-models');
      const data = await res.json();
      setAvailableLocalModels(data?.ollama?.models || []);
    } catch (e) {
      console.error("Lỗi lấy local models:", e);
    }
  };

  // Switch model on the fly for active notebook
  const handleSwitchModel = async (newProvider, newModelName) => {
    setShowModelPicker(false);
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          model_name: newModelName,
          is_private: ['ollama', 'lm_studio'].includes(newProvider)
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveNotebook(updated.notebook);
      }
    } catch (e) {
      console.error("Lỗi đổi model:", e);
    }
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
        body: JSON.stringify(guideConfig)
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
        body: JSON.stringify(guideConfig)
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
    try {
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notebook_id: activeNotebook.id,
          focus_topic: podcastConfig.focus_topic,
          style: podcastConfig.style
        })
      });
      if (!res.ok) throw new Error("Lỗi khi gọi API tạo Podcast");
      
      // Đợi hoàn tất và nạp file audio
      setTimeout(() => {
        setAudioUrl(`/api/podcast/audio/${activeNotebook.id}?t=${Date.now()}`);
        setPodcastGenerating(false);
      }, 5000);
    } catch (e) {
      console.error(e);
      alert("Lỗi tạo podcast: " + e.message);
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

  const handlePreviewDocument = async (filename) => {
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
        setDocuments(await docRes.json());
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Lỗi khi nạp link: ${e.message}`, citations: [] }]);
    } finally {
      setLoading(false);
      setUploadingDocs(prev => prev.filter(d => d.filename !== urlToSubmit));
    }
  };

  const handleFileUpload = async (e) => {
    if (!activeNotebook) return;
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadingDocs(prev => [...prev, { filename: file.name }]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('notebook_id', activeNotebook.id);

    try {
      const response = await fetch('/api/ingest/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      await response.json();
      
      const docRes = await fetch(`/api/notebooks/${activeNotebook.id}/documents`);
      if (docRes.ok) {
        setDocuments(await docRes.json());
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Lỗi khi tải tệp: ${err.message}`, citations: [] }]);
    } finally {
      setUploading(false);
      setUploadingDocs(prev => prev.filter(d => d.filename !== file.name));
      e.target.value = null;
    }
  };

  const deleteDocument = async (filename) => {
    if (!activeNotebook) return;
    if (!window.confirm(`Bạn có chắc muốn xóa tài liệu "${filename}"?`)) return;
    
    try {
      const res = await fetch(`/api/notebooks/${activeNotebook.id}/documents?filename=${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.filename !== filename));
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeNotebook) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '', citations: [] }]);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMsg, 
          notebook_id: activeNotebook.id,
          provider: activeNotebook.provider,
          model_name: activeNotebook.model_name
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
    }
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
    <div className="h-screen w-full flex bg-[#131314] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Cột 1: Left Sidebar (Sources) */}
      <div className="w-72 flex-shrink-0 h-full border-r border-white/5 bg-[#14161a] flex flex-col p-4 z-10 relative">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 w-fit transition-colors text-sm font-medium">
          <ArrowLeft size={16} /> Quay lại Danh sách
        </button>
        <h2 className="font-semibold text-base mb-3 flex items-center gap-2 text-gray-200">
          <Layers size={18} className="text-blue-400" /> Nguồn tài liệu ({documents.length})
        </h2>
        
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2.5">
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
              {documents.map((doc, index) => (
                <div 
                  key={`doc-${index}`} 
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.07] rounded-xl border border-white/10 flex items-center justify-between gap-2 group transition cursor-pointer"
                  onClick={() => handlePreviewDocument(doc.filename)}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 relative">
                      {doc.filename.includes('http') || doc.filename.includes('YouTube') ? <LinkIcon size={16} /> : <FileText size={16} />}
                      <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full text-[#131314] p-0.5">
                        <Check size={8} strokeWidth={4} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-gray-200" title={doc.filename}>{doc.filename}</p>
                      <p className="text-[10px] text-gray-500 truncate">{new Date(doc.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => handlePreviewDocument(doc.filename)}
                      className="p-1.5 rounded text-gray-400 hover:text-blue-400 hover:bg-white/10 transition"
                      title="Xem nội dung trích xuất"
                    >
                      <Eye size={13} />
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
              ))}
            </>
          )}
        </div>

        <div className="pt-3 mt-auto border-t border-white/10 space-y-2">
          <button 
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="w-full bg-white/5 hover:bg-white/10 text-gray-200 py-2.5 rounded-xl flex justify-center items-center gap-2 font-medium text-xs transition border border-white/10"
          >
            <LinkIcon size={15} /> Thêm Link / YouTube
          </button>
          <button 
            onClick={() => document.getElementById('file-upload').click()}
            className="w-full bg-white text-black hover:bg-gray-200 py-2.5 rounded-xl flex justify-center items-center gap-2 font-semibold text-xs transition shadow-lg"
          >
            <Plus size={15} /> Tải tệp lên
          </button>
        </div>
      </div>

      {/* Cột 2: Center (Chat) */}
      <div className="flex-1 flex flex-col h-full border-r border-white/5 p-4 max-w-4xl mx-auto relative z-10">
        
        {/* Chat Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
              <FileText className="text-blue-500" size={20}/>
              {activeNotebook.title}
            </h2>

            {/* Quick Model Selector Chip */}
            <div className="relative">
              <button 
                onClick={() => setShowModelPicker(!showModelPicker)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition cursor-pointer ${
                  currentProvider === 'ollama' 
                    ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' 
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                }`}
                title="Bấm để đổi mô hình AI"
              >
                {currentProvider === 'ollama' ? <Cpu size={12} /> : <Cloud size={12} />}
                <span>{currentProvider.toUpperCase()}: {currentModel}</span>
                <span className="text-[10px] opacity-60">▾</span>
              </button>

              {/* Model Picker Dropdown */}
              {showModelPicker && (
                <div className="absolute left-0 mt-2 w-64 bg-[#1c1e24] border border-white/15 rounded-xl shadow-2xl p-2 z-30 space-y-1 animate-fade-in">
                  <div className="text-[10px] font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">
                    Đổi Mô hình AI:
                  </div>
                  
                  {availableLocalModels.length > 0 && (
                    <>
                      <div className="text-[10px] text-green-400 px-2 pt-1 font-medium">Ollama (Trên máy):</div>
                      {availableLocalModels.map(m => (
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
                      ))}
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

                  <div className="pt-1.5 mt-1 border-t border-white/10">
                    <button
                      onClick={() => { setShowModelPicker(false); setShowSettings(true); }}
                      className="w-full text-left text-[11px] text-blue-400 hover:underline px-2 py-1 flex items-center gap-1"
                    >
                      <Settings size={12} /> Mở Cài đặt API Keys...
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportChat}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 font-medium"
              title="Xuất toàn bộ đoạn chat ra file Markdown (.md)"
            >
              <FileDown size={13} />
              <span className="hidden sm:inline">Xuất Chat</span>
            </button>
            <button 
              onClick={handleEvaluate}
              disabled={evaluating}
              className="text-xs px-3 py-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition disabled:opacity-50 flex items-center gap-1.5 font-medium"
              title="Đánh giá mức độ hiểu bài và chất lượng câu hỏi"
            >
              {evaluating ? <Loader size={13} className="animate-spin" /> : <Award size={13} />}
              {evaluating ? "Đang chấm..." : "Đánh giá AI"}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition"
              title="Cài đặt mô hình"
            >
              <Settings size={16} />
            </button>
            <button 
              onClick={deleteNotebook}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-white/5 transition"
              title="Xóa sổ tay"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-5 pb-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs ${
                msg.role === 'user' ? 'bg-gradient-to-br from-purple-600 to-pink-500' : 'bg-gradient-to-br from-blue-600 to-cyan-500'
              }`}>
                {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className={`flex flex-col gap-1.5 max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`group/msg relative px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-[#252830] border border-white/10 text-white rounded-tr-sm' 
                    : 'bg-[#181a20] border border-white/10 text-gray-100 rounded-tl-sm'
                }`}>
                  {msg.content && (
                    <button
                      onClick={() => handleCopyMessage(msg.content, idx)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 hover:bg-black/70 text-gray-400 hover:text-white opacity-0 group-hover/msg:opacity-100 transition shadow backdrop-blur-sm"
                      title="Sao chép nội dung tin nhắn"
                    >
                      {copiedMsgIdx === idx ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                  )}
                  {msg.content ? (
                    <div className="whitespace-pre-wrap pr-4">
                      {msg.content}
                      {msg.role === 'assistant' && loading && idx === messages.length - 1 && (
                        <span className="inline-block w-2 h-3.5 bg-blue-500 animate-pulse ml-1 align-middle rounded-sm"></span>
                      )}
                    </div>
                  ) : msg.role === 'assistant' && loading && idx === messages.length - 1 ? (
                    <div className="flex flex-col gap-2">
                      <span className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                      </span>
                      {msg.status && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium animate-pulse">
                          <Loader size={11} className="animate-spin" />
                          {msg.status}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-xs italic">
                      (Không có nội dung phản hồi)
                    </div>
                  )}
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {msg.citations.map((cit, cidx) => (
                      <div key={cidx} className="flex items-center gap-1 text-[11px] bg-blue-500/10 border border-blue-500/25 text-blue-400 px-2 py-0.5 rounded-full">
                        <span className="font-semibold">{cit.marker}</span>
                        <ChevronRight size={10} className="opacity-50" />
                        <span className="truncate max-w-[140px] opacity-90">{cit.filename}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="pt-2">
          <div className="bg-[#181a20] border border-white/15 p-2 flex items-end gap-2 rounded-2xl relative group focus-within:border-blue-500/60 transition-all duration-300">
            
            <div className="relative">
              {showUrlInput && (
                <div className="absolute bottom-full left-0 mb-2 bg-[#1c1f26] border border-white/15 p-2.5 rounded-xl shadow-2xl flex gap-2 z-20 w-80">
                  <input 
                    type="text" 
                    value={urlInputValue}
                    onChange={(e) => setUrlInputValue(e.target.value)}
                    placeholder="Dán link Website hoặc YouTube..." 
                    className="flex-1 bg-black/40 text-xs px-3 py-2 rounded-lg outline-none text-white border border-white/15 focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  />
                  <button 
                    onClick={handleUrlSubmit}
                    className="bg-blue-600 px-3 rounded-lg text-white hover:bg-blue-500 transition"
                  >
                    <Check size={14}/>
                  </button>
                </div>
              )}
              <button 
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="p-2.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
                title="Nhập Link Website hoặc YouTube"
              >
                <LinkIcon size={18} />
              </button>
            </div>
            
            <button 
              onClick={() => document.getElementById('file-upload').click()}
              className="p-2.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
              title="Tải lên PDF/Doc/Audio"
            >
              <Paperclip size={18} />
            </button>
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              onChange={handleFileUpload}
              accept=".pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.mp3,.wav,.m4a"
            />

            <textarea 
              className="flex-1 bg-transparent border-none px-2 py-2.5 text-sm text-white focus:outline-none resize-none min-h-[44px] max-h-[140px] scrollbar-hide"
              placeholder="Đặt câu hỏi về tài liệu của bạn..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button 
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                input.trim() && !loading 
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' 
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              }`}
              onClick={handleSend} 
              disabled={!input.trim() || loading}
            >
              <Send size={16} className={input.trim() && !loading ? 'translate-x-0.5 -translate-y-0.5' : ''} />
            </button>
          </div>
          <div className="text-center mt-2 text-[11px] text-gray-500">
            NotebookLM Mini trả lời dựa trên tài liệu đã nạp. Hãy kiểm tra lại nguồn trích dẫn nếu cần.
          </div>
        </div>
      </div>

      {/* Cột 3: Right Sidebar (Study Guide & Podcast) */}
      <div className="w-80 lg:w-96 flex-shrink-0 h-full p-4 overflow-y-auto scrollbar-hide bg-[#14161a] flex flex-col gap-5 border-l border-white/5">
        
        {/* Study Guide Card */}
        <div className="p-4 rounded-2xl bg-[#181a20] border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-400 flex items-center gap-1.5">
              <BookOpen size={16} /> Cẩm Nang Học Tập
            </h3>
            {documents.length > 0 && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowGuideConfigModal(true)}
                  disabled={regeneratingGuide}
                  className="text-[11px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition"
                  title="Tùy chỉnh số lượng câu hỏi, flashcards và chủ đề"
                >
                  <SlidersHorizontal size={11} /> Tùy chỉnh
                </button>
                <button 
                  onClick={handleRegenerateStudyGuide}
                  disabled={regeneratingGuide}
                  className="text-[11px] text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition"
                  title="Làm mới nhanh"
                >
                  <RefreshCw size={12} className={regeneratingGuide ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </div>
          
          {documents.length === 0 ? (
            <div className="text-gray-500 text-xs py-6 text-center leading-relaxed">
              Tải lên tài liệu ở cột bên trái để AI tự động trích xuất bản tóm tắt và câu hỏi ôn tập.
            </div>
          ) : !studyGuide ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2.5">
              <Loader className="animate-spin text-blue-500" size={20} />
              <span className="text-xs">Đang đọc & phân tích tài liệu...</span>
            </div>
          ) : (
            <div className="space-y-3.5 text-xs">
              <div>
                <h4 className="font-semibold text-gray-300 mb-1">Tóm tắt cốt lõi:</h4>
                <p className="text-gray-400 leading-relaxed max-h-36 overflow-y-auto scrollbar-hide">{studyGuide.summary}</p>
              </div>
              <div className="pt-2 border-t border-white/10">
                <h4 className="font-semibold text-gray-300 mb-1">Câu hỏi thường gặp:</h4>
                <p className="text-gray-400 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto scrollbar-hide">{studyGuide.faq}</p>
              </div>

              <div className="pt-3 flex gap-2 border-t border-white/10">
                <button 
                  onClick={() => setShowQuiz(true)}
                  disabled={!studyGuide.quiz || studyGuide.quiz.length === 0}
                  className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 py-2 rounded-xl transition flex items-center justify-center gap-1.5 font-semibold disabled:opacity-40"
                >
                  <Brain size={14} /> Trắc nghiệm ({studyGuide.quiz?.length || 0})
                </button>
                <button 
                  onClick={() => setShowFlashcards(true)}
                  disabled={!studyGuide.flashcards || studyGuide.flashcards.length === 0}
                  className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 py-2 rounded-xl transition flex items-center justify-center gap-1.5 font-semibold disabled:opacity-40"
                  title="Mở bộ thẻ lật 3D, game ghép thẻ và xuất Quizlet"
                >
                  <Layers size={14} /> Quizlet ({studyGuide.flashcards?.length || 0})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Podcast Card */}
        <div className="p-4 rounded-2xl bg-[#181a20] border border-white/10">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-bold text-purple-400 flex items-center gap-1.5">
              <Headphones size={16} /> Trò Chuyện Audio (Podcast)
            </h3>
            {documents.length > 0 && (
              <button 
                onClick={() => setShowPodcastModal(true)}
                disabled={podcastGenerating}
                className="text-[11px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition"
                title="Tùy chỉnh chủ đề và phong cách Podcast"
              >
                <SlidersHorizontal size={11} /> Tùy chỉnh
              </button>
            )}
          </div>
          
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            AI tự động viết kịch bản và thảo luận bằng âm thanh giữa 2 người dẫn chương trình.
          </p>

          {!audioUrl ? (
            <button 
              onClick={generatePodcast}
              disabled={podcastGenerating || documents.length === 0}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white font-semibold text-xs py-2.5 rounded-xl transition disabled:opacity-40 flex justify-center items-center gap-2"
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
                className="w-full py-1.5 text-[11px] text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition text-center"
              >
                Tạo bản thu khác (Tùy chỉnh)
              </button>
            </div>
          )}
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

      {/* MODAL: QUIZLET SUITE (Flashcards 3D, Match Game, Export) */}
      <QuizletModal
        isOpen={showFlashcards}
        onClose={() => setShowFlashcards(false)}
        flashcards={studyGuide?.flashcards || []}
        title={activeNotebook?.title || "Bộ thẻ học tập"}
        onOpenConfig={() => setShowGuideConfigModal(true)}
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

    </div>
  );
}

export default Studio;
