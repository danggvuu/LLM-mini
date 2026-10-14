import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Search, Check, Settings, Trash2, Cpu, Cloud, Server, ExternalLink } from 'lucide-react';
import axios from 'axios';
import SettingsModal from '../components/SettingsModal';

function Dashboard() {
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Create Notebook Form State
  const [newTitle, setNewTitle] = useState('');
  const [provider, setProvider] = useState('ollama'); // 'ollama', 'lm_studio', 'gemini', 'openai', 'groq'
  const [selectedModel, setSelectedModel] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [globalSettings, setGlobalSettings] = useState({});
  const [localModels, setLocalModels] = useState([]);

  useEffect(() => {
    fetchNotebooks();
    fetchSettingsAndModels();
  }, []);

  const fetchNotebooks = async () => {
    try {
      const res = await axios.get('/api/notebooks');
      setNotebooks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettingsAndModels = async () => {
    try {
      const [settingsRes, modelsRes] = await Promise.all([
        axios.get('/api/settings'),
        axios.get('/api/llm/local-models')
      ]);
      setGlobalSettings(settingsRes.data || {});
      const ollamaModels = modelsRes.data?.ollama?.models || [];
      setLocalModels(ollamaModels);
      if (ollamaModels.length > 0 && !selectedModel) {
        setSelectedModel(ollamaModels[0].name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreateModal = () => {
    fetchSettingsAndModels();
    setNewTitle('');
    setCustomKey('');
    setShowModal(true);
  };

  const handleDeleteNotebook = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa Sổ tay này cùng toàn bộ tài liệu bên trong không?")) return;
    try {
      await axios.delete(`/api/notebooks/${id}`);
      setNotebooks(prev => prev.filter(nb => nb.id !== id));
    } catch (err) {
      alert("Lỗi xóa sổ tay: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    let finalKey = customKey.trim();
    if (!finalKey) {
      if (provider === 'gemini') finalKey = globalSettings.gemini_api_key || '';
      else if (provider === 'openai') finalKey = globalSettings.openai_api_key || '';
      else if (provider === 'groq') finalKey = globalSettings.groq_api_key || '';
    }

    if (['gemini', 'openai', 'groq'].includes(provider) && !finalKey) {
      alert(`Vui lòng nhập API Key cho ${provider.toUpperCase()} hoặc cài đặt trong phần Cài đặt!`);
      return;
    }
    
    const id = Date.now().toString();
    const isPrivate = ['ollama', 'lm_studio'].includes(provider);

    try {
      await axios.post('/api/notebooks', {
        id,
        title: newTitle.trim(),
        is_private: isPrivate,
        provider,
        model_name: selectedModel || undefined,
        api_key: finalKey || undefined
      });
      setShowModal(false);
      navigate(`/notebook/${id}`);
    } catch (err) {
      console.error(err);
      alert('Lỗi tạo sổ ghi chú: ' + (err.response?.data?.detail || err.message));
    }
  };

  const filteredNotebooks = notebooks.filter(nb => 
    nb.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProviderBadge = (nb) => {
    const prov = (nb.provider || (nb.is_private ? 'ollama' : 'gemini')).toLowerCase();
    if (prov === 'ollama') {
      return {
        label: `Ollama: ${nb.model_name || 'qwen2.5:3b'}`,
        color: 'bg-green-500/20 text-green-400 border-green-500/30'
      };
    }
    if (prov === 'lm_studio') {
      return {
        label: `LM Studio: ${nb.model_name || 'Local'}`,
        color: 'bg-teal-500/20 text-teal-300 border-teal-500/30'
      };
    }
    if (prov === 'gemini') {
      return {
        label: `Gemini: ${nb.model_name || 'Flash'}`,
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      };
    }
    if (prov === 'groq') {
      return {
        label: `Groq: ${nb.model_name || 'Llama'}`,
        color: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      };
    }
    return {
      label: `${prov.toUpperCase()}: ${nb.model_name || ''}`,
      color: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };
  };

  return (
    <div className="flex flex-col min-h-screen font-sans selection:bg-blue-500/30 w-full bg-[#121316] text-white">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-[#14161a]">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md">
            <BookOpen size={18} />
          </div>
          <span className="font-semibold text-lg tracking-tight">NotebookLM Mini</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-1.5 rounded-xl text-sm font-medium transition text-gray-200"
          >
            <Settings size={16} /> Cài đặt Model & API Key
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8">
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sổ ghi chú của bạn</h1>
            <p className="text-xs text-gray-400 mt-1">Quản lý và nghiên cứu thông tin dựa trên dữ liệu của riêng bạn</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm sổ ghi chú..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button 
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors shadow-lg shrink-0"
            >
              <Plus size={18} /> Tạo mới
            </button>
          </div>
        </div>

        {/* Notebooks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Create New Card */}
          <div 
            onClick={handleOpenCreateModal}
            className="aspect-[4/3] rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-dashed border-white/15 hover:border-white/30 transition-all cursor-pointer flex flex-col items-center justify-center group"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="font-semibold text-base text-gray-200">Tạo sổ ghi chú mới</span>
            <span className="text-xs text-gray-500 mt-1">Cắm Local hoặc Cloud AI</span>
          </div>

          {/* Existing Notebooks */}
          {filteredNotebooks.map(nb => {
            const badge = getProviderBadge(nb);
            return (
              <div 
                key={nb.id}
                onClick={() => navigate(`/notebook/${nb.id}`)}
                className="aspect-[4/3] rounded-2xl bg-[#181a20] border border-white/10 p-5 flex flex-col justify-between cursor-pointer hover:border-white/25 transition-all hover:-translate-y-1 hover:shadow-xl relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <button 
                    onClick={(e) => handleDeleteNotebook(e, nb.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition"
                    title="Xóa sổ ghi chú"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg text-white mb-1.5 line-clamp-2 leading-snug">{nb.title}</h3>
                  <p className="text-xs text-gray-500">{new Date(nb.created_at).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
            );
          })}
        </div>

      </main>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-xl font-bold text-white">Tạo Sổ ghi chú mới</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Tên sổ ghi chú</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="VD: Nghiên cứu sinh học, Ôn thi Luật..."
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">Chọn Bộ não AI (Mô hình)</label>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div 
                  onClick={() => {
                    setProvider('ollama');
                    if (localModels.length > 0) setSelectedModel(localModels[0].name);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    provider === 'ollama' 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Server size={16} className="text-green-400" />
                    <span className="font-semibold text-sm text-green-300">Ollama Local</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight">100% Offline trên máy tính, bảo mật tuyệt đối.</p>
                </div>

                <div 
                  onClick={() => {
                    setProvider('gemini');
                    setSelectedModel(globalSettings.gemini_model || 'gemini-2.5-flash');
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    provider === 'gemini' 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Cloud size={16} className="text-blue-400" />
                    <span className="font-semibold text-sm text-blue-300">Google Gemini</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight">Siêu nhanh, thông minh, miễn phí API key.</p>
                </div>
              </div>

              {/* Provider Options Row */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setProvider('openai');
                    setSelectedModel(globalSettings.openai_model || 'gpt-4o-mini');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    provider === 'openai' ? 'border-white bg-white/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  OpenAI (ChatGPT)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProvider('groq');
                    setSelectedModel(globalSettings.groq_model || 'llama-3.3-70b-versatile');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    provider === 'groq' ? 'border-purple-500 bg-purple-500/10 text-purple-300' : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  Groq (Siêu tốc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProvider('lm_studio');
                    setSelectedModel('local-model');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    provider === 'lm_studio' ? 'border-teal-500 bg-teal-500/10 text-teal-300' : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  LM Studio
                </button>
              </div>

              {/* Model selection based on provider */}
              {provider === 'ollama' && (
                <div className="bg-black/30 p-3 rounded-xl border border-white/10 space-y-2">
                  <label className="block text-xs text-gray-400 font-medium">Chọn mô hình trong Ollama:</label>
                  {localModels.length > 0 ? (
                    <select
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      className="w-full bg-[#121316] border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                    >
                      {localModels.map(m => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({m.size_gb} GB)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={selectedModel} 
                      onChange={e => setSelectedModel(e.target.value)}
                      placeholder="VD: qwen2.5:3b hoặc llama3.2"
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                    />
                  )}
                  <p className="text-[11px] text-gray-500">
                    {localModels.length > 0 ? `Đã phát hiện ${localModels.length} mô hình sẵn có trên máy.` : 'Không tìm thấy Ollama đang chạy, bạn vẫn có thể nhập tên model.'}
                  </p>
                </div>
              )}

              {/* Cloud API Key field */}
              {['gemini', 'openai', 'groq'].includes(provider) && (
                <div className="bg-black/30 p-3 rounded-xl border border-white/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-gray-300 font-medium">
                      {provider.toUpperCase()} API Key:
                    </label>
                    {globalSettings[`${provider}_api_key`] && !customKey && (
                      <span className="text-[11px] text-green-400 flex items-center gap-1">
                        <Check size={12} /> Đã có Key trong Cài đặt
                      </span>
                    )}
                  </div>
                  <input 
                    type="password" 
                    value={customKey}
                    onChange={e => setCustomKey(e.target.value)}
                    placeholder={globalSettings[`${provider}_api_key`] ? "Dùng key đã lưu (hoặc dán key khác vào đây)" : "Dán API Key vào đây..."}
                    className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                Hủy
              </button>
              <button 
                type="button"
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-gray-200 disabled:opacity-50 transition shadow-lg"
              >
                Tạo sổ ghi chú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        onSettingsSaved={() => {
          fetchSettingsAndModels();
        }}
      />

    </div>
  );
}

export default Dashboard;
