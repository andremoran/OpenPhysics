import Groq from 'groq-sdk';
import { env } from '../config/env.ts';
import fs from 'fs';
import { toolsSchemas } from '../tools/index.ts';
import { logModelAttempt } from '../memory/firebase.ts';

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Trim conversation to avoid 413 (payload too large) errors.
 */
function trimMessages(messages: LLMMessage[], maxMessages: number = 20): LLMMessage[] {
    if (messages.length <= maxMessages) return messages;
    const systemMsg = messages[0]?.role === 'system' ? [messages[0]] : [];
    const recentMsgs = messages.slice(-(maxMessages - systemMsg.length));
    return [...systemMsg, ...recentMsgs];
}

// ═══════════════════════════════════════════
// Multi-Key Groq Client Pool
// ═══════════════════════════════════════════
const groqClients: Groq[] = env.GROQ_API_KEYS.map(key => new Groq({ apiKey: key }));
if (groqClients.length === 0) {
    groqClients.push(new Groq({ apiKey: env.GROQ_API_KEY }));
}
console.log(`[LLM] Loaded ${groqClients.length} Groq API key(s).`);
console.log(`[LLM] Loaded ${env.OPENROUTER_API_KEYS.length} OpenRouter API key(s).`);

// ═══════════════════════════════════════════
// OpenRouter with key rotation
// ═══════════════════════════════════════════
async function tryOpenRouter(model: string, messages: LLMMessage[], apiKey: string): Promise<any> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/OpenPhysics",
            "X-Title": "OpenPhysics"
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            tools: toolsSchemas,
            tool_choice: "auto"
        })
    });

    if (!response.ok) {
        const rawError = await response.text();
        throw new Error(`HTTP ${response.status}: ${rawError.substring(0, 200)}`);
    }

    const data: any = await response.json();

    if (!data.choices || data.choices.length === 0) {
        throw new Error("No choices returned.");
    }

    return data.choices[0].message;
}

/**
 * OPTIMIZED CASCADE with multi-key rotation.
 * Physics-optimized model selection favoring reasoning models.
 */
const VERIFIED_FREE_MODELS = [
    'arcee-ai/trinity-large-preview:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'qwen/qwen3-coder:free',
];

export async function chatCompletion(messages: LLMMessage[]): Promise<any> {
    const errors: string[] = [];
    const trimmed = trimMessages(messages);

    // ── Step 1: Groq — try ALL API keys ──
    for (let i = 0; i < groqClients.length; i++) {
        const keyLabel = groqClients.length > 1 ? `Groq-Key${i + 1}` : 'Groq';
        const modelName = `groq/llama-3.3-70b-versatile(${keyLabel})`;
        const start = Date.now();
        try {
            console.log(`[LLM] Trying ${keyLabel}...`);
            const response = await groqClients[i].chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: trimmed as any[],
                tools: toolsSchemas as any[],
                tool_choice: 'auto',
                max_tokens: 4096,
                temperature: 0.5, // Lower temp for physics precision
            });
            const latency = Date.now() - start;
            console.log(`[LLM] ✅ ${keyLabel} succeeded (${latency}ms).`);
            logModelAttempt(modelName, true, latency);
            return response.choices[0].message;
        } catch (error: any) {
            const latency = Date.now() - start;
            const reason = error.message?.substring(0, 120) || 'Unknown';
            console.error(`[LLM] ❌ ${keyLabel}: ${reason}`);
            errors.push(`${keyLabel}: ${reason}`);
            logModelAttempt(modelName, false, latency, reason);
        }
    }

    // ── Step 2: OpenRouter — try each model × each API key ──
    const orKeys = env.OPENROUTER_API_KEYS.length > 0 ? env.OPENROUTER_API_KEYS : (env.OPENROUTER_API_KEY ? [env.OPENROUTER_API_KEY] : []);

    if (orKeys.length > 0) {
        for (const model of VERIFIED_FREE_MODELS) {
            for (let k = 0; k < orKeys.length; k++) {
                const start = Date.now();
                const shortName = model.split('/').pop()?.replace(':free', '') || model;
                const keyLabel = orKeys.length > 1 ? `${shortName}-Key${k + 1}` : shortName;
                try {
                    await delay(300);
                    console.log(`[LLM] Trying ${keyLabel}...`);
                    const result = await tryOpenRouter(model, trimmed, orKeys[k]);
                    const latency = Date.now() - start;
                    console.log(`[LLM] ✅ ${keyLabel} succeeded (${latency}ms).`);
                    logModelAttempt(model, true, latency);
                    return result;
                } catch (error: any) {
                    const latency = Date.now() - start;
                    const reason = error.message?.substring(0, 120) || 'Unknown';
                    const is404 = reason.includes('404');
                    console.error(`[LLM] ❌ ${keyLabel}: ${reason}`);
                    errors.push(`${keyLabel}: ${reason}`);
                    logModelAttempt(model, false, latency, reason);
                    if (is404) break;
                }
            }
        }
    }

    // ── All failed ──
    const top3 = errors.slice(0, 3).join(' | ');
    throw new Error(`⚠️ Los ${errors.length} modelos fallaron. Top errores: ${top3}. Intenta en 30s.`);
}

/**
 * Transcribes audio using Groq Whisper.
 * Tries all available Groq keys.
 */
export async function transcribeAudio(filePath: string): Promise<string> {
    console.log(`[LLM] Transcribing audio...`);
    for (let i = 0; i < groqClients.length; i++) {
        try {
            const transcription = await groqClients[i].audio.transcriptions.create({
                file: fs.createReadStream(filePath),
                model: "whisper-large-v3",
                language: "es",
            });
            return transcription.text;
        } catch (error: any) {
            console.error(`[LLM] Whisper Key${i + 1} failed: ${error.message}`);
            if (i === groqClients.length - 1) {
                throw new Error('Error al transcribir audio: ' + error.message);
            }
        }
    }
    throw new Error('No Groq keys available for transcription.');
}
