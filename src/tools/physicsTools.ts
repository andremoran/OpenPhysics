/**
 * Physics Computation Tools for OpenPhysics
 * Mathematical computations, unit conversions, dimensional analysis, and physics constants.
 */

// ═══════════════════════════════════════════
// Physical Constants (CODATA 2018)
// ═══════════════════════════════════════════
const CONSTANTS: Record<string, { value: number; unit: string; name: string }> = {
    c: { value: 299792458, unit: 'm/s', name: 'Speed of light' },
    h: { value: 6.62607015e-34, unit: 'J·s', name: 'Planck constant' },
    hbar: { value: 1.054571817e-34, unit: 'J·s', name: 'Reduced Planck constant' },
    G: { value: 6.67430e-11, unit: 'm³/(kg·s²)', name: 'Gravitational constant' },
    kB: { value: 1.380649e-23, unit: 'J/K', name: 'Boltzmann constant' },
    e: { value: 1.602176634e-19, unit: 'C', name: 'Elementary charge' },
    me: { value: 9.1093837015e-31, unit: 'kg', name: 'Electron mass' },
    mp: { value: 1.67262192369e-27, unit: 'kg', name: 'Proton mass' },
    mn: { value: 1.67492749804e-27, unit: 'kg', name: 'Neutron mass' },
    NA: { value: 6.02214076e23, unit: 'mol⁻¹', name: 'Avogadro number' },
    R: { value: 8.314462618, unit: 'J/(mol·K)', name: 'Gas constant' },
    eps0: { value: 8.8541878128e-12, unit: 'F/m', name: 'Vacuum permittivity' },
    mu0: { value: 1.25663706212e-6, unit: 'N/A²', name: 'Vacuum permeability' },
    sigma: { value: 5.670374419e-8, unit: 'W/(m²·K⁴)', name: 'Stefan-Boltzmann constant' },
    alpha: { value: 7.2973525693e-3, unit: '(dimensionless)', name: 'Fine-structure constant' },
    Rydberg: { value: 1.0973731568160e7, unit: 'm⁻¹', name: 'Rydberg constant' },
    a0: { value: 5.29177210903e-11, unit: 'm', name: 'Bohr radius' },
    lP: { value: 1.616255e-35, unit: 'm', name: 'Planck length' },
    tP: { value: 5.391247e-44, unit: 's', name: 'Planck time' },
    mP: { value: 2.176434e-8, unit: 'kg', name: 'Planck mass' },
    TP: { value: 1.416784e32, unit: 'K', name: 'Planck temperature' },
    g: { value: 9.80665, unit: 'm/s²', name: 'Standard gravity' },
    atm: { value: 101325, unit: 'Pa', name: 'Standard atmosphere' },
};

/**
 * Look up a physical constant by name/symbol
 */
export async function getPhysicsConstant(name: string): Promise<string> {
    const key = name.trim().toLowerCase();

    // Direct match
    if (CONSTANTS[name]) {
        const c = CONSTANTS[name];
        return `🔬 **${c.name}** (${name})\n   Valor: ${c.value.toExponential(10)}\n   Unidades: ${c.unit}`;
    }

    // Search by name
    const matches = Object.entries(CONSTANTS).filter(([k, v]) =>
        k.toLowerCase().includes(key) || v.name.toLowerCase().includes(key)
    );

    if (matches.length === 0) {
        return `Constante "${name}" no encontrada. Constantes disponibles: ${Object.keys(CONSTANTS).join(', ')}`;
    }

    let result = `🔬 **Constantes encontradas:**\n\n`;
    for (const [k, v] of matches) {
        result += `• **${v.name}** (${k}) = ${v.value.toExponential(6)} ${v.unit}\n`;
    }
    return result;
}

/**
 * Evaluate a mathematical expression (safe subset)
 */
export async function evaluateExpression(expression: string): Promise<string> {
    try {
        // Replace physics constants with their numerical values
        let expr = expression;
        for (const [key, val] of Object.entries(CONSTANTS)) {
            // Replace constant name with its value (word boundary match)
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            expr = expr.replace(regex, `(${val.value})`);
        }

        // Basic safe evaluation using Function constructor
        // Only allow mathematical operations
        const sanitized = expr.replace(/[^0-9+\-*/().eE,\s^]/g, '');
        if (sanitized !== expr.replace(/\s/g, '').replace(/[^0-9+\-*/().eE,\s^]/g, '')) {
            return `⚠️ Expresión contiene caracteres no permitidos. Solo se permiten operaciones matemáticas básicas (+, -, *, /, ^, paréntesis) y constantes físicas.`;
        }

        // Replace ^ with ** for JS evaluation
        const jsExpr = sanitized.replace(/\^/g, '**');

        const result = new Function(`return ${jsExpr}`)();

        if (typeof result !== 'number' || !isFinite(result)) {
            return `⚠️ Resultado no válido (infinito o NaN). Revisa la expresión.`;
        }

        return `🧮 **Cálculo:**\n   Expresión: ${expression}\n   Resultado: **${result.toExponential(6)}**`;
    } catch (error: any) {
        return `Error evaluando expresión: ${error.message}`;
    }
}

