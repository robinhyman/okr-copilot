import { pool } from '../db/pool.js';

export interface KeyResultInput {
  id?: number;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
}

export interface OkrInput {
  ownerUserId: string;
  teamId: string;
  objective: string;
  timeframe: string;
  keyResults: KeyResultInput[];
}

export interface UserKeyResult {
  id: number;
  okr_id: number;
  objective: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
}

export interface StructuredCheckinInput {
  keyResultId: number;
  userId: string;
  value: number;
  commentary?: string;
  note?: string;
  progressDelta?: number | null;
  confidence?: number | null;
  blockerTags?: string[];
  source?: string;
  createdAt?: string;
}

async function hydrateOkr(okrId: number) {
  const okrRes = await pool.query(
    `SELECT id, user_id, team_id, objective, timeframe, created_at, updated_at FROM okrs WHERE id = $1`,
    [okrId]
  );
  if (!okrRes.rowCount) return null;

  const krRes = await pool.query(
    `SELECT id, okr_id, title, target_value, current_value, unit, sort_order, created_at, updated_at
     FROM key_results WHERE okr_id = $1 ORDER BY sort_order ASC, id ASC`,
    [okrId]
  );

  return {
    ...okrRes.rows[0],
    keyResults: krRes.rows.map((r) => ({
      ...r,
      target_value: Number(r.target_value),
      current_value: Number(r.current_value)
    }))
  };
}

export async function listOkrsForTeam(teamId: string) {
  const res = await pool.query(`SELECT id FROM okrs WHERE team_id = $1 ORDER BY created_at DESC LIMIT 20`, [teamId]);
  const okrs = [];
  for (const row of res.rows) {
    const okr = await hydrateOkr(Number(row.id));
    if (okr) okrs.push(okr);
  }
  return okrs;
}

export async function listOkrsAcrossTeams(teamIds: string[]) {
  if (!teamIds.length) return [];
  const res = await pool.query(
    `SELECT id FROM okrs WHERE team_id = ANY($1::text[]) ORDER BY created_at DESC LIMIT 50`,
    [teamIds]
  );

  const okrs = [];
  for (const row of res.rows) {
    const okr = await hydrateOkr(Number(row.id));
    if (okr) okrs.push(okr);
  }
  return okrs;
}

export async function listKeyResultsForUser(userId: string): Promise<UserKeyResult[]> {
  const res = await pool.query(
    `SELECT kr.id, kr.okr_id, o.objective, kr.title, kr.target_value, kr.current_value, kr.unit
     FROM key_results kr
     JOIN okrs o ON o.id = kr.okr_id
     WHERE o.team_id IN (
       SELECT tm.team_id FROM team_memberships tm WHERE tm.user_id = $1
     )`,
    [userId]
  );

  return res.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    okr_id: Number(row.okr_id),
    target_value: Number(row.target_value),
    current_value: Number(row.current_value)
  }));
}

