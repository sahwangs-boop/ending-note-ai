import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChat } from '../EndingNoteAI/handler.mjs';
import { selectKnowledge } from '../EndingNoteAI/r2-knowledge.mjs';
import { validateR2Response } from '../EndingNoteAI/r2-schema.mjs';

const agent = { id: 'EndingNoteAI', instructions: 'R2 test' };
const output = value => ({ status: 'completed', usage: { input_tokens: 100, output_tokens: 80, total_tokens: 180 }, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });

test('R2 지식은 기존 앱의 장례 비용·장지·디지털클린 내용을 적극 사용한다', () => {
  const costs = selectKnowledge('가족장 비용은 얼마나 드나요?');
  assert(costs.some(item => item.id === 'funeral-scale'));
  assert(costs.some(item => item.id === 'funeral-cost' && item.facts.some(fact => fact.includes('5,600,000원'))));
  assert(selectKnowledge('화장 후 수목장을 하고 싶어요').some(item => item.id === 'burial-place'));
  assert(selectKnowledge('온라인 계정과 구독은 어떻게 정리하나요?').some(item => item.id === 'digital-aftercare'));
});

test('단순 상담은 답변만 반환하고 계획 후보를 자동 생성하지 않는다', async () => {
  let payload;
  const respond = async value => {
    payload = value;
    return output({ schemaVersion: 'ending-note-consultation.r2', intent: 'INFORMATION', answer: '가족장은 가까운 가족 중심으로 진행하는 장례 방식입니다.', citations: ['funeral-scale'], notices: ['기존 엔딩노트 자료를 바탕으로 한 참고 정보입니다.'], planCandidates: [], nextQuestion: '예상하시는 참석 범위도 알아볼까요?', offerToSave: false, requiresConfirmation: false });
  };
  const result = await handleChat(agent, { action: 'consult', question: '가족장이 무엇인가요?', history: [], documentId: 'mock-doc-r2info', planSummary: [] }, respond);
  assert.equal(result.action, 'consultation_reply');
  assert.equal(result.planCandidates.length, 0);
  assert.equal(result.requiresConfirmation, false);
  assert.equal(payload.text.format.name, 'ending_note_consultation');
  assert(payload.instructions.includes("'저장했습니다'"));
});

test('개인 희망은 복수 영역 계획 후보로 분리하고 확인 전 확정하지 않는다', async () => {
  const question = '장례는 가족장으로 하고 화장 후 수목장을 원해요.';
  const respond = async () => output({
    schemaVersion: 'ending-note-consultation.r2', intent: 'PLAN_CREATE', answer: '가족장, 화장, 수목장 희망을 각각 정리했습니다.', citations: ['funeral-scale', 'burial-method', 'burial-place'], notices: ['현재 장지 정보는 기존 자료 기반 참고 정보입니다.'],
    planCandidates: [
      { candidateId: 'r2-1', areaId: 'funeral', fieldKey: 'scale', value: '가족 중심 장례', evidence: '가족장', status: 'AI_EXTRACTED' },
      { candidateId: 'r2-2', areaId: 'burial', fieldKey: 'method', value: '화장', evidence: '화장', status: 'AI_EXTRACTED' },
      { candidateId: 'r2-3', areaId: 'burial', fieldKey: 'placeType', value: '수목장', evidence: '수목장', status: 'AI_EXTRACTED' }
    ], nextQuestion: null, offerToSave: true, requiresConfirmation: true
  });
  const result = await handleChat(agent, { action: 'consult', question, history: [], documentId: 'mock-doc-r2plan', planSummary: [] }, respond);
  assert.equal(result.planCandidates.length, 3);
  assert(result.planCandidates.every(item => item.status === 'AI_EXTRACTED' && item.confirmedValue === null));
  assert.equal(result.requiresConfirmation, true);
});

