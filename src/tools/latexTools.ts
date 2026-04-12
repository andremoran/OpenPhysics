/**
 * LaTeX and PDF Tools for OpenPhysics
 * Genera documentos LaTeX académicos y exporta Google Docs como PDF
 */

import { google } from 'googleapis';
import { getAuthenticatedClient } from '../config/googleAuth.ts';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Genera un documento LaTeX completo con estructura académica.
 * Guarda el .tex en un archivo temporal y retorna la ruta.
 */
export async function generateLatexDocument(args: {
    title: string;
    author?: string;
    content: string;
    documentClass?: string;
    packages?: string[];
}): Promise<string> {
    const {
        title,
        author = 'OpenPhysics Agent',
        content,
        documentClass = 'article',
        packages = [],
    } = args;

    // Paquetes base para física + los que pidió el agente
    const basePackages = [
        '\\usepackage[utf8]{inputenc}',
        '\\usepackage[T1]{fontenc}',
        '\\usepackage{amsmath,amssymb,amsfonts}',
        '\\usepackage{physics}',
        '\\usepackage{graphicx}',
        '\\usepackage{hyperref}',
        '\\usepackage{geometry}',
        '\\usepackage{booktabs}',
        '\\usepackage{siunitx}',
    ];
    const extraPackages = packages.map(p => `\\usepackage{${p}}`);
    const allPackages = [...new Set([...basePackages, ...extraPackages])].join('\n');

    const latex = `\\documentclass[12pt,a4paper]{${documentClass}}
${allPackages}
\\geometry{margin=2.5cm}

\\title{${escapeLaTeX(title)}}
\\author{${escapeLaTeX(author)}}
\\date{\\today}

\\begin{document}

\\maketitle

${content}

\\end{document}
`;

    const timestamp = Date.now();
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const tmpPath = path.join(os.tmpdir(), `openphysics_${safeName}_${timestamp}.tex`);
    fs.writeFileSync(tmpPath, latex, 'utf-8');

    const preview = latex.substring(0, 1200);
    return [
        `✅ **Documento LaTeX generado exitosamente**`,
        `📄 Archivo: \`${tmpPath}\``,
        `📦 Tamaño: ${latex.length} caracteres`,
        ``,
        `**Vista previa del código:**`,
        `\`\`\`latex`,
        preview,
        latex.length > 1200 ? '...[código completo en archivo]' : '',
        `\`\`\``,
        ``,
        `💡 Para compilar a PDF en terminal: \`pdflatex "${tmpPath}"\``,
    ].join('\n');
}

/**
 * Exporta un Google Doc como PDF y guarda en archivo temporal.
 * Retorna la ruta del PDF para que el bot lo envíe por Telegram.
 */
export async function exportGoogleDocAsPdf(args: { documentId: string; filename?: string }): Promise<string> {
    try {
        const auth = await getAuthenticatedClient();
        const drive = google.drive({ version: 'v3', auth });

        // Obtener metadata del archivo
        const meta = await drive.files.get({ fileId: args.documentId, fields: 'name' });
        const docName = meta.data.name || `document_${args.documentId}`;

        // Exportar como PDF
        const response = await drive.files.export(
            { fileId: args.documentId, mimeType: 'application/pdf' },
            { responseType: 'arraybuffer' }
        );

        const buffer = Buffer.from(response.data as ArrayBuffer);
        const safeName = (args.filename || docName).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
        const tmpPath = path.join(os.tmpdir(), `openphysics_${safeName}_${Date.now()}.pdf`);
        fs.writeFileSync(tmpPath, buffer);

        return [
            `✅ **PDF exportado exitosamente**`,
            `📄 Documento: "${docName}"`,
            `📁 Ruta temporal: \`${tmpPath}\``,
            `📦 Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`,
            ``,
            `SEND_FILE:${tmpPath}`,
        ].join('\n');
    } catch (error: any) {
        return `Error exportando PDF: ${error.message}`;
    }
}

/**
 * Escapa caracteres especiales de LaTeX en texto plano
 */
function escapeLaTeX(text: string): string {
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/[&%$#_{}~^]/g, '\\$&');
}

// ═══════════════════════════════════════════
// Schemas para el LLM
// ═══════════════════════════════════════════

export const generateLatexDocumentSchema = {
    type: 'function',
    function: {
        name: 'generate_latex_document',
        description: 'Genera un documento LaTeX académico completo con paquetes de física incluidos (amsmath, siunitx, physics, etc.). Ideal para papers, reportes técnicos, documentos con ecuaciones. Retorna el código LaTeX y la ruta del archivo .tex guardado.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Título del documento' },
                author: { type: 'string', description: 'Nombre del autor. Default: OpenPhysics Agent' },
                content: {
                    type: 'string',
                    description: 'Cuerpo del documento en LaTeX. Puede incluir \\section{}, \\subsection{}, ecuaciones con $ o \\begin{equation}, tablas con \\begin{table}, etc. NO incluir \\begin{document} ni el preámbulo — eso se agrega automáticamente.'
                },
                documentClass: {
                    type: 'string',
                    description: 'Clase del documento: article (default), report, book, beamer (presentaciones)'
                },
                packages: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Paquetes LaTeX adicionales a incluir (sin \\usepackage{}). Ejemplos: ["tikz", "pgfplots", "listings"]'
                }
            },
            required: ['title', 'content']
        }
    }
};

export const exportGoogleDocAsPdfSchema = {
    type: 'function',
    function: {
        name: 'export_google_doc_as_pdf',
        description: 'Exporta un Google Document existente como archivo PDF. Requiere autenticación Google activa. Retorna la ruta del PDF para enviarlo por Telegram.',
        parameters: {
            type: 'object',
            properties: {
                documentId: {
                    type: 'string',
                    description: 'ID del Google Document (la cadena alfanumérica en la URL del documento)'
                },
                filename: {
                    type: 'string',
                    description: 'Nombre personalizado para el archivo PDF (sin extensión). Opcional.'
                }
            },
            required: ['documentId']
        }
    }
};
