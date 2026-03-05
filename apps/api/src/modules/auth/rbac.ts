import type { Request } from 'express';
import { pool } from '../../db/pool.js';

export type TeamRole = 'manager' | 'team_member' | 'senior_leader';

export interface ActorMembership {
  teamId: string;
  role: TeamRole;
}

export interface ActorContext {
  userId: string;
  email: string;
  displayName: string;
  activeTeamId: string;
  memberships: ActorMembership[];
}

export interface TeamScopedPermission {
  teamId: string;
  canView: boolean;
  canManageOkrs: boolean;
  canManageDrafts: boolean;
  canPublishOkrs: boolean;
  canCheckin: boolean;
}

const DEFAULT_USER_ID = 'mgr_product';
const DEFAULT_TEAM_ID = 'team_product';

function parseRole(value: string): TeamRole {
  if (value === 'manager' || value === 'team_member' || value === 'senior_leader') {
    return value;
  }
  return 'team_member';
}

export async function getActorContext(req: Request): Promise<ActorContext> {
  const headerUserId = req.header('x-auth-user-id')?.trim() || req.header('x-user-id')?.trim() || DEFAULT_USER_ID;
  const activeTeamId = req.header('x-auth-team-id')?.trim() || req.header('x-team-id')?.trim() || DEFAULT_TEAM_ID;

  const userRes = await pool.query<{ id: string; email: string; display_name: string }>(
    `SELECT id, email, display_name FROM users WHERE id = $1 LIMIT 1`,
    [headerUserId]
  );

  const userRow = userRes.rows[0] ?? {
    id: headerUserId,
    email: `${headerUserId}@demo.local`,
    display_name: headerUserId
  };

  const membershipsRes = await pool.query<{ team_id: string; role: string }>(
    `SELECT team_id, role FROM team_memberships WHERE user_id = $1`,
    [headerUserId]
  );

  const memberships: ActorMembership[] = membershipsRes.rows.map((row) => ({
    teamId: row.team_id,
    role: parseRole(row.role)
  }));

  return {
    userId: userRow.id,
    email: userRow.email,
    displayName: userRow.display_name,
    activeTeamId,
    memberships
  };
}

function roleForTeam(actor: ActorContext, teamId: string): TeamRole | null {
  const membership = actor.memberships.find((item) => item.teamId === teamId);
  return membership?.role ?? null;
}

function isSeniorLeader(actor: ActorContext): boolean {
  return actor.memberships.some((item) => item.role === 'senior_leader');
}

export function canViewTeam(actor: ActorContext, teamId: string): boolean {
  if (isSeniorLeader(actor)) return true;
  return Boolean(roleForTeam(actor, teamId));
}

export function canManageOkrs(actor: ActorContext, teamId: string): boolean {
  return roleForTeam(actor, teamId) === 'manager';
}

export function canManageDrafts(actor: ActorContext, teamId: string): boolean {
  const role = roleForTeam(actor, teamId);
  return role === 'manager' || role === 'team_member';
}

export function canPublishOkrs(actor: ActorContext, teamId: string): boolean {
  return roleForTeam(actor, teamId) === 'manager';
}

export function canCheckin(actor: ActorContext, teamId: string): boolean {
  const role = roleForTeam(actor, teamId);
  return role === 'manager' || role === 'team_member';
}

export function buildPermissionSummary(actor: ActorContext, teamId: string): TeamScopedPermission {
  return {
    teamId,
    canView: canViewTeam(actor, teamId),
    canManageOkrs: canManageOkrs(actor, teamId),
    canManageDrafts: canManageDrafts(actor, teamId),
    canPublishOkrs: canPublishOkrs(actor, teamId),
    canCheckin: canCheckin(actor, teamId)
  };
}
