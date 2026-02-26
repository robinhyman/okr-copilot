import { useEffect, useMemo, useState } from 'react';

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

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const stubToken = import.meta.env.VITE_AUTH_STUB_TOKEN ?? 'dev-stub-token';

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
  const [okrs, setOkrs] = useState<ApiOkr[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftMetadata, setDraftMetadata] = useState<DraftMetadata | null>(null);
  const [focusArea, setFocusArea] = useState('Client delivery');
  const [timeframe, setTimeframe] = useState('Q2 2026');
  const [feedback, setFeedback] = useState<Feedback>({ type: 'info', text: '' });
  const [checkins, setCheckins] = useState<Record<number, { value: string; commentary: string }>>({});
  const [checkinHistory, setCheckinHistory] = useState<Record<number, KrCheckin[]>>({});

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
        const response = await jsonFetch('/api/okrs');
        const rows = response.okrs ?? [];
        setOkrs(rows);
        await refreshCheckinHistory(rows);
      } catch (e: any) {
        setFeedback({ type: 'error', text: String(e?.message || e) });
      }
    })();
  }, []);

  async function generateDraft() {
    setFeedback({ type: 'info', text: 'Generating draft...' });
    try {
      const response = await jsonFetch('/api/okrs/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focusArea, timeframe })
      });
      setDraft(response.draft);
      setDraftMetadata(response.metadata ?? null);
      setFeedback({ type: 'success', text: 'Draft generated. Review and save.' });
    } catch (e: any) {
      setFeedback({ type: 'error', text: `Draft generation failed: ${String(e?.message || e)}` });
    }
  }

  async function saveOkr() {
    if (!active) return;
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
    }
  }

  async function submitCheckin(krId: number) {
    const current = checkins[krId];
    if (!current || !current.value) return;

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
    }
  }

  return (
    <main className="container">
      <h1>OKR Co-Pilot</h1>

      <section className="panel">
        <h2>1) Generate LLM-assisted draft</h2>
        <div className="row">
          <input value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder="Focus area" />
          <input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="Timeframe" />
          <button onClick={() => generateDraft()}>Generate draft</button>
        </div>
      </section>

      {active && (
        <section className="panel">
          <h2>2) Edit + save OKR</h2>
          {!!draftMetadata && (
            <p className="badge">
              Draft source: <strong>{draftMetadata.source}</strong>
              {draftMetadata.source === 'fallback' && draftMetadata.reason ? ` (${draftMetadata.reason})` : ''}
            </p>
          )}
          <label>Objective</label>
          <input
            value={active.objective}
            onChange={(e) => setDraft({ ...(active as Draft), objective: e.target.value })}
          />
          <label>Timeframe</label>
          <input
            value={active.timeframe}
            onChange={(e) => setDraft({ ...(active as Draft), timeframe: e.target.value })}
          />

          <h3>Key Results</h3>
          {active.keyResults.map((kr, index) => (
            <div className="kr" key={kr.id ?? index}>
              <input
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

          <button onClick={() => saveOkr()}>Save OKR</button>
        </section>
      )}

      {!!okrs.length && (
        <section className="panel">
          <h2>3) KR check-ins (value + commentary)</h2>
          {okrs[0].keyResults.map((kr) => (
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
                <button onClick={() => submitCheckin(kr.id)}>Submit check-in</button>
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
          ))}
        </section>
      )}

      {!!feedback.text && <p className={`status ${feedback.type}`}>{feedback.text}</p>}
    </main>
  );
}
