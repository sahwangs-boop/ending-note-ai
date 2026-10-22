import {HttpError} from '../shared/errors.mjs';

export const IFA_API_URL = process.env.IFA_API_URL || 'https://www.ifa.co.kr/Home/WebService.asmx/GetOpenData';

export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return /^010\d{8}$/.test(digits) ? digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '';
}

export function normalizeBirthDate(value, now = new Date()) {
  if (typeof value !== 'string') throw new HttpError(400, '생년월일을 YYMMDD 또는 YYYY-MM-DD 형식으로 입력해 주세요.');
  const compact = value.trim().replace(/[.\-/\s]/g, '');
  let year, month, day;
  if (/^\d{6}$/.test(compact)) {
    const shortYear = Number(compact.slice(0, 2));
    year = shortYear <= now.getFullYear() % 100 ? 2000 + shortYear : 1900 + shortYear;
    month = Number(compact.slice(2, 4));
    day = Number(compact.slice(4, 6));
  } else if (/^\d{8}$/.test(compact)) {
    year = Number(compact.slice(0, 4));
    month = Number(compact.slice(4, 6));
    day = Number(compact.slice(6, 8));
  } else {
    throw new HttpError(400, '생년월일을 YYMMDD 또는 YYYY-MM-DD 형식으로 입력해 주세요.');
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > now) {
    throw new HttpError(400, '유효한 생년월일을 입력해 주세요.');
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function insuranceAge(birth, now = new Date()) {
  const normalized = normalizeBirthDate(birth, now);
  const [year, month, day] = normalized.split('-').map(Number);
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age--;
  let months = now.getMonth() + 1 - month;
  if (now.getDate() < day) months--;
  if (months < 0) months += 12;
  if (months >= 6) age++;
  if (age < 0 || age > 120) throw new HttpError(400, '생년월일을 확인해 주세요.');
  return age;
}

export function recommendMethod(answers, now = new Date()) {
  const risk = Number(answers.invest_type_01), loss = Number(answers.invest_type_02);
  if (![1, 2, 3].includes(risk) || ![1, 2, 3].includes(loss)) throw new HttpError(400, '투자 성향 질문에 먼저 답해 주세요.');
  const score = risk + loss - 2;
  const birth = normalizeBirthDate(answers.cus_birth, now);
  const age = insuranceAge(birth, now);
  const target = Number(answers.target_age);
  if (!Number.isInteger(target) || target <= age || target > 85) throw new HttpError(400, '목표 나이는 보험나이보다 높고 85세 이하여야 합니다.');
  const years = target - age;
  const value = score <= 2 || years <= 10 ? 1 : 2;
  return {score, profile: score <= 2 ? '보수적 투자자' : '적극적 투자자', age, years, value,
    label: value === 1 ? '자동 배분 조절형' : '성장 추구형'};
}

export function buildApplicationPayload(input, item, now = new Date()) {
  const memberId = String(input.memberId ?? '').trim();
  if (!memberId || memberId.length > 100 || /[;\r\n\0]/.test(memberId)) throw new HttpError(400, '로그인 아이디를 확인해 주세요.');
  if (!['M', 'F'].includes(input.gender)) throw new HttpError(400, '성별을 선택해 주세요.');
  if (!normalizePhone(input.phone)) throw new HttpError(400, '휴대전화 번호를 확인해 주세요.');
  if (!item || !String(item.ifa_item_code ?? '').trim()) throw new HttpError(400, '신청 가능한 상품 정보를 확인해 주세요.');
  const answers = input.answers;
  if (!answers || ![1, 2, 3].includes(Number(answers.invest_type_01)) || ![1, 2, 3].includes(Number(answers.invest_type_02)) ||
      ![1, 2].includes(Number(answers.invest_purpose)) || ![1, 2].includes(Number(answers.gp_apply_yn)) || ![1, 2].includes(Number(answers.alarm_yn))) {
    throw new HttpError(400, '설문 응답을 모두 확인해 주세요.');
  }
  const birth = normalizeBirthDate(answers.cus_birth, now);
  const age = insuranceAge(birth, now);
  const target = Number(answers.target_age);
  if (!Number.isInteger(target) || target <= age || target > 85) throw new HttpError(400, '목표 나이는 보험나이보다 높고 85세 이하여야 합니다.');
  return {target:'VFANew',cmd:'VFAContractAdd',member_id:memberId,stock_code:'',item_code:String(item.item_code),
    invest_type_01:Number(answers.invest_type_01),invest_type_02:Number(answers.invest_type_02),invest_purpose:Number(answers.invest_purpose),
    target_age:target,cus_birth:birth,gp_apply_yn:String(answers.gp_apply_yn),alarm_yn:String(answers.alarm_yn),age:String(age)};
}

export function eligibleProducts(items) {
  return (Array.isArray(items) ? items : []).filter(item => item && String(item.item_code ?? '').trim() && String(item.ifa_item_code ?? '').trim());
}

const textValue = (record, keys) => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return '';
};

function listValue(value) {
  if (Array.isArray(value)) return value.map(item => String(item ?? '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (!text) return [];
  try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) return parsed.map(item => String(item ?? '').trim()).filter(Boolean); } catch {}
  return text.split(/[|,;\n]/).map(item => item.trim()).filter(Boolean);
}

function readablePurpose(value) {
  if (value === '1') return '노후 연금자산 마련';
  if (value === '2') return '기타 목적자금을 위한 투자';
  return value;
}

function readableMethod(value) {
  if (value === '1') return '자동 배분 조절형';
  if (value === '2') return '성장 추구형';
  return value;
}

function rebalancingRows(record) {
  const rows = record?.rebalancing ?? record?.rebalancing_list ?? record?.rebalancingList ?? record?.rebalancing_history ?? record?.rebalancingHistory;
  return Array.isArray(rows) ? rows.filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [];
}

function rebalancingDates(rows) {
  return [...new Set(rows.map(row => textValue(row, ['std_date','stdDate'])).filter(Boolean))].sort();
}

function buildRebalancingViewList(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const date = textValue(row, ['std_date','stdDate']);
    if (!date) continue;
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(row);
  }
  const dates = [...grouped.keys()].sort((a,b) => new Date(a) - new Date(b));
  if (!dates.length) return [];
  const today = new Date();
  today.setHours(0,0,0,0);
  const currentDate = dates.reduce((closest,date) => {
    const distance = Math.abs(new Date(date).setHours(0,0,0,0) - today.getTime());
    const closestDistance = Math.abs(new Date(closest).setHours(0,0,0,0) - today.getTime());
    return distance < closestDistance ? date : closest;
  }, dates[0]);
  const rounds = new Map();
  let round = 1;
  for (const date of dates) if (date !== currentDate) rounds.set(date, `${round++}회`);
  return dates.map(date => ({
    stdDate: date,
    label: date === currentDate ? '현재' : rounds.get(date),
    items: grouped.get(date).map(row => ({
      name: textValue(row, ['fund_name','fundName','name']) || '펀드',
      ratio: textValue(row, ['fund_ratio','fundRatio','ratio'])
    }))
  })).sort((a,b) => a.label === '현재' ? -1 : b.label === '현재' ? 1 : new Date(b.stdDate) - new Date(a.stdDate));
}

