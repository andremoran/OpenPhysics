import { google } from 'googleapis';
import { getAuthenticatedClient } from '../config/googleAuth.ts';

/**
 * Creates a brand new Google Doc with the specified title and optional initial content.
 */
export async function createGoogleDoc(args: { title: string, content?: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const docs = google.docs({ version: 'v1', auth });

        const res = await docs.documents.create({
            requestBody: {
                title: args.title
            }
        });

        const documentId = res.data.documentId;
        if (!documentId) throw new Error("Could not obtain Document ID");

        if (args.content) {
            await docs.documents.batchUpdate({
                documentId,
                requestBody: {
                    requests: [
                        {
                            insertText: {
                                location: { index: 1 },
                                text: args.content
                            }
                        }
                    ]
                }
            });
        }

        return `✅ Documento de Google creado exitosamente.\n- Título: ${res.data.title}\n- Link: https://docs.google.com/document/d/${documentId}/edit`;
    } catch (error: any) {
        console.error("Error creating Google Doc:", error);
        return `Error al crear el documento: ${error.message}`;
    }
}

/**
 * Appends text to an existing Google Doc.
 */
export async function appendToGoogleDoc(args: { documentId: string, text: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const docs = google.docs({ version: 'v1', auth });
        const { documentId, text } = args;

        const doc = await docs.documents.get({ documentId });
        const content = doc.data.body?.content;

        let endIndex = 1;
        if (content && content.length > 0) {
            const lastElement = content[content.length - 1];
            endIndex = lastElement.endIndex ? lastElement.endIndex - 1 : 1;
        }

        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: { index: endIndex },
                            text: "\n" + text
                        }
                    }
                ]
            }
        });

        return `✅ Texto añadido exitosamente al documento (ID: ${documentId}).`;
    } catch (error: any) {
        console.error("Error appending to Google Doc:", error);
        return `Error al editar el documento de Google: ${error.message}`;
    }
}

// Schemas
export const createGoogleDocSchema = {
    type: 'function',
    function: {
        name: 'create_google_doc',
        description: 'Crea un nuevo documento de texto en Google Docs con título y contenido opcional.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Título del documento' },
                content: { type: 'string', description: 'Contenido inicial (opcional)' }
            },
            required: ['title']
        }
    }
};

export const appendToGoogleDocSchema = {
    type: 'function',
    function: {
        name: 'append_to_google_doc',
        description: 'Añade texto al final de un documento de Google Docs existente.',
        parameters: {
            type: 'object',
            properties: {
                documentId: { type: 'string', description: 'ID del documento' },
                text: { type: 'string', description: 'Texto a añadir' }
            },
            required: ['documentId', 'text']
        }
    }
};
