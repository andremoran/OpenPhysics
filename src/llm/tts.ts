import fs from 'fs';
import path from 'path';
import os from 'os';
import * as googleTTS from 'google-tts-api';

/**
 * Splits text into chunks and generates a Google TTS voice note.
 * Returns the local file path to the generated MP3 file.
 */
export async function generateAudio(text: string): Promise<string | null> {
    if (!text || text.trim() === '') return null;

    console.log("[Google TTS] Generating Audio for text length:", text.length);

    try {
        const results = await googleTTS.getAllAudioBase64(text, {
            lang: 'es',
            slow: false,
            host: 'https://translate.google.com',
            splitPunct: ',.?:;'
        });

        if (!results || results.length === 0) {
            throw new Error("Google TTS returned no audio frames.");
        }

        const buffers = results.map(res => Buffer.from(res.base64, 'base64'));
        const finalBuffer = Buffer.concat(buffers);

        const tmpPath = path.join(os.tmpdir(), `physics_tts_${Date.now()}.mp3`);
        fs.writeFileSync(tmpPath, finalBuffer);
        console.log(`[Google TTS] Audio saved successfully to ${tmpPath}`);

        return tmpPath;

    } catch (error: any) {
        console.error("[Google TTS] Failed to generate audio:", error);
        return null;
    }
}
