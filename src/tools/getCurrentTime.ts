/**
 * Returns the current date and time in ISO format.
 */
export async function getCurrentTime(): Promise<string> {
    const now = new Date();
    return `ISO: ${now.toISOString()}\nFormatted: ${now.toLocaleString('es-ES', { timeZone: 'America/Lima' })} (America/Lima)\nLocal (Server): ${now.toLocaleString()}`;
}

export const getCurrentTimeSchema = {
    type: 'function',
    function: {
        name: 'get_current_time',
        description: 'Get the current local date and time. Useful when you need to know what day or time it is right now.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
};
