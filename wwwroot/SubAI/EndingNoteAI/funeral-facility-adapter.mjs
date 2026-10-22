export const EHANEUL_FACILITY_SEARCH_URL = 'https://www.15774129.go.kr/portal/esky/fnlfac/fac_list.do?facilitygroupcd=TBC0700001&menuId=M0001000100000000';

export class FuneralFacilityRepository {
  async search() {
    throw new Error('UNKNOWN: e하늘 공식 API 계약·인증정보가 제공되지 않았습니다.');
  }
}

export class MockFuneralFacilityRepository extends FuneralFacilityRepository {
  async search({ region = '' } = {}) {
    return { source: 'MOCK', region, facilities: [], externalSearchUrl: EHANEUL_FACILITY_SEARCH_URL };
  }
}

// 공식 API 명세와 이용 승인이 제공되면 이 계약을 구현한다.
// 브라우저에서 e하늘 내부 AJAX를 직접 호출하거나 비공개 응답을 운영 API로 간주하지 않는다.
export class EhaneulFuneralFacilityRepository extends FuneralFacilityRepository {
  constructor({ endpoint, apiKey } = {}) { super(); this.endpoint = endpoint; this.apiKey = apiKey; }
  async search() {
    if (!this.endpoint || !this.apiKey) throw new Error('UNKNOWN: e하늘 API endpoint 또는 인증정보가 없습니다.');
    throw new Error('NOT_IMPLEMENTED: 공식 API 계약 승인 후 구현합니다.');
  }
}