function inferredRebalanceCycle(dates) {
  if (dates.length < 2) return '';
  const gaps = dates.slice(1).map((date, index) => {
    const earlier = Date.parse(`${dates[index]}T00:00:00Z`);
    const later = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(earlier) && Number.isFinite(later) ? Math.round((later - earlier) / 86400000) : NaN;
  }).filter(days => days > 0);
  return gaps.length && gaps.every(days => days === gaps[0]) ? String(gaps[0]) : '';
}

function formatRebalancingDate(value) {
  const date = String(value ?? '').trim();
  const match = date.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}` : date;
}

function findFundRows(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 5) return [];
  if (Array.isArray(value)) {
    const rows = value.filter(item => item && typeof item === 'object' && !Array.isArray(item));
    if (rows.some(item => Object.keys(item).some(key => /fund|펀드/i.test(key)))) return rows;
    for (const item of value) { const nested = findFundRows(item, depth + 1); if (nested.length) return nested; }
    return [];
  }
  for (const [key, child] of Object.entries(value)) {
    if (/fund|portfolio|asset|alloc|펀드/i.test(key) && Array.isArray(child)) return child.filter(item => item && typeof item === 'object' && !Array.isArray(item));
  }
  for (const child of Object.values(value)) { const nested = findFundRows(child, depth + 1); if (nested.length) return nested; }
  return [];
}

export function normalizeMemberContracts(items) {
  const contracts = Array.isArray(items) ? items : [];
  return contracts.filter(item => item && typeof item === 'object' && !Array.isArray(item)).map(item => {
    const fundInfo = item.fundInfo ?? item.fund_info ?? {};
    const rebalanceRows = rebalancingRows(item);
    const rebalanceDates = rebalancingDates(rebalanceRows);
    const fundNames = listValue(fundInfo.fund_name_list ?? fundInfo.fundNameList ?? item.fund_name_list ?? item.fundNameList);
    const fundRatios = listValue(fundInfo.fund_ratio_list ?? fundInfo.fundRatioList ?? item.fund_ratio_list ?? item.fundRatioList);
    const fundRows = findFundRows(fundInfo).length ? findFundRows(fundInfo) : findFundRows(item);
    const nestedFunds = fundRows.map(fund => {
      const name = textValue(fund, ['fund_name','fund_nm','fundName','fund_title','item_name','item_display_name','name','title']);
      let ratio = textValue(fund, ['fund_ratio','ratio','allocation_ratio','alloc_ratio','weight','percent','percentage','rate','rate_value','fund_per','fund_rate']);
      if (!ratio) {
        const entry = Object.entries(fund).find(([key, value]) => /ratio|alloc|weight|percent|rate|비율/i.test(key) && (typeof value === 'number' || typeof value === 'string'));
        if (entry) ratio = String(entry[1]).trim();
      }
      return {name: name || '펀드', ratio: ratio ? (/%/.test(ratio) ? ratio : `${ratio}%`) : ''};
    }).filter(fund => fund.name !== '펀드' || fund.ratio);
    const listedFunds = fundNames.map((name, index) => {
      const rawRatio = fundRatios[index] ?? '';
      const numericRatio = Number(String(rawRatio).replace('%','').trim());
      const ratio = rawRatio && !String(rawRatio).includes('%') && Number.isFinite(numericRatio)
        ? `${numericRatio > 0 && numericRatio <= 1 ? numericRatio * 100 : numericRatio}%`
        : String(rawRatio);
      return {name, ratio};
    });
    const funds = listedFunds.length ? listedFunds : nestedFunds;
    const suppliedGroups = item.rebalancingViewList ?? item.rebalancing_view_list;
    const rebalancingViewList = Array.isArray(suppliedGroups) ? suppliedGroups.map(group => ({
      label: textValue(group, ['label']),
      stdDate: textValue(group, ['std_date','stdDate']),
      items: (Array.isArray(group?.items) ? group.items : []).map(row => ({name:textValue(row,['fund_name','fundName','name']) || '펀드',ratio:textValue(row,['fund_ratio','fundRatio','ratio'])}))
    })) : buildRebalancingViewList(rebalanceRows);
    const purposeValue = textValue(item, ['invest_purpose_name','purpose_name','invest_purpose_text','purpose_text','invest_purpose','purpose']);
    const methodValue = textValue(item, ['gp_apply_yn_name','invest_operation_type','operation_method_name','method_name','invest_method','operation_method','operation_type_name','gp_apply_yn']);
    return {
      companyName: textValue(item, ['corp_name','company_name','insurance_company','insurer_name','corp_nm']),
      productName: textValue(item, ['item_display_name','item_name','product_name','contract_name','prod_name','product_nm']),
      purpose: readablePurpose(purposeValue),
      method: readableMethod(methodValue),
      targetAge: textValue(item, ['target_age','retire_age','retirement_age']),
      recommendationDate: (textValue(fundInfo, ['create_dtm','reg_dtm']) || textValue(item, ['create_dtm','reg_dtm','recommend_date','recommend_created_at','created_date','create_date','create_dt'])).slice(0,10),
      nextRebalanceDate: (textValue(fundInfo, ['update_date']) || textValue(item, ['update_date','next_rebalance_date','next_rebalance_dt','next_rebalancing_date','next_rebalancing_dt','scheduled_rebalance_date','scheduled_rebalance_dt'])).slice(0,10),
      rebalanceCount: textValue(item, ['rebalancing_count','rebalancing_cnt','rebalance_count','rebalance_cnt','rebalance_count_text','rebalance_total_count']) || (rebalanceDates.length ? String(rebalanceDates.length) : ''),
      rebalanceCycle: textValue(fundInfo, ['update_days']) || textValue(item, ['update_days','rebalancing_cycle','rebalancing_period','rebalancing_term','rebalance_cycle','rebalance_period','rebalance_term','rebalance_cycle_days','rebalance_interval']) || inferredRebalanceCycle(rebalanceDates),
      lastRebalanceDate: formatRebalancingDate(textValue(item, ['last_rebalancing_date','last_rebalance_date','rebalancing_date','rebalancing_dt','rebalance_occurrence_date','rebalance_event_date','rebalance_create_date']) || rebalanceDates.at(-1) || ''),
      rebalancingViewList,
      contractId: textValue(item, ['id','contract_id','member_contract_id']),
      funds
    };
  });
}

export async function callIfa(payload, signal, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(IFA_API_URL, {method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal,redirect:'error'});
  } catch {
    throw new HttpError(502, 'iFA 서비스에 연결하지 못했습니다. 로그인 상태와 네트워크를 확인해 주세요.');
  }
  if (!response.ok) throw new HttpError(502, `iFA 서비스 응답 오류 (${response.status})`);
  let data;
  try {
    data = await response.json();
    if (typeof data.d === 'string') data = JSON.parse(data.d);
  } catch { throw new HttpError(502, 'iFA 서비스 응답 형식을 확인하지 못했습니다.'); }
  if (Number(data.result) !== 1) throw new HttpError(502, String(data.msg || 'iFA 서비스에서 요청을 처리하지 못했습니다.').slice(0, 500));
  return data;
}

export async function handleVfaAction(input, signal, fetchImpl = fetch) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, '요청 형식을 확인해 주세요.');
  if (input.action === 'companies') {
    const result = await callIfa({target:'VFANew',cmd:'VFACorpList'},signal,fetchImpl);
    const companies = (result.items || []).filter(item => item?.corp_code && item?.corp_name).map(item => ({corp_code:String(item.corp_code),corp_name:String(item.corp_name)}));
    return {message:'신청 가능한 보험사 목록입니다.',companies};
  }
  if (input.action === 'products') {
    const corpCode = String(input.corpCode ?? '').trim();
    if (!corpCode || corpCode.length > 30) throw new HttpError(400, '보험사를 먼저 선택해 주세요.');
    const result = await callIfa({target:'VFANew',cmd:'VFAItemList',corp_code:corpCode},signal,fetchImpl);
    const products = eligibleProducts(result.items).map(item => ({corp_code:corpCode,corp_name:String(item.corp_name || ''),item_code:String(item.item_code),ifa_item_code:String(item.ifa_item_code),item_name:String(item.item_display_name || item.item_name || '')}));
    return {message:'신청 가능한 상품 목록입니다.',products};
  }
  if (input.action === 'simulations') {
    const corpCode = String(input.corpCode ?? '').trim(), itemCode = String(input.itemCode ?? '').trim();
    if (!corpCode || corpCode.length > 30 || !itemCode || itemCode.length > 100) throw new HttpError(400, '보험사와 상품을 선택해 주세요.');
    const productList = await callIfa({target:'VFANew',cmd:'VFAItemList',corp_code:corpCode},signal,fetchImpl);
    const item = eligibleProducts(productList.items).find(value => String(value.item_code) === itemCode && String(value.corp_code || corpCode) === corpCode);
    if (!item) throw new HttpError(400, '선택한 상품의 시뮬레이션 대상 정보를 확인하지 못했습니다.');
    const result = await callIfa({target:'VFANew',cmd:'SimulList',item_code:itemCode},signal,fetchImpl);
    return {message:'선택한 상품의 VFA 알고리즘 테스트 성과입니다.',items:Array.isArray(result.items)?result.items:[]};
  }
  if (input.action === 'applications') {
    const memberId = String(input.memberId ?? '').trim();
    if (!memberId || memberId.length > 100 || /[;\r\n\0]/.test(memberId)) throw new HttpError(400, '로그인 아이디를 확인해 주세요.');
    const result = await callIfa({target:'VFANew',cmd:'MemberContractMP',member_id:memberId},signal,fetchImpl);
    const contracts = await Promise.all((Array.isArray(result.items) ? result.items : []).map(async contract => {
      const contractId = textValue(contract, ['id','contract_id','member_contract_id']);
      if (!contractId) return contract;
      const [fundInfoResult, rebalancingResult] = await Promise.allSettled([
        callIfa({target:'VFANew',cmd:'MemberContractView',id:contractId,member_id:memberId},signal,fetchImpl),
        callIfa({target:'VFANew',cmd:'RebalacingView',id:contractId},signal,fetchImpl)
      ]);
      const fundInfo = fundInfoResult.status === 'fulfilled' && Array.isArray(fundInfoResult.value.items) ? fundInfoResult.value.items[0] : null;
      const rebalancing = rebalancingResult.status === 'fulfilled' && Array.isArray(rebalancingResult.value.items) ? rebalancingResult.value.items : [];
      return {...contract,fundInfo:fundInfo || {},rebalancing};
    }));
    return {message:'신청하신 변액보험 펀드 서비스 목록입니다.',contracts:normalizeMemberContracts(contracts)};
  }
  if (input.action === 'submit') {
    const corpCode = String(input.corpCode ?? '').trim(), itemCode = String(input.itemCode ?? '').trim();
    if (!corpCode || !itemCode) throw new HttpError(400, '보험사와 상품을 선택해 주세요.');
    const list = await callIfa({target:'VFANew',cmd:'VFAItemList',corp_code:corpCode},signal,fetchImpl);
    const item = eligibleProducts(list.items).find(value => String(value.item_code) === itemCode && String(value.corp_code || corpCode) === corpCode);
    if (!item) throw new HttpError(400, '선택한 상품이 신청 대상인지 다시 확인해 주세요.');
    const answers = input.answers;
    const recommendation = recommendMethod(answers);
    if (!answers.consent) throw new HttpError(400, '서비스 안내에 동의해 주세요.');
    const payload = buildApplicationPayload(input,item);
    const result = await callIfa(payload,signal,fetchImpl);
    const saved = result.items?.[0] || {};
    return {message:'펀드 추천 서비스 신청이 완료되었습니다.',applicationId:String(saved.id || saved.member_contract_id || saved.application_id || ''),productName:String(item.item_display_name || item.item_name || ''),recommendation:recommendation.label};
  }
  if (input.action === 'cancel') {
    const memberId = String(input.memberId ?? '').trim();
    const applicationId = String(input.applicationId ?? '').trim();
    if (!memberId || memberId.length > 100 || /[;\r\n\0]/.test(memberId) || !applicationId || applicationId.length > 100) throw new HttpError(400, '취소할 신청 정보를 확인해 주세요.');
    const existing = await callIfa({target:'VFANew',cmd:'MemberContractMP',member_id:memberId},signal,fetchImpl);
    const current = (Array.isArray(existing.items) ? existing.items : []).find(item => textValue(item, ['id','contract_id','member_contract_id']) === applicationId);
    const contractId = textValue(current, ['id','contract_id','member_contract_id']);
    if (!contractId) throw new HttpError(400, '이 아이디에서 취소할 신청을 찾지 못했습니다. 신청 목록을 새로고침한 뒤 다시 시도해 주세요.');
    await callIfa({target:'VFANew',cmd:'MemberContractDel',member_id:memberId,id:contractId},signal,fetchImpl);
    return {message:'서비스 신청을 취소했습니다.',cancelled:true};
  }
  throw new HttpError(400, '지원하지 않는 VFA 요청입니다.');
}
