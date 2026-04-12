import { google } from 'googleapis';
import { getAuthenticatedClient } from '../config/googleAuth.ts';

/**
 * Creates a new Google Document with the provided title and content.
 */
export async function createGoogleDoc(args: { title: string, content: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const docs = google.docs({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });

        // First, create a blank document
        const doc = await docs.documents.create({
            requestBody: {
                title: args.title,
            },
        });

        const documentId = doc.data.documentId;
        if (!documentId) throw new Error("Could not create document ID");

        // Then, insert the content
        // Note: Google Docs API uses 'requests' to batch updates
        await docs.documents.batchUpdate({
            documentId: documentId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: {
                                index: 1,
                            },
                            text: args.content,
                        },
                    },
                ],
            },
        });

        return `Successfully created Google Doc: "${args.title}"\nURL: https://docs.google.com/document/d/${documentId}/edit`;
    } catch (e: any) {
        return `Error creating Google Doc: ${e.message}`;
    }
}

export const createGoogleDocSchema = {
    type: 'function',
    function: {
        name: 'create_google_doc',
        description: 'Create a new Google Document for research notes, derivations, or reports. This is the preferred way to "Package" your results.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'The title of the document' },
                content: { type: 'string', description: 'The text content to populate the document with. Supports standard text and LaTeX-style notation.' },
            },
            required: ['title', 'content'],
        },
    },
};

/**
 * Searches Google Drive for files.
 */
export async function searchGoogleDrive(args: { query: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const drive = google.drive({ version: 'v3', auth });

        const res = await drive.files.list({
            q: `name contains '${args.query}'`,
            fields: 'files(id, name, webViewLink)',
            pageSize: 5
        });

        const files = res.data.files || [];
        if (files.length === 0) return "No files found on Google Drive matching that query.";

        return files.map(f => `- ${f.name} (ID: ${f.id})\n  Link: ${f.webViewLink}`).join('\n');
    } catch (e: any) {
        return `Error searching Google Drive: ${e.message}`;
    }
}

export const searchGoogleDriveSchema = {
    type: 'function',
    function: {
        name: 'search_google_drive',
        description: 'Search for files in the user\'s Google Drive by name.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Substring to search for in file names' },
            },
            required: ['query'],
        },
    },
};
