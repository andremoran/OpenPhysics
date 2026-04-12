import { Bot, Context, NextFunction, InputFile } from 'grammy';
import { env } from '../config/env.ts';
import { runAgentLoop } from '../agent/loop.ts';
import { transcribeAudio } from '../llm/provider.ts';
import { generateAudio } from '../llm/tts.ts';
import { clearMessages } from '../memory/firebase.ts';
import { getAuthUrl, loadToken, isGoogleOAuthConfigured } from '../config/googleAuth.ts';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

/**
 * Security Middleware: Restrict access to allowed user IDs only.
 */
async function aclMiddleware(ctx: Context, next: NextFunction) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!env.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
        console.warn(`[Security] Unauthorized access attempt by Telegram User ID: ${userId}`);
        await ctx.reply("⚛️ Access denied. Not authorized for OpenPhysics.");
        return;
    }

    await next();
}

bot.use(aclMiddleware);

// Handle the /start command
bot.command("start", async (ctx) => {
    await ctx.reply(
        "⚛️ **OpenPhysics activo.**\n\n" +
        "Soy tu asistente de investigación en física, inspirado en GPD (Get Physics Done).\n\n" +
        "**Herramientas disponibles:**\n" +
        "🔍 Búsqueda de papers en arXiv\n" +
        "🔬 Constantes físicas (CODATA)\n" +
        "🧮 Evaluación de expresiones matemáticas\n" +
        "🔄 Conversión de unidades físicas\n" +
        "🐺 Wolfram Alpha\n" +
        "📝 **Google Workspace (Docs/Drive)** para reportes y almacenamiento\n\n" +
        "**Comandos:**\n" +
        "`/clear` — Limpiar historial\n" +
        "`/login` — Conectar Google Workspace\n\n" +
        "**Metodología GPD:**\n" +
        "Scope → Plan → Derive → Verify → Package",
        { parse_mode: "Markdown" }
    );
});

// Handle /clear command to reset memory
bot.command("clear", async (ctx) => {
    const userId = ctx.from!.id;
    await clearMessages(userId);
    await ctx.reply("🧹 Memoria limpia. Nueva sesión de investigación.");
});

// Handle /login command for Google OAuth
bot.command("login", async (ctx) => {
    if (!isGoogleOAuthConfigured()) {
        await ctx.reply("Google OAuth no está configurado en las variables de entorno.");
        return;
    }

    const token = await loadToken();
    const url = getAuthUrl();

    if (token) {
        await ctx.reply(
            `📌 Ya existe un token de Google guardado. Si necesitas renovar permisos:\n\n🔗 ${url}`
        );
    } else {
        await ctx.reply(
            `Para dar acceso a Google Workspace a OpenPhysics:\n\n🔗 ${url}`
        );
    }
});

// Main message handler
bot.on("message:text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    await ctx.replyWithChatAction("typing");

    try {
        const answer = await runAgentLoop(userId, text);

        if (answer.length > 4000) {
            // Split long messages
            for (let i = 0; i < answer.length; i += 4000) {
                await ctx.reply(answer.slice(i, i + 4000));
            }
        } else {
            await ctx.reply(answer);
        }

    } catch (error: any) {
        console.error(`[Error] processing message for ${userId}:`, error.message);
        await ctx.reply(`❌ Error: ${error.message}`);
    }
});

// Handle voice/audio messages
bot.on(["message:voice", "message:audio"], async (ctx) => {
    const userId = ctx.from.id;
    await ctx.replyWithChatAction("typing");

    try {
        const file = await ctx.getFile();
        const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const tmpPath = path.join(os.tmpdir(), `physics_voice_${userId}_${Date.now()}.ogg`);
        fs.writeFileSync(tmpPath, buffer);

        const processingMsg = await ctx.reply("<i>🎧 Escuchando audio...</i>", { parse_mode: "HTML" });

        const transcribedText = await transcribeAudio(tmpPath);
        fs.unlinkSync(tmpPath);

        if (!transcribedText || transcribedText.trim() === '') {
            await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, "<i>No se detectó voz.</i>", { parse_mode: "HTML" });
            return;
        }

        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, `<i>🗣️ Transcrito: ${transcribedText}</i>`, { parse_mode: "HTML" });

        await ctx.replyWithChatAction("typing");
        const answer = await runAgentLoop(userId, `(Mensaje de voz transcrito): ${transcribedText}`);

        await ctx.replyWithChatAction("record_voice");
        const audioPath = await generateAudio(answer);

        if (audioPath) {
            await ctx.replyWithVoice(new InputFile(fs.createReadStream(audioPath)));
            const textLabel = `📝 *Transcripción del agente:*\n${answer.substring(0, 3900)}`;
            await ctx.reply(textLabel, { parse_mode: "Markdown" });
            fs.unlinkSync(audioPath);
        } else {
            if (answer.length > 4000) {
                await ctx.reply(answer.substring(0, 4000) + "\n...[truncated]");
            } else {
                await ctx.reply(answer);
            }
        }

    } catch (error: any) {
        console.error(`[Error] processing audio for ${userId}:`, error.message);
        await ctx.reply(`❌ Error de transcripción: ${error.message}`);
    }
});

// Handle generic files (documents and photos)
bot.on(["message:document", "message:photo"], async (ctx) => {
    const userId = ctx.from.id;
    await ctx.replyWithChatAction("typing");

    try {
        const fileObj = ctx.message.document || (ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1] : null);
        if (!fileObj) return;

        const file = await ctx.api.getFile(fileObj.file_id);
        const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = ctx.message.document?.file_name || `physics_file_${Date.now()}.dat`;
        const tmpPath = path.join(os.tmpdir(), `upload_${userId}_${fileName}`);
        fs.writeFileSync(tmpPath, buffer);

        const processingMsg = await ctx.reply(`<i>📥 Recibí "${fileName}". Analizando...</i>`, { parse_mode: "HTML" });

        const systemPromptInjection = `(El usuario envió un archivo. Nombre: "${fileName}". Ruta temporal: "${tmpPath}".)`;
        const answer = await runAgentLoop(userId, systemPromptInjection + (ctx.message.caption ? ` Mensaje adjunto: ${ctx.message.caption}` : ''));

        try {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
        } catch (e) { }

        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, `✅ Recibido.\n\n${answer}`);

    } catch (error: any) {
        console.error(`[Error] processing document for ${userId}:`, error.message);
        await ctx.reply(`❌ Error procesando archivo: ${error.message}`);
    }
});
