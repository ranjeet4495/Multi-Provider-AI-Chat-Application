import React, { useState } from 'react';

const EXAMPLE_CHIPS = [
  'Show all customers',
  'Show all orders for Alice Smith',
  'Show users above age 30',
  'Add new customer John Doe from New York',
  'Update customer Alice Smith city to Boston'
];

function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState('');

  const handleQuery = async (queryText) => {
    const activeQuery = queryText || prompt;
    if (!activeQuery.trim()) return;

    setLoading(true);
    setError(null);
    setLastQuery(activeQuery);

    try {
      const response = await fetch('http://localhost:5001/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: activeQuery }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setData(result);
      } else {
        setError(result.message || 'Something went wrong while running the query.');
        setData(result); // Set result anyway to show SQL if it succeeded in compiling but failed DB execution
      }
    } catch (err) {
      setError(`Failed to connect to backend server: ${err.message}. Please ensure the Node server is running on port 5001.`);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">🗄️</div>
          <div className="logo-text">
            <h1>AI SQL Assistant</h1>
            <p>MCP Database Workflow Demo</p>
          </div>
        </div>
        <span className="badge">MySQL Connected</span>
      </header>

      {/* Main Workspace Grid */}
      <div className="dashboard-grid">
        <div className="glass-card">
          {/* Examples chips */}
          <div className="examples-section">
            <span className="examples-title">Try an example query:</span>
            <div className="chips-container">
              {EXAMPLE_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  className="example-chip"
                  onClick={() => {
                    setPrompt(chip);
                    handleQuery(chip);
                  }}
                  disabled={loading}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* User Input Wrapper */}
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything in plain English... (e.g. 'Show all customers from New York')"
              rows="2"
              disabled={loading}
            />
            <button
              className="send-button"
              onClick={() => handleQuery()}
              disabled={loading || !prompt.trim()}
            >
              {loading ? 'Running...' : 'Run Query ⚡'}
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="glass-card spinner-container">
            <div className="spinner"></div>
            <span className="spinner-text">AI generating SQL query & executing on Database...</span>
          </div>
        )}

        {/* Query Results / Response Section */}
        {!loading && (data || error) && (
          <div className="glass-card response-container">
            {/* Show User query */}
            <div className="user-query-panel">
              <span className="panel-label">Natural Language Prompt</span>
              <div className="user-query-text">"{lastQuery}"</div>
            </div>

            {/* Generated SQL block */}
            {data?.sql && (
              <div className="sql-card">
                <div className="sql-header">
                  <span className="sql-title">Generated SQL Query</span>
                  <span className="sql-badge">MySQL</span>
                </div>
                <div className="sql-content">{data.sql}</div>
              </div>
            )}

            {/* Success or Error Banner */}
            {error ? (
              <div className="status-banner error">
                <span className="status-icon">⚠️</span>
                <span>{error}</span>
              </div>
            ) : (
              <div className="status-banner success">
                <span className="status-icon">✓</span>
                <span>{data?.message || 'SQL command completed successfully.'}</span>
              </div>
            )}

            {/* Results Data Table */}
            {data?.success && data?.isSelect && (
              <div className="results-card">
                <div className="results-header">
                  <span className="panel-label sql-label">Database Output</span>
                  <span className="results-count">
                    {data.results.length} {data.results.length === 1 ? 'row' : 'rows'} returned
                  </span>
                </div>
                <div className="table-wrapper">
                  {data.results.length > 0 ? (
                    <table className="results-table">
                      <thead>
                        <tr>
                          {Object.keys(data.results[0]).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.results.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {Object.values(row).map((val, valIdx) => (
                              <td key={valIdx}>
                                {val === null || val === undefined ? (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span>
                                ) : typeof val === 'object' ? (
                                  JSON.stringify(val)
                                ) : (
                                  String(val)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-table-state">Query returned 0 rows. Table is empty.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Welcome message if fresh app state */}
        {!loading && !data && !error && (
          <div className="glass-card welcome-panel">
            <div className="welcome-icon">🤖</div>
            <h2>AI-Powered Database Assistant</h2>
            <p>
              Type any query above to experience the Model Context Protocol (MCP) in action.
              The AI will translate your English prompt to SQL, query MySQL directly,
              and format the tables live.
            </p>
          </div>
        )}

        {/* MCP Workflow Breakdown Section */}
        <section className="workflow-section">
          <h3>Understanding the MCP-Style Workflow</h3>
          <div className="workflow-steps">
            <div className="step-card">
              <span className="step-num">Step 01</span>
              <span className="step-title">AI Intent Analysis</span>
              <p className="step-desc">
                The user inputs natural language. The server parses the prompt (using LLM or rule-based parser) to identify the intended database tables, conditions, and operations.
              </p>
            </div>
            <div className="step-card">
              <span className="step-num">Step 02</span>
              <span className="step-title">Tool Execution</span>
              <p className="step-desc">
                The system converts the query intent into a formal MySQL dialect statement and runs the SQL statement securely against the database utilizing the connection pool.
              </p>
            </div>
            <div className="step-card">
              <span className="step-num">Step 03</span>
              <span className="step-title">Context Presentation</span>
              <p className="step-desc">
                The database returns the raw cursor matrix. The server encapsulates this result context inside a JSON API response, which the React app renders dynamically as a structured data grid.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <p>Built with React, Express, MySQL & Google Gemini API. Senior Full-Stack Engineering Showcase.</p>
      </footer>
    </div>
  );
}

export default App;
