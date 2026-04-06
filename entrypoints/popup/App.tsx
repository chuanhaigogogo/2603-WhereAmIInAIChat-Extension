import { useState, useEffect } from 'react';
import { AIExtractor } from '../../src/core/extraction/AIExtractor';

type ApiProvider = 'anthropic' | 'deepseek' | 'doubao' | 'gemini' | 'openai';

const PROVIDERS: { key: ApiProvider; label: string; placeholder: string }[] = [
  { key: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { key: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...' },
  { key: 'gemini', label: 'Google', placeholder: 'AIza...' },
  { key: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { key: 'doubao', label: 'Volcengine Ark', placeholder: 'ark-...' },
];

const PROVIDER_ORIGINS: Record<ApiProvider, string> = {
  anthropic: 'https://api.anthropic.com/*',
  deepseek: 'https://api.deepseek.com/*',
  gemini: 'https://generativelanguage.googleapis.com/*',
  openai: 'https://api.openai.com/*',
  doubao: 'https://ark.cn-beijing.volces.com/*',
};

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [provider, setProvider] = useState<ApiProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    chrome.storage.local.get(
      ['mindflow_api_provider', 'mindflow_api_key', 'mindflow_sidebar_open', 'mindflow_connected'],
      (result) => {
        if (result.mindflow_api_provider) setProvider(result.mindflow_api_provider);
        if (result.mindflow_api_key) setApiKey(result.mindflow_api_key);
        if (result.mindflow_sidebar_open) setSidebarOpen(result.mindflow_sidebar_open);
        if (result.mindflow_connected) setConnected(true);
      }
    );
  }, []);

  const saveSettings = (newProvider: ApiProvider, newKey: string) => {
    chrome.storage.local.set({
      mindflow_api_provider: newProvider,
      mindflow_api_key: newKey,
    });
  };

  const clearConnected = () => {
    setConnected(false);
    chrome.storage.local.set({ mindflow_connected: false });
  };

  const sendToTab = async (msg: { type: string }): Promise<boolean> => {
    setPageError('');
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return false;
      const url = tab.url || '';
      if (!url.match(/chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|chat\.deepseek\.com|doubao\.com|perplexity\.ai|grok\.com/)) {
        setPageError('Open a supported AI chat page first');
        return false;
      }
      await browser.tabs.sendMessage(tab.id, msg);
      return true;
    } catch {
      setPageError('Refresh the AI chat page first');
      return false;
    }
  };

  const toggleSidebar = async () => {
    const ok = await sendToTab({ type: 'toggle-sidebar' });
    if (ok) {
      const newState = !sidebarOpen;
      setSidebarOpen(newState);
      chrome.storage.local.set({ mindflow_sidebar_open: newState });
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setConnected(false);
    try {
      const origin = PROVIDER_ORIGINS[provider];
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) {
        setTestResult('Permission denied');
        setTesting(false);
        return;
      }
      const ok = await AIExtractor.testConnection(provider, apiKey);
      setConnected(ok);
      chrome.storage.local.set({ mindflow_connected: ok });
      setTestResult(ok ? 'Connected!' : 'Failed - check key');
    } catch (e) {
      setTestResult('Error - ' + (e instanceof Error ? e.message : 'network'));
    }
    setTesting(false);
  };

  const generateMindMap = async () => {
    if (!sidebarOpen) {
      const ok = await sendToTab({ type: 'toggle-sidebar' });
      if (!ok) return;
      setSidebarOpen(true);
      chrome.storage.local.set({ mindflow_sidebar_open: true });
    }
    const ok = await sendToTab({ type: 'generate-mindmap' });
    if (!ok) return;
    setGenerating(true);
    setGenStatus('Generating...');
    setTimeout(() => { setGenerating(false); setGenStatus('Check sidebar'); }, 1000);
    setTimeout(() => setGenStatus(''), 3000);
  };

  const canGenerate = connected;

  return (
    <div style={{ padding: '12px 14px', width: '280px', fontSize: '12px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>
            MindFlow
          </span>
          <span style={{
            fontSize: '9px', background: '#f0f4ff', color: '#6b8aed',
            padding: '1px 5px', borderRadius: '6px', fontWeight: 500,
          }}>v1.0</span>
        </div>
        <button onClick={() => window.close()} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '13px', color: '#c0c4cc', padding: '2px 4px', lineHeight: 1,
        }} title="Close">{'\u2715'}</button>
      </div>

      {/* 1. Show Panel */}
      <button onClick={toggleSidebar} style={{
        ...actionBtn,
        background: sidebarOpen ? '#fff' : '#3b82f6',
        color: sidebarOpen ? '#6b7280' : '#fff',
        border: sidebarOpen ? '1px solid #e5e7eb' : '1px solid #3b82f6',
        marginBottom: '6px',
      }}>
        <span style={num}>1.</span>
        {sidebarOpen ? 'Panel Visible' : 'Show Panel'}
      </button>
      {pageError && (
        <div style={{ marginTop: '4px', marginBottom: '2px', fontSize: '10px', color: '#ef4444', textAlign: 'center' }}>
          {pageError}
        </div>
      )}

      {/* 2. API Configuration */}
      <div style={{
        border: '1px solid #f0f0f0', borderRadius: '6px',
        padding: '8px 10px', marginBottom: '6px', background: '#fafbfc',
      }}>
        {/* Provider chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '6px' }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setProvider(p.key); clearConnected(); setTestResult(null); saveSettings(p.key, apiKey); }}
              style={provider === p.key ? chipActive : chipInactive}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Key input */}
        <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              clearConnected(); setTestResult(null);
              saveSettings(provider, e.target.value);
            }}
            placeholder={PROVIDERS.find(p => p.key === provider)?.placeholder ?? 'API key'}
            style={{
              flex: 1, padding: '4px 6px', fontSize: '11px',
              border: '1px solid #e5e7eb', borderRadius: '4px',
              outline: 'none', minWidth: 0, color: '#374151',
            }}
          />
          <button onClick={() => setShowKey(!showKey)} style={{
            padding: '4px 6px', fontSize: '10px', color: '#9ca3af',
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>

        {/* 2. Test connection */}
        <button onClick={testConnection} disabled={!apiKey || testing} style={{
          width: '100%', padding: '4px', fontSize: '11px', fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: connected ? '#dcfce7' : '#fff',
          color: connected ? '#16a34a' : '#6b7280',
          border: connected ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
          borderRadius: '4px', cursor: (!apiKey || testing) ? 'default' : 'pointer',
          opacity: (!apiKey || testing) ? 0.5 : 1,
        }}>
          <span style={num}>2.</span>
          {testing ? 'Testing...' : connected ? 'Connected' : 'Test Connection'}
        </button>

        {testResult && !connected && (
          <div style={{ marginTop: '4px', fontSize: '10px', color: '#ef4444' }}>{testResult}</div>
        )}
        <div style={{ marginTop: '5px', fontSize: '9px', color: '#c0c4cc', lineHeight: '1.3' }}>
          Key stored locally only.
        </div>
      </div>

      {/* 3. Generate */}
      <button
        onClick={generateMindMap}
        disabled={!canGenerate || generating}
        style={{
          ...actionBtn,
          background: !canGenerate ? '#e5e7eb' : generating ? '#c4b5fd' : '#8b5cf6',
          color: !canGenerate ? '#9ca3af' : '#fff',
          border: !canGenerate ? '1px solid #e5e7eb' : '1px solid transparent',
          fontWeight: 600,
        }}
      >
        <span style={num}>3.</span>
        {generating ? 'Generating...' : 'Generate Mind Map'}
      </button>
      {genStatus && (
        <div style={{ marginTop: '3px', fontSize: '10px', color: '#8b5cf6', textAlign: 'center' }}>
          {genStatus}
        </div>
      )}
      {!canGenerate && (
        <div style={{ marginTop: '3px', fontSize: '10px', color: '#c0c4cc', textAlign: 'center' }}>
          Connect API first
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const num: React.CSSProperties = {
  fontSize: '9px', fontWeight: 600, opacity: 0.5, marginRight: '4px',
};

const actionBtn: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '6px', fontSize: '11px', fontWeight: 500,
  borderRadius: '5px', cursor: 'pointer', lineHeight: '1.3',
  transition: 'background 0.15s',
};

const chipActive: React.CSSProperties = {
  padding: '2px 6px', fontSize: '9px', fontWeight: 500,
  background: '#3b82f6', color: '#fff', border: '1px solid #3b82f6',
  borderRadius: '3px', cursor: 'pointer', lineHeight: '1.3',
};

const chipInactive: React.CSSProperties = {
  padding: '2px 6px', fontSize: '9px',
  background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb',
  borderRadius: '3px', cursor: 'pointer', lineHeight: '1.3',
};
