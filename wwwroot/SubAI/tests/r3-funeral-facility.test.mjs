import test from 'node:test';
import assert from 'node:assert/strict';
import { EHANEUL_FACILITY_SEARCH_URL, MockFuneralFacilityRepository, EhaneulFuneralFacilityRepository } from '../EndingNoteAI/funeral-facility-adapter.mjs';
import { nextFuneralGuidance } from '../EndingNoteAI/r3-conversation-guide.mjs';

test('장례식장 계획은 지역과 선택 기준을 기존 장례 흐름에 포함한다', () => {
  const region = nextFuneralGuidance({ question: '계속', planSummary: [
    { areaId:'funeral', fieldKey:'ceremonyForm', value:'전통식', status:'USER_CONFIRMED' },
    { areaId:'funeral', fieldKey:'scale', value:'직계가족 중심', status:'USER_CONFIRMED' }
  ], candidates: [] });
  assert.equal(region.stepId, 'funeral-hall-region');
  const criteria = nextFuneralGuidance({ question: '계속', planSummary: [
    { areaId:'funeral', fieldKey:'ceremonyForm', value:'전통식', status:'USER_CONFIRMED' },
    { areaId:'funeral', fieldKey:'scale', value:'직계가족 중심', status:'USER_CONFIRMED' },
    { areaId:'funeral', fieldKey:'funeralHallRegion', value:'서울', status:'USER_CONFIRMED' }
  ], candidates: [] });
  assert.equal(criteria.stepId, 'funeral-hall-criteria');
});

test('e하늘 연계는 공식 검색 링크와 교체 가능한 Repository 계약을 제공한다', async () => {
  assert.match(EHANEUL_FACILITY_SEARCH_URL, /15774129\.go\.kr/);
  const mock = await new MockFuneralFacilityRepository().search({ region:'서울' });
  assert.equal(mock.source, 'MOCK');
  assert.equal(mock.region, '서울');
  await assert.rejects(() => new EhaneulFuneralFacilityRepository().search(), /UNKNOWN/);
});

test('조문객 식사는 규모별 인원과 예상 금액을 선택 버튼에 제공한다', () => {
  const summary = [
    ['ceremonyForm','전통식'],['scale','가까운 친지·지인까지'],['expectedGuests','중소규모 100~150명 · 45~60평'],['funeralHallRegion','서울'],['funeralHallCriteria','시설·용품 가격'],['goods','기본에 충실하게'],['shroud','전통 수의'],['condolencePolicy','가족의 뜻에 맡기기']
  ].map(([fieldKey,value])=>({ areaId:'funeral', fieldKey, value, status:'USER_CONFIRMED' }));
  const meal = nextFuneralGuidance({ question:'계속', planSummary:summary, candidates:[] });
  assert.equal(meal.stepId,'funeral-meal');
  assert(meal.choices.some(item=>item.label.includes('장례식장 식사 · 약 313만원 (125명)')));
});
