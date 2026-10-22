import { HttpError } from '../shared/errors.mjs';
import { isObject } from '../shared/validation.mjs';
import { R1_AREA_IDS } from './r1-content-catalog.mjs';

export const R1_SCHEMA_VERSION = 'ending-note-document.r1';
export const PLAN_VALUE_STATUS = Object.freeze(['AI_EXTRACTED', 'USER_CONFIRMED', 'USER_EDITED', 'USER_ENTERED', 'UNDECIDED', 'SKIPPED', 'INVALIDATED']);
export const PLAN_SECTION_STATUS = Object.freeze(['NOT_STARTED', 'IN_PROGRESS', 'REVIEW_REQUIRED', 'CONFIRMED', 'PAUSED']);

export const FIELD_DEFINITIONS = Object.freeze({
  people: Object.freeze(['ownerName', 'birthDate', 'address', 'primaryContact', 'documentCustodian', 'disclosurePolicy', 'importantPeople', 'delegates']),
  life: Object.freeze(['lifeStory', 'values', 'bucketList']),
  funeral: Object.freeze(['ceremonyForm', 'scale', 'expectedGuests', 'funeralHallRegion', 'funeralHallName', 'funeralHallCriteria', 'fundingSource', 'religion', 'announcementScope', 'portrait', 'music', 'flowers', 'goods', 'shroud', 'condolencePolicy', 'mealPlan', 'guestReception', 'transport', 'estimatedCost']),
  burial: Object.freeze(['method', 'placeType', 'detailType', 'preferredArea', 'reason']),
  will: Object.freeze(['willPurpose', 'assets', 'beneficiaries', 'distributionWishes', 'executorWish', 'documentLocation', 'specialRequests', 'legalReviewStatus']),
  aftercare: Object.freeze(['firstActions', 'documentLocations', 'accounts', 'subscriptions', 'digitalAssets', 'devices', 'housingInstructions', 'administrativeTasks']),
  giving: Object.freeze(['donationWishes', 'organDonationWish']),
  pet: Object.freeze(['pets', 'caregiverWish', 'careInstructions']),
  memento: Object.freeze(['items', 'disposalWishes', 'memorialWishes']),
  messages: Object.freeze(['recipientMessages', 'lastRequests'])
});

const forbiddenFieldPattern = /password|passcode|pin|privatekey|seedphrase|recoverykey|residentregistration|accountnumber/i;

export function createR1Document(documentId, now = new Date().toISOString()) {
  if (typeof documentId !== 'string' || !/^mock-doc-[a-z0-9-]{6,}$/i.test(documentId)) throw new HttpError(400, '문서 ID 형식을 확인해 주세요.');
  return {
    schemaVersion: R1_SCHEMA_VERSION,
    documentId,
    title: '나의 Ending Note',
    createdAt: now,
    updatedAt: now,
    sections: Object.fromEntries(R1_AREA_IDS.map(areaId => [areaId, { sectionStatus: 'NOT_STARTED', fields: {} }])),
    people: [],
    consultationHistory: [],
    proposalHistory: [],
    versions: [],
    notices: {
      legalWill: '이 문서는 유언 준비를 위한 기록이며 법적으로 유효한 유언장임을 보장하지 않습니다.',
      estimatedCost: '비용은 기준일과 조건에 따라 달라질 수 있는 참고 정보입니다.',
      secrets: '비밀번호·복구키·주민등록번호·계좌번호 등 비밀정보를 입력하지 마세요.'
    }
  };
}

function validateFieldVersion(value, areaId, fieldKey) {
  if (!isObject(value) || value.areaId !== areaId || value.fieldKey !== fieldKey || !PLAN_VALUE_STATUS.includes(value.status) || typeof value.version !== 'number' || !Number.isInteger(value.version) || value.version < 1) throw new HttpError(400, '계획 필드 형식을 확인해 주세요.');
  if (forbiddenFieldPattern.test(fieldKey)) throw new HttpError(400, '비밀정보 필드는 Ending Note에 저장할 수 없습니다.');
  if (value.status === 'AI_EXTRACTED' && value.confirmedValue !== null) throw new HttpError(400, 'AI 추출값은 사용자 확인 전에 확정할 수 없습니다.');
  if (['USER_CONFIRMED', 'USER_EDITED', 'USER_ENTERED'].includes(value.status) && value.confirmedValue == null) throw new HttpError(400, '확정 상태에는 사용자 확인값이 필요합니다.');
  if (typeof value.source !== 'string' || !['CHAT', 'WEB_APP', 'LEGACY_IMPORT'].includes(value.source)) throw new HttpError(400, '계획 필드 출처를 확인해 주세요.');
  return true;
}

export function validateR1Document(document) {
  if (!isObject(document) || document.schemaVersion !== R1_SCHEMA_VERSION || typeof document.documentId !== 'string' || !isObject(document.sections)) throw new HttpError(400, 'R1 Ending Note 문서 형식을 확인해 주세요.');
  const keys = Object.keys(document.sections);
  if (keys.length !== R1_AREA_IDS.length || R1_AREA_IDS.some(areaId => !Object.hasOwn(document.sections, areaId))) throw new HttpError(400, 'R1 Ending Note 영역 구성을 확인해 주세요.');
  for (const areaId of R1_AREA_IDS) {
    const section = document.sections[areaId];
    if (!isObject(section) || !PLAN_SECTION_STATUS.includes(section.sectionStatus) || !isObject(section.fields)) throw new HttpError(400, 'R1 영역 상태를 확인해 주세요.');
    for (const [fieldKey, versions] of Object.entries(section.fields)) {
      if (!FIELD_DEFINITIONS[areaId].includes(fieldKey) || !Array.isArray(versions) || !versions.length) throw new HttpError(400, 'R1 계획 필드를 확인해 주세요.');
      versions.forEach(version => validateFieldVersion(version, areaId, fieldKey));
    }
  }
  return document;
}

export function createPlanCandidate({ areaId, fieldKey, rawText, extractedValue, candidateId, now = new Date().toISOString() }) {
  if (!R1_AREA_IDS.includes(areaId) || !FIELD_DEFINITIONS[areaId].includes(fieldKey) || typeof rawText !== 'string' || !rawText.trim() || typeof extractedValue !== 'string' || !extractedValue.trim() || typeof candidateId !== 'string' || !candidateId.trim()) throw new HttpError(400, '계획 후보 형식을 확인해 주세요.');
  if (forbiddenFieldPattern.test(fieldKey)) throw new HttpError(400, '비밀정보는 계획 후보로 만들 수 없습니다.');
  return Object.freeze({ version: 1, candidateId, areaId, fieldKey, rawText, extractedValue, confirmedValue: null, status: 'AI_EXTRACTED', source: 'CHAT', createdAt: now, updatedAt: now });
}

