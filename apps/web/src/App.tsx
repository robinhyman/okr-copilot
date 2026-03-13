import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { getRoutePath, type RoutePath } from './lib/ui';
import { deriveCoachUiState, publishButtonEnabled } from './lib/conversationFlow';
import { buildGroupedOverviewMetrics } from './lib/overviewMetrics';
import { OverviewDashboard } from './components/OverviewDashboard';
import { buildDeterministicFirstCoachQuestion } from './lib/coachStatus';

type ApiOkr = {
  id: number;
  objective: string;
  timeframe: string;
  team_id?: string;
  team_name?: string;
  owner_display_name?: string;
  keyResults: Array<{ id: number; title: string; target_value: number; current_value: number; unit: string }>;
};

type ChatTurnMetadata = {
  source?: 'llm' | 'fallback';
  provider?: 'openai' | 'deterministic';
  reason?: string;
  mode?: 'questions' | 'refine';
  loopDetected?: boolean;
  loopStage?: string;
  loopRiskScore?: number;
  loopSignals?: string[];
  loopEscapePath?: string;
  progress?: { known?: string[]; inferred?: string[]; missing?: string[]; unlockItem?: string };
  assumptions?: string[];
  sri?: number;
  unresolvedSlotAge?: number;
  ttfudTurns?: number;
  draftOnRequestCompliant?: boolean;
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
  variant?: 'wizard_first' | 'conversational_first';
};

type CloseConfirmChoice = 'cancel' | 'discard' | 'save_and_close';

type ManagerDigest = {
  teamId: string;
  summary: { on_track: number; at_risk: number; off_track: number };
  items: Array<{ keyResultId: number; title: string; objective: string; riskLevel: 'on_track' | 'at_risk' | 'off_track'; staleDays: number; note: string | null }>;
};

type LeaderRollup = {
  teams: Array<{ teamId: string; teamDisplayName?: string; ownerDisplayName?: string | null; ownerLabel?: string; onTrack: number; atRisk: number; offTrack: number }>;
  trend: Array<{ weekStart: string; onTrack: number; atRisk: number; offTrack: number }>;
};

type TeamCheckin = {
  id: number;
  key_result_id: number;
  key_result_title: string;
  key_result_unit: string;
  objective: string;
  team_id: string;
  value: number;
  progress_delta: number | null;
  confidence: number | null;
  note: string | null;
  created_by_user_id: string;
  created_at: string;
};

type FlowMode = 'wizard' | 'conversational';
type Variant = 'wizard_first' | 'conversational_first' | 'none';


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

function hasPreviewReadinessThreshold(draft: DraftPayload | null): boolean {
  if (!draft) return false;
  const hasObjective = draft.objective.trim().split(/\s+/).filter(Boolean).length >= 4;
  const hasTimeframe = draft.timeframe.trim().length > 0;
  const hasKrCandidate = draft.keyResults.some((kr) => kr.title.trim().length > 0);
  return hasObjective && hasTimeframe && hasKrCandidate;
}

function fingerprintDraft(draft: DraftPayload | null): string {
  return draft ? JSON.stringify(draft) : '';
}

