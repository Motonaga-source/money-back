/// <reference types="vite/client" />

interface ImportMetaEnv {
    // Cloudflare Pages Functions environment variables
    // These are only used for type checking in development
    // Actual values are set in Cloudflare Pages Dashboard for production
    readonly GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
    readonly GOOGLE_PRIVATE_KEY?: string;
    readonly SPREADSHEET_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
