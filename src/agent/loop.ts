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
- **Web Search** (search_web): General internet search using DuckDuckGo — use this to find recent publications, author profiles, institutions, news, or any information not in arXiv/Wolfram.
- **Fetch Web Page** (fetch_web_page): Read the text content of a specific URL.
- **arXiv**: Search for physics papers and retrieve full abstracts.
- **Physics Constants** (CODATA values), expression evaluation, unit conversion.
- **Wolfram Alpha**: Complex computations and mathematical queries.
- **LaTeX Documents** (generate_latex_document): Generate professional academic LaTeX documents with physics packages included.
- **PDF Export** (export_google_doc_as_pdf): Export a Google Doc as a PDF file (sent directly via Telegram).
- **Google Workspace**: Create and edit Google Docs, search and manage Drive files, update Google Sheets.
- **Gmail**: List, read, and send emails for research communication.

Follow the GPD research methodology:
1. SCOPE: Clarify the question, identify knowns/unknowns
2. PLAN: Break into analytical steps, identify required data
3. DERIVE: Execute steps systematically with dimensional consistency
4. VERIFY: Cross-check against limiting cases and known results
5. PACKAGE: Summarize findings, provide LaTeX-ready equations

**IMPORTANT**:
- If the user asks to search the web, find authors, or look for recent publications: use search_web first, then fetch_web_page for details.
- If the user requests a PDF: use generate_latex_document for academic content, OR create_google_doc + export_google_doc_as_pdf for Google Docs exports.
- The generate_latex_document tool saves a .tex file that is automatically sent to the user via Telegram.
- The export_google_doc_as_pdf tool generates a PDF that is automatically sent to the user via Telegram.

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
