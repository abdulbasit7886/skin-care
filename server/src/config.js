import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const env = process.env;

const required = (name) => {
  const v = env[name];
  if (!v) throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  return v;
};

const isProd = env.NODE_ENV === 'production';

const jwtSecret = required('JWT_SECRET');
if (isProd && (jwtSecret === 'change-me' || jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be a long random value in production');
}

export const config = {
  isProd,
  port: Number(env.PORT || 4000),
  appUrl: (env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  sessionHours: 12,
  clinicTz: env.CLINIC_TZ || 'Asia/Karachi',
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Health Synapsis <no-reply@example.com>',
  },
  contactTo: env.CONTACT_TO || '',
  websiteFacilityId: env.WEBSITE_FACILITY_ID || '',
  storageDir: path.resolve(ROOT_DIR, env.STORAGE_DIR || './server/storage'),
  distDir: path.join(ROOT_DIR, 'dist'),
  maxUploadBytes: 15 * 1024 * 1024,
};