export function App() {
  const [route, setRoute] = useState<RoutePath>(() => getRoutePath(window.location.pathname));
  const [personaKey, setPersonaKey] = useState(PERSONAS[0].key);
  const [okrs, setOkrs] = useState<ApiOkr[]>([]);
  const [managerDigest, setManagerDigest] = useState<ManagerDigest | null>(null);
  const [leaderRollup, setLeaderRollup] = useState<LeaderRollup | null>(null);
  const [teamCheckins, setTeamCheckins] = useState<TeamCheckin[]>([]);
  const [checkinDaysFilter, setCheckinDaysFilter] = useState<7 | 30 | 90>(30);
  const [drafts, setDrafts] = useState<DraftSession[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null);
  const [activeDraft, setActiveDraft] = useState<DraftPayload | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isComposingInput, setIsComposingInput] = useState(false);
  const [coachPrompts, setCoachPrompts] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [isStartingCoachSession, setIsStartingCoachSession] = useState(false);
  const [isCoachThinking, setIsCoachThinking] = useState(false);
  const [coachThinkingSinceMs, setCoachThinkingSinceMs] = useState<number | null>(null);
  const [firstCoachResponseMs, setFirstCoachResponseMs] = useState<number | null>(null);
  const [isKrCheckinModalOpen, setIsKrCheckinModalOpen] = useState(false);
  const [checkinKr, setCheckinKr] = useState<{ krId: number; krTitle: string; objective: string; currentValue: number; targetValue: number; unit: string } | null>(null);
  const [checkinValue, setCheckinValue] = useState('');
  const [checkinNote, setCheckinNote] = useState('');
  const [checkinStatus, setCheckinStatus] = useState('');

  const [defaultMode, setDefaultMode] = useState<FlowMode>('conversational');
  const [currentMode, setCurrentMode] = useState<FlowMode>('conversational');
  const [assignmentVariant, setAssignmentVariant] = useState<Variant>('none');
  const [assignmentReady, setAssignmentReady] = useState(false);
  const [isDraftPreviewUnlocked, setIsDraftPreviewUnlocked] = useState(false);
  const [lastSavedDraftFingerprint, setLastSavedDraftFingerprint] = useState('');
  const [isUnsavedCloseConfirmOpen, setIsUnsavedCloseConfirmOpen] = useState(false);

  const sessionStartRef = useRef<number | null>(null);
  const modalOpenRef = useRef<number | null>(null);
  const exposureSentRef = useRef(false);

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
          teamId: okr.team_id,
          teamName: okr.team_name,
          ownerLabel: okr.owner_display_name ? `Owner: ${okr.owner_display_name}` : undefined,
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

  async function trackUiEvent(event_name: string, props: Record<string, unknown> = {}) {
    const payload = {
      event_name,
      experiment_id: 'okr_create_entry_v1',
      variant: assignmentVariant,
      user_id: persona.userId,
      persona: role,
      team_id: persona.teamId,
      session_id: `${persona.userId}:${persona.teamId}`,
      draft_session_id: activeDraftId,
      request_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      app_version: 'web-dev',
      ...props
    };

    try {
      await jsonFetch('/api/events/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [payload] })
      }, actorHeaders);
    } catch {
      // non-blocking telemetry
    }
  }

  async function resolveDefaultMode() {
    setAssignmentReady(false);
    setDefaultMode('conversational');
    setCurrentMode('conversational');
    setAssignmentVariant('conversational_first');
    void trackUiEvent('ab_assignment_resolved', { variant: 'conversational_first', source: 'override' });
    setAssignmentReady(true);
    exposureSentRef.current = false;
  }

  async function loadOkrs() {
    const response = await jsonFetch('/api/okrs', undefined, actorHeaders);
    setOkrs(response.okrs ?? []);
  }

  async function loadDrafts() {
    const response = await jsonFetch('/api/okr-drafts', undefined, actorHeaders);
    setDrafts(response.drafts ?? []);
  }

  async function loadTeamCheckins(days: number = checkinDaysFilter) {
    const response = await jsonFetch(`/api/checkins?limit=120&days=${days}`, undefined, actorHeaders);
    setTeamCheckins(response.checkins ?? []);
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
    void loadTeamCheckins(checkinDaysFilter);
    void resolveDefaultMode();
    setActiveDraftId(null);
    setActiveDraft(null);
    setChatMessages([]);
    setCoachPrompts([]);
    setIsCoachModalOpen(false);
    setIsStartingCoachSession(false);
    setIsCoachThinking(false);
    setCoachThinkingSinceMs(null);
    setFirstCoachResponseMs(null);
    setIsKrCheckinModalOpen(false);
    setCheckinKr(null);
    setCheckinValue('');
    setCheckinNote('');
    setCheckinStatus('');
    setIsDraftPreviewUnlocked(false);
    setLastSavedDraftFingerprint('');
    setIsUnsavedCloseConfirmOpen(false);
    sessionStartRef.current = null;
    modalOpenRef.current = null;
  }, [personaKey]);

  useEffect(() => {
    if (isCoachModalOpen && assignmentReady && !exposureSentRef.current) {
      exposureSentRef.current = true;
      void trackUiEvent('ab_exposure', { variant: assignmentVariant });
    }
  }, [isCoachModalOpen, assignmentReady, assignmentVariant]);

  function navigate(path: RoutePath) {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(path);
  }

  async function openCreateFlow(entryPoint: 'primary_cta' | 'resume_draft' | 'deep_link') {
    if (!assignmentReady) return;
    setCurrentMode('conversational');
    setIsUnsavedCloseConfirmOpen(false);
    setIsCoachModalOpen(true);
    modalOpenRef.current = performance.now();
    void trackUiEvent('coach_entry_clicked', { entry_point: entryPoint, variant: assignmentVariant });
    await startDraftSession();
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
    setIsDraftPreviewUnlocked(false);
    setLastSavedDraftFingerprint('');
    setStatus('Starting coach session…');

    try {
      const created = await jsonFetch('/api/okr-drafts/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${persona.teamId} coach draft`, metadata: { variant: assignmentVariant } })
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
      void trackUiEvent('okr_draft_started', { flow: 'conversational' });
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
    setCurrentMode('conversational');
    setChatMessages([{ role: 'assistant', content: `Resumed draft: ${session.title}. Tell me what to refine.` }]);
    setCoachPrompts([]);
    setIsDraftPreviewUnlocked(hasPreviewReadinessThreshold(session.current_draft ?? null));
    setLastSavedDraftFingerprint(fingerprintDraft(session.current_draft ?? null));
    setIsCoachThinking(false);
    setIsStartingCoachSession(false);
    setIsUnsavedCloseConfirmOpen(false);
    setIsCoachModalOpen(true);
    void trackUiEvent('coach_entry_clicked', { entry_point: 'resume_draft', variant: assignmentVariant });
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
      const becameReady = hasPreviewReadinessThreshold(response.draft);
      const requestedEarlyPreview = typeof prefilled === 'string' && prefilled.toLowerCase().includes('generate the first full draft');
      if (!isDraftPreviewUnlocked && (becameReady || requestedEarlyPreview)) {
        setIsDraftPreviewUnlocked(true);
        setStatus('Draft preview is now ready.');
        void trackUiEvent('draft_preview_revealed', {
          reason: becameReady ? 'threshold_met' : 'explicit_generate_action'
        });
      }
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
            mode: response.mode,
            loopDetected: response.metadata?.loopDetected,
            loopStage: response.metadata?.loopStage,
            loopRiskScore: response.metadata?.loopRiskScore,
            loopSignals: response.metadata?.loopSignals,
            loopEscapePath: response.metadata?.loopEscapePath,
            progress: response.metadata?.progress,
            assumptions: response.metadata?.assumptions,
            sri: response.metadata?.sri,
            unresolvedSlotAge: response.metadata?.unresolvedSlotAge,
            ttfudTurns: response.metadata?.ttfudTurns,
            draftOnRequestCompliant: response.metadata?.draftOnRequestCompliant
          }
        }
      ]);
      const turnLatencyMs = Math.round(performance.now() - turnStartedAt);
      setStatus(`${response.mode === 'questions' ? 'Coach asked follow-up questions.' : 'Draft refined.'} · response ${turnLatencyMs}ms`);
      void trackUiEvent('coach_response_received', {
        flow: 'conversational',
        latency_ms: turnLatencyMs,
        source: response.metadata?.source,
        fallback_reason: response.metadata?.reason ?? null,
        loop_detected: Boolean(response.metadata?.loopDetected),
        loop_stage: response.metadata?.loopStage ?? null,
        loop_risk_score: response.metadata?.loopRiskScore ?? null,
        sri: response.metadata?.sri ?? null,
        unresolved_slot_age: response.metadata?.unresolvedSlotAge ?? null,
        ttfud_turns: response.metadata?.ttfudTurns ?? null,
        draft_on_request_compliant: response.metadata?.draftOnRequestCompliant ?? null
      });
      if (response.metadata?.loopDetected) {
        void trackUiEvent('coach_loop_detected', {
          flow: 'conversational',
          loop_stage: response.metadata?.loopStage ?? 'detected',
          loop_risk_score: response.metadata?.loopRiskScore ?? null,
          loop_signals: response.metadata?.loopSignals ?? []
        });
      }
      if (response.metadata?.loopEscapePath) {
        void trackUiEvent('coach_loop_escape_path', {
          flow: 'conversational',
          escape_path: response.metadata?.loopEscapePath
        });
      }
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
    const response = await jsonFetch(`/api/okr-drafts/${activeDraftId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: activeDraft, status: statusToSave, summary: 'Saved from review pane' })
    }, actorHeaders);
    setLastSavedDraftFingerprint(fingerprintDraft(activeDraft));
    const savedAt = new Date(response?.version?.created_at ?? Date.now()).toLocaleTimeString();
    const versionNumber = Number(response?.version?.version_number ?? selectedDraft?.version_count ?? 0);
    setStatus(statusToSave === 'ready' ? `Draft marked ready at ${savedAt} (v${versionNumber || '—'}).` : `Draft saved at ${savedAt} (v${versionNumber || '—'}).`);
    void trackUiEvent('save_draft_success', { flow: currentMode, version_number: versionNumber || null });
    await loadDrafts();
  }

  async function handleContinueLater() {
    if (!isCoachModalOpen) return;
    const hasUnsavedDraftChanges = Boolean(activeDraft) && fingerprintDraft(activeDraft) !== lastSavedDraftFingerprint;
    if (hasUnsavedDraftChanges) {
      setIsUnsavedCloseConfirmOpen(true);
      return;
    }
    setIsCoachModalOpen(false);
    setStatus('Closed. You can continue later from Drafts.');
  }

  async function resolveUnsavedClose(choice: CloseConfirmChoice) {
    if (choice === 'cancel') {
      setIsUnsavedCloseConfirmOpen(false);
      return;
    }

    if (choice === 'save_and_close') {
      await saveDraft('saved');
      setStatus('Draft saved. You can continue later from Drafts.');
      setIsUnsavedCloseConfirmOpen(false);
      setIsCoachModalOpen(false);
      return;
    }

    setIsUnsavedCloseConfirmOpen(false);
    setIsCoachModalOpen(false);
    setStatus('Closed without saving recent changes. Last saved draft remains available.');
    void trackUiEvent('continue_later_with_unsaved_changes', { resolution: 'discarded_unsaved' });
  }

  async function deleteDraft(sessionId: number) {
    const confirmed = window.confirm('Delete this draft? This cannot be undone.');
    if (!confirmed) return;
    await jsonFetch(`/api/okr-drafts/${sessionId}`, { method: 'DELETE' }, actorHeaders);
    if (activeDraftId === sessionId) {
      setActiveDraftId(null);
      setActiveDraft(null);
      setChatMessages([]);
      setCoachPrompts([]);
      setIsCoachModalOpen(false);
    }
    setStatus('Draft deleted.');
    await loadDrafts();
  }

  async function publishDraft() {
    if (!activeDraftId) return;
    await jsonFetch(`/api/okr-drafts/${activeDraftId}/publish`, { method: 'POST' }, actorHeaders);
    setStatus('Draft published to OKRs.');
    setIsCoachModalOpen(false);
    void trackUiEvent('draft_publish_success', { flow: currentMode });
    await loadOkrs();
    await loadDrafts();
    await loadOverviewRoleData();
  }

  function openKrCheckinModal(input: { krId: number; krTitle: string; objective: string; currentValue: number; targetValue: number; unit: string }) {
    setCheckinKr(input);
    setCheckinValue(String(input.currentValue));
    setCheckinNote('');
    setCheckinStatus('');
    setIsKrCheckinModalOpen(true);
  }

  async function submitKrCheckin() {
    if (!checkinKr) return;
    const numericValue = Number(checkinValue);
    if (!Number.isFinite(numericValue)) {
      setCheckinStatus('Please enter a valid numeric value.');
      return;
    }

    try {
      await jsonFetch(`/api/key-results/${checkinKr.krId}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: numericValue, note: checkinNote || undefined })
      }, actorHeaders);
      setCheckinStatus('Check-in saved.');
      setIsKrCheckinModalOpen(false);
      await loadOkrs();
      await loadOverviewRoleData();
      await loadTeamCheckins(checkinDaysFilter);
    } catch (error: any) {
      setCheckinStatus(`Could not save check-in: ${error?.message ?? 'unknown error'}`);
    }
  }

  const selectedDraft = useMemo(() => drafts.find((d) => d.id === activeDraftId) ?? null, [drafts, activeDraftId]);
  const publishEnabled = publishButtonEnabled({ canPublish, hasDraft: Boolean(activeDraft), draftStatus: selectedDraft?.status });
  const publishBlockReason = !canPublish
    ? 'Only managers can publish this draft.'
    : !hasPreviewReadinessThreshold(activeDraft)
      ? 'Need objective + timeframe + at least one KR before publishing.'
      : selectedDraft?.status === 'published'
        ? 'This draft is already published.'
        : '';
  const modalOpenLatencyMs = sessionStartRef.current !== null && modalOpenRef.current !== null
    ? Math.max(0, Math.round(modalOpenRef.current - sessionStartRef.current))
    : null;
  const thinkingElapsedSeconds = coachThinkingSinceMs ? Math.max(0, Math.floor((Date.now() - coachThinkingSinceMs) / 1000)) : null;

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return;
    if (isComposingInput || event.nativeEvent.isComposing) return;
    if (event.shiftKey) {
      void trackUiEvent('chat_shift_enter_newline_used', { flow: currentMode });
      return;
    }
    if (event.metaKey || event.ctrlKey || !event.shiftKey) {
      event.preventDefault();
      if (isCoachThinking || isStartingCoachSession || !chatInput.trim()) return;
      void trackUiEvent('chat_enter_send_used', { flow: currentMode, input_length: chatInput.trim().length });
      void sendChatTurn();
    }
  }

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
            onRequestKrCheckin={openKrCheckinModal}
          />
        )}

        {route === '/okrs' && (
          <section className="panel">
            <h2>OKR Creation</h2>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button disabled={!assignmentReady || isStartingCoachSession} onClick={() => void openCreateFlow('primary_cta')}>
                {!assignmentReady ? 'Preparing coach…' : 'Create OKR with Coach'}
              </button>
              <p className="muted">State: {coachUiState}</p>
              {!!status && <p className="muted" aria-live="polite">{status}</p>}
              {(modalOpenLatencyMs !== null || firstCoachResponseMs !== null) && (
                <p className="muted">Perf: modal {modalOpenLatencyMs ?? '-'}ms · first response {firstCoachResponseMs ?? '-'}ms</p>
              )}
            </div>

            <div className="panel nested">
              <h3>Drafts</h3>
              {drafts.map((draft) => (
                <div key={draft.id} className="row" style={{ justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <button className="secondary" onClick={() => void resumeDraft(draft)}>
                    {draft.title} · {draft.status} · v{draft.version_count}
                  </button>
                  <button className="secondary" onClick={() => void deleteDraft(draft.id)}>Delete</button>
                </div>
              ))}
            </div>

            {isCoachModalOpen && (
              <div className="coach-modal-backdrop" role="presentation">
                <section className="coach-modal" role="dialog" aria-label="OKR coach dialog" aria-modal="true">
                  <div className="coach-modal-header row" style={{ justifyContent: 'space-between' }}>
                    <h3>Create OKR with Coach</h3>
                    <p className="muted">Understand context → Build draft → Finalize and publish</p>
                  </div>

                  <div className="coach-modal-grid">
                    <div className="panel nested">
                      <h4>Conversation</h4>
                      <ul className="history">
                        {chatMessages.map((m, idx) => {
                          return (
                            <li key={idx}>
                              <strong>{m.role === 'assistant' ? 'Coach' : 'You'}:</strong> {m.content}
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
                        <textarea
                          value={chatInput}
                          rows={3}
                          disabled={isCoachThinking || isStartingCoachSession}
                          placeholder={isCoachThinking || isStartingCoachSession ? 'Coach is thinking…' : 'Reply or ask for changes…'}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={handleComposerKeyDown}
                          onCompositionStart={() => setIsComposingInput(true)}
                          onCompositionEnd={() => setIsComposingInput(false)}
                        />
                        <button disabled={isCoachThinking || isStartingCoachSession} onClick={() => void sendChatTurn()}>Send</button>
                      </div>
                    </div>

                    <div className="panel nested">
                      <h4>Prompt focus</h4>
                      {coachPrompts.length ? <ul className="history">{coachPrompts.map((q, i) => <li key={i}>{q}</li>)}</ul> : null}
                      <p className="muted">
                        {isStartingCoachSession
                          ? 'Loading prompt context…'
                          : hasPreviewReadinessThreshold(activeDraft)
                            ? 'You’re on track — use a shortcut or reply to coach.'
                            : 'Tip: answer one more coach question to unlock draft preview.'}
                      </p>
                      <p className="muted">Use the suggested chips above the composer for quick actions.</p>
                    </div>

                    <div className="panel nested wizard-output-panel" aria-live="polite">
                      <h4>Live draft preview</h4>
                      {!isDraftPreviewUnlocked ? (
                        <p className="muted">Draft preview will appear once we have enough context (objective + timeframe + at least one KR).</p>
                      ) : !activeDraft ? <p>{isStartingCoachSession ? 'Starting coach session…' : 'Draft preview building…'}</p> : (
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
                    <button className="secondary" onClick={() => void handleContinueLater()}>Continue later</button>
                    <button
                      disabled={isCoachThinking || isStartingCoachSession || !publishEnabled || !hasPreviewReadinessThreshold(activeDraft)}
                      onClick={() => void publishDraft()}
                    >
                      Publish draft
                    </button>
                  </div>
                  {!publishEnabled || !hasPreviewReadinessThreshold(activeDraft) ? <p className="muted">{publishBlockReason || 'Need objective + timeframe + at least one KR before publishing.'}</p> : null}
                </section>
              </div>
            )}

            {isUnsavedCloseConfirmOpen ? (
              <div className="coach-modal-backdrop" role="presentation">
                <section className="coach-modal unsaved-confirm" role="dialog" aria-modal="true" aria-label="Unsaved changes confirmation">
                  <h3>Leave without saving recent changes?</h3>
                  <p>Your last saved draft is safe. Recent edits will be lost.</p>
                  <div className="row">
                    <button onClick={() => void resolveUnsavedClose('save_and_close')}>Save and close</button>
                    <button className="secondary" onClick={() => void resolveUnsavedClose('discard')}>Close without saving</button>
                    <button className="secondary" onClick={() => void resolveUnsavedClose('cancel')}>Cancel</button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        )}

        {route === '/checkins' && (
          <section className="panel" data-testid="checkins-screen">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Check-ins</h2>
              <div className="row">
                <label htmlFor="checkin-days" className="muted">Window</label>
                <select
                  id="checkin-days"
                  value={checkinDaysFilter}
                  onChange={(e) => {
                    const days = Number(e.target.value) as 7 | 30 | 90;
                    setCheckinDaysFilter(days);
                    void loadTeamCheckins(days);
                  }}
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            </div>

            {!teamCheckins.length ? (
              <p className="muted">No check-ins in this window yet.</p>
            ) : (
              <div className="checkins-table-wrap">
                <table className="checkins-table" data-testid="checkins-table">
                  <thead>
                    <tr>
                      <th>Key result name</th>
                      <th>Change from</th>
                      <th>Change to</th>
                      <th>Checked in by</th>
                      <th>Check-in timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamCheckins.map((checkin) => {
                      const changeFrom = checkin.progress_delta == null ? null : checkin.value - checkin.progress_delta;
                      return (
                        <tr key={checkin.id} data-testid={`checkin-${checkin.id}`}>
                          <td>
                            <strong>{checkin.key_result_title}</strong>
                            <div className="muted">{checkin.objective}</div>
                          </td>
                          <td>{changeFrom == null ? '—' : `${changeFrom} ${checkin.key_result_unit}`}</td>
                          <td>{checkin.value} {checkin.key_result_unit}</td>
                          <td>{checkin.created_by_user_id}</td>
                          <td>{new Date(checkin.created_at).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {isKrCheckinModalOpen && checkinKr ? (
          <div className="coach-modal-backdrop" role="presentation">
            <section className="coach-modal" role="dialog" aria-label="KR check-in" aria-modal="true">
              <div className="coach-modal-header row" style={{ justifyContent: 'space-between' }}>
                <h3>Check in on KR</h3>
                <button className="secondary" onClick={() => setIsKrCheckinModalOpen(false)}>Close</button>
              </div>
              <div className="panel nested">
                <p><strong>{checkinKr.krTitle}</strong></p>
                <p className="muted">{checkinKr.objective}</p>
                <p className="muted">Current {checkinKr.currentValue} {checkinKr.unit} · Target {checkinKr.targetValue} {checkinKr.unit}</p>

                <label>Current value</label>
                <p className="muted">Enter the current total value (not just today’s increment). Unit: {checkinKr.unit}.</p>
                <input value={checkinValue} onChange={(e) => setCheckinValue(e.target.value)} inputMode="decimal" />

                <label>Commentary</label>
                <textarea
                  value={checkinNote}
                  onChange={(e) => setCheckinNote(e.target.value)}
                  placeholder="Add context, blockers, or confidence notes..."
                  rows={4}
                />

                {checkinStatus ? <p className="muted">{checkinStatus}</p> : null}
              </div>

              <div className="row">
                <button className="secondary" onClick={() => setIsKrCheckinModalOpen(false)}>Cancel</button>
                <button onClick={() => void submitKrCheckin()}>Save check-in</button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
