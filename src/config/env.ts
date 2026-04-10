import 'dotenv/config';

// Define a strict verification function
function getEnv(key: string, required: boolean = true, fallback?: string): string {
    const value = process.env[key] || fallback;
    if (required && !value) {
        throw new Error(`Environment variable missing: ${key}`);
    }
    return value || '';
}

/**
 * Parse comma-separated API keys from env var.
 * Supports: GROQ_API_KEY="key1" or GROQ_API_KEY="key1,key2,key3"
 */
function getApiKeys(key: string, required: boolean = true): string[] {
    const raw = getEnv(key, required, '');
    if (!raw) return [];
    return raw.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

export const env = {
    TELEGRAM_BOT_TOKEN: getEnv('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_ALLOWED_USER_IDS: getEnv('TELEGRAM_ALLOWED_USER_IDS')
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id)),

    // Multi-key support: comma-separated keys for rotation
    GROQ_API_KEYS: getApiKeys('GROQ_API_KEY'),
    OPENROUTER_API_KEYS: getApiKeys('OPENROUTER_API_KEY'),

    // Legacy single-key accessors (for backward compatibility)
    GROQ_API_KEY: getEnv('GROQ_API_KEY'),
    OPENROUTER_API_KEY: getEnv('OPENROUTER_API_KEY', false, ''),

    OPENROUTER_MODEL: getEnv('OPENROUTER_MODEL', false, 'openrouter/free'),
    DB_PATH: getEnv('DB_PATH', false, './memory.db'),
    GOOGLE_OAUTH_CLIENT_ID: getEnv('GOOGLE_OAUTH_CLIENT_ID', false, ''),
    GOOGLE_OAUTH_CLIENT_SECRET: getEnv('GOOGLE_OAUTH_CLIENT_SECRET', false, ''),
    GOOGLE_OAUTH_REDIRECT_URI: getEnv('GOOGLE_OAUTH_REDIRECT_URI', false, 'http://localhost:3000/oauth2callback'),
    GEMINI_API_KEY: getEnv('GEMINI_API_KEY', false, ''),
    WOLFRAM_APP_ID: getEnv('WOLFRAM_APP_ID', false, ''),
};
