/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLUB_NAME?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_GOOGLE_BOOKS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
