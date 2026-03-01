import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTerminalStore } from '../store/terminal-store';

interface PlanReviewPanelProps {
  sessionId: string;
  planPath: string;
}

export function PlanReviewPanel({ sessionId, planPath }: PlanReviewPanelProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const closePlanView = useTerminalStore((s) => s.closePlanView);
  const viewPlan = useTerminalStore((s) => s.viewPlan);
  const session = useTerminalStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const planFiles = session?.planFiles || [];

  const currentFileName = planPath.split('/').pop() || 'plan.md';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    window.airport.readPlanFile(planPath).then((text) => {
      if (cancelled) return;
      if (!text) {
        setError(true);
      } else {
        setContent(text);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [planPath]);

  // Live reload: re-read when planFiles change (modification times)
  useEffect(() => {
    const match = planFiles.find((f) => f.path === planPath);
    if (!match) return;

    window.airport.readPlanFile(planPath).then((text) => {
      if (text) setContent(text);
    });
  }, [planFiles.find((f) => f.path === planPath)?.modifiedAt]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      background: '#1e1e2e',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: '#181825',
        borderBottom: '1px solid #313244',
        flexShrink: 0,
      }}>
        <button
          onClick={closePlanView}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: '1px solid #45475a',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
            color: '#cdd6f4',
            fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#313244';
            e.currentTarget.style.borderColor = '#585b70';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.borderColor = '#45475a';
          }}
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="#cdd6f4">
            <path d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.751.751 0 011.042.018.751.751 0 01.018 1.042L4.81 7h7.44a.75.75 0 010 1.5H4.81l2.97 2.97a.75.75 0 010 1.06Z"/>
          </svg>
          Back to Terminal
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: '#cba6f7',
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 600,
        }}>
          <svg width={12} height={12} viewBox="0 0 16 16" fill="#cba6f7">
            <path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0110.25 10H7.061l-2.574 2.573A1.458 1.458 0 012 11.543V10h-.25A1.75 1.75 0 010 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 01.75.75v2.19l2.72-2.72a.749.749 0 01.53-.22h3.5a.25.25 0 00.25-.25v-5.5a.25.25 0 00-.25-.25h-8.5a.25.25 0 00-.25.25Z"/>
          </svg>
          Plan
        </div>

        {planFiles.length > 1 ? (
          <select
            value={planPath}
            onChange={(e) => viewPlan(sessionId, e.target.value)}
            style={{
              background: '#313244',
              color: '#cdd6f4',
              border: '1px solid #45475a',
              borderRadius: 4,
              padding: '3px 6px',
              fontSize: 11,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {planFiles.map((f) => (
              <option key={f.path} value={f.path}>{f.name}</option>
            ))}
          </select>
        ) : (
          <span style={{
            fontSize: 11,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            color: '#a6adc8',
          }}>
            {currentFileName}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px',
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6c7086',
            fontSize: 13,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}>
            Loading plan...
          </div>
        ) : error ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#f38ba8',
            fontSize: 13,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}>
            Plan file not found or could not be read.
          </div>
        ) : (
          <div className="plan-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 style={{
                    color: '#cdd6f4',
                    fontSize: 24,
                    fontWeight: 700,
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    borderBottom: '1px solid #313244',
                    paddingBottom: 8,
                    marginBottom: 16,
                    marginTop: 0,
                  }}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{
                    color: '#cdd6f4',
                    fontSize: 20,
                    fontWeight: 600,
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    borderBottom: '1px solid #313244',
                    paddingBottom: 6,
                    marginBottom: 12,
                    marginTop: 24,
                  }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{
                    color: '#cdd6f4',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    marginBottom: 8,
                    marginTop: 20,
                  }}>{children}</h3>
                ),
                h4: ({ children }) => (
                  <h4 style={{
                    color: '#bac2de',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    marginBottom: 6,
                    marginTop: 16,
                  }}>{children}</h4>
                ),
                p: ({ children }) => (
                  <p style={{
                    color: '#cdd6f4',
                    fontSize: 14,
                    lineHeight: 1.7,
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    marginBottom: 12,
                    marginTop: 0,
                  }}>{children}</p>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    style={{ color: '#89b4fa', textDecoration: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                  >{children}</a>
                ),
                code: ({ className, children }) => {
                  const isBlock = className?.startsWith('language-');
                  if (isBlock) {
                    return (
                      <code style={{
                        display: 'block',
                        background: '#11111b',
                        color: '#cdd6f4',
                        padding: 16,
                        borderRadius: 6,
                        fontSize: 13,
                        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                        overflowX: 'auto',
                        lineHeight: 1.5,
                      }}>{children}</code>
                    );
                  }
                  return (
                    <code style={{
                      background: '#313244',
                      color: '#f38ba8',
                      padding: '2px 5px',
                      borderRadius: 3,
                      fontSize: 13,
                      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    }}>{children}</code>
                  );
                },
                pre: ({ children }) => (
                  <pre style={{
                    background: '#11111b',
                    borderRadius: 6,
                    border: '1px solid #313244',
                    marginBottom: 16,
                    marginTop: 8,
                    overflow: 'hidden',
                  }}>{children}</pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{
                    borderLeft: '3px solid #cba6f7',
                    paddingLeft: 16,
                    margin: '12px 0',
                    color: '#a6adc8',
                  }}>{children}</blockquote>
                ),
                ul: ({ children }) => (
                  <ul style={{
                    color: '#cdd6f4',
                    fontSize: 14,
                    lineHeight: 1.7,
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    paddingLeft: 24,
                    marginBottom: 12,
                    marginTop: 4,
                  }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{
                    color: '#cdd6f4',
                    fontSize: 14,
                    lineHeight: 1.7,
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    paddingLeft: 24,
                    marginBottom: 12,
                    marginTop: 4,
                  }}>{children}</ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: 4 }}>{children}</li>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table style={{
                      borderCollapse: 'collapse',
                      width: '100%',
                      fontSize: 13,
                      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    }}>{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ background: '#181825' }}>{children}</thead>
                ),
                th: ({ children }) => (
                  <th style={{
                    border: '1px solid #313244',
                    padding: '8px 12px',
                    color: '#cdd6f4',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{
                    border: '1px solid #313244',
                    padding: '8px 12px',
                    color: '#a6adc8',
                  }}>{children}</td>
                ),
                hr: () => (
                  <hr style={{
                    border: 'none',
                    borderTop: '1px solid #313244',
                    margin: '24px 0',
                  }} />
                ),
                strong: ({ children }) => (
                  <strong style={{ color: '#f9e2af', fontWeight: 600 }}>{children}</strong>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
