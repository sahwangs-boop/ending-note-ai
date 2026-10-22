import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_CATALOG, R1_AREA_IDS, contentByArea, validateContentCatalog } from '../EndingNoteAI/r1-content-catalog.mjs';
import { FIELD_DEFINITIONS, createPlanCandidate, createR1Document, validateR1Document } from '../EndingNoteAI/r1-document-schema.mjs';
import { selectDataProvider, validateProviderResult } from '../EndingNoteAI/r1-data-provider-contract.mjs';

test('R1은 승인된 10개 통합 데이터 영역을 제공한다', () => {
  assert.deepEqual(R1_AREA_IDS, ['people', 'life', 'funeral', 'burial', 'will', 'aftercare', 'giving', 'pet', 'memento', 'messages']);
  assert.equal(Object.keys(FIELD_DEFINITIONS).length, 10);
});

test('기존 앱 콘텐츠는 잠정 승인과 고지 문구를 포함해 참고 답변에 사용할 수 있다', () => {
  assert.equal(validateContentCatalog(), true);
  assert(CONTENT_CATALOG.length >= 18);
  assert(CONTENT_CATALOG.every(entry => entry.sources.length && entry.reviewStatus === 'PROVISIONAL_APPROVED' && entry.usableForAnswer === true && entry.requiredNotice));
  assert(contentByArea('funeral').length >= 4);
  assert(contentByArea('funeral', { includeUnverified: true }).length >= 4);
});

test('향후 API가 비활성일 때 레거시 참고 데이터로 명시적으로 폴백한다', () => {
  const selected = selectDataProvider('FUNERAL_DATA_API');
  assert.equal(selected.providerId, 'LEGACY_CONTENT');
  assert.equal(selected.fallback, true);
  assert.equal(validateProviderResult({ providerId: 'LEGACY_CONTENT', retrievedAt: '2026-10-19T00:00:00.000Z', dataAsOf: 'UNKNOWN', items: [], notice: '기존 자료 기반 참고 정보' }).providerId, 'LEGACY_CONTENT');
});

test('R1 통합 문서는 10개 영역과 법률·비용·비밀정보 고지를 갖는다', () => {
  const document = createR1Document('mock-doc-r1test');
  assert.equal(Object.keys(document.sections).length, 10);
  assert.match(document.notices.legalWill, /법적으로 유효한 유언장/);
  assert.match(document.notices.estimatedCost, /참고/);
  assert.match(document.notices.secrets, /비밀번호/);
  assert.equal(validateR1Document(document), document);
});

test('상담 답변은 문서에 자동 저장되지 않고 계획 후보만 AI_EXTRACTED로 생성된다', () => {
  const document = createR1Document('mock-doc-r1candidate');
  document.consultationHistory.push({ question: '가족장이 무엇인가요?', answer: '합성 상담 답변', savedToPlan: false });
  assert.equal(Object.keys(document.sections.funeral.fields).length, 0);
  const candidate = createPlanCandidate({ areaId: 'funeral', fieldKey: 'scale', rawText: '가족장으로 하고 싶어요.', extractedValue: '직계가족 중심 장례', candidateId: 'candidate-r1-1' });
  assert.equal(candidate.status, 'AI_EXTRACTED');
  assert.equal(candidate.confirmedValue, null);
});

test('AI 추출값 자동 확정과 비밀정보 필드는 거부한다', () => {
  const document = createR1Document('mock-doc-r1invalid');
  document.sections.funeral.fields.scale = [{ ...createPlanCandidate({ areaId: 'funeral', fieldKey: 'scale', rawText: '가족장', extractedValue: '직계가족', candidateId: 'candidate-r1-2' }), confirmedValue: '직계가족' }];
  assert.throws(() => validateR1Document(document), /확정할 수 없습니다/);
  assert.throws(() => createPlanCandidate({ areaId: 'aftercare', fieldKey: 'password', rawText: '비밀', extractedValue: '비밀', candidateId: 'candidate-r1-3' }), /계획 후보/);
});

