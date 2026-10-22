import { HttpError } from '../shared/errors.mjs';

export const CONTENT_REVIEW_STATUS = Object.freeze(['UNVERIFIED_LEGACY', 'PROVISIONAL_APPROVED', 'BUSINESS_REVIEWED', 'LEGAL_REVIEWED', 'APPROVED']);
export const CONTENT_USAGE_MODE = Object.freeze(['REFERENCE_WITH_DISCLOSURE', 'LIVE_API', 'AUTHORITATIVE']);
export const R1_AREA_IDS = Object.freeze([
  'people', 'life', 'funeral', 'burial', 'will', 'aftercare', 'giving', 'pet', 'memento', 'messages'
]);

const source = (path, detail) => Object.freeze({ system: 'LEGACY_ENDING_NOTE', path, detail });
const item = value => Object.freeze({
  reviewStatus: 'PROVISIONAL_APPROVED', approvedBy: 'PRODUCT_OWNER', approvedAt: '2026-10-19', verifiedAt: null,
  usableForAnswer: true, usageMode: 'REFERENCE_WITH_DISCLOSURE', dataAsOf: 'UNKNOWN',
  requiredNotice: '기존 엔딩노트 자료를 바탕으로 한 참고 정보이며 최신 데이터 연동 후 달라질 수 있습니다.',
  ...value, sources: Object.freeze(value.sources)
});

