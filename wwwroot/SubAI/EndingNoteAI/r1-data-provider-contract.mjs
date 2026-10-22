import { HttpError } from '../shared/errors.mjs';

export const DATA_PROVIDER_IDS = Object.freeze(['LEGACY_CONTENT', 'FUNERAL_DATA_API', 'TAX_RULE_API', 'MEDICAL_DONATION_API']);

export const DATA_PROVIDER_POLICY = Object.freeze({
  LEGACY_CONTENT: Object.freeze({ active: true, mode: 'REFERENCE_WITH_DISCLOSURE', freshness: 'UNKNOWN' }),
  FUNERAL_DATA_API: Object.freeze({ active: false, mode: 'LIVE_API', freshness: 'UNKNOWN' }),
  TAX_RULE_API: Object.freeze({ active: false, mode: 'LIVE_API', freshness: 'UNKNOWN' }),
  MEDICAL_DONATION_API: Object.freeze({ active: false, mode: 'LIVE_API', freshness: 'UNKNOWN' })
});

export function selectDataProvider(preferredProvider) {
  if (!DATA_PROVIDER_IDS.includes(preferredProvider)) throw new HttpError(400, '알 수 없는 데이터 제공자입니다.');
  const preferred = DATA_PROVIDER_POLICY[preferredProvider];
  if (preferred.active) return { providerId: preferredProvider, ...preferred, fallback: false };
  return { providerId: 'LEGACY_CONTENT', ...DATA_PROVIDER_POLICY.LEGACY_CONTENT, fallback: true, requestedProvider: preferredProvider };
}

export function validateProviderResult(value) {
  if (!value || !DATA_PROVIDER_IDS.includes(value.providerId) || typeof value.retrievedAt !== 'string' || typeof value.dataAsOf !== 'string' || !Array.isArray(value.items) || typeof value.notice !== 'string' || !value.notice.trim()) {
    throw new HttpError(502, '외부 데이터 응답 형식을 확인하지 못했습니다.');
  }
  return value;
}
