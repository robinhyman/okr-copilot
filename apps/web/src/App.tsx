import { useEffect, useMemo, useState } from 'react';

type Draft = {
  objective: string;
  timeframe: string;
  keyResults: Array<{ id?: number; title: string; targetValue: number; currentValue: number; unit: string }>;
};

type ApiOkr = {
  id: number;
  objective: string;
  timeframe: string;
  keyResults: Array<{ id: number; title: string; target_value: number; current_value: number; unit: string }>;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const stubToken = import.meta.env.VITE_AUTH_STUB_TOKEN ?? 'dev-stub-token';

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${apiBase}${path}`, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `request_failed_${res.status}`);
  return data;
}

export function App() {
  const [okrs, setOkrs] = useState<ApiOkr[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focusArea, setFocusArea] = useState('Client delivery');
  const [timeframe, setTimeframe] = useState('Q2 2026');
  const [status, setStatus] = useState('');
  const [checkins, setCheckins] = useState<Record<number, { value: string; commentary: string }>>({});

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

  async function refreshOkrs() {
    const response = await jsonFetch('/api/okrs');
    setOkrs(response.okrs ?? []);
  }

  useEffect(() => {
    refreshOkrs().catch((e) => setStatus(String(e.message || e)));
  }, []);

  async function generateDraft() {
    setStatus('Generating draft...');
    const response = await jsonFetch('/api/okrs/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focusArea, timeframe })
    });
    setDraft(response.draft);
    setStatus('Draft generated. Review and save.');
  }

  async function saveOkr() {
    if (!active) return;
    setStatus('Saving...');

    const payload = {
      objective: active.objective,
      timeframe: active.timeframe,
      keyResults: active.keyResults
    };

    const existingId = okrs[0]?.id;
    const isUpdate = Boolean(existingId);

    const response = await jsonFetch(isUpdate ? `/api/okrs/${existingId}` : '/api/okrs', {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-stub-token': stubToken
      },
      body: JSON.stringify(payload)
    });

    setDraft(null);
    setStatus(isUpdate ? 'OKR updated.' : 'OKR created.');
    if (!isUpdate) setOkrs([response.okr]);
    await refreshOkrs();
  }

  async function submitCheckin(krId: number) {
    const current = checkins[krId];
    if (!current || !current.value) return;

    setStatus('Submitting check-in...');
    await jsonFetch(`/api/key-results/${krId}/checkins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-stub-token': stubToken
      },
      body: JSON.stringify({ value: Number(current.value), commentary: current.commentary })
    });

    setStatus('Check-in saved.');
    await refreshOkrs();
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
            </div>
          ))}
        </section>
      )}

      <p className="status">{status}</p>
    </main>
  );
}
