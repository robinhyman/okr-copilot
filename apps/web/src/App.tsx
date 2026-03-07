import { useEffect, useMemo, useRef, useState } from 'react';
import { getRoutePath, type RoutePath } from './lib/ui';
import { deriveCoachUiState, publishButtonEnabled } from './lib/conversationFlow';
import { buildGroupedOverviewMetrics } from './lib/overviewMetrics';
import { OverviewDashboard } from './components/OverviewDashboard';
import { buildDeterministicFirstCoachQuestion, formatTurnStatus } from './lib/coachStatus';

type ApiOkr = {
  id: number;
  objective: string;
  timeframe: string;
  keyResults: Array<{ id: number; title: string; target_value: number; current_value: number; unit: string }>;
};

type ChatTurnMetadata = {
  source?: 'llm' | 'fallback';
  provider?: 'openai' | 'deterministic';
  reason?: string;
  mode?: 'questions' | 'refine';
};

type ChatMessage = { role: 'user' | 'assistant'; content: string; metadata?: ChatTurnMetadata };
type DraftPayload = { objective: string; timeframe: string; keyResults: Array<{ title: string; targetValue: number; currentValue: number; unit: string }> };
type DraftSession = {
  id: number;
  team_id: string;
  owner_user_id: string;
  title: string;
  status: 'discovery' | 'refining' | 'saved' | 'ready' | 'published';
  version_count: number;
  current_draft: DraftPayload | null;
  updated_at: string;
};

type ManagerDigest = {
  teamId: string;
  summary: { on_track: number; at_risk: number; off_track: number };
  items: Array<{ keyResultId: number; title: string; objective: string; riskLevel: 'on_track' | 'at_risk' | 'off_track'; staleDays: number; note: string | null }>;
};

type LeaderRollup = {
  teams: Array<{ teamId: string; onTrack: number; atRisk: number; offTrack: number }>;
  trend: Array<{ weekStart: string; onTrack: number; atRisk: number; offTrack: number }>;
};

const apiBase =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : 'http://localhost:4000');
const stubToken = import.meta.env.VITE_AUTH_STUB_TOKEN ?? 'dev-stub-token';

const PERSONAS = [
  { key: 'manager-product', label: 'Manager · Product team', userId: 'mgr_product', teamId: 'team_product' },
  { key: 'manager-sales', label: 'Manager · Sales team', userId: 'mgr_sales', teamId: 'team_sales' },
  { key: 'manager-ops', label: 'Manager · Ops team', userId: 'mgr_ops', teamId: 'team_ops' },
  { key: 'member-sales', label: 'Team member · Sales team', userId: 'member_sales', teamId: 'team_sales' },
  { key: 'member-product', label: 'Team member · Product team', userId: 'member_product', teamId: 'team_product' },
  { key: 'leader-exec-product', label: 'Senior leader · cross-team', userId: 'leader_exec', teamId: 'team_product' }
];

