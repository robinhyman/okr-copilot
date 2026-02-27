import { useEffect, useMemo, useState } from 'react';
import { getRoutePath, validateDraft, type RoutePath } from './lib/ui';

type Draft = {
  objective: string;
  timeframe: string;
  keyResults: Array<{ id?: number; title: string; targetValue: number; currentValue: number; unit: string }>;
};

type DraftMetadata = {
  source: 'llm' | 'fallback';
  provider: 'openai' | 'deterministic';
  reason?: string;
};

type ApiOkr = {
  id: number;
  objective: string;
  timeframe: string;
  keyResults: Array<{ id: number; title: string; target_value: number; current_value: number; unit: string }>;
};

type KrCheckin = {
  id: number;
  key_result_id: number;
  value: number;
  commentary: string | null;
  created_at: string;
};

type Feedback = { type: 'info' | 'success' | 'error'; text: string };
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const stubToken = import.meta.env.VITE_AUTH_STUB_TOKEN ?? 'dev-stub-token';
const chatStorageKey = 'okr-copilot.chat.v1';

type PersistedChatState = {
  okrId: number;
  messages: ChatMessage[];
};

const NAV_ITEMS: Array<{ path: RoutePath; label: string }> = [
  { path: '/overview', label: 'Overview' },
  { path: '/okrs', label: 'OKRs' },
  { path: '/checkins', label: 'Check-ins' }
];

async function jsonFetch(path: string, init?: RequestInit) {
  const mergedHeaders: Record<string, string> = {
    'x-auth-stub-token': stubToken,
    ...(init?.headers ? (init.headers as Record<string, string>) : {})
  };

  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: mergedHeaders
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `request_failed_${res.status}`);
  return data;
}

