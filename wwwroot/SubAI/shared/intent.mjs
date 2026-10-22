import { HttpError } from './errors.mjs';
import { validateChat } from './validation.mjs';

const intentTool = {
  type: 'function', name: 'classify_and_respond', strict: true,
  description: 'Agent의 담당 범위인지 분류하고 범위 안이면 답변을 생성합니다.',
  parameters: {
    type: 'object',
    properties: {
      intent: { type: 'string', enum: ['in_scope', 'delegate_to_main'] },
      message: { type: 'string' }
    },
    required: ['intent', 'message'], additionalProperties: false
  }
};

export async function classifyAndRespond(agent, input, respond, signal) {
  const request = validateChat(input);
  const result = await respond({
    instructions: `${agent.instructions}\n\n요청 처리 규칙:\n- 사용자의 질문이 위에 명시된 이 Agent의 담당 범위인지 먼저 분류하세요.\n- 담당 범위 안이면 intent를 in_scope로 하고 정중한 한국어 답변을 message에 작성하세요.\n- 담당 범위 밖이면 intent를 delegate_to_main으로 하고 message는 빈 문자열로 두세요. 범위 밖 질문에는 직접 답하지 마세요.\n- 최신 정보를 조회한 것처럼 말하거나 출처를 꾸며내지 마세요.`,
    input: JSON.stringify({ question: request.question, history: request.history }),
    tools: [intentTool], tool_choice: { type: 'function', name: 'classify_and_respond' }, parallel_tool_calls: false
  }, signal);
  const calls = result.output.filter(item => item.type === 'function_call');
  if (calls.length !== 1 || calls[0].name !== intentTool.name || typeof calls[0].arguments !== 'string') {
    throw new HttpError(502, 'Agent 의도 분류 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
  }
  let decision;
  try { decision = JSON.parse(calls[0].arguments); }
  catch { throw new HttpError(502, 'Agent 의도 분류 형식이 올바르지 않습니다.'); }
  if (!decision || Array.isArray(decision) || typeof decision !== 'object' ||
      Object.keys(decision).length !== 2 || !['in_scope', 'delegate_to_main'].includes(decision.intent) ||
      typeof decision.message !== 'string' || decision.message.length > 20000 ||
      (decision.intent === 'in_scope' && !decision.message.trim())) {
    throw new HttpError(502, 'Agent 의도 분류 결과를 확인해 주세요.');
  }
  return { ...decision, request };
}
