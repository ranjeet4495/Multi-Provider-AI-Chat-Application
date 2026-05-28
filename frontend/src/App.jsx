import React, { useState, useEffect } from 'react';
import axios from 'axios';

const defaultSettings = {
  jiraDomain: '',
  jiraEmail: '',
  jiraToken: '',
  jiraCustomField: '',
  openaiKey: '',
  openaiModel: 'gpt-4',
  geminiKey: '',
  geminiModel: 'gemini-1.5-flash',
  grokKey: '',
  grokModel: 'grok-beta',
  groqKey: '',
  groqModel: 'llama3-8b-8192',
  ollamaModel: 'phi3'
};

export default function App() {
  // Settings & Configuration States
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('qa_assistant_settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState({ ...settings });

  // Input & Content States
  const [ticketId, setTicketId] = useState('');
  const [jiraData, setJiraData] = useState(null);
  const [editableContent, setEditableContent] = useState('');
  const [selectedModel, setSelectedModel] = useState('openai');

  // Request & Status States
  const [loading, setLoading] = useState(false);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [generatedTestCases, setGeneratedTestCases] = useState('');

  // Defect Creation States
  const [defectProjectKey, setDefectProjectKey] = useState('');
  const [defectSummary, setDefectSummary] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [defectSteps, setDefectSteps] = useState('');
  const [defectExpected, setDefectExpected] = useState('');
  const [defectActual, setDefectActual] = useState('');
  const [defectSeverity, setDefectSeverity] = useState('Medium');
  const [defectPriority, setDefectPriority] = useState('Medium');
  const [defectLoading, setDefectLoading] = useState(false);
  const [defectGenLoading, setDefectGenLoading] = useState(false);
  const [defectCreatedKey, setDefectCreatedKey] = useState('');

  // Sync temp settings when drawer opens
  useEffect(() => {
    if (settingsOpen) {
      setTempSettings({ ...settings });
    }
  }, [settingsOpen, settings]);

  // Auto-hide toast notification
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle saving configurations to localStorage
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSettings(tempSettings);
    localStorage.setItem('qa_assistant_settings', JSON.stringify(tempSettings));
    setSettingsOpen(false);
    showToast('Settings saved successfully!');
  };

  const showToast = (message) => {
    setToast(message);
  };

  // Action: Fetch Jira Ticket
  const handleFetchJira = async () => {
    if (!ticketId.trim()) {
      setError('Please enter a Jira Ticket ID.');
      return;
    }

    setJiraLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`/api/jira/${ticketId.trim()}`, {
        headers: {
          'x-jira-domain': settings.jiraDomain,
          'x-jira-email': settings.jiraEmail,
          'x-jira-token': settings.jiraToken,
          'x-jira-custom-field': settings.jiraCustomField,
        }
      });

      const data = response.data;
      setJiraData(data);

      if (!defectProjectKey.trim() && ticketId.includes('-')) {
        setDefectProjectKey(ticketId.split('-')[0].trim().toUpperCase());
      }
      
      // Populate editable text area
      const textBlock = `Title: ${data.title}\n\nDescription:\n${data.description}\n\nAcceptance Criteria:\n${data.acceptanceCriteria}`;
      setEditableContent(textBlock);
      showToast(`Fetched ticket ${ticketId} successfully!`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || `Failed to fetch Jira ticket: ${err.message}`);
    } finally {
      setJiraLoading(false);
    }
  };

  // Action: Generate Test Cases
  const handleGenerateTestCases = async () => {
    if (!editableContent.trim()) {
      setError('Jira content is empty. Please fetch a ticket or enter details manually.');
      return;
    }

    // Verify key exists for selected cloud model
    if (selectedModel === 'openai' && !settings.openaiKey) {
      setError('OpenAI API key is missing. Open Settings (⚙️) to enter it.');
      return;
    }
    if (selectedModel === 'gemini' && !settings.geminiKey) {
      setError('Gemini API key is missing. Open Settings (⚙️) to enter it.');
      return;
    }
    if (selectedModel === 'grok' && !settings.grokKey) {
      setError('Grok API key is missing. Open Settings (⚙️) to enter it.');
      return;
    }
    if (selectedModel === 'groq' && !settings.groqKey) {
      setError('Groq API key is missing. Open Settings (⚙️) to enter it.');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedTestCases('');

    // Determine model name
    let modelName = '';
    if (selectedModel === 'openai') modelName = settings.openaiModel;
    if (selectedModel === 'gemini') modelName = settings.geminiModel;
    if (selectedModel === 'grok') modelName = settings.grokModel;
    if (selectedModel === 'groq') modelName = settings.groqModel;
    if (selectedModel === 'ollama') modelName = settings.ollamaModel;

    try {
      const response = await axios.post('/api/generate', {
        jiraContent: editableContent,
        selectedModel,
        modelName,
        apiKeys: {
          openaiKey: settings.openaiKey,
          geminiKey: settings.geminiKey,
          grokKey: settings.grokKey,
          groqKey: settings.groqKey,
        }
      });

      setGeneratedTestCases(response.data.testCases);
      showToast('Test cases generated successfully!');
    } catch (err) {
      console.error(err);

        setDefectCreatedKey(response.data.key || '');
      setError(err.response?.data?.error || `Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Parser to extract AI generated defect fields
  const parseAIDefect = (text) => {
    let summary = '';
    let description = '';
    let steps = '';
    let expected = '';
    let actual = '';

    // 1. Try Bracketed tags
    const summaryMatch = text.match(/\[SUMMARY\]([\s\S]*?)(?=\[(DESCRIPTION|STEPS|EXPECTED|ACTUAL)\]|$)/i);
    const descriptionMatch = text.match(/\[DESCRIPTION\]([\s\S]*?)(?=\[(SUMMARY|STEPS|EXPECTED|ACTUAL)\]|$)/i);
    const stepsMatch = text.match(/\[STEPS\]([\s\S]*?)(?=\[(SUMMARY|DESCRIPTION|EXPECTED|ACTUAL)\]|$)/i);
    const expectedMatch = text.match(/\[EXPECTED\]([\s\S]*?)(?=\[(SUMMARY|DESCRIPTION|STEPS|ACTUAL)\]|$)/i);
    const actualMatch = text.match(/\[ACTUAL\]([\s\S]*?)(?=\[(SUMMARY|DESCRIPTION|STEPS|EXPECTED)\]|$)/i);

    if (summaryMatch) summary = summaryMatch[1].trim();
    if (descriptionMatch) description = descriptionMatch[1].trim();
    if (stepsMatch) steps = stepsMatch[1].trim();
    if (expectedMatch) expected = expectedMatch[1].trim();
    if (actualMatch) actual = actualMatch[1].trim();

    // 2. Fallback: Parse headings or labels if bracketed tags were not fully matched
    if (!summary) {
      const sMatch = text.match(/(?:Summary|Title|Bug Summary):\s*(.*?)(?=\n|$)/i);
      if (sMatch) summary = sMatch[1].trim();
    }
    if (!steps) {
      const stMatch = text.match(/(?:Steps to Reproduce|Steps|Reproduction Steps):\s*([\s\S]*?)(?=(?:Expected Result|Expected|Actual Result|Actual|$))/i);
      if (stMatch) steps = stMatch[1].trim();
    }
    if (!expected) {
      const eMatch = text.match(/(?:Expected Result|Expected):\s*([\s\S]*?)(?=(?:Actual Result|Actual|Steps|$))/i);
      if (eMatch) expected = eMatch[1].trim();
    }
    if (!actual) {
      const aMatch = text.match(/(?:Actual Result|Actual):\s*([\s\S]*?)(?=(?:Steps|Expected|$))/i);
      if (aMatch) actual = aMatch[1].trim();
    }

    // If still empty, use the whole text as description
    if (!summary && !steps && !expected && !actual) {
      summary = `Defect found in Jira Ticket`;
      description = text;
    }

    return { summary, description, steps, expected, actual };
  };

  // Action: Create Defect in Jira
  const handleCreateDefect = async (e) => {
    e.preventDefault();
    if (!defectProjectKey.trim()) {
      setError('Please provide a Jira Project Key.');
      return;
    }
    if (!defectSummary.trim()) {
      setError('Please provide a Defect Summary.');
      return;
    }

    setDefectLoading(true);
    setError('');

    const projectKey = defectProjectKey.trim().toUpperCase();

    try {
      const response = await axios.post('/api/jira/defect', {
        projectKey,
        summary: defectSummary,
        description: defectDescription,
        steps: defectSteps,
        expectedResult: defectExpected,
        actualResult: defectActual,
        severity: defectSeverity,
        priority: defectPriority
      }, {
        headers: {
          'x-jira-domain': settings.jiraDomain,
          'x-jira-email': settings.jiraEmail,
          'x-jira-token': settings.jiraToken,
        }
      });

      showToast(`Defect created successfully: ${response.data.key}`);
      // Clear fields upon success
      setDefectProjectKey('');
      setDefectSummary('');
      setDefectDescription('');
      setDefectSteps('');
      setDefectExpected('');
      setDefectActual('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || `Failed to create defect: ${err.message}`);
    } finally {
      setDefectLoading(false);
    }
  };

  // Action: Generate Defect using AI
  const handleGenerateDefectAI = async () => {
    if (!editableContent.trim()) {
      setError('Jira story content is empty. Please fetch a ticket or enter details manually first.');
      return;
    }

    if (selectedModel === 'openai' && !settings.openaiKey) {
      setError('OpenAI API key is missing. Open Settings (⚙️) to enter it.');
      return;
    }
    if (selectedModel === 'gemini' && !settings.geminiKey) {
      setError('Gemini API key is missing. Open Settings (⚙️) to enter it.');
      return;
    }
    if (selectedModel === 'grok' && !settings.grokKey) {
      setError('Grok API key is missing. Open Settings (⚙️) to enter it.');
      return;
    }

    setDefectGenLoading(true);
    setError('');

    let modelName = '';
    if (selectedModel === 'openai') modelName = settings.openaiModel;
    if (selectedModel === 'gemini') modelName = settings.geminiModel;
    if (selectedModel === 'grok') modelName = settings.grokModel;
    if (selectedModel === 'groq') modelName = settings.groqModel;
    if (selectedModel === 'ollama') modelName = settings.ollamaModel;

    const prompt = `Act as QA Engineer. Create a bug report from below issue.
Include the following exact labels, and keep the output short, structured, and easy to parse:
[SUMMARY] Summary/Title of the bug
[DESCRIPTION] High level description of what is failing
[STEPS] Step 1, Step 2, Step 3, etc. to reproduce the issue
[EXPECTED] The expected behavior
[ACTUAL] The actual incorrect behavior

Keep it short, professional, and structured.

Jira Story Details:
${editableContent}`;

    try {
      const response = await axios.post('/api/generate', {
        jiraContent: prompt,
        selectedModel,
        modelName,
        apiKeys: {
          openaiKey: settings.openaiKey,
          geminiKey: settings.geminiKey,
          grokKey: settings.grokKey,
          groqKey: settings.groqKey,
        }
      });

      const generatedText = response.data.testCases;
      const parsedDefect = parseAIDefect(generatedText);

      setDefectSummary(parsedDefect.summary);
      setDefectDescription(parsedDefect.description);
      setDefectSteps(parsedDefect.steps);
      setDefectExpected(parsedDefect.expected);
      setDefectActual(parsedDefect.actual);

      showToast('Defect details generated and pre-filled by AI!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || `Defect generation failed: ${err.message}`);
    } finally {
      setDefectGenLoading(false);
    }
  };

  // Copy output to clipboard helper
  const handleCopyClipboard = () => {
    if (!generatedTestCases) return;
    navigator.clipboard.writeText(generatedTestCases);
    showToast('Copied to clipboard!');
  };

  // Custom Simple Markdown Renderer
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      
      // Parse Bold (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      let parts = [];
      let lastIndex = 0;
      let match;
      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} style={{ color: '#e9d5ff' }}>{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      const renderedLine = parts.length > 0 ? parts : content;

      // Render Headings
      if (line.startsWith('### ')) {
        return <h3 key={idx} style={{ marginTop: '1.25rem', marginBottom: '0.5rem', color: '#a78bfa', fontWeight: '600' }}>{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} style={{ marginTop: '1.5rem', marginBottom: '0.75rem', color: '#c084fc', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.25rem', fontWeight: '700' }}>{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={idx} style={{ marginTop: '1.75rem', marginBottom: '1rem', color: '#ffffff', fontWeight: '800' }}>{line.slice(2)}</h1>;
      }
      
      // Render bullet list
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const bulletText = line.trim().substring(2);
        return (
          <li key={idx} style={{ marginLeft: '1.5rem', marginBottom: '0.4rem', listStyleType: 'square', color: '#e5e7eb' }}>
            {renderedLine}
          </li>
        );
      }

      // Empty Lines
      if (line.trim() === '') {
        return <div key={idx} style={{ height: '0.5rem' }} />;
      }
      
      return <p key={idx} style={{ marginBottom: '0.5rem', color: '#d1d5db' }}>{renderedLine}</p>;
    });
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className="toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* Header Panel */}
      <header>
        <div className="logo-section">
          <span className="logo-icon">⚡</span>
          <div className="logo-text">
            <h1>QA AI Assistant</h1>
            <p>Jira User Story Test Case Generator</p>
          </div>
        </div>
        
        <div className="actions-section">
          <button 
            className="btn-icon" 
            onClick={() => setSettingsOpen(true)}
            title="Configure API Keys & Jira Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="main-layout">
        
        {/* Left Hand: Jira Inputs & Editing */}
        <div className="left-column">
          
          {/* Jira Fetch Card */}
          <div className="glass-card jira-fetch-card">
            <label htmlFor="ticket-id-input">Jira Ticket Connection</label>
            <div className="input-group">
              <input
                id="ticket-id-input"
                type="text"
                placeholder="Enter Issue Key (e.g., PROJ-123)"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchJira()}
                disabled={jiraLoading}
              />
              <button onClick={handleFetchJira} disabled={jiraLoading} className="accent">
                {jiraLoading ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
                    Fetching...
                  </>
                ) : (
                  'Fetch Ticket'
                )}
              </button>
            </div>

            {jiraData && (
              <div className="ticket-data-display">
                <div className="field-section">
                  <div className="field-label">Jira Title</div>
                  <div className="field-value-box field-value-title">{jiraData.title}</div>
                </div>
                
                <div className="field-section">
                  <div className="field-label">Description</div>
                  <div className="field-value-box">{jiraData.description || '(No description)'}</div>
                </div>

                <div className="field-section">
                  <div className="field-label">Acceptance Criteria</div>
                  <div className="field-value-box">{jiraData.acceptanceCriteria || '(No acceptance criteria detected)'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Edit & Generator Options */}
          <div className="glass-card generator-card">
            <label htmlFor="jira-content-editable">Edit Story Details & Generate</label>
            <textarea
              id="jira-content-editable"
              placeholder="Jira issue summary, description, and acceptance criteria will populate here. You can also type or modify details directly."
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              style={{ flex: 1 }}
            />

            <div className="model-selector-container">
              <div>
                <label htmlFor="model-select">AI Platform</label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="grok">xAI Grok</option>
                  <option value="groq">Groq API</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>

              <button 
                onClick={handleGenerateTestCases} 
                disabled={loading || !editableContent.trim()}
                style={{ width: '100%' }}
              >
                {loading ? 'Generating...' : 'Generate Cases'}
              </button>
            </div>
          </div>

          {/* Create Defect Card */}
          <div className="glass-card defect-card" style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ margin: 0 }}>Create Defect in Jira</label>
              <button 
                type="button" 
                className="secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', height: 'auto' }} 
                onClick={handleGenerateDefectAI}
                disabled={defectGenLoading || !editableContent.trim()}
              >
                {defectGenLoading ? 'Generating...' : '🪄 AI Generate Defect'}
              </button>
            </div>

            <form onSubmit={handleCreateDefect} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label htmlFor="defect-project-key" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Project Key *</label>
                <input
                  id="defect-project-key"
                  type="text"
                  placeholder="e.g. PROJ"
                  value={defectProjectKey}
                  onChange={(e) => setDefectProjectKey(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="defect-summary" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Defect Summary (Title) *</label>
                <input
                  id="defect-summary"
                  type="text"
                  placeholder="e.g. [Bug] Login button fails to redirect"
                  value={defectSummary}
                  onChange={(e) => setDefectSummary(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="defect-desc" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Description</label>
                <textarea
                  id="defect-desc"
                  placeholder="General description of the defect"
                  value={defectDescription}
                  onChange={(e) => setDefectDescription(e.target.value)}
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="defect-steps" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Steps to Reproduce</label>
                  <textarea
                    id="defect-steps"
                    placeholder="1. Navigate to...\n2. Click..."
                    value={defectSteps}
                    onChange={(e) => setDefectSteps(e.target.value)}
                    style={{ minHeight: '80px' }}
                  />
                </div>
                <div>
                  <label htmlFor="defect-expected" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Expected Result</label>
                  <textarea
                    id="defect-expected"
                    placeholder="User should be logged in..."
                    value={defectExpected}
                    onChange={(e) => setDefectExpected(e.target.value)}
                    style={{ minHeight: '80px' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="defect-actual" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Actual Result</label>
                <textarea
                  id="defect-actual"
                  placeholder="App throws a 500 error page..."
                  value={defectActual}
                  onChange={(e) => setDefectActual(e.target.value)}
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="defect-severity" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Severity</label>
                  <select
                    id="defect-severity"
                    value={defectSeverity}
                    onChange={(e) => setDefectSeverity(e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="defect-priority" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Priority</label>
                  <select
                    id="defect-priority"
                    value={defectPriority}
                    onChange={(e) => setDefectPriority(e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                className="accent"
                style={{ width: '100%', marginTop: '0.25rem' }}
                disabled={defectLoading}
              >
                {defectLoading ? 'Creating Defect...' : 'Create Defect in Jira'}
              </button>
              {defectCreatedKey && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  background: 'rgba(16, 185, 129, 0.13)',
                  color: '#05f3a6',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  Defect created successfully: <strong>{defectCreatedKey}</strong>
                </div>
              )}
            </form>
          </div>

        </div>

        {/* Right Hand: Output Panel */}
        <div className="right-column">
          <div className="glass-card output-card">
            <div className="output-header">
              <div className="output-title-group">
                {loading && <span className="pulse-dot"></span>}
                <label style={{ margin: 0 }}>Generated QA Test Cases</label>
              </div>
              {generatedTestCases && (
                <button className="secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={handleCopyClipboard}>
                  Copy Cases
                </button>
              )}
            </div>

            <div className="test-cases-display">
              {loading ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <div className="loading-text">QA Engineer is analyzing details and drafting cases...</div>
                </div>
              ) : generatedTestCases ? (
                <div className="test-case-markdown">
                  {renderMarkdown(generatedTestCases)}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">📝</span>
                  <p>Your AI generated test cases will be presented here.</p>
                  <small>Populate the Jira story on the left, choose a model, and click "Generate Cases".</small>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Drawer Overlay */}
      <div className={`settings-overlay ${settingsOpen ? 'open' : ''}`} onClick={() => setSettingsOpen(false)}>
        {/* Settings Slider Panel */}
        <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="settings-header">
            <h2>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Settings Panel
            </h2>
            <button className="btn-icon" onClick={() => setSettingsOpen(false)} style={{ width: '32px', height: '32px' }}>
              ✕
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="settings-sections">
            
            {/* Jira Connection Block */}
            <div>
              <div className="settings-section-title">Atlassian Jira Settings</div>
              <div className="settings-field-group">
                <div className="setting-item">
                  <label htmlFor="set-jira-domain">Jira Domain</label>
                  <input
                    id="set-jira-domain"
                    type="text"
                    placeholder="e.g. company.atlassian.net"
                    value={tempSettings.jiraDomain}
                    onChange={(e) => setTempSettings({ ...tempSettings, jiraDomain: e.target.value })}
                  />
                </div>
                <div className="setting-item">
                  <label htmlFor="set-jira-email">Account Email</label>
                  <input
                    id="set-jira-email"
                    type="email"
                    placeholder="name@company.com"
                    value={tempSettings.jiraEmail}
                    onChange={(e) => setTempSettings({ ...tempSettings, jiraEmail: e.target.value })}
                  />
                </div>
                <div className="setting-item">
                  <label htmlFor="set-jira-token">Jira API Token</label>
                  <input
                    id="set-jira-token"
                    type="password"
                    placeholder="ATATT3xFf..."
                    value={tempSettings.jiraToken}
                    onChange={(e) => setTempSettings({ ...tempSettings, jiraToken: e.target.value })}
                  />
                </div>
                <div className="setting-item">
                  <label htmlFor="set-jira-custom">Acceptance Criteria Custom Field ID (Optional)</label>
                  <input
                    id="set-jira-custom"
                    type="text"
                    placeholder="e.g. customfield_10010"
                    value={tempSettings.jiraCustomField}
                    onChange={(e) => setTempSettings({ ...tempSettings, jiraCustomField: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>If left empty, system searches descriptions and attributes automatically.</small>
                </div>
              </div>
            </div>

            {/* AI Providers Keys and Models */}
            <div>
              <div className="settings-section-title">AI Model Credentials</div>
              <div className="settings-field-group">
                
                {/* OpenAI settings */}
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                  <div className="setting-item">
                    <label htmlFor="set-openai-key">OpenAI API Key</label>
                    <input
                      id="set-openai-key"
                      type="password"
                      placeholder="sk-proj-..."
                      value={tempSettings.openaiKey}
                      onChange={(e) => setTempSettings({ ...tempSettings, openaiKey: e.target.value })}
                    />
                  </div>
                  <div className="setting-item" style={{ marginTop: '0.4rem' }}>
                    <label htmlFor="set-openai-model">OpenAI Model</label>
                    <select
                      id="set-openai-model"
                      value={tempSettings.openaiModel}
                      onChange={(e) => setTempSettings({ ...tempSettings, openaiModel: e.target.value })}
                    >
                      <option value="gpt-4">gpt-4</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4-turbo">gpt-4-turbo</option>
                      <option value="gpt-3.5-turbo">gpt-3.5</option>
                    </select>
                  </div>
                </div>

                {/* Gemini settings */}
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                  <div className="setting-item">
                    <label htmlFor="set-gemini-key">Gemini API Key</label>
                    <input
                      id="set-gemini-key"
                      type="password"
                      placeholder="AIzaSy..."
                      value={tempSettings.geminiKey}
                      onChange={(e) => setTempSettings({ ...tempSettings, geminiKey: e.target.value })}
                    />
                  </div>
                  <div className="setting-item" style={{ marginTop: '0.4rem' }}>
                    <label htmlFor="set-gemini-model">Gemini Model</label>
                    <select
                      id="set-gemini-model"
                      value={tempSettings.geminiModel}
                      onChange={(e) => setTempSettings({ ...tempSettings, geminiModel: e.target.value })}
                    >
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    </select>
                  </div>
                </div>

                {/* Grok (xAI) settings */}
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                  <div className="setting-item">
                    <label htmlFor="set-grok-key">xAI Grok API Key</label>
                    <input
                      id="set-grok-key"
                      type="password"
                      placeholder="xai-..."
                      value={tempSettings.grokKey}
                      onChange={(e) => setTempSettings({ ...tempSettings, grokKey: e.target.value })}
                    />
                  </div>
                  <div className="setting-item" style={{ marginTop: '0.4rem' }}>
                    <label htmlFor="set-grok-model">Grok Model</label>
                    <select
                      id="set-grok-model"
                      value={tempSettings.grokModel}
                      onChange={(e) => setTempSettings({ ...tempSettings, grokModel: e.target.value })}
                    >
                      <option value="grok-beta">grok-beta</option>
                    </select>
                  </div>
                </div>

                {/* Groq API settings */}
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                  <div className="setting-item">
                    <label htmlFor="set-groq-key">Groq API Key</label>
                    <input
                      id="set-groq-key"
                      type="password"
                      placeholder="gsk_..."
                      value={tempSettings.groqKey}
                      onChange={(e) => setTempSettings({ ...tempSettings, groqKey: e.target.value })}
                    />
                  </div>
                  <div className="setting-item" style={{ marginTop: '0.4rem' }}>
                    <label htmlFor="set-groq-model">Groq Model</label>
                    <select
                      id="set-groq-model"
                      value={tempSettings.groqModel}
                      onChange={(e) => setTempSettings({ ...tempSettings, groqModel: e.target.value })}
                    >
                      <option value="llama3-8b-8192">llama3-8b-8192</option>
                      <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                      <option value="gemma2-9b-it">gemma2-9b-it</option>
                    </select>
                  </div>
                </div>

                {/* Ollama Local settings */}
                <div>
                  <div className="setting-item">
                    <label htmlFor="set-ollama-model">Ollama Model Name</label>
                    <input
                      id="set-ollama-model"
                      type="text"
                      placeholder="e.g. phi3, mistral, llama3"
                      value={tempSettings.ollamaModel}
                      onChange={(e) => setTempSettings({ ...tempSettings, ollamaModel: e.target.value })}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Drawer Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" style={{ flex: 1 }}>Save Settings</button>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setSettingsOpen(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
