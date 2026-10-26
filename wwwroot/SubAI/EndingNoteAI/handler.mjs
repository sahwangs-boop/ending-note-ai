import { HttpError } from '../shared/errors.mjs';
import { isObject, validateChat } from '../shared/validation.mjs';
import {
  CONVERSATION_STATUS, FIELD_STATUS, SECTION_STATUS,
  assertTransition, conditionalQuestion, extractMock, validateClientStateSummary,
  validateConflictResolution, validateDocumentRequest, validatePersonResolution,
  validateReviewCommand, validateSuggestionResolution
} from './domain.mjs';
import { answerWithMainAI } from './main-ai.mjs';
import { extractRemote } from './llm-adapter.mjs';
import { consultFallback, consultRemote } from './r2-adapter.mjs';
import { validatePlanSummary } from './r2-schema.mjs';
import { applyConversationGuide, funeralGuidanceForStep, resolveGuidedChoice } from './r3-conversation-guide.mjs';

const actions = ['consult', 'funeral_guidance', 'guided_choice', 'extract', 'transition', 'set_disposition', 'review_field', 'resolve_person', 'resolve_suggestion', 'resolve_conflict', 'save_document', 'delegate'];

function exactKeys(value, allowed, required = allowed) {
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key)) && keys.every(key => allowed.includes(key));
}

