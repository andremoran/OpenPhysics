import { google } from 'googleapis';
import { getAuthenticatedClient } from '../config/googleAuth.ts';

/**
 * Updates a range of values in a Google Sheet.
 */
export async function updateGoogleSheetValues(args: { spreadsheetId: string, range: string, values: any[][] }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const { spreadsheetId, range, values } = args;

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });

        return `✅ Rango ${range} actualizado en la hoja ${spreadsheetId}.`;
    } catch (error: any) {
        return `Error al actualizar hoja: ${error.message}`;
    }
}

/**
 * Gets values from a Google Sheet range.
 */
export async function getGoogleSheetValues(args: { spreadsheetId: string, range: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const { spreadsheetId, range } = args;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return `No se encontraron datos en el rango ${range}.`;

        return JSON.stringify(rows);
    } catch (error: any) {
        return `Error al obtener valores: ${error.message}`;
    }
}

/**
 * Appends rows to a Google Sheet.
 */
export async function appendSheetRows(args: { spreadsheetId: string, values: any[][], range?: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const { spreadsheetId, values, range = 'A1' } = args;

        const res = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values }
        });

        return `✅ Filas agregadas exitosamente. Rango actualizado: ${res.data.updates?.updatedRange}`;
    } catch (error: any) {
        return `Error al agregar filas: ${error.message}`;
    }
}

/**
 * Creates a brand new spreadsheet.
 */
export async function createSpreadsheet(args: { title: string, sheetTitle?: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const { title, sheetTitle = 'Sheet1' } = args;

        const res = await sheets.spreadsheets.create({
            requestBody: {
                properties: { title },
                sheets: [{ properties: { title: sheetTitle } }]
            }
        });

        return `✅ Hoja de cálculo creada exitosamente.\n- Nombre: ${res.data.properties?.title}\n- ID: ${res.data.spreadsheetId}\n- Link: ${res.data.spreadsheetUrl}`;
    } catch (error: any) {
        return `Error al crear hoja de cálculo: ${error.message}`;
    }
}

// Schemas
export const updateGoogleSheetValuesSchema = {
    type: 'function',
    function: {
        name: 'update_google_sheet_values',
        description: 'Actualiza celdas en un Google Sheet.',
        parameters: {
            type: 'object',
            properties: {
                spreadsheetId: { type: 'string', description: 'ID de la hoja' },
                range: { type: 'string', description: 'Rango A1 (ej: A1:B2)' },
                values: { type: 'array', items: { type: 'array', items: { type: ['string', 'number', 'boolean'] } } }
            },
            required: ['spreadsheetId', 'range', 'values']
        }
    }
};

export const getGoogleSheetValuesSchema = {
    type: 'function',
    function: {
        name: 'get_google_sheet_values',
        description: 'Obtiene valores de un rango en un Google Sheet.',
        parameters: {
            type: 'object',
            properties: {
                spreadsheetId: { type: 'string', description: 'ID de la hoja' },
                range: { type: 'string', description: 'Rango A1' }
            },
            required: ['spreadsheetId', 'range']
        }
    }
};

export const appendSheetRowsSchema = {
    type: 'function',
    function: {
        name: 'append_sheet_rows',
        description: 'Agrega filas al final de una hoja.',
        parameters: {
            type: 'object',
            properties: {
                spreadsheetId: { type: 'string', description: 'ID de la hoja' },
                values: { type: 'array', items: { type: 'array', items: { type: ['string', 'number', 'boolean'] } } },
                range: { type: 'string', description: 'Pestaña o rango base' }
            },
            required: ['spreadsheetId', 'values']
        }
    }
};

export const createSpreadsheetSchema = {
    type: 'function',
    function: {
        name: 'create_spreadsheet',
        description: 'Crea una nueva hoja de cálculo.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Título del archivo' },
                sheetTitle: { type: 'string', description: 'Título de la primera pestaña' }
            },
            required: ['title']
        }
    }
};
