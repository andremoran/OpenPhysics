import { chatCompletion, LLMMessage } from '../llm/provider.ts';
import { executeTool } from '../tools/index.ts';
import { getMessages, addMessage } from '../memory/firebase.ts';

import fs from 'fs';
import path from 'path';

// Load Physics Agent Persona from markdown
const personaPath = path.join(process.cwd(), 'src/config/persona.md');
let agentPersona = '';
try {
    if (fs.existsSync(personaPath)) {
        agentPersona = fs.readFileSync(personaPath, 'utf-8');
    }
} catch (e) {
    console.error("No se pudo cargar persona.md");
}

const SYSTEM_PROMPT = `
You are OpenPhysics. A specialized AI research agent for physics, inspired by Get Physics Done (GPD) by Physical Superintelligence PBC (PSI).
Your primary interface is Telegram. You are running locally and completely under the control of your user.

You have access to tools for:
- Searching arXiv for physics papers
- Looking up physical constants (CODATA values)
- Evaluating mathematical expressions with physics constants
- Converting physical units
- Querying Wolfram Alpha for computations

Follow the GPD research methodology:
1. SCOPE: Clarify the question, identify knowns/unknowns
2. PLAN: Break into analytical steps, identify required data
3. DERIVE: Execute steps systematically with dimensional consistency
4. VERIFY: Cross-check against limiting cases and known results
5. PACKAGE: Summarize findings, provide LaTeX-ready equations

Always use tools if you need real data. Keep missing evidence explicit — never invent results.
Be concise but rigorous. When presenting equations, use clear notation.
Respond in Spanish unless the physics content requires English.

---
AGENT PERSISTENT CONTEXT / PHYSICS IDENTITY:
${agentPersona}
---
`.trim();

const MAX_ITERATIONS = 20;

/**
 * The main agent loop for a user message.
 */
export async function runAgentLoop(userId: number, text: string): Promise<string> {
    // 1. Save the new user message
    await addMessage(userId, 'user', text);

    // 2. Fetch context
    const history = await getMessages(userId, 20);

    // Build messages array
    const messages: LLMMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
    }

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[Agent] User ${userId} | Iteration ${iterations}`);

        // Call LLM
        const responseMessage = await chatCompletion(messages);
        messages.push(responseMessage);

        let toolCallsToExecute = responseMessage.tool_calls || [];

        // Check if the LLM decided to call a tool
        if (toolCallsToExecute && toolCallsToExecute.length > 0) {
            console.log(`[Agent] LLM requested tools:`, toolCallsToExecute.map((tc: any) => tc.function.name));

            for (const toolCall of toolCallsToExecute) {
                const functionName = toolCall.function.name;
                const functionArgs = toolCall.function.arguments;

                console.log(`[Agent] Executing tool: ${functionName}`);
                const result = await executeTool(functionName, functionArgs, userId);
                console.log(`[Agent] Tool ${functionName} returned:`, result.substring(0, 200));

                messages.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: functionName,
                    content: result,
                });
            }
        } else {
            // No tool called — the LLM generated a final textual response
            let finalContent = responseMessage.content || '';
            if (!finalContent.trim()) {
                finalContent = "✅";
            }

            await addMessage(userId, 'assistant', finalContent);
            return finalContent;
        }
    }

    const limitReachedMsg = "Límite de iteraciones de razonamiento alcanzado. Deteniendo aquí.";
    await addMessage(userId, 'assistant', limitReachedMsg);
    return limitReachedMsg;
}
