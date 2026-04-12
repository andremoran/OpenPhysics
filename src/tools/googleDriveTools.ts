import { google } from 'googleapis';
import { getAuthenticatedClient } from '../config/googleAuth.ts';
import fs from 'fs';

/**
 * Searches for files in Google Drive.
 */
export async function searchDriveFiles(args: { query?: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const drive = google.drive({ version: 'v3', auth });
        const query = args.query || "";

        const params: any = {
            pageSize: 10,
            fields: 'nextPageToken, files(id, name, mimeType, webViewLink, createdTime)',
        };

        if (query.trim() !== "") {
            if (query.includes('=')) {
                params.q = query;
            } else {
                params.q = `name contains '${query}'`;
            }
        }

        const res = await drive.files.list(params);
        const files = res.data.files;

        if (!files || files.length === 0) {
            return "No se encontraron archivos en Google Drive con esa búsqueda.";
        }

        let output = "Archivos encontrados en Google Drive:\n";
        files.forEach((file) => {
            output += `- ${file.name} (Tipo: ${file.mimeType})\n  ID: ${file.id}\n  Link: ${file.webViewLink}\n`;
        });

        return output;
    } catch (error: any) {
        console.error("Error searching Drive files:", error);
        return `Error al acceder a Google Drive: ${error.message}`;
    }
}

/**
 * Reads the text content of a Google Doc or plain text file from Drive.
 */
export async function readDriveFile(args: { fileId: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const drive = google.drive({ version: 'v3', auth });
        const fileId = args.fileId;

        const fileMeta = await drive.files.get({ fileId, fields: 'mimeType, name' });
        const mimeType = fileMeta.data.mimeType;

        if (mimeType === 'application/vnd.google-apps.document') {
            const res = await drive.files.export(
                { fileId, mimeType: 'text/plain' },
                { responseType: 'text' }
            );
            return `Contenido del documento "${fileMeta.data.name}":\n\n${res.data}`;
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            const res = await drive.files.export(
                { fileId, mimeType: 'text/csv' },
                { responseType: 'text' }
            );
            return `Contenido de la hoja de cálculo "${fileMeta.data.name}":\n\n${res.data}`;
        } else if (typeof mimeType === 'string' && mimeType.startsWith('text/')) {
            const res = await drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'text' }
            );
            return `Contenido del archivo "${fileMeta.data.name}":\n\n${res.data}`;
        } else {
            return `El archivo "${fileMeta.data.name}" no es de un formato que este bot pueda leer en texto puro (MimeType: ${mimeType}).`;
        }
    } catch (error: any) {
        console.error("Error reading Drive file:", error);
        return `Error al leer el archivo de Google Drive: ${error.message}`;
    }
}

/**
 * Uploads a local file to Google Drive.
 */
export async function uploadDriveFile(args: { localPath: string, fileName: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata = { name: args.fileName };
        const media = {
            body: fs.createReadStream(args.localPath)
        };

        const res = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink'
        });

        return `✅ Archivo subido exitosamente a Google Drive.\n- Nombre: ${res.data.name}\n- ID: ${res.data.id}\n- Link: ${res.data.webViewLink}`;
    } catch (error: any) {
        console.error("Error uploading to Drive:", error);
        return `Error al subir el archivo a Google Drive: ${error.message}`;
    }
}

/**
 * Creates a new folder in Google Drive.
 */
export async function createDriveFolder(args: { folderName: string, parentFolderId?: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const drive = google.drive({ version: 'v3', auth });
        const fileMetadata: any = {
            name: args.folderName,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (args.parentFolderId) {
            fileMetadata.parents = [args.parentFolderId];
        }
        const res = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id, name, webViewLink'
        });
        return `✅ Carpeta creada exitosamente.\n- Nombre: ${res.data.name}\n- ID: ${res.data.id}\n- Link: ${res.data.webViewLink}`;
    } catch (error: any) {
        console.error("Error creating folder:", error);
        return `Error al crear carpeta: ${error.message}`;
    }
}

/**
 * Shares a file or folder.
 */
