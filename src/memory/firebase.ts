import admin from 'firebase-admin';
import { env } from '../config/env.ts';

// Initialize Firebase Admin
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('[Firebase] Admin initialized using FIREBASE_SERVICE_ACCOUNT_JSON from env var.');
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        console.log('[Firebase] Admin initialized using applicationDefault().');
    }
} catch (error) {
    console.log('[Firebase] Error initializing admin SDK, verify your credentials.', error);
}

const db = admin.firestore();

/**
 * Save Google OAuth Token to central doc
 */
export async function saveGoogleToken(token: any): Promise<void> {
    try {
        await db.collection('sysconfig').doc('google_oauth').set({
            token,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('[Firebase] Saved Google OAuth token.');
    } catch (e: any) {
        console.error('[Firebase] Error saving Google token:', e.message);
    }
}

/**
 * Retrieve Google OAuth Token from central doc
 */
export async function getGoogleToken(): Promise<any | null> {
    try {
        const doc = await db.collection('sysconfig').doc('google_oauth').get();
        if (doc.exists) {
            return doc.data()?.token || null;
        }
    } catch (e: any) {
        console.error('[Firebase] Error loading Google token:', e.message);
    }
    return null;
}

export interface FBChatMessage {
    id: string;
    userId: number;
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: admin.firestore.Timestamp;
}

/**
 * Store a message into memory
 */
export async function addMessage(userId: number, role: 'system' | 'user' | 'assistant', content: string) {
    try {
        const messagesRef = db.collection(`physics_users/${userId}/messages`);
        await messagesRef.add({
            userId,
            role,
            content,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err: any) {
        console.error(`[Firebase] Error adding message: ${err.message}`);
    }
}

/**
 * Get messages for a user
 */
export async function getMessages(userId: number, limit: number = 20): Promise<FBChatMessage[]> {
    try {
        const messagesRef = db.collection(`physics_users/${userId}/messages`);
        const snapshot = await messagesRef
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const messages: FBChatMessage[] = [];
        snapshot.forEach(doc => {
            messages.push({
                id: doc.id,
                ...doc.data()
            } as FBChatMessage);
        });

        return messages.reverse();
    } catch (err: any) {
        console.error(`[Firebase] Error getting messages: ${err.message}`);
        return [];
    }
}

/**
 * Clear memory for a user
 */
export async function clearMessages(userId: number) {
    try {
        const messagesRef = db.collection(`physics_users/${userId}/messages`);
        const snapshot = await messagesRef.get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`[Firebase] Memory cleared for user ${userId}`);
    } catch (err: any) {
        console.error(`[Firebase] Error clearing messages: ${err.message}`);
    }
}

// ═══════════════════════════════════════════
// Research Session Storage
// ═══════════════════════════════════════════

export interface ResearchSession {
    id: string;
    userId: number;
    title: string;
    phase: 'scope' | 'plan' | 'derive' | 'verify' | 'package';
    notes: string;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
}

/**
 * Save or update a research session
 */
export async function saveResearchSession(userId: number, sessionId: string, data: Partial<ResearchSession>) {
    try {
        const ref = db.collection(`physics_users/${userId}/research_sessions`).doc(sessionId);
        await ref.set({
            ...data,
            userId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`[Firebase] Saved research session ${sessionId} for user ${userId}`);
    } catch (err: any) {
        console.error(`[Firebase] Error saving research session: ${err.message}`);
    }
}

/**
 * Get all research sessions for a user
 */
export async function getResearchSessions(userId: number): Promise<ResearchSession[]> {
    try {
        const ref = db.collection(`physics_users/${userId}/research_sessions`);
        const snapshot = await ref.orderBy('updatedAt', 'desc').limit(10).get();

        const sessions: ResearchSession[] = [];
        snapshot.forEach(doc => {
            sessions.push({ id: doc.id, ...doc.data() } as ResearchSession);
        });
        return sessions;
    } catch (err: any) {
        console.error(`[Firebase] Error getting research sessions: ${err.message}`);
        return [];
    }
}

// ═══════════════════════════════════════════
// AI Model Performance Monitoring
// ═══════════════════════════════════════════

/**
 * Log a single LLM model attempt to Firestore for monitoring.
 */
export async function logModelAttempt(
    model: string,
    success: boolean,
    latencyMs: number,
    error?: string
) {
    try {
        await db.collection('physics_metrics').doc('llm_calls').collection('attempts').add({
            model,
            success,
            latencyMs,
            error: error || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err: any) {
        console.error(`[Firebase] Metrics log error: ${err.message}`);
    }
}

/**
 * Get aggregated model performance stats from the last N days.
 */
export async function getModelStats(days: number = 7): Promise<string> {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const snapshot = await db
            .collection('physics_metrics').doc('llm_calls').collection('attempts')
            .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(cutoff))
            .get();

        const stats: Record<string, { attempts: number; successes: number; totalLatency: number; errors: string[] }> = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const model = data.model || 'unknown';
            if (!stats[model]) {
                stats[model] = { attempts: 0, successes: 0, totalLatency: 0, errors: [] };
            }
            stats[model].attempts++;
            if (data.success) stats[model].successes++;
            stats[model].totalLatency += (data.latencyMs || 0);
            if (data.error && stats[model].errors.length < 3) {
                stats[model].errors.push(data.error.substring(0, 80));
            }
        });

        if (Object.keys(stats).length === 0) {
            return `No hay datos de los últimos ${days} días.`;
        }

        let report = `📊 Métricas LLM — OpenPhysics (últimos ${days} días):\n\n`;
        for (const [model, s] of Object.entries(stats)) {
            const shortName = model.split('/').pop()?.replace(':free', '') || model;
            const rate = s.attempts > 0 ? Math.round((s.successes / s.attempts) * 100) : 0;
            const avgMs = s.attempts > 0 ? Math.round(s.totalLatency / s.attempts) : 0;
            report += `**${shortName}**\n`;
            report += `  ✅ ${s.successes}/${s.attempts} (${rate}%) | ⏱️ ${avgMs}ms avg\n`;
            if (s.errors.length > 0) {
                report += `  ❌ Últimos errores: ${s.errors[0]}\n`;
            }
            report += `\n`;
        }

        return report;
    } catch (err: any) {
        console.error(`[Firebase] Error getting model stats: ${err.message}`);
        return 'Error al obtener métricas: ' + err.message;
    }
}
