import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
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
console.log(`[LLM] Anthropic configured: ${!!env.ANTHROPIC_API_KEY}`);

// ═══════════════════════════════════════════
// Anthropic Claude Client
// ═══════════════════════════════════════════
let anthropicClient: Anthropic | null = null;
if (env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

/**
 * Convierte mensajes del formato interno al formato Anthropic.
 * Anthropic separa el system prompt de los mensajes de usuario.
 */
async function tryAnthropic(messages: LLMMessage[]): Promise<any> {
    if (!anthropicClient) throw new Error('Anthropic not configured');

    const systemMsg = messages.find(m => m.role === 'system');
    const systemPrompt = systemMsg?.content || '';
    const chatMessages = messages.filter(m => m.role !== 'system');

    // Convertir tool_calls al formato Anthropic
    const anthropicMessages: Anthropic.MessageParam[] = chatMessages.map(m => {
        if (m.role === 'tool') {
            return {
                role: 'user' as const,
                content: [{
                    type: 'tool_result' as const,
                    tool_use_id: m.tool_call_id || '',
                    content: m.content || '',
                }]
            };
        }
        if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
            const content: any[] = [];
            if (m.content) content.push({ type: 'text', text: m.content });
            for (const tc of m.tool_calls) {
                let inputObj: Record<string, unknown> = {};
                try { inputObj = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
                content.push({
                    type: 'tool_use',
                    id: tc.id,
                    name: tc.function.name,
                    input: inputObj,
                });
            }
            return { role: 'assistant' as const, content };
        }
        return {
            role: m.role as 'user' | 'assistant',
            content: m.content || '',
        };
    });

    // Convertir schemas de tools al formato Anthropic
    const anthropicTools: Anthropic.Tool[] = toolsSchemas.map(schema => ({
        name: schema.function.name,
        description: schema.function.description,
        input_schema: schema.function.parameters as Anthropic.Tool.InputSchema,
    }));

    const response = await anthropicClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: anthropicTools,
    });

    // Convertir respuesta Anthropic al formato interno (compatible con OpenAI)
    const textContent = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('');

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

    if (toolUseBlocks.length > 0) {
        return {
            role: 'assistant',
            content: textContent || null,
            tool_calls: toolUseBlocks.map(b => ({
                id: b.id,
                type: 'function',
                function: {
                    name: b.name,
                    arguments: JSON.stringify(b.input),
                }
            }))
        };
    }

    return {
        role: 'assistant',
        content: textContent,
        tool_calls: null,
    };
}

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
// Modelos gratuitos confiables en OpenRouter (ordenados por fiabilidad)
const VERIFIED_FREE_MODELS = [
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'qwen/qwen3-14b:free',
    'deepseek/deepseek-r1-0528:free',
];

export async function chatCompletion(messages: LLMMessage[]): Promise<any> {
    const errors: string[] = [];
    const trimmed = trimMessages(messages);

    // ── Step 0: Anthropic Claude (más confiable, si está configurado) ──
    if (anthropicClient) {
        const start = Date.now();
        try {
            console.log('[LLM] Trying Anthropic claude-haiku-4-5...');
            const result = await tryAnthropic(trimmed);
            const latency = Date.now() - start;
            console.log(`[LLM] ✅ Anthropic succeeded (${latency}ms).`);
            logModelAttempt('anthropic/claude-haiku-4-5', true, latency);
            return result;
        } catch (error: any) {
            const latency = Date.now() - start;
            const reason = error.message?.substring(0, 120) || 'Unknown';
            console.error(`[LLM] ❌ Anthropic: ${reason}`);
            errors.push(`Anthropic: ${reason}`);
            logModelAttempt('anthropic/claude-haiku-4-5', false, latency, reason);
        }
    }

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