async function jsonFetch(path: string, init?: RequestInit, authHeaders?: Record<string, string>) {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'x-auth-stub-token': stubToken,
      ...(authHeaders ?? {}),
      ...(init?.headers ? (init.headers as Record<string, string>) : {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `request_failed_${res.status}`);
  return data;
}

function personaRole(userId: string): 'manager' | 'team_member' | 'senior_leader' {
  if (userId.startsWith('leader_')) return 'senior_leader';
  if (userId.startsWith('mgr_')) return 'manager';
  return 'team_member';
}

export function App() {
  const [route, setRoute] = useState<RoutePath>(() => getRoutePath(window.location.pathname));
  const [personaKey, setPersonaKey] = useState(PERSONAS[0].key);
  const [okrs, setOkrs] = useState<ApiOkr[]>([]);
  const [managerDigest, setManagerDigest] = useState<ManagerDigest | null>(null);
  const [leaderRollup, setLeaderRollup] = useState<LeaderRollup | null>(null);
  const [drafts, setDrafts] = useState<DraftSession[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null);
  const [activeDraft, setActiveDraft] = useState<DraftPayload | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [coachPrompts, setCoachPrompts] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [isStartingCoachSession, setIsStartingCoachSession] = useState(false);
  const [isCoachThinking, setIsCoachThinking] = useState(false);
  const [coachThinkingSinceMs, setCoachThinkingSinceMs] = useState<number | null>(null);
  const [firstCoachResponseMs, setFirstCoachResponseMs] = useState<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const modalOpenRef = useRef<number | null>(null);

  const persona = PERSONAS.find((x) => x.key === personaKey) ?? PERSONAS[0];
  const actorHeaders = { 'x-auth-user-id': persona.userId, 'x-auth-team-id': persona.teamId };
  const role = personaRole(persona.userId);

  const canPublish = role === 'manager';
  const coachUiState = deriveCoachUiState({
    hasActiveDraft: Boolean(activeDraft),
    draftStatus: drafts.find((d) => d.id === activeDraftId)?.status,
    hasMessages: chatMessages.length > 0
  });

  const overviewMetrics = useMemo(
    () =>
      buildGroupedOverviewMetrics(
        okrs.map((okr) => ({
          id: okr.id,
          objective: okr.objective,
          timeframe: okr.timeframe,
          keyResults: okr.keyResults.map((kr) => ({
            id: kr.id,
            title: kr.title,
            currentValue: Number(kr.current_value),
            targetValue: Number(kr.target_value),
            unit: kr.unit
          }))
        }))
      ),
    [okrs]
  );

  async function loadOkrs() {
    const response = await jsonFetch('/api/okrs', undefined, actorHeaders);
    setOkrs(response.okrs ?? []);
  }

  async function loadDrafts() {
    const response = await jsonFetch('/api/okr-drafts', undefined, actorHeaders);
    setDrafts(response.drafts ?? []);
  }

  async function loadOverviewRoleData() {
    if (role === 'manager') {
      const response = await jsonFetch('/api/manager/digest', undefined, actorHeaders);
      setManagerDigest(response.digest ?? null);
      setLeaderRollup(null);
      return;
    }

    if (role === 'senior_leader') {
      const response = await jsonFetch('/api/leader/rollup', undefined, actorHeaders);
      setLeaderRollup(response.rollup ?? null);
      setManagerDigest(null);
      return;
    }

    setManagerDigest(null);
    setLeaderRollup(null);
  }

  useEffect(() => {
    void loadOkrs();
    void loadDrafts();
    void loadOverviewRoleData();
    setActiveDraftId(null);
    setActiveDraft(null);
    setChatMessages([]);
    setCoachPrompts([]);
    setIsCoachModalOpen(false);
    setIsStartingCoachSession(false);
    setIsCoachThinking(false);
    setCoachThinkingSinceMs(null);
    setFirstCoachResponseMs(null);
    sessionStartRef.current = null;
    modalOpenRef.current = null;
  }, [personaKey]);

  function navigate(path: RoutePath) {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(path);
  }

  async function startDraftSession() {
    const now = performance.now();
    sessionStartRef.current = now;
    setFirstCoachResponseMs(null);
    setIsCoachModalOpen(true);
    modalOpenRef.current = performance.now();
    setIsStartingCoachSession(true);
    setIsCoachThinking(true);
    setCoachThinkingSinceMs(Date.now());
    setChatMessages([]);
    setCoachPrompts([]);
    setActiveDraft(null);
    setStatus('Starting coach session…');

    try {
      const created = await jsonFetch('/api/okr-drafts/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${persona.teamId} coach draft` })
      }, actorHeaders);
      const sessionId = Number(created?.session?.id);
      setActiveDraftId(sessionId);

      setActiveDraft(null);
      setCoachPrompts([]);
      setChatMessages([
        {
          role: 'assistant',
          content: buildDeterministicFirstCoachQuestion(persona.teamId),
          metadata: {
            source: 'fallback',
            provider: 'deterministic',
            reason: 'deterministic_first_turn',
            mode: 'questions'
          }
        }
      ]);

      const firstResponse = sessionStartRef.current !== null ? Math.round(performance.now() - sessionStartRef.current) : null;
      setFirstCoachResponseMs(firstResponse);
      setStatus(`Coach session started · deterministic first turn${firstResponse !== null ? ` · first response ${firstResponse}ms` : ''}`.trim());
      void loadDrafts();
    } catch (error: any) {
      setStatus(`Could not start coach session: ${error?.message ?? 'unknown error'}`);
    } finally {
      setIsStartingCoachSession(false);
      setIsCoachThinking(false);
      setCoachThinkingSinceMs(null);
    }
  }

  async function resumeDraft(session: DraftSession) {
    setActiveDraftId(session.id);
    setActiveDraft(session.current_draft ?? null);
    setChatMessages([{ role: 'assistant', content: `Resumed draft: ${session.title}. Tell me what to refine.` }]);
    setCoachPrompts([]);
    setIsCoachThinking(false);
    setIsStartingCoachSession(false);
    setIsCoachModalOpen(true);
  }

  async function sendChatTurn(prefilled?: string) {
    if (!activeDraftId || isCoachThinking) return;
    const text = (prefilled ?? chatInput).trim();
    if (!text) return;
    const next = [...chatMessages, { role: 'user' as const, content: text }];
    setChatMessages(next);
    setChatInput('');
    setIsCoachThinking(true);
    setCoachThinkingSinceMs(Date.now());

    const turnStartedAt = performance.now();

    try {
      const response = await jsonFetch(`/api/okr-drafts/${activeDraftId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, draft: activeDraft })
      }, actorHeaders);

      setActiveDraft(response.draft);
      setCoachPrompts(Array.isArray(response.questions) ? response.questions : []);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.assistantMessage || 'Updated draft.',
          metadata: {
            source: response.metadata?.source,
            provider: response.metadata?.provider,
            reason: response.metadata?.reason,
            mode: response.mode
          }
        }
      ]);
      const sourceStatus = formatTurnStatus(response.metadata);
      const turnLatencyMs = Math.round(performance.now() - turnStartedAt);
      setStatus(`${response.mode === 'questions' ? 'Coach asked follow-up questions.' : 'Draft refined.'}${sourceStatus ? ` · ${sourceStatus}` : ''} · response ${turnLatencyMs}ms`);
      void loadDrafts();
    } catch (error: any) {
      setStatus(`Coach response failed: ${error?.message ?? 'unknown error'}`);
    } finally {
      setIsCoachThinking(false);
      setCoachThinkingSinceMs(null);
    }
  }

  async function saveDraft(statusToSave: 'saved' | 'ready' = 'saved') {
    if (!activeDraftId || !activeDraft) return;
    await jsonFetch(`/api/okr-drafts/${activeDraftId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: activeDraft, status: statusToSave, summary: 'Saved from review pane' })
    }, actorHeaders);
    setStatus(statusToSave === 'ready' ? 'Draft marked ready.' : 'Draft saved.');
    await loadDrafts();
  }

  async function publishDraft() {
    if (!activeDraftId) return;
    await jsonFetch(`/api/okr-drafts/${activeDraftId}/publish`, { method: 'POST' }, actorHeaders);
    setStatus('Draft published to OKRs.');
    setIsCoachModalOpen(false);
    await loadOkrs();
    await loadDrafts();
    await loadOverviewRoleData();
  }

  const selectedDraft = useMemo(() => drafts.find((d) => d.id === activeDraftId) ?? null, [drafts, activeDraftId]);
  const modalOpenLatencyMs = sessionStartRef.current !== null && modalOpenRef.current !== null
    ? Math.max(0, Math.round(modalOpenRef.current - sessionStartRef.current))
    : null;
  const thinkingElapsedSeconds = coachThinkingSinceMs ? Math.max(0, Math.floor((Date.now() - coachThinkingSinceMs) / 1000)) : null;

  return (
    <main className="app-shell">
      <aside className="sidebar panel">
        <h1>OKR Co-Pilot</h1>
        <button className={route === '/overview' ? 'active' : ''} onClick={() => navigate('/overview')}>Overview</button>
        <button className={route === '/okrs' ? 'active' : ''} onClick={() => navigate('/okrs')}>OKRs</button>
        <button className={route === '/checkins' ? 'active' : ''} onClick={() => navigate('/checkins')}>Check-ins</button>
        <label>Demo persona</label>
        <select value={personaKey} onChange={(e) => setPersonaKey(e.target.value)}>
          {PERSONAS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </aside>

      <section className="main-content">
        {route === '/overview' && (
          <OverviewDashboard
            role={role}
            metrics={overviewMetrics}
            managerDigest={managerDigest}
            leaderRollup={leaderRollup}
          />
        )}

        {route === '/okrs' && (
          <section className="panel">
            <h2>Conversational OKR Coach</h2>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button disabled={isStartingCoachSession} onClick={() => void startDraftSession()}>
                {isStartingCoachSession ? 'Starting coach…' : 'Create OKR with Coach'}
              </button>
              <p className="muted">State: {coachUiState}</p>
              {!!status && <p className="muted">{status}</p>}
              {(modalOpenLatencyMs !== null || firstCoachResponseMs !== null) && (
                <p className="muted">Perf: modal {modalOpenLatencyMs ?? '-'}ms · first response {firstCoachResponseMs ?? '-'}ms</p>
              )}
            </div>

            <div className="panel nested">
              <h3>Drafts</h3>
              {drafts.map((draft) => (
                <button key={draft.id} className="secondary" onClick={() => void resumeDraft(draft)}>
                  {draft.title} · {draft.status} · v{draft.version_count}
                </button>
              ))}
            </div>

            {isCoachModalOpen && (
              <div className="coach-modal-backdrop" role="presentation">
                <section className="coach-modal" role="dialog" aria-label="OKR coach dialog" aria-modal="true">
                  <div className="coach-modal-header row" style={{ justifyContent: 'space-between' }}>
                    <h3>Create OKR with Coach</h3>
                    <button className="secondary" onClick={() => setIsCoachModalOpen(false)}>Continue later</button>
                  </div>

                  <div className="coach-modal-grid">
                    <div className="panel nested">
                      <h4>Conversation</h4>
                      <ul className="history">
                        {chatMessages.map((m, idx) => {
                          const turnStatus = formatTurnStatus(m.metadata);
                          return (
                            <li key={idx}>
                              <strong>{m.role === 'assistant' ? 'Coach' : 'You'}:</strong> {m.content}
                              {turnStatus ? <div className="muted">{turnStatus}</div> : null}
                            </li>
                          );
                        })}
                        {(isStartingCoachSession || isCoachThinking) && (
                          <li className="coach-thinking" aria-live="polite">
                            <strong>Coach:</strong>
                            <span className="typing-dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                            <span className="muted"> thinking{thinkingElapsedSeconds && thinkingElapsedSeconds > 4 ? ` (${thinkingElapsedSeconds}s)` : ''}</span>
                          </li>
                        )}
                      </ul>
                      <div className="row">
                        <input
                          value={chatInput}
                          disabled={isCoachThinking || isStartingCoachSession}
                          placeholder={isCoachThinking || isStartingCoachSession ? 'Coach is thinking…' : 'Answer the coach...'}
                          onChange={(e) => setChatInput(e.target.value)}
                        />
                        <button disabled={isCoachThinking || isStartingCoachSession} onClick={() => void sendChatTurn()}>Send</button>
                      </div>
                    </div>

                    <div className="panel nested">
                      <h4>Prompt focus</h4>
                      {coachPrompts.length ? <ul className="history">{coachPrompts.map((q, i) => <li key={i}>{q}</li>)}</ul> : <p className="muted">{isStartingCoachSession ? 'Loading coach prompts…' : 'No missing-context prompts right now.'}</p>}
                      <div className="row">
                        <button disabled={isCoachThinking || isStartingCoachSession} className="secondary" onClick={() => void sendChatTurn('Generate the first full draft now.')}>Generate draft</button>
                        <button disabled={isCoachThinking || isStartingCoachSession} className="secondary" onClick={() => void sendChatTurn('Make KRs more measurable.')}>Make KRs measurable</button>
                      </div>
                    </div>

                    <div className="panel nested">
                      <h4>Live draft preview</h4>
                      {!activeDraft ? <p>{isStartingCoachSession ? 'Starting coach session…' : 'Draft preview building…'}</p> : (
                        <>
                          <p><strong>Objective:</strong> {activeDraft.objective}</p>
                          <p><strong>Timeframe:</strong> {activeDraft.timeframe}</p>
                          <ul>{activeDraft.keyResults.map((kr, i) => <li key={i}>{kr.title} ({kr.currentValue} → {kr.targetValue} {kr.unit})</li>)}</ul>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="row">
                    <button className="secondary" disabled={!activeDraft || isCoachThinking || isStartingCoachSession} onClick={() => void saveDraft('saved')}>Save draft</button>
                    <button className="secondary" onClick={() => setIsCoachModalOpen(false)}>Continue later</button>
                    <button
                      disabled={isCoachThinking || isStartingCoachSession || !publishButtonEnabled({ canPublish, hasDraft: Boolean(activeDraft), draftStatus: selectedDraft?.status })}
                      onClick={() => void publishDraft()}
                    >
                      Publish when ready
                    </button>
                  </div>
                </section>
              </div>
            )}
          </section>
        )}

        {route === '/checkins' && <section className="panel"><h2>Check-ins</h2><p>Published objectives and KRs are available after draft publish.</p></section>}
      </section>
    </main>
  );
}
