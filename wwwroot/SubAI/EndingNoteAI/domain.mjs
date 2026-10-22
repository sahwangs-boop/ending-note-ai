import { HttpError } from '../shared/errors.mjs';
import { isObject } from '../shared/validation.mjs';

export const FIELD_STATUS = Object.freeze([
  'AI_EXTRACTED', 'USER_CONFIRMED', 'USER_EDITED', 'USER_ENTERED',
  'UNDECIDED', 'SKIPPED', 'NOT_APPLICABLE', 'INVALIDATED'
]);
export const SECTION_STATUS = Object.freeze(['NOT_STARTED', 'IN_PROGRESS', 'REVIEW_REQUIRED', 'CONFIRMED', 'PAUSED']);
export const CONVERSATION_STATUS = Object.freeze(['ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED']);
export const SCREENS = Object.freeze(['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09']);
export const PERSON_DECISIONS = Object.freeze(['SAME_PERSON', 'DIFFERENT_PERSON', 'LATER']);
export const SUGGESTION_STATUS = Object.freeze(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED']);
export const CONFLICT_DECISIONS = Object.freeze(['KEEP_A', 'KEEP_B', 'BOTH_UNDECIDED', 'EDIT']);

export const SECTIONS = Object.freeze({
  life: Object.freeze({
    title: '삶의 기록',
    questions: Object.freeze([
      Object.freeze({ id: 'Q-LIFE-01', text: '가족이 나를 어떤 사람으로 기억하면 좋겠나요? 짧게 말해도 괜찮아요.' }),
      Object.freeze({ id: 'Q-LIFE-02', text: '꼭 남기고 싶은 사람이나 기억에 남는 순간이 있나요?' }),
      Object.freeze({ id: 'Q-LIFE-03', text: '살아오며 중요하게 여긴 가치나 가족에게 전하고 싶은 삶의 원칙이 있나요?' })
    ])
  }),
  will: Object.freeze({
    title: '유언 준비',
    questions: Object.freeze([
      Object.freeze({ id: 'Q-WILL-01', text: '정리해 두고 싶은 재산이나 소중한 물건이 있나요? 목록만 만들어도 괜찮아요.' }),
      Object.freeze({ id: 'Q-WILL-02', text: '그 재산을 누구에게 어떻게 남기고 싶은지 정해두셨나요, 아니면 아직 미정인가요?' }),
      Object.freeze({ id: 'Q-WILL-03', text: '유언을 맡아 확인할 사람이나 재산 외에 남기고 싶은 요청이 있나요?' })
    ])
  }),
  funeral: Object.freeze({
    title: '장례 준비',
    questions: Object.freeze([
      Object.freeze({ id: 'Q-FUNERAL-01', text: '어떤 형태와 규모의 장례가 편하신가요? 아직 미정이어도 괜찮아요.' }),
      Object.freeze({ id: 'Q-FUNERAL-02', text: '화장·매장과 이후 안치 방법에 대해 생각해 두신 것이 있나요?' }),
      Object.freeze({ id: 'Q-FUNERAL-03', text: '종교 의식, 음악, 사진, 꽃 등 꼭 지키고 싶은 요청이 있나요?' })
    ])
  }),
  message: Object.freeze({
    title: '가족 메시지',
    questions: Object.freeze([
      Object.freeze({ id: 'Q-MSG-01', text: '누구에게 메시지를 남기고 싶으세요?' }),
      Object.freeze({ id: 'Q-MSG-02', text: '그분에게 가장 먼저 전하고 싶은 말을 편하게 적어주세요. 짧아도 괜찮아요.' }),
      Object.freeze({ id: 'Q-MSG-03', text: '이 내용을 그대로 남길까요, 아니면 AI가 문장을 다듬은 제안도 보여드릴까요?' })
    ])
  })
});

export const DETAIL_QUESTIONS = Object.freeze({
  'D-LIFE-02': Object.freeze({ sectionId: 'life', text: '그 순간이 특별했던 이유를 한 가지만 더 들려주시겠어요?' }),
  'D-WILL-01': Object.freeze({ sectionId: 'will', text: '지금은 정확한 금액 없이, 각 항목을 구분할 이름만 더 적어주시겠어요?' }),
  'D-WILL-02': Object.freeze({ sectionId: 'will', text: '대상과 희망 내용을 한 문장씩 구분해 주시겠어요? 법적 배분을 확정하는 단계는 아닙니다.' }),
  'D-FUNERAL-01': Object.freeze({ sectionId: 'funeral', text: '참석 범위나 규모에 대해 한 가지 더 정하고 싶은 내용이 있나요?' }),
  'D-FUNERAL-02': Object.freeze({ sectionId: 'funeral', text: '장법 이후의 안치 장소는 정하셨나요, 아니면 미정으로 둘까요?' }),
  'D-FUNERAL-03': Object.freeze({ sectionId: 'funeral', text: '그중 반드시 지켜주었으면 하는 한 가지가 있나요?' }),
  'D-MSG-01': Object.freeze({ sectionId: 'message', text: '같은 관계의 사람이 여럿이라면 가상 별칭으로 구분해 주시겠어요?' }),
  'D-MSG-03': Object.freeze({ sectionId: 'message', text: '문장을 담백하게 정리할까요, 따뜻하게 정리할까요?' })
});

const fieldTransitions = Object.freeze({
  AI_EXTRACTED: ['USER_CONFIRMED', 'USER_EDITED', 'UNDECIDED', 'SKIPPED', 'INVALIDATED'],
  USER_CONFIRMED: ['USER_EDITED', 'UNDECIDED', 'INVALIDATED'],
  USER_EDITED: ['USER_EDITED', 'UNDECIDED', 'INVALIDATED'],
  USER_ENTERED: ['USER_EDITED', 'UNDECIDED', 'INVALIDATED'],
  UNDECIDED: ['AI_EXTRACTED', 'USER_ENTERED', 'SKIPPED'],
  SKIPPED: ['AI_EXTRACTED', 'USER_ENTERED', 'UNDECIDED'],
  NOT_APPLICABLE: ['AI_EXTRACTED', 'USER_ENTERED'],
  INVALIDATED: []
});
const sectionTransitions = Object.freeze({
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW_REQUIRED', 'PAUSED'],
  REVIEW_REQUIRED: ['IN_PROGRESS', 'CONFIRMED', 'PAUSED'],
  CONFIRMED: ['IN_PROGRESS'],
  PAUSED: ['IN_PROGRESS']
});
const conversationTransitions = Object.freeze({
  ACTIVE: ['PAUSED', 'COMPLETED', 'ABANDONED'],
  PAUSED: ['ACTIVE', 'ABANDONED'],
  COMPLETED: ['ACTIVE'],
  ABANDONED: ['ACTIVE']
});

export function canTransition(kind, from, to) {
  const table = kind === 'field' ? fieldTransitions : kind === 'section' ? sectionTransitions : kind === 'conversation' ? conversationTransitions : null;
  return Boolean(table?.[from]?.includes(to));
}

export function assertTransition(kind, from, to) {
  if (!canTransition(kind, from, to)) throw new HttpError(400, `허용되지 않은 ${kind} 상태 전이입니다.`);
  return { kind, from, to };
}

export function questionById(questionId) {
  for (const [sectionId, section] of Object.entries(SECTIONS)) {
    const question = section.questions.find(item => item.id === questionId);
    if (question) return { ...question, sectionId };
  }
  const detail = DETAIL_QUESTIONS[questionId];
  if (detail) return { id: questionId, ...detail };
  return null;
}

function safeText(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `${label} 형식을 확인해 주세요.`);
  return value.trim().replace(/\s+/g, ' ');
}

