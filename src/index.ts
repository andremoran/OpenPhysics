import express from 'express';
import { bot } from './bot/telegram.ts';
import { getOAuth2Client, saveToken } from './config/googleAuth.ts';
import { env } from './config/env.ts';
import './memory/firebase.ts'; // Initialize DB connection

console.log("-----------------------------------------");
console.log("⚛️  Starting OpenPhysics Agent...");
console.log("   Inspired by Get Physics Done (GPD)");
console.log("   by Physical Superintelligence PBC");
console.log("-----------------------------------------");
console.log(`Allowed Users: ${env.TELEGRAM_ALLOWED_USER_IDS.join(', ')}`);
console.log("-----------------------------------------");

// Handle errors gracefully to prevent crashing
bot.catch((err) => {
    console.error(`[Global Telegram Error]:`, err);
});

// Start long polling for Telegram
bot.start({
    onStart: (botInfo) => {
        console.log(`[Telegram] Successfully connected as @${botInfo.username}`);
    }
});

// --- Web Service Keep-Alive for Render ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('⚛️ OpenPhysics is alive and running! Powered by GPD methodology.');
});

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
        res.status(400).send("No code provided.");
        return;
    }

    try {
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        await saveToken(tokens);

        console.log("Successfully authenticated with Google OAuth!");
        res.send("¡Autenticación exitosa! OpenPhysics ahora tiene acceso a tus documentos. Puedes cerrar esta ventana.");
    } catch (e: any) {
        console.error("Error exchanging code for token:", e.message);
        res.status(500).send("Error autenticando: " + e.message);
    }
});

app.listen(PORT, () => {
    console.log(`[Web] Keep-Alive server listening on port ${PORT}`);
});

/**
 * Handle graceful shutdowns
 */
process.once("SIGINT", () => {
    console.log("Stopping bot...");
    bot.stop();
});
process.once("SIGTERM", () => {
    console.log("Stopping bot...");
    bot.stop();
});
