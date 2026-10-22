const FUNERAL_TOPIC = /장례|부고|조문|빈소|수의|화환|영정|화장|매장|장지|봉안|수목장|추모/;

export const FUNERAL_GUIDE_STEPS = Object.freeze([
  Object.freeze({ id: 'funeral-form', areaId: 'funeral', fieldKey: 'ceremonyForm', question: '먼저 어떤 형식의 장례가 편하신가요?', help: '장례 형식은 의식의 분위기를 정하는 항목이에요. 종교나 집안 전통이 없다면 간소하게 준비해도 괜찮습니다.', choices: Object.freeze([
    ['traditional', '전통식으로 준비', '전통식 장례로 준비하고 싶어요.'], ['religious', '종교식으로 준비', '종교식 장례로 준비하고 싶어요.'], ['simple', '종교 의식 없이 간소하게', '종교 의식 없이 간소하게 준비하고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-scale', areaId: 'funeral', fieldKey: 'scale', question: '부고를 알리고 조문을 받을 범위는 어느 정도가 좋으세요?', help: '범위에 따라 빈소 크기와 식사 준비가 달라져요. 정확한 인원보다 누구까지 알릴지를 먼저 정하면 쉽습니다.', choices: Object.freeze([
    ['none', '알리지 않음·무빈소', '부고를 널리 알리지 않고 무빈소로 진행하고 싶어요.'], ['family', '직계가족 중심', '직계가족 중심의 작은 장례를 원해요.'], ['close', '가까운 친지·지인까지', '가까운 친지와 지인까지 부고를 알리고 싶어요.'], ['many', '많은 조문객', '가능한 많은 분께 부고를 알리는 일반 장례를 원해요.']
  ]) }),
  Object.freeze({ id: 'funeral-guests', areaId: 'funeral', fieldKey: 'expectedGuests', question: '예상 조문객 수와 필요한 빈소 규모를 골라볼까요?', help: '조문객 수는 식음료비와 빈소 사용료에 가장 큰 영향을 줍니다. 아래 금액은 3일장 기준 참고 범위이며 실제 견적은 달라질 수 있습니다.', skipWhen: summary => /무빈소|직계가족/.test(valueOf(summary, 'funeral', 'scale')), choices: Object.freeze([
    ['small', '소규모 50~70명 · 30~45평 · 약 600~850만원', '예상 조문객은 50~70명, 빈소는 30~45평 규모로 계획하고 총 장례비는 약 600~850만원을 참고하겠습니다.'],
    ['standard', '중소규모 100~150명 · 45~60평 · 약 1,000~1,400만원', '예상 조문객은 100~150명, 빈소는 45~60평 규모로 계획하고 총 장례비는 약 1,000~1,400만원을 참고하겠습니다.'],
    ['large', '중대규모 200~300명 · 70~90평 · 약 1,500~2,150만원', '예상 조문객은 200~300명, 빈소는 70~90평 규모로 계획하고 총 장례비는 약 1,500~2,150만원을 참고하겠습니다.'],
    ['special', '대규모 300~500명 · 100~120평 · 약 2,100~3,200만원', '예상 조문객은 300~500명, 빈소는 100~120평 규모로 계획하고 총 장례비는 약 2,100~3,200만원을 참고하겠습니다.'],
    ['vip', '특대규모 500명 이상 · 150평 이상 · 약 3,200~5,000만원+', '예상 조문객은 500명 이상, 빈소는 150평 이상 규모로 계획하고 총 장례비는 약 3,200~5,000만원 이상을 참고하겠습니다.']
  ]) }),
  Object.freeze({ id: 'funeral-hall-region', areaId: 'funeral', fieldKey: 'funeralHallRegion', question: '장례식장은 어느 지역에서 알아볼까요?', help: '가족이 이동하기 편한 지역이나 거주지 가까운 곳을 먼저 정하면 e하늘에서 시설과 가격을 비교하기 쉽습니다.', choices: Object.freeze([
    ['seoul', '서울', '서울 지역 장례식장을 알아보고 싶어요.'], ['gyeonggi', '경기', '경기 지역 장례식장을 알아보고 싶어요.'], ['incheon', '인천', '인천 지역 장례식장을 알아보고 싶어요.'], ['metropolitan', '그 밖의 광역시', '부산·대구·대전·광주·울산 등 광역시에서 알아보고 싶어요.'], ['other', '다른 지역 직접 입력', '장례식장 희망 지역을 직접 입력하고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-hall-criteria', areaId: 'funeral', fieldKey: 'funeralHallCriteria', question: '장례식장을 고를 때 무엇을 가장 중요하게 볼까요?', help: 'e하늘에서는 위치, 시설·편의 여부와 장례용품 가격 등을 확인할 수 있습니다. 실제 빈소 이용 가능 여부와 최종 가격은 시설에 다시 확인해야 합니다.', choices: Object.freeze([
    ['distance', '가족의 이동 거리', '가족과 가까운 위치를 가장 중요하게 보고 싶어요.'], ['price', '시설·용품 가격', '시설 사용료와 장례용품 가격을 우선 비교하고 싶어요.'], ['rooms', '빈소 규모와 시설', '빈소 규모와 편의시설을 중요하게 보고 싶어요.'], ['hospital', '병원 연계 편의', '병원에서 이동하기 편한 장례식장을 찾고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-goods', areaId: 'funeral', fieldKey: 'goods', question: '제단 장식과 장례용품은 어느 정도로 준비할까요?', help: '기존 앱은 기본형·일반형·고급형으로 나누었어요. 실제 구성과 비용은 장례식장과 시점에 따라 달라질 수 있습니다.', skipWhen: summary => valueOf(summary, 'funeral', 'scale').includes('무빈소'), choices: Object.freeze([
    ['basic', '기본에 충실하게', '제단과 장례용품은 기본형으로 준비하고 싶어요.'], ['standard', '일반적인 수준으로', '제단과 장례용품은 일반형으로 준비하고 싶어요.'], ['premium', '충분히 예를 갖춰서', '제단과 장례용품은 고급형으로 준비하고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-shroud', areaId: 'funeral', fieldKey: 'shroud', question: '수의나 입관할 때 입을 옷은 어떻게 준비할까요?', help: '기존 앱에서는 전통 수의, 미리 준비한 수의, 나에게 의미 있는 옷 중에서 선택할 수 있었습니다.', choices: Object.freeze([
    ['traditional', '전통 수의', '전통 수의를 준비하고 싶어요.'], ['prepared', '미리 준비한 수의', '미리 준비해 둔 수의를 사용하고 싶어요.'], ['meaningful', '나에게 의미 있는 옷', '수의 대신 나에게 의미 있는 옷을 입고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-condolence', areaId: 'funeral', fieldKey: 'condolencePolicy', question: '부의금과 화환은 어떻게 하고 싶으세요?', help: '받지 않기, 가족 뜻에 맡기기, 일부를 기부하기처럼 원칙만 기록해도 됩니다.', choices: Object.freeze([
    ['accept', '가족의 뜻에 맡기기', '부의금과 화환은 가족의 뜻에 맡기고 싶어요.'], ['decline', '정중히 받지 않기', '부의금과 화환은 정중히 받지 않고 싶어요.'], ['donate', '부의금 일부 기부', '부의금의 일부를 기부하고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-meal', areaId: 'funeral', fieldKey: 'mealPlan', question: '조문객 식사는 어떻게 준비할까요?', help: '현재 선택한 장례 규모의 예상 조문객 수를 기준으로 계산한 참고 금액입니다. 실제 단가와 인원은 장례식장 견적에서 다시 확인해야 합니다.', choicesFor: summary => mealChoices(summary) }),
  Object.freeze({ id: 'funeral-reception', areaId: 'funeral', fieldKey: 'guestReception', question: '조문객 응대는 어떻게 준비할까요?', help: '가족이 직접 맡거나 의전 도우미를 추가할 수 있습니다. 아래 금액은 인력 추가 비용의 예시입니다.', choices: Object.freeze([
    ['family', '가족 중심 응대 · 추가 0원', '조문객 응대는 가족 중심으로 하고 추가 비용은 두지 않겠습니다.'], ['helper4', '의전 도우미 4명 · 약 48만원', '조문객 응대를 위해 의전 도우미 4명을 추가하고 약 48만원을 예상합니다.'], ['helper6', '의전 도우미 6명 · 약 72만원', '조문객 응대를 위해 의전 도우미 6명을 추가하고 약 72만원을 예상합니다.'], ['later', '장례식장 상담 후 결정 · 금액 미정', '조문객 응대 인력은 장례식장 상담 후 결정하고 금액은 미정으로 두겠습니다.']
  ]) }),
  Object.freeze({ id: 'funeral-music', areaId: 'funeral', fieldKey: 'music', question: '장례식에서 들려주고 싶은 음악이 있나요?', help: '평소 좋아했던 노래, 가족과 추억이 있는 곡, 종교 음악처럼 분위기만 정해도 충분합니다.', choices: Object.freeze([
    ['classic', '잔잔한 클래식', '장례식에는 잔잔한 클래식 음악을 틀고 싶어요.'], ['favorite', '내가 좋아하던 노래', '제가 좋아하던 노래를 장례식에서 들려주고 싶어요.'], ['family', '가족과 추억이 있는 노래', '가족과 추억이 있는 노래를 들려주고 싶어요.'], ['silent', '음악 없이 조용하게', '음악 없이 조용하게 진행하고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-flowers', areaId: 'funeral', fieldKey: 'flowers', question: '꽃과 제단 장식은 어떤 분위기가 좋으세요?', help: '흰 꽃 중심, 좋아하는 꽃, 계절 생화, 최소한의 장식처럼 분위기만 골라도 나중에 바꿀 수 있어요.', choices: Object.freeze([
    ['white', '흰 꽃 위주의 단정한 제단', '흰 꽃 위주의 단정한 제단을 원해요.'], ['favorite', '내가 좋아하는 꽃', '제가 좋아하는 꽃으로 장식하고 싶어요.'], ['seasonal', '계절 생화로 자연스럽게', '계절 생화로 자연스럽게 꾸미고 싶어요.'], ['minimal', '꽃 장식은 최소한으로', '꽃 장식은 최소한으로 하고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-portrait', areaId: 'funeral', fieldKey: 'portrait', question: '영정사진은 어떤 모습으로 남기고 싶으세요?', help: '사진 파일은 지금 올리지 않아도 됩니다. 자연스러운 일상 사진처럼 원하는 느낌만 기록할 수 있어요.', choices: Object.freeze([
    ['natural', '자연스러운 일상 사진', '영정사진은 자연스러운 일상 사진으로 하고 싶어요.'], ['formal', '단정한 정장 사진', '영정사진은 단정한 정장 사진으로 하고 싶어요.'], ['family', '가족이 좋은 사진을 선택', '영정사진은 가족이 좋은 사진을 선택해 주면 좋겠어요.']
  ]) }),
  Object.freeze({ id: 'burial-method', areaId: 'burial', fieldKey: 'method', question: '장례 후에는 화장과 매장 중 어느 쪽을 생각하고 계세요?', help: '화장은 이후 봉안당·수목장·잔디장·해양장 등을 선택할 수 있고, 매장은 선산이나 공원묘지 등을 검토하게 됩니다.', choices: Object.freeze([
    ['cremation', '화장', '장법은 화장으로 하고 싶어요.'], ['burial', '매장', '장법은 매장으로 하고 싶어요.']
  ]) }),
  Object.freeze({ id: 'burial-place', areaId: 'burial', fieldKey: 'placeType', question: '이후 어디에 모시는 방식이 마음에 가까우세요?', help: '기존 앱에서는 봉안당·봉안묘·수목장·잔디장·해양장·산골, 매장 시 선산·공원묘지·국립묘지를 안내했습니다.', choicesFor: summary => valueOf(summary, 'burial', 'method').includes('매장') ? Object.freeze([
    ['family-land', '개인 선산', '장지는 개인 선산을 생각하고 있어요.'], ['cemetery', '공원묘지', '장지는 공원묘지를 생각하고 있어요.'], ['national', '국립묘지 자격 확인', '국립묘지 안장 가능 여부를 알아보고 싶어요.']
  ]) : Object.freeze([
    ['columbarium', '봉안당', '화장 후 봉안당에 모시고 싶어요.'], ['tree', '수목장', '화장 후 수목장을 원해요.'], ['grass', '잔디장', '화장 후 잔디장을 원해요.'], ['sea', '해양장', '화장 후 해양장을 원해요.'], ['scatter', '산골', '화장 후 산골 방식도 알아보고 싶어요.']
  ]) }),
  Object.freeze({ id: 'burial-detail', areaId: 'burial', fieldKey: 'detailType', question: '개인형·부부형·가족형처럼 함께 모실 범위도 정해볼까요?', help: '장지에 따라 가능한 형태가 다르므로 지금은 희망만 기록하고 실제 시설 정보는 나중에 확인하면 됩니다.', choices: Object.freeze([
    ['individual', '개인형', '장지는 개인형을 우선 생각하고 있어요.'], ['couple', '부부형', '장지는 부부형을 생각하고 있어요.'], ['family', '가족형', '장지는 가족형을 생각하고 있어요.']
  ]) })
]);

export const FUNERAL_OPTIONAL_STEPS = Object.freeze([
  Object.freeze({ id: 'funeral-announcement', areaId: 'funeral', fieldKey: 'announcementScope', question: '부고는 누구에게, 어떤 방식으로 알릴까요?', help: '연락 범위와 방법을 미리 남기면 가족이 급한 상황에서 판단하기 쉬워집니다.', choices: Object.freeze([
    ['family', '가족·가까운 친지만', '부고는 가족과 가까운 친지에게만 알리고 싶어요.'],
    ['contacts', '지인·직장 연락처까지', '부고는 지인과 직장 연락처까지 알리고 싶어요.'],
    ['public', '모바일 부고장으로 넓게', '모바일 부고장을 만들어 넓게 알리고 싶어요.'],
    ['delegate', '범위는 가족이 결정', '부고를 알릴 범위와 방법은 가족에게 맡기고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-transport', areaId: 'funeral', fieldKey: 'transport', question: '장례식 이동 차량은 어떻게 준비할까요?', help: '고인 이송, 유족 이동, 장지 이동에 필요한 차량을 구분해 생각하면 편합니다. 실제 비용은 거리와 업체에 따라 달라집니다.', choices: Object.freeze([
    ['basic', '기본 장의차만 준비', '장례식 이동 차량은 기본 장의차만 준비하고 싶어요.'],
    ['bus', '유족·조문객 버스 포함', '장지 이동을 위해 유족과 조문객용 버스도 준비하고 싶어요.'],
    ['family', '가족 차량 중심', '가까운 이동은 가족 차량을 중심으로 준비하고 싶어요.'],
    ['quote', '거리 확인 후 견적', '이동 거리와 인원을 확인한 뒤 차량 견적을 받고 싶어요.']
  ]) }),
  Object.freeze({ id: 'funeral-funding', areaId: 'funeral', fieldKey: 'fundingSource', question: '장례 비용은 어떤 방법으로 준비해 둘까요?', help: '정확한 계좌번호는 적지 않고, 가족이 확인할 수 있는 재원과 보관 위치만 기록해 주세요.', choices: Object.freeze([
    ['insurance', '보험금·상조 서비스', '장례 비용은 보험금이나 가입한 상조 서비스로 준비하고 싶어요.'],
    ['reserve', '별도 예비자금', '장례 비용을 위한 별도 예비자금을 마련해 두고 싶어요.'],
    ['family', '가족과 분담', '장례 비용은 가족과 상의해 분담하고 싶어요.'],
    ['later', '예상 총액 확인 후 결정', '예상 장례 비용을 확인한 뒤 마련 방법을 정하고 싶어요.']
  ]) }),
  Object.freeze({ id: 'aftercare-first-actions', areaId: 'aftercare', fieldKey: 'firstActions', question: '사망 직후 가족이 가장 먼저 확인할 내용을 남겨둘까요?', help: '연락할 사람, 장례 관련 계약, 중요 문서 위치처럼 급한 순서만 간단히 적어도 도움이 됩니다.', choices: Object.freeze([
    ['contact', '먼저 연락할 사람', '사망 직후 가족이 먼저 연락할 사람과 연락 순서를 정리하고 싶어요.'],
    ['documents', '계약·중요 문서 위치', '장례 계약과 중요 문서의 보관 위치를 먼저 확인하도록 남기고 싶어요.'],
    ['funeral', '장례 계획부터 확인', '가족이 이 Ending Note의 장례 계획부터 확인하도록 남기고 싶어요.'],
    ['write', '직접 순서를 적을게요', '사망 직후 가족이 할 일을 제가 직접 순서대로 적고 싶어요.']
  ]) })
]);

export const FUNERAL_MORE_TOPICS = Object.freeze([
  Object.freeze({ id: 'hall', label: '장례식장과 지역 다시 보기', stepId: 'funeral-hall-region' }),
  Object.freeze({ id: 'cost', label: '예상 비용과 마련 방법', stepId: 'funeral-funding' }),
  Object.freeze({ id: 'announcement', label: '부고 문구와 알릴 방법', stepId: 'funeral-announcement' }),
  Object.freeze({ id: 'transport', label: '장례식 이동 차량', stepId: 'funeral-transport' }),
  Object.freeze({ id: 'meal', label: '음식과 조문객 응대 다시 보기', stepId: 'funeral-meal' }),
  Object.freeze({ id: 'aftercare', label: '사후 행정 준비', stepId: 'aftercare-first-actions' })
]);

export function funeralGuidanceForStep(stepId, planSummary = []) {
  const step = [...FUNERAL_GUIDE_STEPS, ...FUNERAL_OPTIONAL_STEPS].find(item => item.id === stepId);
  if (!step) return null;
  const sourceChoices = step.choicesFor ? step.choicesFor(planSummary) : step.choices;
  return Object.freeze({ complete: false, stepId: step.id, areaId: step.areaId, fieldKey: step.fieldKey, question: step.question, help: step.help, choices: Object.freeze([
    ...sourceChoices.map(([id, label, prompt]) => Object.freeze({ id, label, prompt, kind: 'prompt' })),
    Object.freeze({ id: 'later', label: '나중에 정할게요', kind: 'defer', prompt: '이 항목은 아직 정하지 않고 다른 항목을 볼게요.' })
  ]) });
}

function valueOf(summary, areaId, fieldKey) { return summary.find(item => item.areaId === areaId && item.fieldKey === fieldKey)?.value || ''; }
function mealChoices(summary) { const scale=valueOf(summary,'funeral','scale'),guest=valueOf(summary,'funeral','expectedGuests'),match=guest.match(/(\d+)(?:~(\d+))?명/),people=match?Math.round((Number(match[1])+Number(match[2]||match[1]))/2):scale.includes('많은')?300:scale.includes('직계가족')?50:scale.includes('무빈소')?0:100,amount=unit=>Math.round(people*unit/10000); return Object.freeze([
  ['snack',`간단한 다과 · 약 ${amount(5000)}만원 (${people}명)`,`조문객 식사는 간단한 다과로 준비하고 약 ${amount(5000)}만원을 예상합니다.`],
  ['lunchbox',`도시락 · 약 ${amount(12000)}만원 (${people}명)`,`조문객 식사는 도시락으로 준비하고 약 ${amount(12000)}만원을 예상합니다.`],
  ['hall',`장례식장 식사 · 약 ${amount(25000)}만원 (${people}명)`,`조문객 식사는 장례식장 식사로 준비하고 약 ${amount(25000)}만원을 예상합니다.`],
  ['family','가족에게 맡기기 · 금액 미정','조문객 식사는 가족에게 맡기고 금액은 미정으로 두겠습니다.']
]); }
function hasField(summary, areaId, fieldKey) { return summary.some(item => item.areaId === areaId && item.fieldKey === fieldKey); }
function isFuneralContext(question, summary, candidates = []) { return FUNERAL_TOPIC.test(question) || summary.some(item => ['funeral', 'burial'].includes(item.areaId)) || candidates.some(item => ['funeral', 'burial'].includes(item.areaId)); }

export function nextFuneralGuidance({ question = '', planSummary = [], candidates = [] }) {
  if (!isFuneralContext(question, planSummary, candidates)) return null;
  const effective = [...planSummary, ...candidates.map(item => ({ areaId: item.areaId, fieldKey: item.fieldKey, value: item.value, status: item.status }))];
  const step = FUNERAL_GUIDE_STEPS.find(item => !hasField(effective, item.areaId, item.fieldKey) && !item.skipWhen?.(effective));
  if (!step) return Object.freeze({ complete: true, question: '장례와 장지의 기본 계획을 정리했어요. 웹 App에서 전체 내용을 확인하거나, 더 이야기하고 싶은 항목을 말씀해 주세요.', choices: Object.freeze([
    Object.freeze({ id: 'review', label: '웹 App에서 확인', kind: 'link', href: './app.html' }), Object.freeze({ id: 'more', label: '다른 장례 항목 이야기', kind: 'menu', prompt: '' })
  ]) });
  const sourceChoices = step.choicesFor ? step.choicesFor(effective) : step.choices;
  return Object.freeze({ complete: false, stepId: step.id, areaId: step.areaId, fieldKey: step.fieldKey, question: step.question, help: step.help, choices: Object.freeze([
    ...sourceChoices.map(([id, label, prompt]) => Object.freeze({ id, label, prompt, kind: 'prompt' })),
    Object.freeze({ id: 'unknown', label: '잘 모르겠어요', kind: 'help', prompt: `${step.question} 아직 잘 모르겠어요. 선택 기준을 쉽게 설명해 주세요.` }),
    Object.freeze({ id: 'later', label: '나중에 정할게요', kind: 'defer', prompt: '이 항목은 아직 정하지 않고 다음으로 넘어갈게요.' })
  ]) });
}

export function applyConversationGuide({ question, planSummary, response }) {
  const guidance = nextFuneralGuidance({ question, planSummary, candidates: response.planCandidates || [] });
  return guidance ? { ...response, nextQuestion: guidance.question, guidance } : response;
}

export function resolveGuidedChoice({ stepId, choiceId, planSummary = [], documentId }) {
  const step = [...FUNERAL_GUIDE_STEPS, ...FUNERAL_OPTIONAL_STEPS].find(item => item.id === stepId);
  if (!step) return null;
  const available = step.choicesFor ? step.choicesFor(planSummary) : step.choices;
  const selected = available.find(([id]) => id === choiceId);
  if (!selected) return null;
  const [, label, prompt] = selected;
  const candidate = Object.freeze({ candidateId: `guided-${step.id}-${Date.now().toString(36)}`, areaId: step.areaId, fieldKey: step.fieldKey, value: label, evidence: prompt, status: 'AI_EXTRACTED', confirmedValue: null });
  const guidance = nextFuneralGuidance({ question: prompt, planSummary, candidates: [candidate] });
  return Object.freeze({
    action: 'consultation_reply', mode: 'GUIDED', documentId,
    schemaVersion: 'ending-note-consultation.r2', intent: 'PLAN_CREATE',
    answer: `${label} 희망으로 정리했어요. 이 내용을 Ending Note에 반영할까요?`,
    citations: [], notices: [], planCandidates: [candidate],
    nextQuestion: guidance?.question || null, guidance, offerToSave: true, requiresConfirmation: true,
    metrics: { latencyMs: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  });
}