export const CONTENT_CATALOG = Object.freeze([
  item({ id: 'funeral-form', areaId: 'funeral', title: '장례 형식', summary: '기존 앱은 전통식과 종교식을 구분해 안내한다.', options: ['전통식', '종교식'], risk: 'MEDIUM', sources: [source('Json/funeral.json', 'data.form'), source('Pages/EndingPlan/Funeral_Chat.aspx', '장례 형식 선택')] }),
  item({ id: 'funeral-scale', areaId: 'funeral', title: '장례 규모', summary: '알리지 않음(무빈소), 직계가족, 가까운 지인, 많은 조문객 범위를 제공한다.', options: ['알리지 않음(무빈소)', '직계가족', '가까운 지인', '최대한 많은 조문객'], risk: 'MEDIUM', sources: [source('Json/funeral.json', 'data.scale')] }),
  item({ id: 'funeral-package', areaId: 'funeral', title: '장례 구성', summary: '제단장식, 인력, 장례용품, 장의차량을 묶어 비교한다.', options: ['무빈소형', '기본형', '일반형', '고급형'], risk: 'HIGH', sources: [source('Json/funeral.json', 'data.goods')] }),
  item({ id: 'funeral-cost', areaId: 'funeral', title: '장례 예상비용', summary: '빈소·안치·입관·식사·용품·차량 등 항목별 레거시 금액을 참고 범위로 제공한다.', options: [], risk: 'HIGH', futureProvider: 'FUNERAL_DATA_API', sources: [source('Json/funeral.json', 'calc_price/view_price')] }),
  item({ id: 'burial-method', areaId: 'burial', title: '장법', summary: '화장과 매장을 구분하고 이후 안치 방법으로 연결한다.', options: ['화장', '매장'], risk: 'MEDIUM', sources: [source('Pages/EndingPlan/Burial_Chat.aspx', '장사 방법 선택')] }),
  item({ id: 'burial-place', areaId: 'burial', title: '장지 형태', summary: '화장·매장 이후 가능한 장지 형태와 특징을 설명한다.', options: ['수목장', '잔디장', '해양장', '봉안당', '봉안묘', '개인선산', '공원묘지', '국립묘지', '산골'], risk: 'HIGH', sources: [source('Json/burial.json', 'data[]'), source('Pages/EndingPlan/Burial_Chat.aspx', '장지 설명')] }),
  item({ id: 'funeral-personalization', areaId: 'funeral', title: '개인화 장례', summary: '음악, 생전 사진·영상, 추모 소품 등으로 개인화할 수 있다.', options: ['음악', '사진', '영상', '추모 소품'], risk: 'LOW', sources: [source('Pages/EndingPlan/Burial_Chat.aspx', '개인화 안내')] }),
  item({ id: 'will-beneficiary', areaId: 'will', title: '상속·유증 대상', summary: '배우자·자녀·법정상속인·비상속인·국가 기부·공익법인 출연 선택 흔적이 있다.', options: ['배우자', '자녀', '법정상속인', '비상속인(유증)', '국가 등에 기부(유증)', '공익법인 설립(출연)'], risk: 'LEGAL', sources: [source('Pages/Testament/Scripts/Testament_Chat.js', '상속·유증 대상 선택')] }),
  item({ id: 'will-draft', areaId: 'will', title: '유언 준비 초안', summary: '재산과 희망 대상을 정리해 유언 준비용 초안으로 확인한다.', options: [], risk: 'LEGAL', sources: [source('Pages/Testament/Testament_Will.aspx', '유언장 결과'), source('API/WillManger.cs', '유언 처리')] }),
  item({ id: 'inheritance-tax', areaId: 'will', title: '상속세 참고', summary: '기존 계산 자료를 참고 시뮬레이션으로 제공하며 세액을 확정하지 않는다.', options: [], risk: 'LEGAL', futureProvider: 'TAX_RULE_API', sources: [source('Pages/Testament/TestaMent_Calculator.aspx', '상속세 계산'), source('Pages/Testament/Tax_Expert.aspx', '전문가 상담')] }),
  item({ id: 'digital-aftercare', areaId: 'aftercare', title: '디지털 사후정리', summary: '추모 계정, 계정 삭제, 구독 해지, 디지털 자산, 기기 접근 희망을 정리한다.', options: ['추모 계정 유지', '온라인 계정 삭제', '구독·멤버십 정리', '디지털 자산 정보 위치', '디지털기기 처리 방법'], risk: 'PRIVACY', sources: [source('Pages/EndingPlan/Digital_Chat.aspx', '디지털클린 계획'), source('Pages/EndingPlan/Digital_Chat_Old.aspx', '세부 항목')] }),
  item({ id: 'donation-plan', areaId: 'giving', title: '기부 계획', summary: '기부 의사와 방법을 정리하고 결과를 확인한다.', options: [], risk: 'LEGAL', sources: [source('Pages/EndingPlan/Donation_Chat.aspx', '기부 계획'), source('Pages/EndingPlan/SubPage_donationMethod.html', '기부 방법')] }),
  item({ id: 'organ-donation', areaId: 'giving', title: '장기기증 의사', summary: '기존 절차 정보를 안내하고 장기기증 의사를 정리한다.', options: [], risk: 'MEDICAL', futureProvider: 'MEDICAL_DONATION_API', sources: [source('Pages/EndingPlan/OrganD_Chat.aspx', '장기기증 계획'), source('Pages/EndingPlan/SubPage_organDonation.html', '장기기증 안내')] }),
  item({ id: 'pet-care', areaId: 'pet', title: '반려동물 돌봄', summary: '사후 반려동물 돌봄 희망과 담당자를 정리한다.', options: [], risk: 'MEDIUM', sources: [source('Pages/EndingPlan/Pet_Chat.aspx', '반려동물 계획')] }),
  item({ id: 'memento-plan', areaId: 'memento', title: '유품·추모 계획', summary: '남길 물건과 정리·보관 희망을 정리한다.', options: [], risk: 'MEDIUM', sources: [source('Pages/EndingPlan/Memento_Chat.aspx', '유품 계획'), source('Pages/EndingPlan/SubPage_mementoPlan.html', '유품 안내')] }),
  item({ id: 'bucket-list', areaId: 'life', title: '버킷리스트', summary: '목표, 예정일, 달성 여부와 수정 이력을 관리한다.', options: [], risk: 'LOW', sources: [source('Pages/Bucket/Scripts/Bucket1.js', '버킷리스트 생성·수정·완료')] }),
  item({ id: 'last-message', areaId: 'messages', title: '마지막 당부와 메시지', summary: '가족·지인에게 남길 말과 마지막 당부를 기록한다.', options: [], risk: 'MEDIUM', sources: [source('Pages/EndingPlan/Last_Chat.aspx', '마지막 당부')] }),
  item({ id: 'facility-search', areaId: 'burial', title: '장례·추모시설 탐색', summary: '장례식장과 추모시설의 위치·가격·시설 정보를 참고용으로 제공한다.', options: [], risk: 'HIGH', futureProvider: 'FUNERAL_DATA_API', sources: [source('Pages/Estimates/Est_Burialground.aspx', '추모시설 비교'), source('Pages/Estimates/', '장례식장 비교')] })
]);

export function contentByArea(areaId, { includeUnverified = false } = {}) {
  if (!R1_AREA_IDS.includes(areaId)) throw new HttpError(400, '알 수 없는 Ending Note 영역입니다.');
  return CONTENT_CATALOG.filter(entry => entry.areaId === areaId && (includeUnverified || entry.usableForAnswer));
}

export function validateContentCatalog(entries = CONTENT_CATALOG) {
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) || !R1_AREA_IDS.includes(entry.areaId) || !CONTENT_REVIEW_STATUS.includes(entry.reviewStatus) || !CONTENT_USAGE_MODE.includes(entry.usageMode) || !Array.isArray(entry.sources) || !entry.sources.length) {
      throw new Error('R1 콘텐츠 카탈로그 형식을 확인해 주세요.');
    }
    if (entry.usableForAnswer && entry.reviewStatus === 'UNVERIFIED_LEGACY') throw new Error('승인되지 않은 콘텐츠는 AI 답변에 사용할 수 없습니다.');
    if (entry.usageMode === 'REFERENCE_WITH_DISCLOSURE' && (!entry.requiredNotice || !entry.dataAsOf)) throw new Error('참고 정보에는 기준일과 고지 문구가 필요합니다.');
    ids.add(entry.id);
  }
  return true;
}

