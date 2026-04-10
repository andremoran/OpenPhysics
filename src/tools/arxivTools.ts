/**
 * arXiv Search Tools for OpenPhysics
 * Search and retrieve physics papers from arXiv.org
 */

interface ArxivEntry {
    title: string;
    authors: string[];
    summary: string;
    published: string;
    arxivId: string;
    pdfUrl: string;
    categories: string[];
}

/**
 * Search arXiv for physics papers matching a query
 */
export async function searchArxiv(query: string, maxResults: number = 5): Promise<string> {
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`arXiv API error: ${response.status}`);
        }

        const xml = await response.text();
        const entries = parseArxivXml(xml);

        if (entries.length === 0) {
            return `No se encontraron resultados en arXiv para: "${query}"`;
        }

        let result = `📚 **Resultados de arXiv** (${entries.length} papers):\n\n`;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            result += `**${i + 1}. ${entry.title}**\n`;
            result += `   👥 ${entry.authors.slice(0, 3).join(', ')}${entry.authors.length > 3 ? ' et al.' : ''}\n`;
            result += `   📅 ${entry.published}\n`;
            result += `   🏷️ ${entry.categories.join(', ')}\n`;
            result += `   🔗 arXiv:${entry.arxivId}\n`;
            result += `   📝 ${entry.summary.substring(0, 300)}...\n\n`;
        }

        return result;
    } catch (error: any) {
        return `Error buscando en arXiv: ${error.message}`;
    }
}

/**
 * Get full details of a specific arXiv paper by ID
 */
export async function getArxivPaper(arxivId: string): Promise<string> {
    try {
        // Clean the ID
        const cleanId = arxivId.replace('arXiv:', '').replace('arxiv:', '').trim();
        const url = `http://export.arxiv.org/api/query?id_list=${cleanId}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`arXiv API error: ${response.status}`);
        }

        const xml = await response.text();
        const entries = parseArxivXml(xml);

        if (entries.length === 0) {
            return `No se encontró el paper arXiv:${cleanId}`;
        }

        const entry = entries[0];
        let result = `📄 **${entry.title}**\n\n`;
        result += `👥 **Autores:** ${entry.authors.join(', ')}\n`;
        result += `📅 **Publicado:** ${entry.published}\n`;
        result += `🏷️ **Categorías:** ${entry.categories.join(', ')}\n`;
        result += `🔗 **arXiv:** ${entry.arxivId}\n`;
        result += `📥 **PDF:** ${entry.pdfUrl}\n\n`;
        result += `**Abstract:**\n${entry.summary}\n`;

        return result;
    } catch (error: any) {
        return `Error obteniendo paper: ${error.message}`;
    }
}

/**
 * Simple XML parser for arXiv Atom feed
 */
function parseArxivXml(xml: string): ArxivEntry[] {
    const entries: ArxivEntry[] = [];

    // Split by <entry> tags
    const entryMatches = xml.split('<entry>').slice(1);

    for (const entryXml of entryMatches) {
        try {
            const title = extractTag(entryXml, 'title')?.replace(/\s+/g, ' ').trim() || '';
            const summary = extractTag(entryXml, 'summary')?.replace(/\s+/g, ' ').trim() || '';
            const published = extractTag(entryXml, 'published')?.substring(0, 10) || '';

            // Extract arxiv ID from <id> tag
            const id = extractTag(entryXml, 'id') || '';
            const arxivId = id.replace('http://arxiv.org/abs/', '').replace('https://arxiv.org/abs/', '');

            // Extract authors
            const authors: string[] = [];
            const authorMatches = entryXml.matchAll(/<name>([^<]+)<\/name>/g);
            for (const match of authorMatches) {
                authors.push(match[1].trim());
            }

            // Extract categories
            const categories: string[] = [];
            const catMatches = entryXml.matchAll(/term="([^"]+)"/g);
            for (const match of catMatches) {
                if (match[1].includes('.') || match[1].includes('-')) {
                    categories.push(match[1]);
                }
            }

            // PDF URL
            const pdfUrl = `https://arxiv.org/pdf/${arxivId}`;

            if (title && arxivId) {
                entries.push({ title, authors, summary, published, arxivId, pdfUrl, categories });
            }
        } catch (e) {
            // Skip malformed entries
        }
    }

    return entries;
}

function extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
}

// ═══════════════════════════════════════════
// Tool Schemas for LLM
// ═══════════════════════════════════════════

export const searchArxivSchema = {
    type: 'function',
    function: {
        name: 'search_arxiv',
        description: 'Search arXiv for physics papers. Use this when the user asks about recent research, papers, publications, or scientific literature. Returns titles, authors, abstracts, and arXiv IDs.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query. Can include terms, author names, or arXiv categories (e.g., "quantum entanglement", "dark energy cosmology", "cat:hep-th").'
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum number of results to return. Default 5, max 20.'
                }
            },
            required: ['query']
        }
    }
};

export const getArxivPaperSchema = {
    type: 'function',
    function: {
        name: 'get_arxiv_paper',
        description: 'Get full details of a specific arXiv paper by its ID (e.g., "2301.12345" or "hep-th/0601001"). Returns complete abstract, all authors, categories, and PDF link.',
        parameters: {
            type: 'object',
            properties: {
                arxivId: {
                    type: 'string',
                    description: 'The arXiv paper ID (e.g., "2301.12345").'
                }
            },
            required: ['arxivId']
        }
    }
};
