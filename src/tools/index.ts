import { getCurrentTime, getCurrentTimeSchema } from './getCurrentTime.ts';
import { searchArxiv, searchArxivSchema, getArxivPaper, getArxivPaperSchema } from './arxivTools.ts';
import { getPhysicsConstant, getPhysicsConstantSchema, evaluateExpression, evaluateExpressionSchema, convertUnits, convertUnitsSchema } from './physicsTools.ts';
import { queryWolfram, queryWolframSchema, queryWolframFull, queryWolframFullSchema } from './wolframTools.ts';
import { getModelPerformance, getModelPerformanceSchema } from './monitoringTools.ts';

// Google Workspace Tools
import { 
    createGoogleDoc, createGoogleDocSchema, 
    appendToGoogleDoc, appendToGoogleDocSchema
} from './googleDocsTools.ts';

import { 
    searchDriveFiles, searchDriveFilesSchema,
    readDriveFile, readDriveFileSchema,
    uploadDriveFile, uploadDriveFileSchema,
    createDriveFolder, createDriveFolderSchema,
    shareDriveFile, shareDriveFileSchema,
    copyDriveFile, copyDriveFileSchema
} from './googleDriveTools.ts';

import {
    updateGoogleSheetValues, updateGoogleSheetValuesSchema,
    getGoogleSheetValues, getGoogleSheetValuesSchema,
    appendSheetRows, appendSheetRowsSchema,
    createSpreadsheet, createSpreadsheetSchema
} from './googleSheetsTools.ts';

import {
    listEmails, listEmailsSchema,
    readEmail, readEmailSchema,
    sendEmail, sendEmailSchema
} from './gmailTools.ts';

/**
 * Registry mapping tool names to their execution functions.
 */
export const toolsRegistry: Record<string, (args: any, userId: number) => Promise<string>> = {
    // Core
    get_current_time: getCurrentTime,

    // arXiv
    search_arxiv: async (args: any) => searchArxiv(args.query, args.maxResults),
    get_arxiv_paper: async (args: any) => getArxivPaper(args.arxivId),

    // Physics Computations
    get_physics_constant: async (args: any) => getPhysicsConstant(args.name),
    evaluate_expression: async (args: any) => evaluateExpression(args.expression),
    convert_units: async (args: any) => convertUnits(args.value, args.fromUnit, args.toUnit),

    // Wolfram Alpha
    query_wolfram: async (args: any) => queryWolfram(args.query),
    query_wolfram_full: async (args: any) => queryWolframFull(args.query),

    // Monitoring
    get_model_stats: async (args: any) => getModelPerformance(args.days),

    // Google Docs
    create_google_doc: createGoogleDoc,
    append_to_google_doc: appendToGoogleDoc,

    // Google Drive
    search_drive_files: searchDriveFiles,
    read_drive_file: readDriveFile,
    upload_drive_file: uploadDriveFile,
    create_drive_folder: createDriveFolder,
    share_drive_file: shareDriveFile,
    copy_drive_file: copyDriveFile,

    // Google Sheets
    update_google_sheet_values: updateGoogleSheetValues,
    get_google_sheet_values: getGoogleSheetValues,
    append_sheet_rows: appendSheetRows,
    create_spreadsheet: createSpreadsheet,

    // Gmail
    list_emails: listEmails,
    read_email: readEmail,
    send_email: sendEmail,
};

/**
 * List of available schema definitions to pass to the LLM.
 */
export const toolsSchemas: any[] = [
    getCurrentTimeSchema,
    // arXiv
    searchArxivSchema,
    getArxivPaperSchema,
    // Physics
    getPhysicsConstantSchema,
    evaluateExpressionSchema,
    convertUnitsSchema,
    // Wolfram
    queryWolframSchema,
    queryWolframFullSchema,
    // Monitoring
    getModelPerformanceSchema,
    
    // Google Workspace
    createGoogleDocSchema,
    appendToGoogleDocSchema,
    searchDriveFilesSchema,
    readDriveFileSchema,
    uploadDriveFileSchema,
    createDriveFolderSchema,
    shareDriveFileSchema,
    copyDriveFileSchema,
    updateGoogleSheetValuesSchema,
    getGoogleSheetValuesSchema,
    appendSheetRowsSchema,
    createSpreadsheetSchema,
    listEmailsSchema,
    readEmailSchema,
    sendEmailSchema
];

/**
 * Executes a tool by name and returns its result as a string.
 */
export async function executeTool(name: string, argsStr: string, userId: number): Promise<string> {
    const toolFn = toolsRegistry[name];
    if (!toolFn) {
        return `Error: Tool ${name} not found.`;
    }

    let args = {};
    try {
        args = argsStr ? JSON.parse(argsStr) : {};
    } catch (err) {
        return `Error: Failed to parse arguments for tool ${name}.`;
    }

    try {
        const result = await toolFn(args, userId);
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
        return `Error executing tool ${name}: ${err.message}`;
    }
}
