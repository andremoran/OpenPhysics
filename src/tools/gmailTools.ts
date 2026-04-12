import { google } from 'googleapis';
import { getAuthenticatedClient } from '../config/googleAuth.ts';

/**
 * Lists recent emails or searches by query.
 */
export async function listEmails(args: { query?: string, maxResults?: number }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const gmail = google.gmail({ version: 'v1', auth });

        const res = await gmail.users.messages.list({
            userId: 'me',
            q: args.query || undefined,
            maxResults: args.maxResults || 10,
        });

        const messages = res.data.messages || [];
        if (messages.length === 0) return 'No se encontraron correos.';

        const results: string[] = [];
        for (const msg of messages.slice(0, args.maxResults || 10)) {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject', 'Date'],
            });

            const headers = detail.data.payload?.headers || [];
            const from = headers.find(h => h.name === 'From')?.value || 'Desconocido';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(sin asunto)';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            const snippet = detail.data.snippet || '';

            results.push(`📧 **${subject}**\n   De: ${from}\n   Fecha: ${date}\n   ID: ${msg.id}\n   ${snippet}...`);
        }

        return results.join('\n\n');
    } catch (e: any) {
        return `Error al listar correos: ${e.message}`;
    }
}

/**
 * Reads the full content of a specific email.
 */
export async function readEmail(args: { messageId: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const gmail = google.gmail({ version: 'v1', auth });

        const res = await gmail.users.messages.get({
            userId: 'me',
            id: args.messageId,
            format: 'full',
        });

        const headers = res.data.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || 'Desconocido';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(sin asunto)';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        let body = '';
        const payload = res.data.payload;

        if (payload?.body?.data) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                    body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    break;
                }
            }
        }

        return `📧 **${subject}**\nDe: ${from}\nFecha: ${date}\n\n${body.substring(0, 3000)}`;
    } catch (e: any) {
        return `Error al leer correo: ${e.message}`;
    }
}

/**
 * Sends a new email.
 */
export async function sendEmail(args: { to: string, subject: string, body: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const gmail = google.gmail({ version: 'v1', auth });

        const raw = createRawEmail(args.to, args.subject, args.body);

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw },
        });

        return `✅ Correo enviado a ${args.to}. ID: ${res.data.id}`;
    } catch (e: any) {
        return `Error al enviar correo: ${e.message}`;
    }
}

function createRawEmail(to: string, subject: string, body: string): string {
    const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body
    ].join('\r\n');
    return Buffer.from(email).toString('base64url');
}

// Schemas
export const listEmailsSchema = {
    type: 'function',
    function: {
        name: 'list_emails',
        description: 'Lista correos de Gmail.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Búsqueda opcional' },
                maxResults: { type: 'number', description: 'Máximo de resultados (def 10)' }
            }
        }
    }
};

export const readEmailSchema = {
    type: 'function',
    function: {
        name: 'read_email',
        description: 'Lee el contenido de un email.',
        parameters: {
            type: 'object',
            properties: {
                messageId: { type: 'string', description: 'ID del mensaje' }
            },
            required: ['messageId']
        }
    }
};

export const sendEmailSchema = {
    type: 'function',
    function: {
        name: 'send_email',
        description: 'Envía un email.',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string', description: 'Destinatario' },
                subject: { type: 'string', description: 'Asunto' },
                body: { type: 'string', description: 'Cuerpo' }
            },
            required: ['to', 'subject', 'body']
        }
    }
};
