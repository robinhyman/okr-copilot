import crypto from 'node:crypto';
import { pool } from '../db/pool.js';

export type DefaultModeVariant = 'wizard_first' | 'conversational_first' | 'not_enrolled';

export interface DefaultModeExperimentConfig {
  enabled: boolean;
  experimentKey: string;
  trafficPercent: number;
  weights: {
    wizard_first: number;
    conversational_first: number;
  };
  killSwitches: {
    wizard_first: boolean;
    conversational_first: boolean;
  };
  allowOverrideHeader: boolean;
}

export interface DefaultModeExperimentResolution {
  experimentKey: string;
  enabled: boolean;
  variant: DefaultModeVariant;
  defaultMode: 'wizard' | 'conversational';
  sticky: boolean;
  reason: 'forced_off' | 'assigned' | 'sticky_assignment' | 'override' | 'not_enrolled';
}

function clampPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

function normalizedWeights(input: { wizard_first: number; conversational_first: number }) {
  const wizard = Math.max(0, Number.isFinite(input.wizard_first) ? input.wizard_first : 0);
  const conversational = Math.max(0, Number.isFinite(input.conversational_first) ? input.conversational_first : 0);
  const total = wizard + conversational;

  if (total <= 0) {
    return { wizard_first: 50, conversational_first: 50 };
  }

  return {
    wizard_first: (wizard / total) * 100,
    conversational_first: (conversational / total) * 100
  };
}

function hashBucket(seed: string): number {
  const hex = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
  const value = Number.parseInt(hex, 16);
  return value % 100;
}

function toDefaultMode(variant: DefaultModeVariant): 'wizard' | 'conversational' {
  return variant === 'conversational_first' ? 'conversational' : 'wizard';
}

function allocateVariant(input: {
  experimentKey: string;
  userId: string;
  teamId: string;
  trafficPercent: number;
  weights: { wizard_first: number; conversational_first: number };
  killSwitches: { wizard_first: boolean; conversational_first: boolean };
}): DefaultModeVariant {
  const bucket = hashBucket(`${input.experimentKey}:${input.userId}:${input.teamId}`);
  if (bucket >= input.trafficPercent) return 'not_enrolled';

  const wizardAllowed = !input.killSwitches.wizard_first;
  const conversationalAllowed = !input.killSwitches.conversational_first;

  if (!wizardAllowed && !conversationalAllowed) return 'not_enrolled';
  if (!wizardAllowed) return 'conversational_first';
  if (!conversationalAllowed) return 'wizard_first';

  return bucket < input.weights.wizard_first ? 'wizard_first' : 'conversational_first';
}

export function resolveDefaultModeConfigFromEnv(env: NodeJS.ProcessEnv): DefaultModeExperimentConfig {
  const enabled = ['1', 'true', 'yes', 'on'].includes((env.EXPERIMENT_DEFAULT_MODE_ENABLED ?? '').toLowerCase().trim());
  const allowOverrideHeader = ['1', 'true', 'yes', 'on'].includes((env.EXPERIMENT_DEFAULT_MODE_ALLOW_OVERRIDE ?? '').toLowerCase().trim());
  const disableWizard = ['1', 'true', 'yes', 'on'].includes((env.EXPERIMENT_DEFAULT_MODE_DISABLE_WIZARD ?? '').toLowerCase().trim());
  const disableConversational = ['1', 'true', 'yes', 'on'].includes((env.EXPERIMENT_DEFAULT_MODE_DISABLE_CONVERSATIONAL ?? '').toLowerCase().trim());

  const trafficPercent = clampPercent(Number(env.EXPERIMENT_DEFAULT_MODE_TRAFFIC_PERCENT), 100);
  const weights = normalizedWeights({
    wizard_first: Number(env.EXPERIMENT_DEFAULT_MODE_WEIGHT_WIZARD),
    conversational_first: Number(env.EXPERIMENT_DEFAULT_MODE_WEIGHT_CONVERSATIONAL)
  });

  return {
    enabled,
    experimentKey: env.EXPERIMENT_DEFAULT_MODE_KEY?.trim() || 'okr_create_entry_v1',
    trafficPercent,
    weights,
    killSwitches: {
      wizard_first: disableWizard,
      conversational_first: disableConversational
    },
    allowOverrideHeader
  };
}

export async function resolveDefaultModeAssignment(input: {
  userId: string;
  teamId: string;
  overrideVariant?: 'wizard_first' | 'conversational_first';
  config: DefaultModeExperimentConfig;
}): Promise<DefaultModeExperimentResolution> {
  if (!input.config.enabled) {
    return {
      experimentKey: input.config.experimentKey,
      enabled: false,
      variant: 'not_enrolled',
      defaultMode: 'wizard',
      sticky: false,
      reason: 'forced_off'
    };
  }

  if (input.overrideVariant) {
    return {
      experimentKey: input.config.experimentKey,
      enabled: true,
      variant: input.overrideVariant,
      defaultMode: toDefaultMode(input.overrideVariant),
      sticky: false,
      reason: 'override'
    };
  }

  const existing = await pool.query<{ variant: DefaultModeVariant }>(
    `SELECT variant
     FROM experiment_assignments
     WHERE experiment_key = $1 AND user_id = $2 AND team_id = $3
     LIMIT 1`,
    [input.config.experimentKey, input.userId, input.teamId]
  );

  if (existing.rowCount) {
    const variant = existing.rows[0].variant;
    return {
      experimentKey: input.config.experimentKey,
      enabled: true,
      variant,
      defaultMode: toDefaultMode(variant),
      sticky: true,
      reason: variant === 'not_enrolled' ? 'not_enrolled' : 'sticky_assignment'
    };
  }

  const variant = allocateVariant({
    experimentKey: input.config.experimentKey,
    userId: input.userId,
    teamId: input.teamId,
    trafficPercent: input.config.trafficPercent,
    weights: input.config.weights,
    killSwitches: input.config.killSwitches
  });

  await pool.query(
    `INSERT INTO experiment_assignments (experiment_key, user_id, team_id, variant, assignment_source, metadata_json)
     VALUES ($1, $2, $3, $4, 'hash_v1', $5::jsonb)
     ON CONFLICT (experiment_key, user_id, team_id) DO NOTHING`,
    [
      input.config.experimentKey,
      input.userId,
      input.teamId,
      variant,
      JSON.stringify({ trafficPercent: input.config.trafficPercent, weights: input.config.weights })
    ]
  );

  return {
    experimentKey: input.config.experimentKey,
    enabled: true,
    variant,
    defaultMode: toDefaultMode(variant),
    sticky: true,
    reason: variant === 'not_enrolled' ? 'not_enrolled' : 'assigned'
  };
}
