import dotenv from 'dotenv';
import path from 'node:path';

// Load root project .env when running from apps/api workspace
const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath, override: true });

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
  excelInputPath: process.env.EXCEL_INPUT_PATH ?? './data/sample-krs.xlsx'
};
