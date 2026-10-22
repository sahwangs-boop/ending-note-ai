import { HttpError } from '../shared/errors.mjs';
import { isObject } from '../shared/validation.mjs';

export const LLM_SCHEMA_VERSION = 'ending-note-extraction.v1';
export const TOPICS = Object.freeze(['life', 'will', 'funeral', 'message', 'mixed', 'out_of_scope']);
export const INTENTS = Object.freeze(['ANSWER', 'CHANGE_TOPIC', 'CORRECT', 'UNDECIDED', 'SKIP', 'ASK_HELP', 'OUT_OF_SCOPE']);
export const ITEM_STATUS = Object.freeze(['AI_EXTRACTED']);
export const CONFIRMATION_ACTIONS = Object.freeze(['CONFIRM', 'EDIT', 'UNDECIDED', 'SKIP']);
export const FIELD_KEYS = Object.freeze([
  'Q-LIFE-01', 'Q-LIFE-02', 'Q-LIFE-03', 'Q-WILL-01', 'Q-WILL-02', 'Q-WILL-03',
  'Q-FUNERAL-01', 'Q-FUNERAL-02', 'Q-FUNERAL-03', 'Q-MSG-01', 'Q-MSG-02', 'Q-MSG-03'
]);

// Responses API structured-output contract. Remote mode uses this contract; Mock mode remains available.
export const ENDING_NOTE_LLM_RESPONSE_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'intent', 'topic', 'sourceText', 'items', 'corrections', 'disposition', 'nextQuestion', 'requiresConfirmation'],
  properties: {
    schemaVersion: { type: 'string', const: LLM_SCHEMA_VERSION },
    intent: { type: 'string', enum: INTENTS },
    topic: { type: 'string', enum: TOPICS },
    sourceText: { type: 'string', minLength: 1, maxLength: 1000 },
    items: { type: 'array', maxItems: 20, items: {
      type: 'object', additionalProperties: false,
      required: ['candidateId', 'sectionId', 'fieldKey', 'value', 'evidence', 'fieldStatus', 'confidence', 'confirmationActions'],
      properties: {
        candidateId: { type: 'string', minLength: 1, maxLength: 80 },
        sectionId: { type: 'string', enum: ['life', 'will', 'funeral', 'message'] },
        fieldKey: { type: 'string', enum: FIELD_KEYS }, value: { type: 'string', minLength: 1, maxLength: 1000 },
        evidence: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'object', additionalProperties: false, required: ['quote', 'start', 'end'], properties: { quote: { type: 'string', minLength: 1, maxLength: 500 }, start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 1 } } } },
        fieldStatus: { type: 'string', const: 'AI_EXTRACTED' }, confidence: { type: 'number', minimum: 0, maximum: 1 },
        confirmationActions: { type: 'array', minItems: 1, items: { type: 'string', enum: CONFIRMATION_ACTIONS } }
      }
    } },
    corrections: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['targetCandidateId', 'replacementValue', 'reason'], properties: { targetCandidateId: { type: 'string', minLength: 1, maxLength: 80 }, replacementValue: { type: 'string', minLength: 1, maxLength: 1000 }, reason: { type: ['string', 'null'], maxLength: 300 } } } },
    disposition: { type: 'string', enum: ['NONE', 'UNDECIDED', 'SKIPPED'] },
    nextQuestion: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['questionId', 'text', 'reason', 'optional'], properties: { questionId: { type: 'string', minLength: 1, maxLength: 80 }, text: { type: 'string', minLength: 1, maxLength: 500 }, reason: { type: 'string', minLength: 1, maxLength: 300 }, optional: { type: 'boolean' } } }] },
    requiresConfirmation: { type: 'boolean' }
  }
});

function text(value, max, label, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(502, `${label} 형식을 확인하지 못했습니다.`);
  return value.trim();
}

function exactKeys(value, allowed, required = allowed) {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key)) && keys.every(key => allowed.includes(key));
}

function validateEvidence(value, sourceText) {
  if (!exactKeys(value, ['quote', 'start', 'end'])) throw new HttpError(502, '근거 원문 형식을 확인하지 못했습니다.');
  const quote = text(value.quote, 500, '근거 원문');
  if (!Number.isInteger(value.start) || !Number.isInteger(value.end)) throw new HttpError(502, '근거 원문의 위치 형식을 확인하지 못했습니다.');
  if (value.start >= 0 && value.end > value.start && value.end <= sourceText.length && sourceText.slice(value.start, value.end) === quote) {
    return { quote, start: value.start, end: value.end };
  }
  // 모델의 한글 code-point/code-unit 계산 차이는 신뢰하지 않고, 인용문이 실제 원문에 있을 때만 서버가 위치를 다시 계산합니다.
  const start = sourceText.indexOf(quote);
  if (start < 0) throw new HttpError(502, '근거 원문이 사용자 발언에 존재하지 않습니다.');
  return { quote, start, end: start + quote.length };
}