// ═══════════════════════════════════════════
// Unit Conversion Tables
// ═══════════════════════════════════════════
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
    // Length
    m: { km: 1e-3, cm: 100, mm: 1000, um: 1e6, nm: 1e9, pm: 1e12, fm: 1e15, angstrom: 1e10, inch: 39.3701, ft: 3.28084, mile: 6.2137e-4, au: 6.685e-12, ly: 1.057e-16, pc: 3.241e-17 },
    // Mass
    kg: { g: 1000, mg: 1e6, ug: 1e9, tonne: 1e-3, lb: 2.20462, oz: 35.274, amu: 6.022e26, eV_c2: 5.609e35 },
    // Time
    s: { ms: 1000, us: 1e6, ns: 1e9, ps: 1e12, min: 1/60, hr: 1/3600, day: 1/86400, yr: 3.171e-8 },
    // Energy
    J: { eV: 6.242e18, keV: 6.242e15, MeV: 6.242e12, GeV: 6.242e9, TeV: 6.242e6, erg: 1e7, cal: 0.2390, kWh: 2.778e-7, BTU: 9.478e-4 },
    // Temperature (special handling needed for offsets)
    // Force
    N: { dyn: 1e5, kgf: 0.10197, lbf: 0.22481 },
    // Pressure
    Pa: { atm: 9.8692e-6, bar: 1e-5, torr: 7.5006e-3, psi: 1.4504e-4, mmHg: 7.5006e-3 },
    // Power
    W: { kW: 1e-3, MW: 1e-6, GW: 1e-9, hp: 1.341e-3 },
    // Frequency
    Hz: { kHz: 1e-3, MHz: 1e-6, GHz: 1e-9, THz: 1e-12 },
};

/**
 * Convert between physical units
 */
export async function convertUnits(value: number, fromUnit: string, toUnit: string): Promise<string> {
    // Find the base unit category
    for (const [base, conversions] of Object.entries(UNIT_CONVERSIONS)) {
        if (fromUnit === base && conversions[toUnit] !== undefined) {
            const result = value * conversions[toUnit];
            return `🔄 **Conversión:**\n   ${value} ${fromUnit} = **${result.toExponential(6)} ${toUnit}**`;
        }
        if (toUnit === base && conversions[fromUnit] !== undefined) {
            const result = value / conversions[fromUnit];
            return `🔄 **Conversión:**\n   ${value} ${fromUnit} = **${result.toExponential(6)} ${toUnit}**`;
        }
        if (conversions[fromUnit] !== undefined && conversions[toUnit] !== undefined) {
            // Both are in the same category, convert via base
            const inBase = value / conversions[fromUnit];
            const result = inBase * conversions[toUnit];
            return `🔄 **Conversión:**\n   ${value} ${fromUnit} = **${result.toExponential(6)} ${toUnit}**`;
        }
    }

    // Temperature special case
    if ((fromUnit === 'C' || fromUnit === 'K' || fromUnit === 'F') &&
        (toUnit === 'C' || toUnit === 'K' || toUnit === 'F')) {
        const result = convertTemperature(value, fromUnit, toUnit);
        return `🌡️ **Conversión:**\n   ${value} °${fromUnit} = **${result.toFixed(4)} °${toUnit}**`;
    }

    return `⚠️ Conversión no soportada: ${fromUnit} → ${toUnit}. Unidades disponibles: ${Object.keys(UNIT_CONVERSIONS).join(', ')} y sus derivadas.`;
}

function convertTemperature(value: number, from: string, to: string): number {
    // Convert to Kelvin first
    let kelvin: number;
    switch (from) {
        case 'C': kelvin = value + 273.15; break;
        case 'F': kelvin = (value - 32) * 5/9 + 273.15; break;
        case 'K': kelvin = value; break;
        default: return NaN;
    }
    // Convert from Kelvin to target
    switch (to) {
        case 'C': return kelvin - 273.15;
        case 'F': return (kelvin - 273.15) * 9/5 + 32;
        case 'K': return kelvin;
        default: return NaN;
    }
}

// ═══════════════════════════════════════════
// Tool Schemas
// ═══════════════════════════════════════════

export const getPhysicsConstantSchema = {
    type: 'function',
    function: {
        name: 'get_physics_constant',
        description: 'Look up a fundamental physical constant by name or symbol. Examples: "c" (speed of light), "hbar" (reduced Planck), "G" (gravitational), "kB" (Boltzmann), "me" (electron mass), "alpha" (fine-structure), etc.',
        parameters: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Name or symbol of the constant (e.g., "c", "hbar", "G", "Boltzmann", "Planck").'
                }
            },
            required: ['name']
        }
    }
};

export const evaluateExpressionSchema = {
    type: 'function',
    function: {
        name: 'evaluate_expression',
        description: 'Evaluate a mathematical expression. Supports basic arithmetic, exponents (^), and physics constants by name. Example: "hbar * c / (e^2)" or "2 * 3.14159 * 1e-10".',
        parameters: {
            type: 'object',
            properties: {
                expression: {
                    type: 'string',
                    description: 'The mathematical expression to evaluate. Can use physics constant names.'
                }
            },
            required: ['expression']
        }
    }
};

export const convertUnitsSchema = {
    type: 'function',
    function: {
        name: 'convert_units',
        description: 'Convert a value between physical units. Supports length (m, km, nm, angstrom, ly, au, pc), mass (kg, g, amu, lb), time (s, ms, ns, yr), energy (J, eV, keV, MeV, GeV, cal, kWh), temperature (C, K, F), force (N, dyn), pressure (Pa, atm, bar, torr), power (W, kW, hp), frequency (Hz, MHz, GHz, THz).',
        parameters: {
            type: 'object',
            properties: {
                value: {
                    type: 'number',
                    description: 'The numerical value to convert.'
                },
                fromUnit: {
                    type: 'string',
                    description: 'The source unit (e.g., "m", "eV", "K").'
                },
                toUnit: {
                    type: 'string',
                    description: 'The target unit (e.g., "nm", "MeV", "C").'
                }
            },
            required: ['value', 'fromUnit', 'toUnit']
        }
    }
};
