import { google } from 'googleapis';
import { env } from './env.ts';
import { saveGoogleToken, getGoogleToken } from '../memory/firebase.ts';

// Define requested scopes
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.modify'
];

/**
 * Validates if the project has Google OAuth credentials configured
 */
export function isGoogleOAuthConfigured(): boolean {
    return !!env.GOOGLE_OAUTH_CLIENT_ID && !!env.GOOGLE_OAUTH_CLIENT_SECRET;
}

/**
 * Initializes and returns an OAuth2 client
 */
export function getOAuth2Client() {
    if (!isGoogleOAuthConfigured()) {
        throw new Error("Google OAuth credentials are not configured in environment variables.");
    }
    return new google.auth.OAuth2(
        env.GOOGLE_OAUTH_CLIENT_ID,
        env.GOOGLE_OAUTH_CLIENT_SECRET,
        env.GOOGLE_OAUTH_REDIRECT_URI
    );
}

/**
 * Generates the authorization URL for the user to login via Telegram
 */
export function getAuthUrl(): string {
    const oauth2Client = getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
    });
}

/**
 * Saves token to Firebase
 */
export async function saveToken(token: any) {
    await saveGoogleToken(token);
}

/**
 * Loads the token from Firebase
 */
export async function loadToken(): Promise<any | null> {
    return await getGoogleToken();
}

/**
 * Returns a fully authenticated Google OAuth2 Client ready to make API calls
 */
export async function getAuthenticatedClient() {
    const oauth2Client = getOAuth2Client();
    const token = await loadToken();

    if (!token) {
        throw new Error("No Google OAuth token found. User must authenticate first.");
    }

    oauth2Client.setCredentials(token);

    // Refresh token if needed
    oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
            console.log("Saving new Google OAuth refresh token");
        }
        console.log("Google OAuth access token refreshed");
        saveToken({ ...token, ...tokens });
    });

    return oauth2Client;
}