export async function handleChat(agent, input, respond, signal) {
  if (!isObject(input) || !actions.includes(input.action)) throw new HttpError(400, 'Ending Note 요청 형식을 확인해 주세요.');
  if (signal?.aborted) throw new HttpError(499, '요청이 취소되었습니다.');

  if (input.action === 'delegate') {
    if (!exactKeys(input, ['action', 'question', 'history'], ['action', 'question', 'history'])) throw new HttpError(400, '위임 요청 형식을 확인해 주세요.');
    const request = validateChat(input);
    return { action: 'reply', message: await answerWithMainAI({ agent, ...request, signal }) };
  }

  if (input.action === 'consult') {
    if (!exactKeys(input, ['action', 'question', 'history', 'documentId', 'planSummary'], ['action', 'question', 'history', 'documentId'])) throw new HttpError(400, 'R2 상담 요청 형식을 확인해 주세요.');
    const chat = validateChat(input);
    if (typeof input.documentId !== 'string' || !/^mock-doc-[a-z0-9-]{6,}$/i.test(input.documentId)) throw new HttpError(400, '문서 ID 형식을 확인해 주세요.');
    const planSummary = validatePlanSummary(input.planSummary);
    let result;
    try {
      result = await consultRemote({ agent, question: chat.question, history: chat.history, planSummary, respond, signal });
    } catch (error) {
      if (!(error instanceof HttpError) || error.status < 500) throw error;
      console.error(`EndingNoteAI remote fallback: ${error.status} ${error.message}`);
      result = { data: consultFallback(chat.question), metrics: { latencyMs: null, inputTokens: null, outputTokens: null, totalTokens: null } };
    }
    const guided = applyConversationGuide({ question: chat.question, planSummary, response: result.data });
    return { action: 'consultation_reply', mode: result.metrics.latencyMs === null ? 'FALLBACK' : 'REMOTE', documentId: input.documentId, ...guided, metrics: result.metrics };
  }

  if (input.action === 'guided_choice') {
    if (!exactKeys(input, ['action', 'stepId', 'choiceId', 'documentId', 'planSummary'])) throw new HttpError(400, '안내 선택 요청 형식을 확인해 주세요.');
    if (typeof input.documentId !== 'string' || !/^mock-doc-[a-z0-9-]{6,}$/i.test(input.documentId)) throw new HttpError(400, '문서 ID 형식을 확인해 주세요.');
    if (typeof input.stepId !== 'string' || typeof input.choiceId !== 'string') throw new HttpError(400, '안내 선택값을 확인해 주세요.');
    const result = resolveGuidedChoice({ stepId: input.stepId, choiceId: input.choiceId, documentId: input.documentId, planSummary: validatePlanSummary(input.planSummary) });
    if (!result) throw new HttpError(400, '현재 질문에서 선택할 수 없는 답변입니다.');
    return result;
  }

  if (input.action === 'funeral_guidance') {
    if (!exactKeys(input, ['action', 'stepId', 'documentId', 'planSummary'])) throw new HttpError(400, '추가 장례 항목 요청 형식을 확인해 주세요.');
    if (typeof input.documentId !== 'string' || !/^mock-doc-[a-z0-9-]{6,}$/i.test(input.documentId)) throw new HttpError(400, '문서 ID 형식을 확인해 주세요.');
    if (typeof input.stepId !== 'string') throw new HttpError(400, '추가 장례 항목을 확인해 주세요.');
    const guidance = funeralGuidanceForStep(input.stepId, validatePlanSummary(input.planSummary));
    if (!guidance) throw new HttpError(400, '현재 제공하지 않는 장례 항목입니다.');
    return { action: 'funeral_guidance', mode: 'GUIDED', documentId: input.documentId, guidance };
  }

  if (input.action === 'extract') {
    if (!exactKeys(input, ['action', 'question', 'history', 'questionId', 'sourceText', 'state', 'mode'], ['action', 'question', 'history', 'questionId', 'sourceText', 'state'])) {
      throw new HttpError(400, '추출 요청 형식을 확인해 주세요.');
    }
    const chat = validateChat(input);
    if (chat.question !== input.sourceText.trim()) throw new HttpError(400, '질문과 원문 답변이 일치하지 않습니다.');
    const state = validateClientStateSummary(input.state);
    const extracted = extractMock(input.questionId, input.sourceText);
    if (state.selectedSection !== extracted.sectionId || state.currentScreen !== 'P05' || state.conversationStatus !== 'ACTIVE') {
      throw new HttpError(400, '현재 인터뷰 상태와 질문이 일치하지 않습니다.');
    }
    const mode = input.mode === undefined ? 'MOCK' : input.mode;
    if (!['MOCK', 'REMOTE'].includes(mode)) throw new HttpError(400, 'AI 실행 모드를 확인해 주세요.');
    if (mode === 'REMOTE') {
      const remote = await extractRemote({ agent, sourceText: input.sourceText, questionId: input.questionId, currentSection: state.selectedSection, history: chat.history, respond, signal });
      return {
        action: 'present_candidates', mode, sourceText: input.sourceText, confirmedValue: null,
        items: remote.data.items, intent: remote.data.intent, topic: remote.data.topic,
        corrections: remote.data.corrections, disposition: remote.data.disposition,
        nextQuestion: remote.data.nextQuestion, requiresConfirmation: remote.data.requiresConfirmation,
        metrics: remote.metrics,
        message: 'Remote AI가 후보 정보를 정리했습니다. 사용자 확인 전에는 확정되지 않습니다.'
      };
    }
    return {
      action: 'present_candidate', mode,
      sourceText: extracted.rawAnswer,
      extractedValue: extracted.extractedValue,
      confirmedValue: null,
      fieldStatus: extracted.fieldStatus,
      conditionalQuestion: conditionalQuestion(input.questionId, extracted.extractedValue),
      message: '답변에서 아래 내용을 정리했습니다. 확인 전에는 확정되지 않습니다.'
    };
  }

  if (input.action === 'set_disposition') {
    if (!exactKeys(input, ['action', 'questionId', 'fieldStatus', 'state'], ['action', 'questionId', 'fieldStatus', 'state']) ||
        !['UNDECIDED', 'SKIPPED'].includes(input.fieldStatus)) {
      throw new HttpError(400, '미정·건너뛰기 요청 형식을 확인해 주세요.');
    }
    const state = validateClientStateSummary(input.state);
    const extracted = extractMock(input.questionId, input.fieldStatus === 'UNDECIDED' ? '아직 정하지 않았습니다.' : '이번에는 건너뜁니다.');
    if (state.selectedSection !== extracted.sectionId || state.currentScreen !== 'P05' || state.conversationStatus !== 'ACTIVE') {
      throw new HttpError(400, '현재 인터뷰 상태와 질문이 일치하지 않습니다.');
    }
    return { action: 'disposition_accepted', questionId: input.questionId, fieldStatus: input.fieldStatus };
  }

  if (input.action === 'review_field') {
    if (!exactKeys(input, ['action', 'questionId', 'fromStatus', 'targetStatus', 'confirmedValue'])) throw new HttpError(400, '검토 요청 형식을 확인해 주세요.');
    return { action: 'review_accepted', ...validateReviewCommand(input) };
  }

  if (input.action === 'resolve_person') {
    if (!exactKeys(input, ['action', 'candidateId', 'decision'])) throw new HttpError(400, '인물 확인 요청 형식을 확인해 주세요.');
    return { action: 'person_resolution_accepted', ...validatePersonResolution(input) };
  }

  if (input.action === 'resolve_suggestion') {
    if (!exactKeys(input, ['action', 'suggestionId', 'status'])) throw new HttpError(400, '영역 간 제안 요청 형식을 확인해 주세요.');
    return { action: 'suggestion_resolution_accepted', ...validateSuggestionResolution(input) };
  }

  if (input.action === 'resolve_conflict') {
    if (!exactKeys(input, ['action', 'conflictId', 'decision'])) throw new HttpError(400, '충돌 확인 요청 형식을 확인해 주세요.');
    return { action: 'conflict_resolution_accepted', ...validateConflictResolution(input) };
  }

  if (input.action === 'save_document') {
    if (!exactKeys(input, ['action', 'nextVersion', 'includeUnresolved', 'sectionCounts'])) throw new HttpError(400, '문서 저장 요청 형식을 확인해 주세요.');
    return { action: 'document_save_accepted', ...validateDocumentRequest(input) };
  }

  if (!exactKeys(input, ['action', 'kind', 'from', 'to'], ['action', 'kind', 'from', 'to'])) {
    throw new HttpError(400, '상태 전이 요청 형식을 확인해 주세요.');
  }
  const enums = input.kind === 'field' ? FIELD_STATUS : input.kind === 'section' ? SECTION_STATUS : input.kind === 'conversation' ? CONVERSATION_STATUS : null;
  if (!enums || !enums.includes(input.from) || !enums.includes(input.to)) throw new HttpError(400, '상태값을 확인해 주세요.');
  assertTransition(input.kind, input.from, input.to);
  return { action: 'transition_accepted', kind: input.kind, from: input.from, to: input.to };
}