test('계획 후보의 잘못된 영역·원문 없는 근거·자동 확정을 거부한다', () => {
  const base = { schemaVersion: 'ending-note-consultation.r2', intent: 'PLAN_CREATE', answer: '정리했습니다.', citations: ['funeral-scale'], notices: [], nextQuestion: null, offerToSave: true, requiresConfirmation: true };
  assert.throws(() => validateR2Response({ ...base, planCandidates: [{ candidateId: 'x', areaId: 'funeral', fieldKey: 'accounts', value: '계정', evidence: '가족장', status: 'AI_EXTRACTED' }] }, '가족장 희망', ['funeral-scale']), /영역/);
  assert.throws(() => validateR2Response({ ...base, planCandidates: [{ candidateId: 'x', areaId: 'funeral', fieldKey: 'scale', value: '조문객 300명', evidence: '없는 근거', status: 'AI_EXTRACTED' }] }, '가족장 희망', ['funeral-scale']), /근거/);
  assert.throws(() => validateR2Response({ ...base, offerToSave: false, planCandidates: [{ candidateId: 'x', areaId: 'funeral', fieldKey: 'scale', value: '가족장', evidence: '가족장', status: 'AI_EXTRACTED' }] }, '가족장 희망', ['funeral-scale']), /저장 제안/);
});

test('모델이 근거를 늘려 써도 후보값이 원문에 정확히 있으면 안전하게 복구한다', () => {
  const base = { schemaVersion: 'ending-note-consultation.r2', intent: 'PLAN_CREATE', answer: '정리했습니다.', citations: ['funeral-ceremony'], notices: [], nextQuestion: null, offerToSave: true, requiresConfirmation: true };
  const result = validateR2Response({ ...base, planCandidates: [{ candidateId: 'flower-1', areaId: 'funeral', fieldKey: 'flowers', value: '흰 꽃 위주의 단정한 제단', evidence: '흰 꽃 위주의 단정한 제단을 원합니다', status: 'AI_EXTRACTED' }] }, "꽃은 '흰 꽃 위주의 단정한 제단'으로 생각하고 있어요.", ['funeral-ceremony']);
  assert.equal(result.planCandidates[0].evidence, '흰 꽃 위주의 단정한 제단');
  assert.equal(result.planCandidates[0].status, 'AI_EXTRACTED');
  assert.equal(result.planCandidates[0].confirmedValue, null);
});

test('현재 계획 요약은 LLM에 전달되지만 documentId는 전달하지 않는다', async () => {
  let payload;
  const respond = async value => { payload = value; return output({ schemaVersion: 'ending-note-consultation.r2', intent: 'PLAN_REVIEW', answer: '현재 계획을 확인했습니다.', citations: ['funeral-scale'], notices: [], planCandidates: [], nextQuestion: null, offerToSave: false, requiresConfirmation: false }); };
  await handleChat(agent, { action: 'consult', question: '내 계획을 알려줘', history: [], documentId: 'mock-doc-r2context', planSummary: [{ areaId: 'funeral', fieldKey: 'scale', value: '가족 중심', status: 'USER_CONFIRMED' }] }, respond);
  const serialized = JSON.stringify(payload);
  assert(serialized.includes('가족 중심'));
  assert(!serialized.includes('mock-doc-r2context'));
});

test('계획 후보가 있으면 INFORMATION 의도를 PLAN_CREATE로 정규화한다', () => {
  const result = validateR2Response({ schemaVersion: 'ending-note-consultation.r2', intent: 'INFORMATION', answer: '계획 후보입니다.', citations: ['funeral-scale'], notices: [], planCandidates: [{ candidateId: 'normalize-1', areaId: 'funeral', fieldKey: 'scale', value: '가족장', evidence: '가족장', status: 'AI_EXTRACTED' }], nextQuestion: null, offerToSave: true, requiresConfirmation: true }, '가족장을 원해요', ['funeral-scale']);
  assert.equal(result.intent, 'PLAN_CREATE');
});

