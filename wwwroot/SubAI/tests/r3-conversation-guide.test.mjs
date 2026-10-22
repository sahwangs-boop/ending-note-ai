import test from 'node:test';
import assert from 'node:assert/strict';
import { funeralGuidanceForStep, nextFuneralGuidance, resolveGuidedChoice } from '../EndingNoteAI/r3-conversation-guide.mjs';

test('장례 상담은 기존 앱 순서의 첫 질문과 클릭 선택지를 제공한다', () => {
  const guide = nextFuneralGuidance({ question: '장례 계획은 무엇부터 준비하나요?', planSummary: [], candidates: [] });
  assert.equal(guide.stepId, 'funeral-form');
  assert.match(guide.question, /형식/);
  assert(guide.choices.some(item => item.label === '전통식으로 준비'));
  assert(guide.choices.some(item => item.label === '잘 모르겠어요'));
  assert(guide.choices.some(item => item.label === '나중에 정할게요'));
});

test('이미 답했거나 보류한 항목은 반복하지 않고 다음 장례 질문으로 이동한다', () => {
  const guide = nextFuneralGuidance({ question: '계속할게요', planSummary: [
    { areaId: 'funeral', fieldKey: 'ceremonyForm', value: '전통식으로 준비', status: 'USER_CONFIRMED' },
    { areaId: 'funeral', fieldKey: 'scale', value: '아직 미정', status: 'UNDECIDED' },
    { areaId: 'funeral', fieldKey: 'expectedGuests', value: '100~150명 · 45~60평', status: 'USER_CONFIRMED' },
    { areaId: 'funeral', fieldKey: 'funeralHallRegion', value: '서울', status: 'USER_CONFIRMED' },
    { areaId: 'funeral', fieldKey: 'funeralHallCriteria', value: '가족의 이동 거리', status: 'USER_CONFIRMED' }
  ], candidates: [] });
  assert.equal(guide.stepId, 'funeral-goods');
});

test('무빈소 선택 시 제단·장례용품 질문을 건너뛴다', () => {
  const guide = nextFuneralGuidance({ question: '계속할게요', planSummary: [
    { areaId: 'funeral', fieldKey: 'ceremonyForm', value: '간소하게', status: 'USER_CONFIRMED' },
    { areaId: 'funeral', fieldKey: 'scale', value: '알리지 않음·무빈소', status: 'USER_CONFIRMED' },
    { areaId: 'funeral', fieldKey: 'funeralHallRegion', value: '서울', status: 'USER_CONFIRMED' },
    { areaId: 'funeral', fieldKey: 'funeralHallCriteria', value: '시설·용품 가격', status: 'USER_CONFIRMED' }
  ], candidates: [] });
  assert.equal(guide.stepId, 'funeral-shroud');
});

test('검증된 선택은 자동 확정하지 않고 AI_EXTRACTED 후보로만 만든다', () => {
  const result = resolveGuidedChoice({ stepId: 'funeral-form', choiceId: 'traditional', documentId: 'mock-doc-guide01', planSummary: [] });
  assert.equal(result.mode, 'GUIDED');
  assert.equal(result.planCandidates[0].fieldKey, 'ceremonyForm');
  assert.equal(result.planCandidates[0].status, 'AI_EXTRACTED');
  assert.equal(result.planCandidates[0].confirmedValue, null);
  assert.equal(result.guidance.stepId, 'funeral-scale');
});

test('현재 질문에 없는 조작된 선택값은 거부한다', () => {
  assert.equal(resolveGuidedChoice({ stepId: 'funeral-form', choiceId: 'tree', documentId: 'mock-doc-guide02', planSummary: [] }), null);
});

test('기본 계획 완료 후 추가 장례 항목을 실제 선택 질문으로 다시 연다', () => {
  const guide = funeralGuidanceForStep('funeral-announcement', []);
  assert.equal(guide.stepId, 'funeral-announcement');
  assert.equal(guide.fieldKey, 'announcementScope');
  assert(guide.choices.some(item => item.label === '모바일 부고장으로 넓게'));
});

test('추가 장례 항목 선택도 사용자 확인 전 후보 상태로만 만든다', () => {
  const result = resolveGuidedChoice({ stepId: 'funeral-transport', choiceId: 'bus', documentId: 'mock-doc-guide03', planSummary: [] });
  assert.equal(result.planCandidates[0].fieldKey, 'transport');
  assert.equal(result.planCandidates[0].status, 'AI_EXTRACTED');
  assert.equal(result.planCandidates[0].confirmedValue, null);
});

test('가족장·무빈소가 아닌 경우 조문객 규모와 참고 비용을 질문한다', () => {
  const guide = nextFuneralGuidance({ question: '계속할게요', planSummary: [
    { areaId: 'funeral', fieldKey: 'ceremonyForm', value: '전통식으로 준비', status: 'USER_CONFIRMED' },
    { areaId: 'funeral', fieldKey: 'scale', value: '가까운 친지·지인까지', status: 'USER_CONFIRMED' }
  ], candidates: [] });
  assert.equal(guide.stepId, 'funeral-guests');
  assert(guide.choices.some(item => /100~150명/.test(item.label)));
  assert(guide.choices.some(item => /3,200~5,000만원/.test(item.label)));
});