export function App() {
  const [route, setRoute] = useState<RoutePath>(() => getRoutePath(window.location.pathname));
  const [okrs, setOkrs] = useState<ApiOkr[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftMetadata, setDraftMetadata] = useState<DraftMetadata | null>(null);
  const [focusArea, setFocusArea] = useState('Client delivery');
  const [timeframe, setTimeframe] = useState('Q2 2026');
  const [feedback, setFeedback] = useState<Feedback>({ type: 'info', text: '' });
  const [checkins, setCheckins] = useState<Record<number, { value: string; commentary: string }>>({});
  const [checkinHistory, setCheckinHistory] = useState<Record<number, KrCheckin[]>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submittingKrId, setSubmittingKrId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  const active = useMemo(() => {
    if (draft) return draft;
    const first = okrs[0];
    if (!first) return null;
    return {
      objective: first.objective,
      timeframe: first.timeframe,
      keyResults: first.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        targetValue: Number(kr.target_value),
        currentValue: Number(kr.current_value),
        unit: kr.unit
      }))
    };
  }, [draft, okrs]);

  const validationErrors = useMemo(() => validateDraft(active), [active]);

  const overviewStats = useMemo(() => {
    const keyResults = okrs[0]?.keyResults ?? [];
    const total = keyResults.length;
    const onTrack = keyResults.filter((kr) => Number(kr.current_value) >= Number(kr.target_value)).length;
    const atRisk = Math.max(total - onTrack, 0);

    const recent = Object.values(checkinHistory)
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      objectiveCount: okrs.length,
      onTrack,
      atRisk,
      lastCheckinAt: recent?.created_at ?? null
    };
  }, [okrs, checkinHistory]);

  useEffect(() => {
    const onPopState = () => setRoute(getRoutePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    // Only restore chat for persisted/saved OKRs; draft sessions are intentionally ephemeral.
    if (draft) return;
    const okrId = okrs[0]?.id;
    if (!Number.isFinite(okrId)) return;

    try {
      const raw = window.localStorage.getItem(chatStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedChatState;
      if (!parsed || parsed.okrId !== okrId || !Array.isArray(parsed.messages)) return;

      const restored: ChatMessage[] = parsed.messages
        .filter((message: any) => message && typeof message.content === 'string' && typeof message.role === 'string')
        .map((message: any) => {
          const role: ChatMessage['role'] = message.role === 'assistant' ? 'assistant' : 'user';
          return { role, content: String(message.content) };
        })
        .slice(-20);

      setChatMessages(restored);
    } catch {
      // ignore local restore issues
    }
  }, [draft, okrs]);

  useEffect(() => {
    // Scope persistence to a specific saved OKR id to avoid replaying stale chat on a different draft/context.
    if (draft) return;
    const okrId = okrs[0]?.id;
    if (!Number.isFinite(okrId)) return;

    try {
      const payload: PersistedChatState = {
        okrId,
        messages: chatMessages.slice(-20)
      };
      window.localStorage.setItem(chatStorageKey, JSON.stringify(payload));
    } catch {
      // ignore local persistence issues
    }
  }, [chatMessages, draft, okrs]);

  async function refreshOkrs(): Promise<ApiOkr[]> {
    const response = await jsonFetch('/api/okrs');
    const rows = response.okrs ?? [];
    setOkrs(rows);
    return rows;
  }

  async function refreshCheckinHistory(rows: ApiOkr[]) {
    const keyResults = rows[0]?.keyResults ?? [];
    if (!keyResults.length) {
      setCheckinHistory({});
      return;
    }

    const histories = await Promise.all(
      keyResults.map(async (kr) => {
        const response = await jsonFetch(`/api/key-results/${kr.id}/checkins?limit=5`);
        return [kr.id, response.checkins ?? []] as const;
      })
    );

    setCheckinHistory(Object.fromEntries(histories));
  }

  useEffect(() => {
    (async () => {
      try {
        const rows = await refreshOkrs();
        await refreshCheckinHistory(rows);
      } catch (e: any) {
        setFeedback({ type: 'error', text: String(e?.message || e) });
      }
    })();
  }, []);

  function navigate(path: RoutePath) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setRoute(path);
  }

  async function generateDraft() {
    setIsGenerating(true);
    setFeedback({ type: 'info', text: 'Generating draft...' });
    try {
      const response = await jsonFetch('/api/okrs/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focusArea, timeframe })
      });
      setDraft(response.draft);
      setDraftMetadata(response.metadata ?? null);
      setChatMessages([
        {
          role: 'assistant',
          content: 'Draft ready. Tell me what to refine (e.g. “make KR2 more measurable” or “reduce ambition by 20%”).'
        }
      ]);
      setFeedback({ type: 'success', text: 'Draft generated. Review and refine in chat, then save.' });
    } catch (e: any) {
      setFeedback({ type: 'error', text: `Draft generation failed: ${String(e?.message || e)}` });
    } finally {
      setIsGenerating(false);
    }
  }

  async function sendChatTurn() {
    const trimmed = chatInput.trim();
    if (!trimmed || isChatting) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: trimmed }];
    setChatMessages(nextMessages);
    setChatInput('');
    setIsChatting(true);
    setFeedback({ type: 'info', text: 'Refining draft...' });

    try {
      const response = await jsonFetch('/api/okrs/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          draft: active ?? undefined,
          focusArea,
          timeframe
        })
      });

      setDraft(response.draft);
      setDraftMetadata(response.metadata ?? null);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: response.assistantMessage || 'Draft updated.' }]);
      setFeedback({ type: 'success', text: 'Draft refined.' });
    } catch (e: any) {
      setFeedback({ type: 'error', text: `Refinement failed: ${String(e?.message || e)}` });
    } finally {
      setIsChatting(false);
    }
  }

  async function saveOkr() {
    if (!active) return;
    if (validationErrors.length) {
      setFeedback({ type: 'error', text: 'Please fix validation errors before saving.' });
      return;
    }

    setIsSaving(true);
    setFeedback({ type: 'info', text: 'Saving...' });

    const payload = {
      objective: active.objective,
      timeframe: active.timeframe,
      keyResults: active.keyResults
    };

    const existingId = okrs[0]?.id;
    const isUpdate = Boolean(existingId);

    try {
      await jsonFetch(isUpdate ? `/api/okrs/${existingId}` : '/api/okrs', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-stub-token': stubToken
        },
        body: JSON.stringify(payload)
      });

      setDraft(null);
      setDraftMetadata(null);
      const rows = await refreshOkrs();
      await refreshCheckinHistory(rows);
      setFeedback({ type: 'success', text: isUpdate ? 'OKR updated successfully.' : 'OKR created successfully.' });
    } catch (e: any) {
      setFeedback({ type: 'error', text: `Save failed: ${String(e?.message || e)}` });
    } finally {
      setIsSaving(false);
    }
  }

  async function submitCheckin(krId: number) {
    const current = checkins[krId];
    if (!current || !current.value) return;

    setSubmittingKrId(krId);
    setFeedback({ type: 'info', text: 'Submitting check-in...' });
    try {
      await jsonFetch(`/api/key-results/${krId}/checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-stub-token': stubToken
        },
        body: JSON.stringify({ value: Number(current.value), commentary: current.commentary })
      });

      setCheckins((prev) => ({ ...prev, [krId]: { value: '', commentary: '' } }));
      const rows = await refreshOkrs();
      await refreshCheckinHistory(rows);
      setFeedback({ type: 'success', text: 'Check-in saved.' });
    } catch (e: any) {
      setFeedback({ type: 'error', text: `Check-in failed: ${String(e?.message || e)}` });
    } finally {
      setSubmittingKrId(null);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar panel">
        <h1>OKR Co-Pilot</h1>
        <nav className="nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${route === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="main-content">
        {route === '/overview' && (
          <section className="panel">
            <h2>Overview</h2>
            <div className="stats-row">
              <div className="stat-card">
                <p>Active objectives</p>
                <strong>{overviewStats.objectiveCount}</strong>
              </div>
              <div className="stat-card">
                <p>On track KRs</p>
                <strong>{overviewStats.onTrack}</strong>
              </div>
              <div className="stat-card">
                <p>At risk KRs</p>
                <strong>{overviewStats.atRisk}</strong>
              </div>
            </div>
            <div className="row">
              <button onClick={() => navigate('/okrs')}>Generate new draft</button>
              <button className="secondary" onClick={() => navigate('/checkins')}>
                Log check-in
              </button>
            </div>

            {!!okrs.length ? (
              <div className="panel nested">
                <h3>Objectives</h3>
                {okrs.map((okr) => (
                  <div key={okr.id} className="objective-block">
                    <p>
                      <strong>{okr.objective}</strong> ({okr.timeframe})
                    </p>
                    <ul className="history">
                      {okr.keyResults.map((kr) => (
                        <li key={kr.id}>
                          {kr.title} — {kr.current_value}/{kr.target_value} {kr.unit}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="muted">
                  Last check-in:{' '}
                  {overviewStats.lastCheckinAt ? new Date(overviewStats.lastCheckinAt).toLocaleString() : 'No check-ins yet'}
                </p>
              </div>
            ) : (
              <p>No OKR yet. Head to OKRs to generate your first draft.</p>
            )}
          </section>
        )}

        {route === '/okrs' && (
          <section className="panel">
            <h2>OKRs</h2>
            <p className="muted">Generate, edit and save your active OKR set.</p>

            <div className="panel nested">
              <h3>Draft generator</h3>
              <div className="row">
                <input value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder="Focus area" />
                <input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="Timeframe" />
                <button disabled={isGenerating} onClick={() => generateDraft()}>
                  {isGenerating ? 'Generating...' : 'Generate draft'}
                </button>
              </div>
            </div>

            <div className="panel nested">
              <h3>Draft refinement chat</h3>
              <div className="chat-thread">
                {!chatMessages.length && (
                  <p className="muted">Start by generating a draft, then refine it here in conversation.</p>
                )}
                {chatMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                    <strong>{message.role === 'user' ? 'You' : 'Co-pilot'}:</strong> {message.content}
                  </div>
                ))}
              </div>
              <div className="row">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask for a refinement…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void sendChatTurn();
                    }
                  }}
                />
                <button disabled={isChatting || !chatInput.trim() || !active} onClick={() => sendChatTurn()}>
                  {isChatting ? 'Refining...' : 'Send'}
                </button>
              </div>
            </div>

            {active ? (
              <>
                {!!draftMetadata && (
                  <p className="badge">
                    Draft source: <strong>{draftMetadata.source}</strong>
                    {draftMetadata.source === 'fallback' && draftMetadata.reason ? ` (${draftMetadata.reason})` : ''}
                  </p>
                )}

                <label>Objective</label>
                <textarea
                  className="full-width-input objective-input"
                  value={active.objective}
                  onChange={(e) => setDraft({ ...(active as Draft), objective: e.target.value })}
                />
                <label>Timeframe</label>
                <input
                  className="full-width-input timeframe-input"
                  value={active.timeframe}
                  onChange={(e) => setDraft({ ...(active as Draft), timeframe: e.target.value })}
                />

                <h3>Key Results</h3>
                {active.keyResults.map((kr, index) => (
                  <div className="kr" key={kr.id ?? index}>
                    <input
                      className="kr-title-input"
                      value={kr.title}
                      onChange={(e) => {
                        const next = [...active.keyResults];
                        next[index] = { ...kr, title: e.target.value };
                        setDraft({ ...(active as Draft), keyResults: next });
                      }}
                    />
                    <input
                      type="number"
                      value={kr.currentValue}
                      onChange={(e) => {
                        const next = [...active.keyResults];
                        next[index] = { ...kr, currentValue: Number(e.target.value || 0) };
                        setDraft({ ...(active as Draft), keyResults: next });
                      }}
                    />
                    <span>/</span>
                    <input
                      type="number"
                      value={kr.targetValue}
                      onChange={(e) => {
                        const next = [...active.keyResults];
                        next[index] = { ...kr, targetValue: Number(e.target.value || 0) };
                        setDraft({ ...(active as Draft), keyResults: next });
                      }}
                    />
                    <input
                      value={kr.unit}
                      onChange={(e) => {
                        const next = [...active.keyResults];
                        next[index] = { ...kr, unit: e.target.value };
                        setDraft({ ...(active as Draft), keyResults: next });
                      }}
                    />
                  </div>
                ))}

                {!!validationErrors.length && (
                  <ul className="validation-list">
                    {validationErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                )}

                <div className="sticky-actions">
                  <button disabled={isSaving} onClick={() => saveOkr()}>
                    {isSaving ? 'Saving...' : 'Save OKR'}
                  </button>
                </div>
              </>
            ) : (
              <p>No draft or saved OKR found yet. Generate a draft to get started.</p>
            )}
          </section>
        )}

        {route === '/checkins' && (
          <section className="panel">
            <h2>Check-ins</h2>
            {!!okrs.length ? (
              okrs[0].keyResults.map((kr) => (
                <div key={kr.id} className="checkin">
                  <div>
                    <strong>{kr.title}</strong> ({kr.current_value}/{kr.target_value} {kr.unit})
                  </div>
                  <div className="row">
                    <input
                      type="number"
                      placeholder="New value"
                      value={checkins[kr.id]?.value ?? ''}
                      onChange={(e) =>
                        setCheckins((prev) => ({
                          ...prev,
                          [kr.id]: { value: e.target.value, commentary: prev[kr.id]?.commentary ?? '' }
                        }))
                      }
                    />
                    <input
                      placeholder="Commentary"
                      value={checkins[kr.id]?.commentary ?? ''}
                      onChange={(e) =>
                        setCheckins((prev) => ({
                          ...prev,
                          [kr.id]: { value: prev[kr.id]?.value ?? '', commentary: e.target.value }
                        }))
                      }
                    />
                    <button disabled={submittingKrId === kr.id} onClick={() => submitCheckin(kr.id)}>
                      {submittingKrId === kr.id ? 'Submitting...' : 'Submit check-in'}
                    </button>
                  </div>
                  <ul className="history">
                    {(checkinHistory[kr.id] ?? []).map((entry) => (
                      <li key={entry.id}>
                        <strong>{entry.value}</strong> — {entry.commentary || 'No commentary'}
                        <span> ({new Date(entry.created_at).toLocaleString()})</span>
                      </li>
                    ))}
                    {!checkinHistory[kr.id]?.length && <li>No check-in history yet.</li>}
                  </ul>
                </div>
              ))
            ) : (
              <p>No key results available yet. Save an OKR first.</p>
            )}
          </section>
        )}

        {!!feedback.text && <p className={`status ${feedback.type}`}>{feedback.text}</p>}
      </section>
    </main>
  );
}

