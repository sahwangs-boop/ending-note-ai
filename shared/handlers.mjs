import { HttpError } from './errors.mjs';
import { validateChat } from './validation.mjs';

export async function handleChat(agent, input, respond, signal) {
  if (agent.handleChat) return agent.handleChat(agent, input, respond, signal);

  const request = validateChat(input);
  const result = await respond({
    instructions: agent.instructions,
    input: [...request.history.map(item => ({ role: item.role, content: item.text })), { role: 'user', content: request.question }]
  }, signal);
  const text = result.output.filter(item => item.type === 'message' && item.role === 'assistant')
    .flatMap(item => item.content ?? []).filter(item => ['output_text', 'refusal'].includes(item.type))
    .map(item => item.type === 'refusal' ? item.refusal : item.text).filter(item => typeof item === 'string').join('\n');
  if (!text.trim() || text.length > 20000) throw new HttpError(502, 'LLM 답변 형식을 확인하지 못했습니다. 다시 시도해 주세요.');
  return { message: text };
}
