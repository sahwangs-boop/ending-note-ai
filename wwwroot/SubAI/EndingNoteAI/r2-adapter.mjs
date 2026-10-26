import { HttpError } from '../shared/errors.mjs';
import { selectKnowledge, knowledgePrompt } from './r2-knowledge.mjs';
import { R2_RESPONSE_SCHEMA, validateR2Response } from './r2-schema.mjs';

const SYSTEM = `당신은 Ending Note AI 상담 오케스트레이터입니다.
사용자의 질문에 먼저 직접 답하세요. 기존 앱 자료는 참고 정보이며 notices에 최신성 안내를 포함하세요.
단순 문의나 비교 요청은 상담 답변만 제공하고 planCandidates를 만들지 마세요.
사용자가 자신의 희망·계획을 말하거나 기존 계획을 수정할 때만 planCandidates를 만드세요.
후보는 사용자 발언에 있는 사실만 사용하고 evidence는 원문의 정확한 연속 부분문자열이어야 합니다.
evidence는 절대 요약하거나 조사·어미를 바꾸지 말고 사용자 문장에서 가장 짧은 근거 구절을 그대로 복사하세요. 예: '가족장', '화장', '수목장', '가상 동생', '가족에게 고맙다고'.
후보는 AI_EXTRACTED이며 사용자 확인 전에는 절대 확정하지 않습니다.
한 발언에 여러 영역의 계획이 있으면 각각 분리하세요.
이미 제공된 계획을 반복 질문하지 말고, 필요할 때만 한 번에 하나의 짧은 후속 질문을 하세요.
비밀번호·PIN·복구키·주민등록번호·계좌번호 입력을 요구하지 마세요.
상속세·장례비용·법률효력·의료절차도 설명할 수 있지만 기준일과 참고 성격을 명확히 하세요.`;

const FIELD_GUIDE = `계획 후보 필드 규칙:
- funeral.ceremonyForm: 전통식·종교식 등 장례 형식
- funeral.scale: 무빈소·가족장·조문객 범위 등 장례 규모
- funeral.religion/announcementScope/portrait/music/flowers/goods/transport/estimatedCost: 해당 세부 희망
- burial.method: 화장·매장, burial.placeType: 수목장·봉안당 등 장지 형태, burial.detailType/preferredArea/reason: 세부 희망
- will.assets: 재산 종류, will.beneficiaries: 받을 사람, will.distributionWishes: 배분 의사, will.executorWish/specialRequests: 집행·당부
- aftercare.accounts/subscriptions/digitalAssets/devices/administrativeTasks: 디지털·행정 사후정리
- giving.donationWishes/organDonationWish: 기부·장기기증 의사
- pet.pets/caregiverWish/careInstructions: 반려동물 정보·담당자·돌봄 요청
- messages.recipientMessages/lastRequests: 가족·지인 메시지와 마지막 당부
- life.lifeStory/values/bucketList, memento.items/disposalWishes/memorialWishes, people.importantPeople/delegates
가족장은 ceremonyForm이 아니라 funeral.scale입니다.
citations에는 제공된 [ID]의 ID 문자열만 대괄호 없이 넣으세요. 지식 문장이나 사용자 원문을 citations에 넣지 마세요.
planCandidates가 하나라도 있으면 offerToSave와 requiresConfirmation은 반드시 true입니다. 후보가 없으면 requiresConfirmation은 false입니다.`;
const CONFIRMATION_LANGUAGE = `사용자가 확인하기 전에는 '저장했습니다', '반영했습니다', '저장하겠습니다'라고 말하지 마세요. 후보가 있으면 반드시 '이 내용을 계획에 반영할까요?'처럼 확인을 요청하세요.`;

function outputText(result) {
  return result.output.flatMap(item => item.type === 'message' && item.role === 'assistant' ? item.content ?? [] : []).filter(item => item.type === 'output_text').map(item => item.text).join('');
}

export async function consultRemote({ agent, question, history, planSummary, respond, signal }) {
  if (typeof respond !== 'function') throw new HttpError(503, 'Remote AI 연결을 사용할 수 없습니다.');
  const knowledge = selectKnowledge(question);
  const started = Date.now();
  const result = await respond({
    instructions: `${agent.instructions}\n\n${SYSTEM}\n\n${FIELD_GUIDE}\n${CONFIRMATION_LANGUAGE}\n\n허용된 citation ID: ${knowledge.map(item => item.id).join(', ')}\n허용된 기존 엔딩노트 지식:\n${knowledgePrompt(knowledge)}`,
    input: [...history.slice(-12).map(item => ({ role: item.role, content: item.text })), { role: 'user', content: JSON.stringify({ question, currentPlan: planSummary }) }],
    text: { format: { type: 'json_schema', name: 'ending_note_consultation', strict: true, schema: R2_RESPONSE_SCHEMA } }
  }, signal);
  const raw = outputText(result);
  if (!raw) throw new HttpError(502, 'Remote AI 상담 응답이 비어 있습니다. 다시 시도해 주세요.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new HttpError(502, 'Remote AI 상담 응답을 읽지 못했습니다. 다시 시도해 주세요.'); }
  return {
    data: validateR2Response(parsed, question, knowledge.map(item => item.id)),
    metrics: { latencyMs: Date.now() - started, inputTokens: result.usage?.input_tokens ?? null, outputTokens: result.usage?.output_tokens ?? null, totalTokens: result.usage?.total_tokens ?? null }
  };
}

export function consultFallback(question) {
  const knowledge = selectKnowledge(question, 4);
  const facts = knowledge.flatMap(item => item.facts).slice(0, 5);
  const introduction = /엔딩\s*노트|엔딩노트/.test(question)
    ? '엔딩노트는 본인의 삶과 마지막 희망을 미리 정리해, 가족이 장례·재산·사후 행정 과정에서 당황하거나 다투지 않도록 돕는 기록입니다.'
    : '현재 AI 연결이 원활하지 않아 검증된 엔딩노트 기본 자료를 바탕으로 안내드립니다.';
  return {
    schemaVersion: 'ending-note-consultation.r2',
    intent: 'INFORMATION',
    answer: `${introduction}\n\n${facts.map(fact => `• ${fact}`).join('\n')}\n\n웹 App에서 내용을 직접 작성하거나 아래 선택 항목으로 계속 진행할 수 있습니다.`,
    citations: knowledge.map(item => item.id),
    notices: ['현재 원격 AI 연결이 원활하지 않아 기본 안내 모드로 답변했습니다.', '비용·법률·세무·의료 정보는 실제 실행 전에 최신 기관 또는 전문가 확인이 필요합니다.'],
    planCandidates: [],
    nextQuestion: '장례 준비, 유언·재산, 사후 정리, 남기는 마음 중 어떤 항목부터 정리할까요?',
    offerToSave: false,
    requiresConfirmation: false
  };
}

