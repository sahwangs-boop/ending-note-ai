import { classifyAndRespond } from '../shared/intent.mjs';
import { answerWithMainAI } from './main-ai.mjs';

export async function handleChat(agent, input, respond, signal) {
  const decision = await classifyAndRespond(agent, input, respond, signal);
  if (decision.intent === 'delegate_to_main') {
    return { message: await answerWithMainAI({ agent, ...decision.request, signal }) };
  }
  return { message: decision.message };
}
