import dotenv from 'dotenv';
import path from 'node:path';

const resolveWorkspaceEnvPath = (): string => {
  if (process.env.ENV_FILE_PATH?.trim()) {
    return path.resolve(process.cwd(), process.env.ENV_FILE_PATH);
  }

  return path.resolve(process.cwd(), '../../.env');
};

const envPath = resolveWorkspaceEnvPath();

// Load root project .env when running from apps/api workspace
dotenv.config({ path: envPath });

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.toLowerCase().trim();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPort: toNumber(process.env.API_PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  appRegion: process.env.APP_REGION ?? 'UK/EU',
  dataResidency: process.env.DATA_RESIDENCY ?? 'uk-eu',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://okr:okr@localhost:5432/okr_copilot?schema=public',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? 'Europe/London',
  authStubEnabled: toBoolean(process.env.AUTH_STUB_ENABLED, true),
  authStubEmail: process.env.AUTH_STUB_EMAIL ?? 'robin@localhost',
  authStubDisplayName: process.env.AUTH_STUB_DISPLAY_NAME ?? 'Robin',
  authStubToken: process.env.AUTH_STUB_TOKEN ?? 'dev-stub-token',
  authGuardToken: process.env.AUTH_GUARD_TOKEN ?? '',
  whatsappProvider: process.env.WHATSAPP_PROVIDER ?? 'twilio',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
  twilioSandbox: toBoolean(process.env.TWILIO_WHATSAPP_SANDBOX, true),
  twilioStatusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL ?? '',
  twilioInboundWebhookPath:
    process.env.TWILIO_INBOUND_WEBHOOK_PATH ?? '/api/reminders/whatsapp/inbound',
  twilioVerifySignature: toBoolean(process.env.TWILIO_VERIFY_SIGNATURE, true),
  twilioPublicBaseUrl: process.env.TWILIO_PUBLIC_BASE_URL ?? '',
  reminderWorkerEnabled: toBoolean(process.env.REMINDER_WORKER_ENABLED, true),
  reminderTickSeconds: toNumber(process.env.REMINDER_TICK_SECONDS, 30),
  excelInputPath: process.env.EXCEL_INPUT_PATH ?? './data/sample-krs.xlsx',
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  okrDraftLlmTimeoutMs: toNumber(process.env.OKR_DRAFT_LLM_TIMEOUT_MS, 15000),
  okrDraftInputMaxChars: toNumber(process.env.OKR_DRAFT_INPUT_MAX_CHARS, 240),
  serveWebDist: toBoolean(process.env.SERVE_WEB_DIST, false),
  webDistDir: process.env.WEB_DIST_DIR ?? ''
};

export function validateStartupConfig(): void {
  const issues: string[] = [];

  if (env.authStubEnabled && !env.authStubToken.trim()) {
    issues.push('AUTH_STUB_TOKEN must be set when AUTH_STUB_ENABLED=true');
  }

  if (env.twilioVerifySignature) {
    if (!env.twilioAuthToken.trim()) {
      issues.push('TWILIO_AUTH_TOKEN must be set when TWILIO_VERIFY_SIGNATURE=true');
    }
    if (!env.twilioPublicBaseUrl.trim()) {
      issues.push('TWILIO_PUBLIC_BASE_URL must be set when TWILIO_VERIFY_SIGNATURE=true');
    }
  }

  if (env.serveWebDist && !env.webDistDir.trim()) {
    issues.push('WEB_DIST_DIR must be set when SERVE_WEB_DIST=true');
  }

  if (issues.length) {
    throw new Error(`[config.invalid] ${issues.join(' | ')}`);
  }
}
