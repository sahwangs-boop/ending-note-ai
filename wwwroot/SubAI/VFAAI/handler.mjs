import { classifyAndRespond } from '../shared/intent.mjs';
import { answerWithMainAI } from './main-ai.mjs';
import { handleVfaAction } from './workflow.mjs';

export async function handleChat(agent, input, respond, signal) {
  if (input?.action !== undefined) return handleVfaAction(input, signal, agent.ifaFetch || fetch);
  const decision = await classifyAndRespond(agent, input, respond, signal);
  if (decision.intent === 'delegate_to_main') {
    return { message: await answerWithMainAI({ agent, ...decision.request, signal }) };
  }
  return { message: decision.message };
}
