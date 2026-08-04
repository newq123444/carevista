import React, { useState } from 'react';
import { useNlSearch, useSearchHistory } from '../hooks';
import type { NlSearchQuery } from '../types';

const EXAMPLE_QUERIES = [
  'Residents with high fall risk',
  'Residents on blood thinners',
  'Falls last week',
  'Residents needing medication review',
  'Room 12 care notes',
];

export default function NaturalLanguageSearch() {
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const searchMutation = useNlSearch();
  const { data: historyData } = useSearchHistory();

  const results = searchMutation.data;
  const history: NlSearchQuery[] = Array.isArray(historyData) ? historyData : (historyData as any)?.queries || [];

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    searchMutation.mutate(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const renderResultCard = (item: any, idx: number) => {
    // Primary detection: resident_id indicates a resident record
    if (item.resident_id || item.first_name || item.last_name) {
      const displayName = (item.first_name || item.last_name)
        ? `${item.first_name || ''} ${item.last_name || ''}`.trim()
        : 'Unknown Resident';
      const initials = displayName === 'Unknown Resident'
        ? '?'
        : `${(item.first_name?.[0] || '')}${(item.last_name?.[0] || '')}`;
      return (
        <div key={idx} style={{ padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 600, color: '#4338ca', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{displayName}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {item.room_number && <span>Room {item.room_number}</span>}
              {item.risk_level && (
                <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, background: item.risk_level === 'high' ? '#fef2f2' : item.risk_level === 'medium' ? '#fffbeb' : '#f0fdf4', color: item.risk_level === 'high' ? '#991b1b' : item.risk_level === 'medium' ? '#92400e' : '#166534' }}>
                  {item.risk_level}
                </span>
              )}
            </div>
            {item.medications && Array.isArray(item.medications) && item.medications.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {item.medications.map((med: string, mi: number) => (
                  <span key={mi} style={{ padding: '1px 8px', borderRadius: 12, fontSize: '0.7rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>{med}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (item.incident_type || item.severity) {
      return (
        <div key={idx} style={{ padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{item.incident_type || 'Incident'}</span>
            {item.severity && (
              <span style={{ padding: '1px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, background: item.severity === 'critical' ? '#fef2f2' : item.severity === 'high' ? '#fff1f2' : '#fffbeb', color: item.severity === 'critical' ? '#991b1b' : item.severity === 'high' ? '#be123c' : '#92400e' }}>
                {item.severity}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {item.incident_date && <span>{new Date(item.incident_date).toLocaleDateString()}</span>}
            {item.resident_name && <span style={{ marginLeft: 8 }}>{item.resident_name}</span>}
          </div>
        </div>
      );
    }
    if (item.name && item.dose) {
      return (
        <div key={idx} style={{ padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{item.name}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {item.dose} {item.frequency && `- ${item.frequency}`}
            {item.resident_name && <span style={{ marginLeft: 8, color: '#475569' }}>({item.resident_name})</span>}
          </div>
        </div>
      );
    }
    // Generic fallback: render key-value pairs as a formatted card
    return (
      <div key={idx} style={{ padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {Object.entries(item).filter(([k]) => k !== 'id' && k !== 'care_home_id').map(([key, value]) => (
            <div key={key} style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, textTransform: 'capitalize', marginBottom: 2 }}>{key.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value == null ? '-' : typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : Object.values(value).join(', ')) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Main */}
        <div style={{ flex: 1 }}>
          {/* Search Bar */}
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 8px', color: '#1e293b' }}>Smart Search</h1>
            <p style={{ color: '#64748b', marginBottom: 20 }}>Ask anything about your care home in plain English</p>

            <div style={{ position: 'relative', maxWidth: 700, margin: '0 auto' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem' }}>&#128269;</span>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... e.g. 'show me residents who had a fall last month'"
                style={{ width: '100%', padding: '14px 120px 14px 44px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none', transition: 'border-color 150ms' }}
              />
              <button onClick={() => handleSearch()} disabled={!query.trim() || searchMutation.isPending} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '8px 20px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', opacity: (!query.trim() || searchMutation.isPending) ? 0.6 : 1 }}>
                Search
              </button>
            </div>
          </div>

          {/* Example Chips */}
          {!results && !searchMutation.isPending && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
              {EXAMPLE_QUERIES.map(eq => (
                <button key={eq} onClick={() => handleSearch(eq)} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 150ms' }}>
                  {eq}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {searchMutation.isPending && (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: 8 }}>Searching<span className="dots">...</span></div>
              <div style={{ fontSize: '0.85rem' }}>Parsing your query and finding relevant records</div>
            </div>
          )}

          {/* Results */}
          {results && !searchMutation.isPending && (
            <div>
              <div style={{ marginBottom: 16, fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>
                Found {results.resultsCount || results.results?.length || 0} results for &ldquo;{results.query}&rdquo;
              </div>
              {results.results && results.results.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {results.results.map((item: any, idx: number) => renderResultCard(item, idx))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>&#128270;</div>
                  <div>No results found. Try rephrasing your query.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* History Sidebar */}
        <div style={{ width: showHistory ? 280 : 40, flexShrink: 0, transition: 'width 200ms' }}>
          <button onClick={() => setShowHistory(!showHistory)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#475569', marginBottom: 8 }}>
            {showHistory ? 'Hide History' : '\ud83d\udd51'}
          </button>
          {showHistory && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', margin: '0 0 12px' }}>Recent Searches</h3>
              {history.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No search history</p>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {history.slice(0, 20).map((h: NlSearchQuery) => (
                    <button key={h.id} onClick={() => handleSearch(h.query_text)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #f1f5f9', background: '#f8fafc', cursor: 'pointer', textAlign: 'left', fontSize: '0.78rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.query_text}
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>{h.results_count} results</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
