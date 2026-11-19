import { describe, expect, it } from 'vitest';

import { ConfigError, readConfig, type EnvSource } from './env';

const firebaseEnv: EnvSource = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'clube.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'clube',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
};

describe('readConfig', () => {
  it('builds the Firebase configuration', () => {
    expect(readConfig({ ...firebaseEnv, VITE_CLUB_NAME: ' Leitores ' })).toEqual({
      mode: 'firebase',
      clubName: 'Leitores',
      googleBooksApiKey: null,
      appCheckSiteKey: null,
      aiModel: null,
      emulators: false,
      live: null,
      firebase: {
        apiKey: 'key',
        authDomain: 'clube.firebaseapp.com',
        projectId: 'clube',
        appId: '1:2:web:3',
      },
    });
  });

  it('turns the duplicate check on with a model name, only with App Check', () => {
    const model = { ...firebaseEnv, VITE_AI_MODEL: ' gemini-3.5-flash-lite ' };
    expect(readConfig(model)).toMatchObject({ aiModel: null });
    expect(readConfig({ ...model, VITE_APPCHECK_SITE_KEY: 'site-key' })).toMatchObject({
      aiModel: 'gemini-3.5-flash-lite',
    });
  });

  it('runs the demo without any Firebase configuration', () => {
    expect(readConfig({ VITE_DEMO_MODE: 'true' })).toEqual({
      mode: 'demo',
      clubName: 'Clube do Livro',
      googleBooksApiKey: null,
    });
  });

  it('points at the local emulators only with a demo project', () => {
    const local = { ...firebaseEnv, VITE_FIREBASE_EMULATORS: 'true' };
    expect(() => readConfig(local)).toThrow(/demo-/);
    expect(readConfig({ ...local, VITE_FIREBASE_PROJECT_ID: 'demo-clube' })).toMatchObject({
      clubName: 'Clube do Livro (teste local)',
      emulators: true,
      googleBooksApiKey: null,
      appCheckSiteKey: null,
      aiModel: null,
      live: null,
    });
  });

  it("uses the site's keys on the emulators, with Gemini on the real project", () => {
    const local = {
      ...firebaseEnv,
      VITE_FIREBASE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'demo-clube',
      VITE_GOOGLE_BOOKS_API_KEY: 'books',
      VITE_APPCHECK_SITE_KEY: 'site-key',
      VITE_AI_MODEL: 'gemini-3.5-flash-lite',
    };
    // Without the real project, no Gemini.
    expect(readConfig(local)).toMatchObject({
      googleBooksApiKey: 'books',
      aiModel: null,
      live: null,
    });
    const live = {
      ...local,
      VITE_LIVE_FIREBASE_API_KEY: 'live-key',
      VITE_LIVE_FIREBASE_AUTH_DOMAIN: 'clube.firebaseapp.com',
      VITE_LIVE_FIREBASE_PROJECT_ID: 'clube',
      VITE_LIVE_FIREBASE_APP_ID: '1:2:web:3',
      VITE_APPCHECK_DEBUG_TOKEN: 'debug',
    };
    expect(readConfig(live)).toMatchObject({
      firebase: { projectId: 'demo-clube' },
      appCheckSiteKey: null,
      aiModel: 'gemini-3.5-flash-lite',
      live: {
        firebase: { projectId: 'clube', apiKey: 'live-key' },
        appCheckSiteKey: 'site-key',
        appCheckDebugToken: 'debug',
      },
    });
  });

  it('names every missing Firebase variable', () => {
    const attempt = () => readConfig({ VITE_FIREBASE_API_KEY: 'key', VITE_FIREBASE_APP_ID: ' ' });
    expect(attempt).toThrow(ConfigError);
    try {
      attempt();
    } catch (error) {
      expect((error as ConfigError).missing).toEqual([
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_APP_ID',
      ]);
    }
  });

  it('keeps optional keys when present', () => {
    const config = readConfig({
      ...firebaseEnv,
      VITE_GOOGLE_BOOKS_API_KEY: 'books',
      VITE_APPCHECK_SITE_KEY: 'recaptcha',
    });
    expect(config).toMatchObject({ googleBooksApiKey: 'books', appCheckSiteKey: 'recaptcha' });
  });
});
