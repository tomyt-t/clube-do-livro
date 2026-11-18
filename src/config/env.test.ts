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
      firebase: {
        apiKey: 'key',
        authDomain: 'clube.firebaseapp.com',
        projectId: 'clube',
        appId: '1:2:web:3',
      },
    });
  });

  it('runs the demo without any Firebase configuration', () => {
    expect(readConfig({ VITE_DEMO_MODE: 'true' })).toEqual({
      mode: 'demo',
      clubName: 'Clube do Livro',
      googleBooksApiKey: null,
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
