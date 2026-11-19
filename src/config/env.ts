export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

/**
 * The real project, used by the local emulators (`npm run dev:emulator`) for
 * Gemini alone. Its App Check runs in debug mode: the site key accepts only
 * the site's domain, so a debug token registered in the console stands in.
 */
export interface LiveConfig {
  firebase: FirebaseConfig;
  appCheckSiteKey: string;
  appCheckDebugToken: string | null;
}

interface SharedConfig {
  clubName: string;
  googleBooksApiKey: string | null;
}

export type AppConfig =
  | (SharedConfig & { mode: 'demo' })
  | (SharedConfig & {
      mode: 'firebase';
      firebase: FirebaseConfig;
      /** Fraud Defense (reCAPTCHA Enterprise) site key; enables Firebase App Check when present. */
      appCheckSiteKey: string | null;
      /**
       * Gemini model for the duplicate check (Firebase AI Logic). AI Logic does
       * not know the allowlist, so the check runs only with App Check too;
       * otherwise anyone could spend the quota with the public config.
       */
      aiModel: string | null;
      /** Local Auth and Firestore emulators (`npm run dev:emulator`) instead of the real project. */
      emulators: boolean;
      /** With the emulators only: the real project, for Gemini. */
      live: LiveConfig | null;
    });

export class ConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Configuração ausente: ${missing.join(', ')}`);
    this.name = 'ConfigError';
    this.missing = missing;
  }
}

type EnvKey =
  | 'VITE_CLUB_NAME'
  | 'VITE_DEMO_MODE'
  | 'VITE_FIREBASE_EMULATORS'
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_APP_ID'
  | 'VITE_GOOGLE_BOOKS_API_KEY'
  | 'VITE_APPCHECK_SITE_KEY'
  | 'VITE_APPCHECK_DEBUG_TOKEN'
  | 'VITE_AI_MODEL'
  | 'VITE_LIVE_FIREBASE_API_KEY'
  | 'VITE_LIVE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_LIVE_FIREBASE_PROJECT_ID'
  | 'VITE_LIVE_FIREBASE_APP_ID';

export type EnvSource = Partial<Record<EnvKey, string>>;

const DEFAULT_CLUB_NAME = 'Clube do Livro';

const FIREBASE_KEYS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const satisfies Record<keyof FirebaseConfig, EnvKey>;

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

const LIVE_KEYS = {
  apiKey: 'VITE_LIVE_FIREBASE_API_KEY',
  authDomain: 'VITE_LIVE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_LIVE_FIREBASE_PROJECT_ID',
  appId: 'VITE_LIVE_FIREBASE_APP_ID',
} as const satisfies Record<keyof FirebaseConfig, EnvKey>;

function readFirebase(
  env: EnvSource,
  keys: Record<keyof FirebaseConfig, EnvKey> = FIREBASE_KEYS,
): FirebaseConfig {
  const entries = Object.entries(keys).map(([field, key]) => [field, optional(env[key])] as const);
  const missing = entries
    .filter(([, value]) => value === null)
    .map(([field]) => keys[field as keyof FirebaseConfig]);
  if (missing.length > 0) throw new ConfigError(missing);
  return Object.fromEntries(entries) as unknown as FirebaseConfig;
}

/** The real project for Gemini, when `.env.emulator.local` has all of it. */
function readLive(env: EnvSource): LiveConfig | null {
  const appCheckSiteKey = optional(env.VITE_APPCHECK_SITE_KEY);
  if (!appCheckSiteKey || !optional(env.VITE_AI_MODEL)) return null;
  try {
    const firebase = readFirebase(env, LIVE_KEYS);
    if (firebase.projectId.startsWith('demo-')) return null;
    return {
      firebase,
      appCheckSiteKey,
      appCheckDebugToken: optional(env.VITE_APPCHECK_DEBUG_TOKEN),
    };
  } catch {
    return null;
  }
}

/**
 * The local emulators (`.env.emulator`): sign-in and data only ever on a
 * `demo-` project, which the emulators never connect to a real one. The
 * site's own keys in `.env.emulator.local` (ignored by git) switch on what
 * spends its quotas: the Google Books key, and Gemini on the real project.
 */
function emulatorConfig(env: EnvSource, clubName: string): AppConfig {
  const firebase = readFirebase(env);
  if (!firebase.projectId.startsWith('demo-')) {
    throw new Error('Os emuladores só rodam com um projeto "demo-", nunca com o real.');
  }
  const live = readLive(env);
  return {
    mode: 'firebase',
    clubName: `${clubName} (teste local)`,
    googleBooksApiKey: optional(env.VITE_GOOGLE_BOOKS_API_KEY),
    firebase,
    appCheckSiteKey: null,
    aiModel: live ? optional(env.VITE_AI_MODEL) : null,
    emulators: true,
    live,
  };
}

/** Reads and validates the build-time configuration (see `.env.example`). */
export function readConfig(env: EnvSource = import.meta.env): AppConfig {
  const shared: SharedConfig = {
    clubName: optional(env.VITE_CLUB_NAME) ?? DEFAULT_CLUB_NAME,
    googleBooksApiKey: optional(env.VITE_GOOGLE_BOOKS_API_KEY),
  };
  if (env.VITE_DEMO_MODE === 'true') return { ...shared, mode: 'demo' };
  if (env.VITE_FIREBASE_EMULATORS === 'true') return emulatorConfig(env, shared.clubName);
  const appCheckSiteKey = optional(env.VITE_APPCHECK_SITE_KEY);

  return {
    ...shared,
    mode: 'firebase',
    firebase: readFirebase(env),
    appCheckSiteKey,
    aiModel: appCheckSiteKey ? optional(env.VITE_AI_MODEL) : null,
    emulators: false,
    live: null,
  };
}
