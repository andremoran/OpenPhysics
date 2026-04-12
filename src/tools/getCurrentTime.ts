/**
 * Returns the current date and time in the user's preferred timezone (Quito, UTC-5).
 */
export async function getCurrentTime(): Promise<string> {
    const now = new Date();
    
    // Format options for the user's locale (Quito)
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };

    const formattedDate = new Intl.DateTimeFormat('es-EC', options).format(now);
    
    return `La fecha y hora actual en Quito, Ecuador (UTC-5) es: ${formattedDate}.`;
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