export function validateReviewCommand(value) {
  if (!isObject(value)) throw new HttpError(400, '검토 요청 형식을 확인해 주세요.');
  const question = questionById(value.questionId);
  if (!question || !FIELD_STATUS.includes(value.fromStatus) || !FIELD_STATUS.includes(value.targetStatus)) {
    throw new HttpError(400, '검토 상태값을 확인해 주세요.');
  }
  assertTransition('field', value.fromStatus, value.targetStatus);
  const confirmedValue = value.confirmedValue === null ? null : safeText(value.confirmedValue, 1000, '확정 답변');
  if (['USER_CONFIRMED', 'USER_EDITED', 'USER_ENTERED'].includes(value.targetStatus) && !confirmedValue) {
    throw new HttpError(400, '확정할 답변을 입력해 주세요.');
  }
  return { questionId: value.questionId, sectionId: question.sectionId, fromStatus: value.fromStatus, targetStatus: value.targetStatus, confirmedValue };
}

export function validatePersonResolution(value) {
  if (!isObject(value) || !PERSON_DECISIONS.includes(value.decision)) throw new HttpError(400, '인물 확인 요청 형식을 확인해 주세요.');
  return { candidateId: safeText(value.candidateId, 80, '인물 후보'), decision: value.decision };
}

export function validateSuggestionResolution(value) {
  if (!isObject(value) || !['ACCEPTED', 'REJECTED'].includes(value.status)) throw new HttpError(400, '영역 간 제안 요청 형식을 확인해 주세요.');
  return { suggestionId: safeText(value.suggestionId, 80, '제안'), status: value.status };
}

export function validateConflictResolution(value) {
  if (!isObject(value) || !CONFLICT_DECISIONS.includes(value.decision)) throw new HttpError(400, '충돌 확인 요청 형식을 확인해 주세요.');
  return { conflictId: safeText(value.conflictId, 80, '충돌 항목'), decision: value.decision };
}

