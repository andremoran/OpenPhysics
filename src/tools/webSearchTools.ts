/**
 * Web Search Tools for OpenPhysics
 * Búsqueda general usando DuckDuckGo HTML (sin API key)
 * + fetchWebPage para leer URLs específicas
 */

interface DDGResult {
    title: string;
    url: string;
    snippet: string;
}

function parseDDGResults(html: string): DDGResult[] {
    const results: DDGResult[] = [];

    // DuckDuckGo HTML usa class="result__a" para títulos y "result__snippet" para fragmentos
    const titleRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const titles = [...html.matchAll(titleRegex)];
    const snippets = [...html.matchAll(snippetRegex)];

    for (let i = 0; i < Math.min(titles.length, snippets.length); i++) {
        const rawHref = titles[i][1];
        const title = titles[i][2].replace(/<[^>]+>/g, '').trim();
        const snippet = snippets[i][1].replace(/<[^>]+>/g, '').trim();

        // Decodificar URL de DDG (formato: //duckduckgo.com/l/?uddg=ENCODED_URL)
        let url = rawHref;
        const uddgMatch = rawHref.match(/uddg=([^&]+)/);
        if (uddgMatch) {
            try {
                url = decodeURIComponent(uddgMatch[1]);
            } catch (_) {
                url = rawHref;
            }
        }

        if (title && url && !url.startsWith('//duckduckgo')) {
            results.push({ title, url, snippet });
        }
    }

    return results;
}

/**
 * Busca en internet usando DuckDuckGo HTML (no requiere API key)
 */
export async function searchWeb(args: { query: string; maxResults?: number }): Promise<string> {
    const { query, maxResults = 5 } = args;
    try {
        const params = new URLSearchParams({ q: query, kl: 'us-en', kp: '-2' });
        const response = await fetch(`https://html.duckduckgo.com/html/?${params.toString()}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            throw new Error(`DuckDuckGo respondió con ${response.status}`);
        }

        const html = await response.text();
        const results = parseDDGResults(html).slice(0, maxResults);

        if (results.length === 0) {
            return `No se encontraron resultados web para: "${query}". Intenta con términos más específicos.`;
        }

        let output = `🌐 **Resultados de búsqueda web** para "${query}" (${results.length} resultados):\n\n`;
        results.forEach((r, i) => {
            output += `**${i + 1}. ${r.title}**\n`;
            output += `   🔗 ${r.url}\n`;
            if (r.snippet) output += `   📝 ${r.snippet}\n`;
            output += '\n';
        });

        return output;
    } catch (error: any) {
        return `Error en búsqueda web: ${error.message}`;
    }
}

/**
 * Obtiene y extrae el texto de una página web específica
 */
export async function fetchWebPage(args: { url: string }): Promise<string> {
    const { url } = args;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,text/plain',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} al obtener ${url}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text') && !contentType.includes('json')) {
            return `El contenido en ${url} no es texto legible (${contentType}).`;
        }

        const html = await response.text();

        // Limpiar HTML y extraer texto legible
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
            .replace(/\s{3,}/g, '\n\n')
            .trim();

        const truncated = text.length > 4000 ? text.substring(0, 4000) + '\n...[contenido truncado]' : text;
        return `📄 **Contenido de ${url}:**\n\n${truncated}`;
    } catch (error: any) {
        return `Error al obtener página web: ${error.message}`;
    }
}

// ═══════════════════════════════════════════
// Schemas para el LLM
// ═══════════════════════════════════════════

export const searchWebSchema = {
    type: 'function',
    function: {
        name: 'search_web',
        description: 'Busca en internet usando DuckDuckGo. Úsalo para encontrar información general, publicaciones recientes, páginas de autores/investigadores, instituciones, noticias científicas, o cualquier consulta que no esté en arXiv/Wolfram. NO requiere API key.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Consulta de búsqueda. Puede ser en español o inglés. Ejemplos: "Vladimir Ivancevic recent publications", "biomechanics muscle injury model 2024"'
                },
                maxResults: {
                    type: 'number',
                    description: 'Número máximo de resultados. Default 5, máximo 10.'
                }
            },
            required: ['query']
        }
    }
};

export const fetchWebPageSchema = {
    type: 'function',
    function: {
        name: 'fetch_web_page',
        description: 'Lee el contenido de texto de una URL específica. Útil para leer artículos académicos en HTML, páginas de investigadores, repositorios de código, o cualquier página web cuya URL ya conoces.',
        parameters: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'URL completa de la página a leer (debe comenzar con http:// o https://)'
                }
            },
            required: ['url']
        }
    }
};
