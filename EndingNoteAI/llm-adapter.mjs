import { HttpError } from '../shared/errors.mjs';
import { ENDING_NOTE_LLM_RESPONSE_SCHEMA, validateLlmStructuredResponse } from './llm-schema.mjs';

const SYSTEM = `당신은 Ending Note AI의 정보 추출 Adapter입니다.
사용자 발언에서 삶의 기록, 유언 준비, 장례 준비, 가족 메시지 후보를 추출합니다.
한 발언에 여러 정보가 있으면 items를 여러 개 반환합니다.
사용자가 현재 질문과 다른 주제를 말하면 실제 topic과 fieldKey로 분류합니다.
필드 의미는 다음과 같습니다.
- Q-LIFE-01: 사용자가 기억되기를 바라는 모습 또는 자기 정체성
- Q-LIFE-02: 소중한 사람 또는 기억
- Q-LIFE-03: 삶의 가치관 또는 원칙
- Q-WILL-01: 재산·물건 등 남길 대상 자산
- Q-WILL-02: 받을 사람과 배분·전달 희망
- Q-WILL-03: 집행 관련 부탁 또는 특별 당부
- Q-FUNERAL-01: 장례 형식 또는 규모
- Q-FUNERAL-02: 화장·매장과 장지·안치 희망
- Q-FUNERAL-03: 종교 의식·음악·영정사진·꽃 등 세부 희망
- Q-MSG-01: 메시지를 받을 사람
- Q-MSG-02: 남기고 싶은 메시지 내용
- Q-MSG-03: 원문 유지 또는 다듬기 선호
발언에 명시된 정보만 분류하고, 같은 근거를 의미가 다른 필드에 중복 저장하지 않습니다.
현재 질문에 이미 충분히 답했다면 같은 내용을 다시 묻지 않습니다.
없는 사실은 만들지 말고 evidence는 sourceText의 정확한 연속 부분문자열과 0-based start/end를 기록합니다.
모든 추출 항목의 fieldStatus는 AI_EXTRACTED이며 requiresConfirmation은 true입니다.
법률 효력, 세금, 공증 여부를 확정하지 않습니다. 질문은 필요한 경우 한 번에 하나만 제안합니다.`;

function outputText(result) {
  return result.output.flatMap(item => item.type === 'message' && item.role === 'assistant' ? item.content ?? [] : [])
    .filter(item => item.type === 'output_text').map(item => item.text).filter(text => typeof text === 'string').join('');
}

export async function extractRemote({ agent, sourceText, questionId, currentSection, history, respond, signal }) {
  if (typeof respond !== 'function') throw new HttpError(503, 'Remote AI 연결을 사용할 수 없습니다. Mock 모드로 전환하거나 잠시 후 다시 시도해 주세요.');
  const started = Date.now();
  const result = await respond({
    instructions: `${agent.instructions}\n\n${SYSTEM}`,
    input: [
      ...history.slice(-12).map(item => ({ role: item.role, content: item.text })),
      { role: 'user', content: JSON.stringify({ currentQuestionId: questionId, currentSection, sourceText }) }
    ],
    text: { format: { type: 'json_schema', name: 'ending_note_extraction', strict: true, schema: ENDING_NOTE_LLM_RESPONSE_SCHEMA } }
  }, signal);
  const raw = outputText(result);
  if (!raw) throw new HttpError(502, 'Remote AI의 구조화 응답이 비어 있습니다. 입력 내용은 저장되지 않았습니다. 다시 시도해 주세요.');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new HttpError(502, 'Remote AI 응답을 구조화 데이터로 읽지 못했습니다. 입력 내용은 저장되지 않았습니다. 다시 시도해 주세요.'); }
  return {
    data: validateLlmStructuredResponse(parsed, sourceText),
    metrics: {
      latencyMs: Date.now() - started,
      inputTokens: Number.isInteger(result.usage?.input_tokens) ? result.usage.input_tokens : null,
      outputTokens: Number.isInteger(result.usage?.output_tokens) ? result.usage.output_tokens : null,
      totalTokens: Number.isInteger(result.usage?.total_tokens) ? result.usage.total_tokens : null
    }
  };
}

