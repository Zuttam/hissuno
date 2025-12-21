/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_CUSTOMIZE_PROJECT_ID?: string;
  readonly VITE_CUSTOMIZE_PUBLIC_KEY?: string;
  readonly VITE_CUSTOMIZE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