export function validateDocumentRequest(value) {
  if (!isObject(value) || !Number.isInteger(value.nextVersion) || value.nextVersion < 1 || value.nextVersion > 9999 || typeof value.includeUnresolved !== 'boolean') {
    throw new HttpError(400, '문서 저장 요청 형식을 확인해 주세요.');
  }
  if (!isObject(value.sectionCounts) || Object.keys(SECTIONS).some(id => !Number.isInteger(value.sectionCounts[id]) || value.sectionCounts[id] < 0 || value.sectionCounts[id] > 100)) {
    throw new HttpError(400, '문서 영역 요약을 확인해 주세요.');
  }
  return { nextVersion: value.nextVersion, includeUnresolved: value.includeUnresolved, sectionCounts: Object.fromEntries(Object.keys(SECTIONS).map(id => [id, value.sectionCounts[id]])) };
}

const sensitivePattern = /\b\d{6}\s*[- ]?\s*[1-4]\d{6}\b|\b\d{2,4}-\d{3,4}-\d{4}\b|\b\d{2,4}-\d{2,6}-\d{2,6}\b/;

export function extractMock(questionId, sourceText) {
  const question = questionById(questionId);
  if (!question) throw new HttpError(400, '알 수 없는 질문입니다.');
  const normalized = safeText(sourceText, 1000, '답변');
  if (sensitivePattern.test(normalized)) throw new HttpError(400, 'Mock에는 주민등록번호·전화번호·계좌번호처럼 보이는 정보를 입력하지 마세요. 가상 표현으로 바꿔 주세요.');
  return Object.freeze({
    questionId,
    sectionId: question.sectionId,
    rawAnswer: sourceText,
    extractedValue: normalized,
    fieldStatus: 'AI_EXTRACTED',
    confidence: null
  });
}

const conditionalRules = Object.freeze({
  'Q-LIFE-02': { pattern: /여행|학교|직장|결혼|가족|친구|부모|자녀|추억|기억/, id: 'D-LIFE-02', text: '그 순간이 특별했던 이유를 한 가지만 더 들려주시겠어요?' },
  'Q-WILL-01': { pattern: /집|아파트|토지|예금|보험|주식|물건|반지|시계|재산/, id: 'D-WILL-01', text: '지금은 정확한 금액 없이, 각 항목을 구분할 이름만 더 적어주시겠어요?' },
  'Q-WILL-02': { pattern: /배우자|자녀|아들|딸|가족|친구|지인|기부|나누|절반|비율/, id: 'D-WILL-02', text: '대상과 희망 내용을 한 문장씩 구분해 주시겠어요? 법적 배분을 확정하는 단계는 아닙니다.' },
  'Q-FUNERAL-01': { pattern: /가족장|무빈소|작게|조용|일반장|종교장|장례/, id: 'D-FUNERAL-01', text: '참석 범위나 규모에 대해 한 가지 더 정하고 싶은 내용이 있나요?' },
  'Q-FUNERAL-02': { pattern: /화장|매장|봉안|수목|산골|납골|장지/, id: 'D-FUNERAL-02', text: '장법 이후의 안치 장소는 정하셨나요, 아니면 미정으로 둘까요?' },
  'Q-FUNERAL-03': { pattern: /음악|사진|꽃|종교|찬송|불교|천주교|기독교/, id: 'D-FUNERAL-03', text: '그중 반드시 지켜주었으면 하는 한 가지가 있나요?' },
  'Q-MSG-01': { pattern: /배우자|아들|딸|자녀|부모|친구|가족|지인/, id: 'D-MSG-01', text: '같은 관계의 사람이 여럿이라면 가상 별칭으로 구분해 주시겠어요?' },
  'Q-MSG-03': { pattern: /다듬|정리|제안/, id: 'D-MSG-03', text: '문장을 담백하게 정리할까요, 따뜻하게 정리할까요?' }
});

export function conditionalQuestion(questionId, extractedValue) {
  const rule = conditionalRules[questionId];
  return rule && rule.pattern.test(extractedValue) ? { id: rule.id, text: rule.text, parentQuestionId: questionId } : null;
}

export function validateClientStateSummary(value) {
  if (!isObject(value) || value.schemaVersion !== 1 || typeof value.documentId !== 'string' || !/^mock-doc-[a-z0-9-]{6,}$/i.test(value.documentId) || !SCREENS.includes(value.currentScreen) ||
      !CONVERSATION_STATUS.includes(value.conversationStatus) ||
      (value.selectedSection !== null && !Object.hasOwn(SECTIONS, value.selectedSection))) {
    throw new HttpError(400, 'Ending Note 상태 형식을 확인해 주세요.');
  }
  if (!isObject(value.sectionStatuses) || Object.keys(SECTIONS).some(id => !SECTION_STATUS.includes(value.sectionStatuses[id]))) {
    throw new HttpError(400, '영역 상태 형식을 확인해 주세요.');
  }
  return {
    schemaVersion: 1,
      documentId: value.documentId,
    currentScreen: value.currentScreen,
    conversationStatus: value.conversationStatus,
    selectedSection: value.selectedSection,
    sectionStatuses: Object.fromEntries(Object.keys(SECTIONS).map(id => [id, value.sectionStatuses[id]]))
  };
}