function validateItem(value, sourceText) {
  if (!exactKeys(value, ['candidateId', 'sectionId', 'fieldKey', 'value', 'evidence', 'fieldStatus', 'confidence', 'confirmationActions'])) {
    throw new HttpError(502, '추출 항목 형식을 확인하지 못했습니다.');
  }
  if (!['life', 'will', 'funeral', 'message'].includes(value.sectionId) || !FIELD_KEYS.includes(value.fieldKey) || value.fieldStatus !== 'AI_EXTRACTED' || typeof value.value !== 'string' || !value.value.trim() || value.value.length > 1000 || typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) {
    throw new HttpError(502, '추출 항목 값을 확인하지 못했습니다.');
  }
  const expectedSection = value.fieldKey.startsWith('Q-LIFE-') ? 'life' : value.fieldKey.startsWith('Q-WILL-') ? 'will' : value.fieldKey.startsWith('Q-FUNERAL-') ? 'funeral' : 'message';
  if (value.sectionId !== expectedSection) throw new HttpError(502, '추출 항목의 영역과 필드가 일치하지 않습니다.');
  if (!Array.isArray(value.evidence) || !value.evidence.length || value.evidence.length > 10 || !Array.isArray(value.confirmationActions) || !value.confirmationActions.length || value.confirmationActions.some(action => !CONFIRMATION_ACTIONS.includes(action))) {
    throw new HttpError(502, '추출 항목의 확인 정보가 올바르지 않습니다.');
  }
  return {
    candidateId: text(value.candidateId, 80, '후보 ID'), sectionId: value.sectionId,
    fieldKey: text(value.fieldKey, 100, '필드 키'), value: value.value.trim(),
    evidence: value.evidence.map(item => validateEvidence(item, sourceText)), fieldStatus: 'AI_EXTRACTED',
    confidence: value.confidence, confirmationActions: [...new Set(value.confirmationActions)]
  };
}

function validateCorrection(value) {
  if (!exactKeys(value, ['targetCandidateId', 'replacementValue', 'reason'])) throw new HttpError(502, '수정 요청 형식을 확인하지 못했습니다.');
  return { targetCandidateId: text(value.targetCandidateId, 80, '수정 대상'), replacementValue: text(value.replacementValue, 1000, '수정 값'), reason: text(value.reason, 300, '수정 이유', true) };
}

function validateNextQuestion(value) {
  if (value === null) return null;
  if (!exactKeys(value, ['questionId', 'text', 'reason', 'optional'])) throw new HttpError(502, '후속 질문 형식을 확인하지 못했습니다.');
  if (typeof value.optional !== 'boolean') throw new HttpError(502, '후속 질문 선택값을 확인하지 못했습니다.');
  return { questionId: text(value.questionId, 80, '후속 질문 ID'), text: text(value.text, 500, '후속 질문'), reason: text(value.reason, 300, '후속 질문 이유'), optional: value.optional };
}

export function validateLlmStructuredResponse(value, expectedSourceText) {
  const keys = ['schemaVersion', 'intent', 'topic', 'sourceText', 'items', 'corrections', 'disposition', 'nextQuestion', 'requiresConfirmation'];
  if (!exactKeys(value, keys) || value.schemaVersion !== LLM_SCHEMA_VERSION || !INTENTS.includes(value.intent) || !TOPICS.includes(value.topic) || !['NONE', 'UNDECIDED', 'SKIPPED'].includes(value.disposition) || typeof value.requiresConfirmation !== 'boolean') {
    throw new HttpError(502, 'LLM 구조화 응답 형식을 확인하지 못했습니다.');
  }
  const sourceText = text(value.sourceText, 1000, '사용자 원문');
  if (sourceText !== expectedSourceText) throw new HttpError(502, 'LLM 응답의 원문이 사용자 발언과 일치하지 않습니다.');
  if (!Array.isArray(value.items) || value.items.length > 20 || !Array.isArray(value.corrections) || value.corrections.length > 20) throw new HttpError(502, 'LLM 응답 항목 수를 확인하지 못했습니다.');
  if ((value.items.length || value.corrections.length) && value.requiresConfirmation !== true) throw new HttpError(502, '추출·수정 항목은 반드시 사용자 확인이 필요합니다.');
  if (value.items.some(item => item.fieldStatus !== 'AI_EXTRACTED')) throw new HttpError(502, 'LLM은 답변을 자동 확정할 수 없습니다.');
  return Object.freeze({
    schemaVersion: LLM_SCHEMA_VERSION, intent: value.intent, topic: value.topic, sourceText,
    items: value.items.map(item => validateItem(item, sourceText)),
    corrections: value.corrections.map(validateCorrection), disposition: value.disposition,
    nextQuestion: validateNextQuestion(value.nextQuestion), requiresConfirmation: value.requiresConfirmation
  });
}

