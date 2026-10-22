import { HttpError } from '../shared/errors.mjs';
import { isObject } from '../shared/validation.mjs';
import { FIELD_DEFINITIONS } from './r1-document-schema.mjs';

export const R2_INTENTS = Object.freeze(['INFORMATION', 'COMPARE', 'PLAN_CREATE', 'PLAN_UPDATE', 'PLAN_REVIEW', 'OUT_OF_SCOPE']);
const areaIds = Object.freeze(Object.keys(FIELD_DEFINITIONS));
const fieldKeys = Object.freeze([...new Set(Object.values(FIELD_DEFINITIONS).flat())]);

export const R2_RESPONSE_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'intent', 'answer', 'citations', 'notices', 'planCandidates', 'nextQuestion', 'offerToSave', 'requiresConfirmation'],
  properties: {
    schemaVersion: { type: 'string', const: 'ending-note-consultation.r2' },
    intent: { type: 'string', enum: R2_INTENTS },
    answer: { type: 'string', minLength: 1, maxLength: 4000 },
    citations: { type: 'array', description: '허용된 지식 ID만 대괄호 없이 기록', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 80 } },
    notices: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 500 } },
    planCandidates: { type: 'array', maxItems: 20, items: {
      type: 'object', additionalProperties: false,
      required: ['candidateId', 'areaId', 'fieldKey', 'value', 'evidence', 'status'],
      properties: {
        candidateId: { type: 'string', minLength: 1, maxLength: 80 },
        areaId: { type: 'string', enum: areaIds },
        fieldKey: { type: 'string', description: 'areaId에 실제로 속하는 필드만 선택', enum: fieldKeys },
        value: { type: 'string', minLength: 1, maxLength: 1500 },
        evidence: { type: 'string', minLength: 1, maxLength: 500 },
        status: { type: 'string', const: 'AI_EXTRACTED' }
      }
    } },
    nextQuestion: { type: ['string', 'null'], maxLength: 500 },
    offerToSave: { type: 'boolean' },
    requiresConfirmation: { type: 'boolean' }
  }
});

function clean(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(502, `${label} 형식을 확인하지 못했습니다.`);
  return value.trim();
}

export function validatePlanSummary(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new HttpError(400, '현재 계획 요약 형식을 확인해 주세요.');
  return value.map(item => {
    if (!isObject(item) || !areaIds.includes(item.areaId) || !FIELD_DEFINITIONS[item.areaId].includes(item.fieldKey) || typeof item.value !== 'string' || !item.value.trim() || item.value.length > 1000 || !['AI_EXTRACTED', 'USER_CONFIRMED', 'USER_EDITED', 'USER_ENTERED', 'UNDECIDED', 'SKIPPED'].includes(item.status)) throw new HttpError(400, '현재 계획 항목 형식을 확인해 주세요.');
    return { areaId: item.areaId, fieldKey: item.fieldKey, value: item.value.trim(), status: item.status };
  });
}

export function validateR2Response(value, question, allowedCitationIds) {
  const keys = ['schemaVersion', 'intent', 'answer', 'citations', 'notices', 'planCandidates', 'nextQuestion', 'offerToSave', 'requiresConfirmation'];
  if (!isObject(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key)) || value.schemaVersion !== 'ending-note-consultation.r2' || !R2_INTENTS.includes(value.intent) || typeof value.offerToSave !== 'boolean' || typeof value.requiresConfirmation !== 'boolean') throw new HttpError(502, 'R2 상담 응답 형식을 확인하지 못했습니다.');
  if (!Array.isArray(value.citations)) throw new HttpError(502, 'R2 상담 출처 목록 형식을 확인하지 못했습니다.');
  const invalidCitations = value.citations.filter(id => !allowedCitationIds.includes(id));
  if (invalidCitations.length) throw new HttpError(502, `R2 상담이 허용되지 않은 출처를 인용했습니다: ${invalidCitations.join(', ')}`);
  if (!Array.isArray(value.notices)) throw new HttpError(502, 'R2 상담 안내 목록 형식을 확인하지 못했습니다.');
  if (!Array.isArray(value.planCandidates)) throw new HttpError(502, 'R2 계획 후보 목록 형식을 확인하지 못했습니다.');
  const candidates = value.planCandidates.map(item => {
    if (!isObject(item) || !areaIds.includes(item.areaId) || !FIELD_DEFINITIONS[item.areaId].includes(item.fieldKey) || item.status !== 'AI_EXTRACTED') throw new HttpError(502, `R2 계획 후보 영역을 확인하지 못했습니다: ${item?.areaId ?? 'UNKNOWN'}.${item?.fieldKey ?? 'UNKNOWN'}`);
    const candidateValue = clean(item.value, 1500, '계획 후보');
    let evidence = clean(item.evidence, 500, '후보 근거');
    // 모델이 근거 문구를 자연스럽게 늘려 써도, 추출값 자체가 사용자 원문에
    // 정확히 존재할 때만 그 원문을 근거로 복구한다. 둘 다 없으면 계속 거부한다.
    if (!question.includes(evidence)) {
      if (question.includes(candidateValue)) evidence = candidateValue;
      else throw new HttpError(502, '계획 후보의 근거가 사용자 발언에 없습니다.');
    }
    return { candidateId: clean(item.candidateId, 80, '후보 ID'), areaId: item.areaId, fieldKey: item.fieldKey, value: candidateValue, evidence, status: 'AI_EXTRACTED', confirmedValue: null };
  });
  if (candidates.length && (!value.offerToSave || !value.requiresConfirmation)) throw new HttpError(502, '계획 후보는 저장 제안과 사용자 확인이 필요합니다.');
  if (!candidates.length && value.requiresConfirmation) throw new HttpError(502, '확인할 계획 후보가 없습니다.');
  const normalizedIntent = candidates.length && ['INFORMATION', 'COMPARE'].includes(value.intent) ? 'PLAN_CREATE' : value.intent;
  return Object.freeze({ schemaVersion: value.schemaVersion, intent: normalizedIntent, answer: clean(value.answer, 4000, '상담 답변'), citations: [...new Set(value.citations)], notices: value.notices.map(item => clean(item, 500, '안내')), planCandidates: candidates, nextQuestion: value.nextQuestion === null ? null : clean(value.nextQuestion, 500, '후속 질문'), offerToSave: value.offerToSave, requiresConfirmation: value.requiresConfirmation });
}

