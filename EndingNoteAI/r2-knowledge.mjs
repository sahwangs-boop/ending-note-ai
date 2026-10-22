import { CONTENT_CATALOG } from './r1-content-catalog.mjs';

const record = value => Object.freeze({ usageMode: 'REFERENCE_WITH_DISCLOSURE', dataAsOf: 'UNKNOWN', ...value });

export const R2_KNOWLEDGE = Object.freeze([
  record({ id: 'funeral-form', keywords: ['장례', '전통식', '종교식'], facts: ['기존 앱은 장례 형식을 전통식과 종교식으로 구분한다.', '종교식 비용과 용품은 종교·인원·규모에 따라 달라질 수 있다.'] }),
  record({ id: 'funeral-scale', keywords: ['가족장', '무빈소', '조문객', '규모'], facts: ['기존 앱 규모 선택은 알리지 않음(무빈소), 직계가족, 가까운 지인, 최대한 많은 조문객이다.', '규모는 빈소·식사·인력 비용에 영향을 준다.'] }),
  record({ id: 'funeral-cost', keywords: ['비용', '가격', '얼마', '견적'], facts: ['레거시 규모 기준 금액: 무빈소 600,000원, 직계가족 5,600,000원, 가까운 지인 3,650,000원, 많은 조문객 11,100,000원.', '레거시 상품 기준 금액: 무빈소형 1,200,000원, 기본형 3,100,000원, 일반형 4,800,000원, 고급형 8,000,000원.', '빈소·안치실·입관실·식사·제단장식·인력·용품·차량이 주요 비용 항목이다.'], futureProvider: 'FUNERAL_DATA_API' }),
  record({ id: 'burial-method', keywords: ['화장', '매장', '장법'], facts: ['기존 앱은 장법을 화장과 매장으로 나눈 뒤 장지 형태를 선택하도록 한다.'] }),
  record({ id: 'burial-place', keywords: ['장지', '수목장', '잔디장', '해양장', '봉안당', '봉안묘', '선산', '공원묘지', '국립묘지', '산골'], facts: ['장지 선택지는 수목장, 잔디장, 해양장, 봉안당, 봉안묘, 개인선산, 공원묘지, 국립묘지, 산골이다.', '레거시 가격 범위 예: 수목장 개인형 300만~500만원, 봉안당 개인형 300만~900만원, 해양장 50만~90만원, 공원묘지 1,500만~4,500만원.', '관리비·표지석·작업비는 별도일 수 있다.'], futureProvider: 'FUNERAL_DATA_API' }),
  record({ id: 'funeral-personalization', keywords: ['음악', '영정', '사진', '영상', '꽃', '추모'], facts: ['기존 앱은 음악, 생전 사진·영상, 추모 소품으로 장례를 개인화하는 방법을 안내한다.'] }),
  record({ id: 'will-beneficiary', keywords: ['유언', '상속', '유증', '재산', '배우자', '자녀'], facts: ['기존 앱은 배우자, 자녀, 법정상속인, 비상속인 유증, 국가 기부, 공익법인 출연을 구분한다.', '작성 결과는 유언 준비용 초안이며 실제 법적 효력은 작성 방식과 요건에 따라 달라진다.'] }),
  record({ id: 'inheritance-tax', keywords: ['상속세', '세금', '공제'], facts: ['기존 앱에는 상속세 계산과 전문가 상담 흐름이 있다.', '현재 계산은 참고 시뮬레이션으로 취급하며 최신 세법 데이터가 연결되면 교체한다.'], futureProvider: 'TAX_RULE_API' }),
  record({ id: 'digital-aftercare', keywords: ['디지털', '계정', '구독', '휴대전화', '핸드폰', '온라인', '비밀번호', '암호화폐'], facts: ['기존 앱은 추모 계정 유지, 온라인 계정 삭제, 구독·멤버십 해지, 디지털 자산 정보, 디지털기기 처리 계획을 제공한다.', '비밀번호·복구키 자체는 AI에 입력하거나 저장하지 않고 보관 위치와 처리 희망만 기록한다.'] }),
  record({ id: 'donation-plan', keywords: ['기부', '재산기부'], facts: ['기존 앱 기부 유형은 현금, 주식·채권, 부동산, 미술품·저작권, 기타이다.', '기부 금액·기관·기타 요청을 계획으로 정리한다.'] }),
  record({ id: 'organ-donation', keywords: ['장기기증', '기증', '의료'], facts: ['기존 앱은 장기기증 정보와 의사를 정리하는 흐름을 제공한다.', '실제 등록·가능 여부·절차는 최신 기관 정보 확인이 필요하다.'], futureProvider: 'MEDICAL_DONATION_API' }),
  record({ id: 'pet-care', keywords: ['반려', '강아지', '고양이', '동물'], facts: ['기존 앱은 사후 반려동물 돌봄 담당자와 돌봄 요청을 계획하도록 한다.'] }),
  record({ id: 'memento-plan', keywords: ['유품', '물건', '정리', '추모품'], facts: ['기존 앱은 남길 물건, 정리·보관 희망, 추모 계획을 작성하도록 한다.'] }),
  record({ id: 'bucket-list', keywords: ['버킷', '하고 싶은', '목표', '꿈'], facts: ['기존 앱은 버킷리스트의 목표, 예정일, 달성 여부를 관리한다.'] }),
  record({ id: 'last-message', keywords: ['메시지', '남길 말', '마지막 말', '가족에게'], facts: ['기존 앱은 가족·지인에게 남길 메시지와 마지막 당부를 기록한다.'] }),
  record({ id: 'facility-search', keywords: ['장례식장', '추모시설', '시설', '근처'], facts: ['기존 앱에는 장례식장과 추모시설의 위치·가격·시설 비교 화면이 있다.', '현재 정보는 참고용이며 향후 장례 데이터 API로 최신화한다.'], futureProvider: 'FUNERAL_DATA_API' })
]);

const approvedIds = new Set(CONTENT_CATALOG.filter(item => item.usableForAnswer).map(item => item.id));

export function selectKnowledge(question, limit = 6) {
  const normalized = String(question).replace(/\s+/g, ' ').trim();
  const selected = R2_KNOWLEDGE.filter(entry => approvedIds.has(entry.id) && entry.keywords.some(keyword => normalized.includes(keyword))).slice(0, limit);
  return selected.length ? selected : R2_KNOWLEDGE.filter(entry => ['funeral-scale', 'will-beneficiary', 'digital-aftercare'].includes(entry.id));
}

export function knowledgePrompt(records) {
  return records.map(entry => `[${entry.id}] ${entry.facts.join(' ')} 데이터 기준일: ${entry.dataAsOf}.`).join('\n');
}

