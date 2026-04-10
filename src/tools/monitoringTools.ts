import { getModelStats } from '../memory/firebase.ts';

// ═══════════════════════════════════════════
// Monitoring Tools — AI Model Performance
// ═══════════════════════════════════════════

/**
 * Gets AI model performance statistics from Firebase.
 */
export async function getModelPerformance(days: number = 7): Promise<string> {
    return await getModelStats(days);
}

export const getModelPerformanceSchema = {
    type: 'function',
    function: {
        name: 'get_model_stats',
        description: 'Obtiene estadísticas de rendimiento de los modelos de IA (tasa de éxito, latencia promedio, errores recientes). Úsala cuando el usuario pregunte cuál modelo funciona mejor o quiera ver métricas.',
        parameters: {
            type: 'object',
            properties: {
                days: {
                    type: 'number',
                    description: 'Número de días de datos a consultar. Por defecto 7.',
                }
            },
            required: []
        }
    }
};