export async function shareDriveFile(args: { fileId: string, role?: string, email?: string, anyone?: boolean }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const drive = google.drive({ version: 'v3', auth });

        const permission: any = {
            type: args.anyone ? 'anyone' : 'user',
            role: args.role || 'reader'
        };
        if (!args.anyone && args.email) {
            permission.emailAddress = args.email;
        }

        await drive.permissions.create({
            fileId: args.fileId,
            requestBody: permission,
            fields: 'id',
        });

        const res = await drive.files.get({ fileId: args.fileId, fields: 'webViewLink' });
        return `✅ Permisos actualizados exitosamente para el archivo. Link: ${res.data.webViewLink}`;
    } catch (error: any) {
        console.error("Error sharing file:", error);
        return `Error al compartir archivo: ${error.message}`;
    }
}

/**
 * Copies a file.
 */
export async function copyDriveFile(args: { fileId: string, newName?: string, targetFolderId?: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata: any = {};
        if (args.newName) fileMetadata.name = args.newName;
        if (args.targetFolderId) fileMetadata.parents = [args.targetFolderId];

        const res = await drive.files.copy({
            fileId: args.fileId,
            requestBody: fileMetadata,
            fields: 'id, name, webViewLink'
        });
        return `✅ Archivo copiado exitosamente.\n- Nombre: ${res.data.name}\n- ID: ${res.data.id}\n- Link: ${res.data.webViewLink}`;
    } catch (error: any) {
        console.error("Error copying file:", error);
        return `Error al copiar archivo: ${error.message}`;
    }
}

// Schemas
export const searchDriveFilesSchema = {
    type: 'function',
    function: {
        name: 'search_drive_files',
        description: 'Busca archivos en Google Drive por nombre o consulta.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Término de búsqueda' }
            }
        }
    }
};

export const readDriveFileSchema = {
    type: 'function',
    function: {
        name: 'read_drive_file',
        description: 'Lee el contenido de un archivo de Drive (Doc, Sheet, Plan de texto).',
        parameters: {
            type: 'object',
            properties: {
                fileId: { type: 'string', description: 'ID del archivo' }
            },
            required: ['fileId']
        }
    }
};

export const uploadDriveFileSchema = {
    type: 'function',
    function: {
        name: 'upload_drive_file',
        description: 'Sube un archivo local a Google Drive.',
        parameters: {
            type: 'object',
            properties: {
                localPath: { type: 'string', description: 'Ruta local' },
                fileName: { type: 'string', description: 'Nombre en Drive' }
            },
            required: ['localPath', 'fileName']
        }
    }
};

export const createDriveFolderSchema = {
    type: 'function',
    function: {
        name: 'create_drive_folder',
        description: 'Crea una carpeta en Drive.',
        parameters: {
            type: 'object',
            properties: {
                folderName: { type: 'string', description: 'Nombre de la carpeta' },
                parentFolderId: { type: 'string', description: 'ID de la carpeta padre (opcional)' }
            },
            required: ['folderName']
        }
    }
};

export const shareDriveFileSchema = {
    type: 'function',
    function: {
        name: 'share_drive_file',
        description: 'Comparte un archivo de Drive.',
        parameters: {
            type: 'object',
            properties: {
                fileId: { type: 'string', description: 'ID del archivo' },
                role: { type: 'string', description: 'reader, commenter, writer' },
                email: { type: 'string', description: 'Email (si anyone es false)' },
                anyone: { type: 'boolean', description: 'Cualquier persona con el link' }
            },
            required: ['fileId']
        }
    }
};

export const copyDriveFileSchema = {
    type: 'function',
    function: {
        name: 'copy_drive_file',
        description: 'Copia un archivo de Drive.',
        parameters: {
            type: 'object',
            properties: {
                fileId: { type: 'string', description: 'ID del archivo original' },
                newName: { type: 'string', description: 'Nuevo nombre' },
                targetFolderId: { type: 'string', description: 'ID carpeta destino' }
            },
            required: ['fileId']
        }
    }
};
