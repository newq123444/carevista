import React, { useState } from 'react';
import { useElearningModules, useCreateElearningModule, useElearningMandatoryStatus, useElearningCompletions, useSubmitElearningQuiz } from '../hooks';

export default function ElearningModule() {
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [quizMode, setQuizMode] = useState<{ moduleId: string; questions: any[] } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  const { data: modules = [], isLoading } = useElearningModules();
  const { data: mandatoryStatus } = useElearningMandatoryStatus();
  const { data: completions } = useElearningCompletions();
  const createMutation = useCreateElearningModule();
  const submitQuizMutation = useSubmitElearningQuiz();

  const [newModule, setNewModule] = useState({ title: '', description: '', category: 'clinical', duration_minutes: 30, mandatory: false });

  const moduleList = Array.isArray(modules) ? modules : (modules as any)?.modules || [];
  const completionList = Array.isArray(completions) ? completions : (completions as any)?.completions || [];
  const mandatoryData = Array.isArray(mandatoryStatus) ? mandatoryStatus : (mandatoryStatus as any)?.data || [];

  const filteredModules = filter === 'all' ? moduleList : moduleList.filter((m: any) => m.category === filter);

  const categories = ['clinical', 'safeguarding', 'health_safety', 'communication', 'specialist', 'compliance'];

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newModule, { onSuccess: () => { setShowCreate(false); setNewModule({ title: '', description: '', category: 'clinical', duration_minutes: 30, mandatory: false }); } });
  };

  const handleSubmitQuiz = () => {
    if (!quizMode) return;
    submitQuizMutation.mutate({ moduleId: quizMode.moduleId, data: { answers: quizAnswers } }, {
      onSuccess: () => { setQuizMode(null); setQuizAnswers({}); }
    });
  };

  if (quizMode) {
    return (
      <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
        <button onClick={() => setQuizMode(null)} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', marginBottom: 24 }}>
          Back to Modules
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Module Quiz</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {quizMode.questions.map((q: any, qi: number) => (
            <div key={q.id || qi} style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ fontWeight: 600, marginBottom: 12 }}>{qi + 1}. {q.question}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(q.options || []).map((opt: string, oi: number) => (
                  <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: quizAnswers[q.id || qi] === oi ? '#eff6ff' : '#f9fafb', borderRadius: 8, border: `1px solid ${quizAnswers[q.id || qi] === oi ? '#bfdbfe' : '#e5e7eb'}`, cursor: 'pointer' }}>
                    <input type="radio" name={`q-${qi}`} checked={quizAnswers[q.id || qi] === oi} onChange={() => setQuizAnswers(a => ({ ...a, [q.id || qi]: oi }))} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleSubmitQuiz} disabled={submitQuizMutation.isPending} style={{ marginTop: 24, padding: '12px 24px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          {submitQuizMutation.isPending ? 'Submitting...' : 'Submit Quiz'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>E-Learning</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Training modules, quizzes, and mandatory training tracker.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          + Create Module
        </button>
      </div>

      {/* Mandatory Training Status */}
      {mandatoryData.length > 0 && (
        <div style={{ padding: 16, background: '#fef9c3', borderRadius: 12, border: '1px solid #fde68a', marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#854d0e', marginBottom: 8 }}>Mandatory Training Status</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {mandatoryData.slice(0, 5).map((item: any, i: number) => (
              <span key={i} style={{ padding: '4px 10px', background: '#fff', borderRadius: 6, fontSize: '0.8rem', border: '1px solid #fde68a' }}>
                {item.title || item.module_title}: {item.completion_rate || '0'}% complete
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === 'all' ? '#0d9488' : '#d1d5db'}`, background: filter === 'all' ? '#eff6ff' : '#fff', color: filter === 'all' ? '#0d9488' : '#6b7280', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
          All
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === cat ? '#0d9488' : '#d1d5db'}`, background: filter === cat ? '#eff6ff' : '#fff', color: filter === cat ? '#0d9488' : '#6b7280', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, textTransform: 'capitalize' }}>
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Create Module Form */}
      {showCreate && (
        <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Create New Module</h2>
          <form onSubmit={handleCreateModule}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Title</label>
                <input type="text" value={newModule.title} onChange={e => setNewModule(m => ({ ...m, title: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Category</label>
                <select value={newModule.category} onChange={e => setNewModule(m => ({ ...m, category: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                  {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Description</label>
              <textarea value={newModule.description} onChange={e => setNewModule(m => ({ ...m, description: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Duration (min)</label>
                <input type="number" value={newModule.duration_minutes} onChange={e => setNewModule(m => ({ ...m, duration_minutes: +e.target.value }))} style={{ width: 100, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={newModule.mandatory} onChange={e => setNewModule(m => ({ ...m, mandatory: e.target.checked }))} />
                <span style={{ fontSize: '0.85rem' }}>Mandatory</span>
              </label>
            </div>
            <button type="submit" disabled={createMutation.isPending} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              {createMutation.isPending ? 'Creating...' : 'Create Module'}
            </button>
          </form>
        </div>
      )}

      {/* Module Grid */}
      {isLoading ? (
        <p style={{ color: '#6b7280' }}>Loading modules...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredModules.map((mod: any) => {
            const completion = completionList.find((c: any) => c.module_id === mod.id);
            return (
              <div key={mod.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ height: 120, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                  🎬
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{mod.title}</h3>
                    {mod.mandatory && <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>MANDATORY</span>}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 8 }}>{mod.description || 'No description'}</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', background: '#f3f4f6', color: '#374151', textTransform: 'capitalize' }}>{(mod.category || '').replace(/_/g, ' ')}</span>
                    {mod.duration_minutes && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{mod.duration_minutes} min</span>}
                  </div>
                  {completion ? (
                    <div style={{ padding: '6px 10px', background: '#dcfce7', borderRadius: 6, fontSize: '0.8rem', color: '#166534', fontWeight: 600, textAlign: 'center' }}>
                      Completed - Score: {completion.quiz_score}%
                    </div>
                  ) : (
                    <button onClick={() => setQuizMode({ moduleId: mod.id, questions: [{ id: '1', question: 'Sample question?', options: ['A', 'B', 'C', 'D'], correct_answer: 0 }] })} style={{ width: '100%', padding: '8px 12px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>
                      Start Module
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
