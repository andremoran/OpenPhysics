/**
 * Wolfram Alpha Integration for OpenPhysics
 * Query Wolfram Alpha for physics computations and knowledge.
 */

import { env } from '../config/env.ts';

/**
 * Query Wolfram Alpha Short Answers API
 */
export async function queryWolfram(query: string): Promise<string> {
    const appId = env.WOLFRAM_APP_ID;

    if (!appId) {
        return '⚠️ Wolfram Alpha no está configurado. Agrega WOLFRAM_APP_ID al .env para habilitar esta herramienta.';
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `http://api.wolframalpha.com/v1/result?appid=${appId}&i=${encodedQuery}&units=metric`;

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 501) {
                return `🐺 Wolfram Alpha no pudo interpretar la consulta: "${query}". Intenta reformularla de forma más específica.`;
            }
            throw new Error(`Wolfram API error: ${response.status}`);
        }

        const result = await response.text();
        return `🐺 **Wolfram Alpha:**\n   Consulta: ${query}\n   Resultado: **${result}**`;

    } catch (error: any) {
        return `Error consultando Wolfram Alpha: ${error.message}`;
    }
}

/**
 * Query Wolfram Alpha Full Results API (when short answer is not enough)
 */
export async function queryWolframFull(query: string): Promise<string> {
    const appId = env.WOLFRAM_APP_ID;

    if (!appId) {
        return '⚠️ Wolfram Alpha no está configurado. Agrega WOLFRAM_APP_ID al .env.';
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `http://api.wolframalpha.com/v2/query?appid=${appId}&input=${encodedQuery}&output=json&format=plaintext`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Wolfram API error: ${response.status}`);
        }

        const data: any = await response.json();
        const result = data.queryresult;

        if (!result.success) {
            return `🐺 Wolfram Alpha no encontró resultados para: "${query}"`;
        }

        let output = `🐺 **Wolfram Alpha — Resultados detallados:**\n\n`;

        const pods = result.pods || [];
        for (const pod of pods.slice(0, 5)) { // Limit to 5 pods
            output += `**${pod.title}:**\n`;
            const subpods = pod.subpods || [];
            for (const sub of subpods.slice(0, 3)) {
                if (sub.plaintext) {
                    output += `   ${sub.plaintext}\n`;
                }
            }
            output += '\n';
        }

        return output;

    } catch (error: any) {
        return `Error consultando Wolfram Alpha: ${error.message}`;
    }
}

// ═══════════════════════════════════════════
// Tool Schemas
// ═══════════════════════════════════════════

export const queryWolframSchema = {
    type: 'function',
    function: {
        name: 'query_wolfram',
        description: 'Query Wolfram Alpha for a quick physics computation or factual answer. Examples: "mass of the sun in kg", "integrate sin(x) dx from 0 to pi", "escape velocity of Mars", "energy of a 500nm photon".',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The query in natural language (English works best with Wolfram).'
                }
            },
            required: ['query']
        }
    }
};

export const queryWolframFullSchema = {
    type: 'function',
    function: {
        name: 'query_wolfram_full',
        description: 'Query Wolfram Alpha for detailed results with multiple sections (input interpretation, results, properties, plots descriptions). Use for complex queries needing more context than a single answer.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The detailed query in natural language.'
                }
            },
            required: ['query']
        }
    }
};