export async function createOkr(input: OkrInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const okrRes = await client.query(
      `INSERT INTO okrs (user_id, team_id, objective, timeframe) VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.ownerUserId, input.teamId, input.objective, input.timeframe]
    );
    const okrId = Number(okrRes.rows[0].id);

    for (const [index, kr] of input.keyResults.entries()) {
      await client.query(
        `INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [okrId, kr.title, kr.targetValue, kr.currentValue, kr.unit, index]
      );
    }

    await client.query('COMMIT');
    return await hydrateOkr(okrId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOkr(okrId: number, input: OkrInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE okrs SET objective = $2, timeframe = $3, updated_at = NOW() WHERE id = $1 AND team_id = $4`,
      [okrId, input.objective, input.timeframe, input.teamId]
    );

    if (!updateRes.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(`DELETE FROM key_results WHERE okr_id = $1`, [okrId]);

    for (const [index, kr] of input.keyResults.entries()) {
      await client.query(
        `INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [okrId, kr.title, kr.targetValue, kr.currentValue, kr.unit, index]
      );
    }

    await client.query('COMMIT');
    return await hydrateOkr(okrId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOkrTeamIdByKeyResultId(keyResultId: number): Promise<string | null> {
  const res = await pool.query(
    `SELECT o.team_id
     FROM key_results kr
     JOIN okrs o ON o.id = kr.okr_id
     WHERE kr.id = $1
     LIMIT 1`,
    [keyResultId]
  );

  return res.rows[0]?.team_id ?? null;
}

export async function listKrCheckins(keyResultId: number, teamIds: string[], limit = 10) {
  if (!teamIds.length) return [];
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const res = await pool.query(
    `SELECT c.id, c.key_result_id, c.value, c.commentary, c.note, c.progress_delta, c.confidence, c.blocker_tags, c.source, c.created_by_user_id, c.created_at
     FROM kr_checkins c
     JOIN key_results kr ON kr.id = c.key_result_id
     JOIN okrs o ON o.id = kr.okr_id
     WHERE c.key_result_id = $1
       AND o.team_id = ANY($2::text[])
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT $3`,
    [keyResultId, teamIds, safeLimit]
  );

  return res.rows.map((row) => ({
    ...row,
    value: Number(row.value),
    progress_delta: row.progress_delta == null ? null : Number(row.progress_delta),
    blocker_tags: Array.isArray(row.blocker_tags) ? row.blocker_tags : []
  }));
}

export async function addKrCheckin(input: StructuredCheckinInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const checkin = await client.query(
      `INSERT INTO kr_checkins (key_result_id, value, commentary, note, progress_delta, confidence, blocker_tags, source, created_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::text[], ARRAY[]::text[]), $8, $9, COALESCE($10::timestamptz, NOW()))
       RETURNING id, key_result_id, value, commentary, note, progress_delta, confidence, blocker_tags, source, created_by_user_id, created_at`,
      [
        input.keyResultId,
        input.value,
        input.commentary ?? input.note ?? null,
        input.note ?? input.commentary ?? null,
        input.progressDelta ?? null,
        input.confidence ?? null,
        input.blockerTags ?? [],
        input.source ?? 'manual',
        input.userId,
        input.createdAt ?? null
      ]
    );

    await client.query(`UPDATE key_results SET current_value = $2, updated_at = NOW() WHERE id = $1`, [
      input.keyResultId,
      input.value
    ]);

    await client.query('COMMIT');
    return checkin.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listManagerDigest(teamId: string) {
  const res = await pool.query(
    `WITH latest AS (
       SELECT DISTINCT ON (kr.id)
         kr.id AS key_result_id,
         kr.title,
         kr.current_value,
         kr.target_value,
         o.objective,
         o.team_id,
         c.created_at,
         c.progress_delta,
         c.confidence,
         c.blocker_tags,
         c.note,
         c.commentary
       FROM key_results kr
       JOIN okrs o ON o.id = kr.okr_id
       LEFT JOIN kr_checkins c ON c.key_result_id = kr.id
       WHERE o.team_id = $1
       ORDER BY kr.id, c.created_at DESC NULLS LAST, c.id DESC NULLS LAST
     )
     SELECT * FROM latest`,
    [teamId]
  );

  const items = res.rows.map((row) => {
    const progressRatio = Number(row.target_value) <= 0 ? 0 : Number(row.current_value) / Number(row.target_value);
    const staleDays = row.created_at ? Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 999;
    const blockers = Array.isArray(row.blocker_tags) ? row.blocker_tags : [];
    let riskLevel: 'on_track' | 'at_risk' | 'off_track' = 'on_track';
    const reasonCodes: string[] = [];

    if (row.confidence != null && Number(row.confidence) <= 2) {
      riskLevel = 'at_risk';
      reasonCodes.push('low_confidence');
    }
    if (row.progress_delta != null && Number(row.progress_delta) < 0) {
      riskLevel = riskLevel === 'at_risk' ? 'off_track' : 'at_risk';
      reasonCodes.push('negative_progress_delta');
    }
    if (staleDays >= 8) {
      riskLevel = riskLevel === 'on_track' ? 'at_risk' : riskLevel;
      reasonCodes.push('stale_update');
    }
    if (blockers.length > 0) {
      riskLevel = riskLevel === 'on_track' ? 'at_risk' : riskLevel;
      reasonCodes.push('blockers_present');
    }
    if (progressRatio < 0.35 && staleDays >= 7) {
      riskLevel = 'off_track';
      reasonCodes.push('low_progress_ratio');
    }

    const riskScore =
      (riskLevel === 'off_track' ? 70 : riskLevel === 'at_risk' ? 35 : 0)
      + Math.min(staleDays, 14)
      + (row.progress_delta != null && Number(row.progress_delta) < 0 ? 12 : 0)
      + (row.confidence != null && Number(row.confidence) <= 2 ? 10 : 0)
      + (blockers.length > 0 ? 8 : 0)
      + (progressRatio < 0.35 ? 10 : 0);

    const suggestedAction = reasonCodes.includes('stale_update')
      ? 'Request fresh check-in by Friday'
      : reasonCodes.includes('blockers_present')
        ? 'Escalate blocker and assign owner'
        : reasonCodes.includes('negative_progress_delta')
          ? 'Run recovery plan this week'
          : reasonCodes.includes('low_confidence')
            ? 'Review confidence risks with owner'
            : riskLevel === 'off_track'
              ? 'Set corrective milestone this week'
              : 'Keep monitoring this KR';

    return {
      keyResultId: Number(row.key_result_id),
      title: row.title,
      objective: row.objective,
      currentValue: Number(row.current_value),
      targetValue: Number(row.target_value),
      confidence: row.confidence == null ? null : Number(row.confidence),
      progressDelta: row.progress_delta == null ? null : Number(row.progress_delta),
      blockers,
      lastCheckinAt: row.created_at,
      staleDays,
      riskLevel,
      riskScore,
      reasonCodes,
      suggestedAction,
      note: row.note ?? row.commentary ?? null
    };
  });

  const counts = items.reduce(
    (acc, item) => {
      acc[item.riskLevel] += 1;
      return acc;
    },
    { on_track: 0, at_risk: 0, off_track: 0 }
  );

  return {
    teamId,
    generatedAt: new Date().toISOString(),
    summary: counts,
    items: items
      .sort((a, b) => b.riskScore - a.riskScore || b.staleDays - a.staleDays)
      .slice(0, 12)
  };
}

export interface OkrDraftPayload {
  objective: string;
  timeframe: string;
  keyResults: Array<{ title: string; targetValue: number; currentValue: number; unit: string }>;
}

export interface DraftSessionSummary {
  id: number;
  team_id: string;
  owner_user_id: string;
  title: string;
  status: string;
  current_version_id: number | null;
  updated_at: string;
  created_at: string;
  version_count: number;
  current_draft: OkrDraftPayload | null;
}

export async function createDraftSession(input: { teamId: string; ownerUserId: string; title: string }) {
  const res = await pool.query(
    `INSERT INTO okr_draft_sessions (team_id, owner_user_id, title, status)
     VALUES ($1, $2, $3, 'discovery')
     RETURNING *`,
    [input.teamId, input.ownerUserId, input.title]
  );
  return res.rows[0];
}

export async function listDraftSessions(teamIds: string[]) {
  if (!teamIds.length) return [];
  const res = await pool.query(
    `SELECT d.id, d.team_id, d.owner_user_id, d.title, d.status, d.current_version_id, d.updated_at, d.created_at,
            COUNT(v.id)::int AS version_count,
            cv.draft_json AS current_draft
     FROM okr_draft_sessions d
     LEFT JOIN okr_draft_versions v ON v.draft_session_id = d.id
     LEFT JOIN okr_draft_versions cv ON cv.id = d.current_version_id
     WHERE d.team_id = ANY($1::text[])
     GROUP BY d.id, cv.draft_json
     ORDER BY d.updated_at DESC`,
    [teamIds]
  );
  return res.rows;
}

export async function getDraftSessionById(sessionId: number) {
  const sessionRes = await pool.query(`SELECT * FROM okr_draft_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
  if (!sessionRes.rowCount) return null;

  const versionsRes = await pool.query(
    `SELECT id, draft_session_id, version_number, source, summary, draft_json, metadata_json, created_by_user_id, created_at
     FROM okr_draft_versions
     WHERE draft_session_id = $1
     ORDER BY version_number DESC`,
    [sessionId]
  );

  return {
    ...sessionRes.rows[0],
    versions: versionsRes.rows
  };
}

export async function appendDraftVersion(input: {
  sessionId: number;
  draft: OkrDraftPayload;
  metadata?: Record<string, unknown>;
  source: 'chat' | 'manual_save' | 'restore' | 'system';
  summary?: string;
  actorUserId: string;
  status?: 'discovery' | 'refining' | 'saved' | 'ready';
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const versionRes = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM okr_draft_versions
       WHERE draft_session_id = $1`,
      [input.sessionId]
    );
    const nextVersion = Number(versionRes.rows[0]?.next_version ?? 1);

    const inserted = await client.query(
      `INSERT INTO okr_draft_versions (draft_session_id, version_number, source, summary, draft_json, metadata_json, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       RETURNING *`,
      [
        input.sessionId,
        nextVersion,
        input.source,
        input.summary ?? null,
        JSON.stringify(input.draft),
        JSON.stringify(input.metadata ?? {}),
        input.actorUserId
      ]
    );

    await client.query(
      `UPDATE okr_draft_sessions
       SET current_version_id = $2,
           status = COALESCE($3, status),
           updated_at = NOW()
       WHERE id = $1`,
      [input.sessionId, inserted.rows[0].id, input.status ?? null]
    );

    await client.query(
      `INSERT INTO okr_draft_audit_events (draft_session_id, event_type, actor_user_id, event_metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [input.sessionId, `draft_version_${input.source}`, input.actorUserId, JSON.stringify({ versionId: inserted.rows[0].id, versionNumber: nextVersion })]
    );

    await client.query('COMMIT');
    return inserted.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function publishDraftSession(input: { sessionId: number; actorUserId: string; teamId: string }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessionRes = await client.query(
      `SELECT d.id, d.current_version_id, v.draft_json
       FROM okr_draft_sessions d
       LEFT JOIN okr_draft_versions v ON v.id = d.current_version_id
       WHERE d.id = $1 AND d.team_id = $2
       LIMIT 1`,
      [input.sessionId, input.teamId]
    );

    if (!sessionRes.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }

    const payload = sessionRes.rows[0]?.draft_json as OkrDraftPayload | null;
    if (!payload || !Array.isArray(payload.keyResults) || payload.keyResults.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('draft_payload_missing');
    }

    const okrRes = await client.query(
      `INSERT INTO okrs (user_id, team_id, objective, timeframe)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.actorUserId, input.teamId, payload.objective, payload.timeframe]
    );

    const okrId = Number(okrRes.rows[0].id);

    for (const [index, kr] of payload.keyResults.entries()) {
      await client.query(
        `INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [okrId, kr.title, kr.targetValue, kr.currentValue, kr.unit, index]
      );
    }

    await client.query(
      `UPDATE okr_draft_sessions
       SET status = 'published',
           published_okr_id = $2,
           published_by_user_id = $3,
           published_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [input.sessionId, okrId, input.actorUserId]
    );

    await client.query(
      `INSERT INTO okr_draft_audit_events (draft_session_id, event_type, actor_user_id, event_metadata)
       VALUES ($1, 'published', $2, $3::jsonb)`,
      [input.sessionId, input.actorUserId, JSON.stringify({ okrId })]
    );

    await client.query('COMMIT');
    return await hydrateOkr(okrId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getLeaderRollup(teamIds: string[]) {
  if (!teamIds.length) {
    return { generatedAt: new Date().toISOString(), trend: [], teams: [] };
  }

  const nowRes = await pool.query(
    `SELECT o.team_id, COUNT(*) FILTER (WHERE (kr.current_value / NULLIF(kr.target_value,0)) >= 0.7) AS on_track,
            COUNT(*) FILTER (WHERE (kr.current_value / NULLIF(kr.target_value,0)) < 0.7 AND (kr.current_value / NULLIF(kr.target_value,0)) >= 0.4) AS at_risk,
            COUNT(*) FILTER (WHERE (kr.current_value / NULLIF(kr.target_value,0)) < 0.4) AS off_track
     FROM key_results kr JOIN okrs o ON o.id = kr.okr_id
     WHERE o.team_id = ANY($1::text[])
     GROUP BY o.team_id`,
    [teamIds]
  );

  const trendRes = await pool.query(
    `SELECT DATE_TRUNC('week', c.created_at)::date AS week_start,
            COUNT(*) FILTER (WHERE c.confidence >= 4 AND COALESCE(c.progress_delta, 0) >= 0) AS on_track,
            COUNT(*) FILTER (WHERE c.confidence = 3 OR COALESCE(c.progress_delta, 0) < 0) AS at_risk,
            COUNT(*) FILTER (WHERE c.confidence <= 2 AND COALESCE(c.progress_delta, 0) < 0) AS off_track
     FROM kr_checkins c
     JOIN key_results kr ON kr.id = c.key_result_id
     JOIN okrs o ON o.id = kr.okr_id
     WHERE o.team_id = ANY($1::text[])
       AND c.created_at >= NOW() - INTERVAL '28 days'
     GROUP BY DATE_TRUNC('week', c.created_at)
     ORDER BY week_start ASC`,
    [teamIds]
  );

  const teams = nowRes.rows.map((row) => ({
    teamId: row.team_id,
    onTrack: Number(row.on_track),
    atRisk: Number(row.at_risk),
    offTrack: Number(row.off_track)
  }));

  return {
    generatedAt: new Date().toISOString(),
    teams,
    trend: trendRes.rows.map((row) => ({
      weekStart: row.week_start,
      onTrack: Number(row.on_track),
      atRisk: Number(row.at_risk),
      offTrack: Number(row.off_track)
    }))
  };
}
