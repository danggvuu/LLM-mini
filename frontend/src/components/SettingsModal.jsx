import React, { useState, useEffect } from 'react';
import { X, Check, Server, Key, Cpu, Cloud, RefreshCw, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';
import axios from 'axios';

export default function SettingsModal({ isOpen, onClose, onSettingsSaved }) {
  const [activeTab, setActiveTab] = useState('local'); // 'local' or 'cloud'
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [localStatus, setLocalStatus] = useState({ ollama: { available: false, models: [] }, lm_studio: { available: false, models: [] } });
  
  // Settings State
  const [settings, setSettings] = useState({
    default_provider: 'ollama',
    default_model: 'qwen2.5:3b',
    ollama_base_url: 'http://localhost:11434',
    lm_studio_base_url: 'http://localhost:1234/v1',
    gemini_api_key: '',
    gemini_model: 'gemini-2.5-flash',
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    groq_api_key: '',
    groq_model: 'llama-3.3-70b-versatile',
    openrouter_api_key: '',
    openrouter_model: 'deepseek/deepseek-r1',
    router9_base_url: 'http://localhost:20128/v1',
    router9_api_key: '',
    router9_model: 'claude-3-5-sonnet',
    custom_base_url: '',
    custom_api_key: '',
    custom_model: ''
  });

  const [testResult, setTestResult] = useState({});
  const [testingProvider, setTestingProvider] = useState(null);
  const [showKeys, setShowKeys] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      scanLocalModels();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (e) {
      console.error("Lỗi tải cài đặt:", e);
    }
  };

  const scanLocalModels = async () => {
    setScanning(true);
    try {
      const res = await axios.get('/api/llm/local-models');
      setLocalStatus(res.data);
      // Nếu có model ollama mà default_model rỗng, chọn model đầu tiên
      if (res.data?.ollama?.models?.length > 0 && (!settings.default_model || settings.default_model === 'qwen2.5:3b')) {
        const found = res.data.ollama.models.find(m => m.name === settings.default_model);
        if (!found) {
          setSettings(prev => ({ ...prev, default_model: res.data.ollama.models[0].name }));
        }
      }
    } catch (e) {
      console.error("Lỗi quét local models:", e);
    } finally {
      setScanning(false);
    }
  };

  const handleTestConnection = async (provider, modelName, apiKey, baseUrl) => {
    setTestingProvider(provider);
    setTestResult(prev => ({ ...prev, [provider]: { testing: true } }));
    try {
      const res = await axios.post('/api/llm/test-connection', {
        provider,
        model_name: modelName,
        api_key: apiKey,
        base_url: baseUrl
      });
      setTestResult(prev => ({ ...prev, [provider]: res.data }));
    } catch (e) {
      setTestResult(prev => ({
        ...prev,
        [provider]: { success: false, message: e.response?.data?.detail || e.message }
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.post('/api/settings', settings);
      if (onSettingsSaved) onSettingsSaved(settings);
      onClose();
    } catch (e) {
      alert("Lỗi lưu cài đặt: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleShowKey = (field) => {
    setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#181a20] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Cpu size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Cấu hình Bộ Não AI</h2>
              <p className="text-xs text-gray-400">Cắm bất kỳ Local AI hoặc Cloud API nào một cách dễ dàng</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-5 bg-white/[0.01]">
          <button
            onClick={() => setActiveTab('local')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'local'
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Server size={15} /> Local AI (Ollama / Trên máy)
          </button>
          <button
            onClick={() => setActiveTab('9router')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === '9router'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Cpu size={15} /> 9Router Gateway
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'cloud'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Cloud size={15} /> Cloud AI (API Key)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-hide">
          
          {/* TAB 1: LOCAL AI */}
          {activeTab === 'local' && (
            <div className="space-y-6 animate-fade-in">
              {/* Ollama Section */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Ollama</span>
                    {localStatus?.ollama?.available ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Đã kết nối ({localStatus.ollama.models.length} model)
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        Chưa tìm thấy
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={scanLocalModels} 
                    disabled={scanning}
                    className="text-xs flex items-center gap-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition"
                  >
                    <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} /> Quét lại
                  </button>
                </div>

                {localStatus?.ollama?.available ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Chọn Model Ollama mặc định:</label>
                      <select
                        value={settings.default_model}
                        onChange={e => setSettings({ ...settings, default_model: e.target.value })}
                        className="w-full bg-[#121316] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
                      >
                        {localStatus.ollama.models.map(m => (
                          <option key={m.name} value={m.name}>
                            {m.name} ({m.size_gb} GB - {m.details?.parameter_size || 'Local'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={settings.ollama_base_url} 
                        onChange={e => setSettings({ ...settings, ollama_base_url: e.target.value })}
                        placeholder="http://localhost:11434"
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-green-500 font-mono"
                      />
                      <button
                        onClick={() => handleTestConnection('ollama', settings.default_model, '', settings.ollama_base_url)}
                        disabled={testingProvider === 'ollama'}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition flex items-center gap-1"
                      >
                        {testingProvider === 'ollama' ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                        Test
                      </button>
                    </div>

                    {testResult.ollama && (
                      <div className={`p-2.5 rounded-lg text-xs border ${testResult.ollama.success ? 'bg-green-500/10 text-green-300 border-green-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                        {testResult.ollama.message}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-300/90 leading-relaxed">
                    💡 <strong>Mẹo cho người dùng mới:</strong> Cài ứng dụng <strong>Ollama</strong> (từ ollama.com) rồi chạy lệnh ví dụ <code>ollama run qwen2.5:3b</code> hoặc mở app lên là hệ thống tự động nhận diện 100%!
                  </div>
                )}
              </div>

              {/* LM Studio / Local OpenAI Compatible */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">LM Studio / vLLM / LocalAI</span>
                  {localStatus?.lm_studio?.available ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                      Sẵn sàng
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Cổng 1234</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Địa chỉ Local Endpoint:</label>
                    <input 
                      type="text" 
                      value={settings.lm_studio_base_url}
                      onChange={e => setSettings({ ...settings, lm_studio_base_url: e.target.value })}
                      placeholder="http://localhost:1234/v1"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Tên Model tải trong LM Studio:</label>
                    <input 
                      type="text" 
                      value={settings.custom_model || 'local-model'}
                      onChange={e => setSettings({ ...settings, custom_model: e.target.value })}
                      placeholder="local-model"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleTestConnection('lm_studio', settings.custom_model || 'local-model', '', settings.lm_studio_base_url)}
                  disabled={testingProvider === 'lm_studio'}
                  className="w-full py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 transition flex items-center justify-center gap-1.5"
                >
                  {testingProvider === 'lm_studio' ? <RefreshCw size={12} className="animate-spin" /> : null}
                  Kiểm tra kết nối LM Studio
                </button>

                {testResult.lm_studio && (
                  <div className={`p-2.5 rounded-lg text-xs border ${testResult.lm_studio.success ? 'bg-green-500/10 text-green-300 border-green-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                    {testResult.lm_studio.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: 9ROUTER GATEWAY */}
          {activeTab === '9router' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-purple-500/[0.04] border border-purple-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">9Router AI Gateway</span>
                    {localStatus?.router9?.available ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Đã kết nối ({localStatus.router9.models.length} model)
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                        Chưa chạy cục bộ (Cổng 20128)
                      </span>
                    )}
                  </div>
                  <a 
                    href="https://github.com/9router/9router" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-xs text-purple-400 hover:underline flex items-center gap-1"
                  >
                    Tài liệu 9Router <ExternalLink size={11} />
                  </a>
                </div>

                <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-xs text-gray-300 space-y-1.5 leading-relaxed">
                  <p className="font-medium text-purple-300">⚡ Tính năng nổi bật của 9Router:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-gray-400 text-[11px]">
                    <li><strong>Smart 3-Tier Auto Fallback:</strong> Tự động đổi sang model khác khi bị Rate Limit (429) hoặc hết quota.</li>
                    <li><strong>Hỗ trợ 60+ nhà cung cấp AI</strong> chỉ qua 1 cổng duy nhất tương thích OpenAI API.</li>
                    <li>Cài đặt nhanh trên máy: <code className="bg-white/10 px-1 py-0.5 rounded text-white font-mono">npm install -g 9router && 9router</code></li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">9Router Endpoint URL:</label>
                    <input 
                      type="text" 
                      value={settings.router9_base_url || 'http://localhost:20128/v1'}
                      onChange={e => setSettings({ ...settings, router9_base_url: e.target.value })}
                      placeholder="http://localhost:20128/v1"
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">9Router API Key (nếu có đặt):</label>
                      <input 
                        type={showKeys.router9 ? "text" : "password"}
                        value={settings.router9_api_key || ''}
                        onChange={e => setSettings({ ...settings, router9_api_key: e.target.value })}
                        placeholder="Lấy từ Dashboard localhost:20128"
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <button 
                        type="button" 
                        onClick={() => toggleShowKey('router9')}
                        className="absolute right-3 top-8 text-gray-400 hover:text-white"
                      >
                        {showKeys.router9 ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Tên Model định tuyến:</label>
                      <input 
                        type="text" 
                        value={settings.router9_model || 'claude-3-5-sonnet'}
                        onChange={e => setSettings({ ...settings, router9_model: e.target.value })}
                        placeholder="claude-3-5-sonnet, deepseek-chat, gpt-4o"
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleTestConnection('9router', settings.router9_model || 'claude-3-5-sonnet', settings.router9_api_key, settings.router9_base_url || 'http://localhost:20128/v1')}
                    disabled={testingProvider === '9router'}
                    className="w-full py-2.5 text-xs font-semibold rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30 transition flex items-center justify-center gap-1.5"
                  >
                    {testingProvider === '9router' ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                    Kiểm tra kết nối 9Router Gateway
                  </button>

                  {testResult['9router'] && (
                    <div className={`p-2.5 rounded-lg text-xs border ${testResult['9router'].success ? 'bg-green-500/10 text-green-300 border-green-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                      {testResult['9router'].message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUD API */}
          {activeTab === 'cloud' && (
            <div className="space-y-5 animate-fade-in">
              
              {/* Gemini */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Google Gemini</span>
                    <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
                      Lấy Key miễn phí <ExternalLink size={10} />
                    </a>
                  </div>
                  <span className="text-xs text-gray-500">Khuyên dùng</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 relative">
                    <input 
                      type={showKeys.gemini ? "text" : "password"}
                      value={settings.gemini_api_key || ''}
                      onChange={e => setSettings({ ...settings, gemini_api_key: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 pr-10 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button 
                      type="button" 
                      onClick={() => toggleShowKey('gemini')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                    >
                      {showKeys.gemini ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div>
                    <select
                      value={settings.gemini_model || 'gemini-2.5-flash'}
                      onChange={e => setSettings({ ...settings, gemini_model: e.target.value })}
                      className="w-full bg-[#121316] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Nhanh)</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Mạnh)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => handleTestConnection('gemini', settings.gemini_model, settings.gemini_api_key, '')}
                  disabled={testingProvider === 'gemini' || !settings.gemini_api_key}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-40 transition flex items-center gap-1.5"
                >
                  {testingProvider === 'gemini' ? <RefreshCw size={12} className="animate-spin" /> : null}
                  Kiểm tra Gemini Key
                </button>

                {testResult.gemini && (
                  <div className={`p-2.5 rounded-lg text-xs border ${testResult.gemini.success ? 'bg-green-500/10 text-green-300 border-green-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                    {testResult.gemini.message}
                  </div>
                )}
              </div>

              {/* OpenAI */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">OpenAI (ChatGPT)</span>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
                    Lấy Key <ExternalLink size={10} />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 relative">
                    <input 
                      type={showKeys.openai ? "text" : "password"}
                      value={settings.openai_api_key || ''}
                      onChange={e => setSettings({ ...settings, openai_api_key: e.target.value })}
                      placeholder="sk-proj-..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 pr-10 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button 
                      type="button" 
                      onClick={() => toggleShowKey('openai')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                    >
                      {showKeys.openai ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div>
                    <select
                      value={settings.openai_model || 'gpt-4o-mini'}
                      onChange={e => setSettings({ ...settings, openai_model: e.target.value })}
                      className="w-full bg-[#121316] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini (Tiết kiệm)</option>
                      <option value="gpt-4o">gpt-4o (Thông minh)</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => handleTestConnection('openai', settings.openai_model, settings.openai_api_key, '')}
                  disabled={testingProvider === 'openai' || !settings.openai_api_key}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-40 transition flex items-center gap-1.5"
                >
                  {testingProvider === 'openai' ? <RefreshCw size={12} className="animate-spin" /> : null}
                  Kiểm tra OpenAI Key
                </button>

                {testResult.openai && (
                  <div className={`p-2.5 rounded-lg text-xs border ${testResult.openai.success ? 'bg-green-500/10 text-green-300 border-green-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                    {testResult.openai.message}
                  </div>
                )}
              </div>

              {/* Groq (Fast & Free) */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Groq</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">Cực nhanh</span>
                  </div>
                  <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
                    Lấy Key miễn phí <ExternalLink size={10} />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 relative">
                    <input 
                      type={showKeys.groq ? "text" : "password"}
                      value={settings.groq_api_key || ''}
                      onChange={e => setSettings({ ...settings, groq_api_key: e.target.value })}
                      placeholder="gsk_..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 pr-10 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                    <button 
                      type="button" 
                      onClick={() => toggleShowKey('groq')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                    >
                      {showKeys.groq ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div>
                    <select
                      value={settings.groq_model || 'llama-3.3-70b-versatile'}
                      onChange={e => setSettings({ ...settings, groq_model: e.target.value })}
                      className="w-full bg-[#121316] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="llama-3.3-70b-versatile">llama-3.3-70b</option>
                      <option value="llama-3.1-8b-instant">llama-3.1-8b (Flash)</option>
                      <option value="mixtral-8x7b-32768">mixtral-8x7b</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => handleTestConnection('groq', settings.groq_model, settings.groq_api_key, '')}
                  disabled={testingProvider === 'groq' || !settings.groq_api_key}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 disabled:opacity-40 transition flex items-center gap-1.5"
                >
                  {testingProvider === 'groq' ? <RefreshCw size={12} className="animate-spin" /> : null}
                  Kiểm tra Groq Key
                </button>

                {testResult.groq && (
                  <div className={`p-2.5 rounded-lg text-xs border ${testResult.groq.success ? 'bg-green-500/10 text-green-300 border-green-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                    {testResult.groq.message}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <p className="text-xs text-gray-500">Cài đặt được lưu trữ an toàn trong máy tính của bạn.</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              Đóng
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-gray-200 transition shadow-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Lưu Cài Đặt
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
