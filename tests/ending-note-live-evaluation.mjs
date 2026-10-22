// 명시적으로 실행할 때만 실제 API를 호출합니다. 합성 데이터만 사용합니다.
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../shared/config.mjs';
import { loadAgents } from '../shared/registry.mjs';
import { createOpenAiClient } from '../shared/openai.mjs';
import { extractRemote } from '../EndingNoteAI/llm-adapter.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = await loadConfig(root);
if (!config.apiKey) throw new Error('OPENAI_API_KEY가 없어 실제 LLM 평가를 실행할 수 없습니다.');
const agent = (await loadAgents(root, config.agentsDirectory)).get('EndingNoteAI');
const respond = createOpenAiClient(config);

// 실행 전에 확정한 기준: 기대 영역/필드가 모두 포함되고 잘못된 영역이 없으며,
// 모든 후보가 AI_EXTRACTED·확인 필요·원문 근거 일치여야 데이터 정확도 PASS.
// 대화 품질은 주제 적합성, 간결한 단일 후속 질문, 반복 방지 각 0~2점(평균 1.5 이상)을 기준으로 한다.
const cases = [
  { id: 1, name: '엔딩노트를 모르는 사용자', section: 'life', questionId: 'Q-LIFE-01', text: '엔딩노트가 무엇인지 잘 모르겠어요.', expected: [] },
  { id: 2, name: '삶의 기록부터 시작', section: 'life', questionId: 'Q-LIFE-02', text: '가상 가족과 떠난 제주 여행이 가장 소중한 기억이에요.', expected: ['Q-LIFE-02'] },
  { id: 3, name: '장례 준비부터 시작', section: 'life', questionId: 'Q-LIFE-01', text: '장례는 가족 중심으로 조용히 하고 화장 후 수목장을 원해요.', expected: ['Q-FUNERAL-01', 'Q-FUNERAL-02'] },
  { id: 4, name: '가족 메시지부터 시작', section: 'life', questionId: 'Q-LIFE-01', text: '가상 딸에게 늘 고맙고 사랑한다고 남기고 싶어요.', expected: ['Q-MSG-01', 'Q-MSG-02'] },
  { id: 5, name: '여러 영역 동시 발화', section: 'life', questionId: 'Q-LIFE-01', text: '제주 여행을 기억하고, 가상 아파트는 가상 딸에게 남기며, 장례는 가족장으로 하고, 가상 배우자에게 고맙다고 전하고 싶어요.', expected: ['Q-LIFE-02', 'Q-WILL-01', 'Q-WILL-02', 'Q-FUNERAL-01', 'Q-MSG-01', 'Q-MSG-02'] },
  { id: 6, name: '답변 도중 생각 변경', section: 'funeral', questionId: 'Q-FUNERAL-01', text: '아까 가족장이라고 했지만 조문객이 올 수 있는 일반 장례로 바꾸고 싶어요.', expected: ['Q-FUNERAL-01'], history: [{ role: 'user', text: '장례는 가족장으로 하고 싶어요.' }, { role: 'assistant', text: '가족장 희망을 후보로 정리했습니다.' }] },
  { id: 7, name: '미정과 건너뛰기', section: 'funeral', questionId: 'Q-FUNERAL-02', text: '장지는 아직 정하지 않았고 이 질문은 넘어갈게요.', expected: [], disposition: ['UNDECIDED', 'SKIPPED'] },
  { id: 8, name: '기존 내용 정정', section: 'will', questionId: 'Q-WILL-02', text: '가상 딸이 아니라 가상 조카에게 남기고 싶어요.', expected: ['Q-WILL-02'], history: [{ role: 'user', text: '가상 딸에게 남기고 싶어요.' }, { role: 'assistant', text: '받을 사람을 가상 딸로 정리했습니다.' }] },
  { id: 9, name: '모호한 답변', section: 'message', questionId: 'Q-MSG-02', text: '그냥 잘 부탁해요.', expected: [] },
  { id: 10, name: '중단 후 재개', section: 'message', questionId: 'Q-MSG-02', text: '이어서 가상 가족에게 늘 고마웠다고 남길게요.', expected: ['Q-MSG-01', 'Q-MSG-02'], history: [{ role: 'user', text: '가족에게 할 말을 나중에 이어서 정리할게요.' }, { role: 'assistant', text: '저장하고 잠시 멈췄습니다.' }] }
];

const results = [];
for (const item of cases) {
  const started = Date.now();
  try {
    const response = await extractRemote({ agent, sourceText: item.text, questionId: item.questionId, currentSection: item.section, history: item.history ?? [], respond });
    const data = response.data;
    const fields = [...new Set(data.items.map(value => value.fieldKey))];
    const missing = item.expected.filter(value => !fields.includes(value));
    const expectedSections = new Set(item.expected.map(value => value.includes('LIFE') ? 'life' : value.includes('WILL') ? 'will' : value.includes('FUNERAL') ? 'funeral' : 'message'));
    const wrong = data.items.filter(value => item.expected.length && !expectedSections.has(value.sectionId)).map(value => value.fieldKey);
    const statusSafe = data.items.every(value => value.fieldStatus === 'AI_EXTRACTED') && (!data.items.length || data.requiresConfirmation === true);
    const dispositionOk = !item.disposition || item.disposition.includes(data.disposition);
    const dataPass = missing.length === 0 && wrong.length === 0 && statusSafe && dispositionOk;
    const topicScore = wrong.length === 0 && missing.length === 0 ? 2 : wrong.length === 0 ? 1 : 0;
    const questionScore = data.nextQuestion === null || (typeof data.nextQuestion.text === 'string' && !/[?？].*[?？]/.test(data.nextQuestion.text)) ? 2 : 0;
    const repetitionScore = data.nextQuestion && item.text.includes(data.nextQuestion.text) ? 0 : 2;
    results.push({ id: item.id, name: item.name, ok: true, dataPass, fields, missing, wrong, intent: data.intent, topic: data.topic, disposition: data.disposition, requiresConfirmation: data.requiresConfirmation, nextQuestion: data.nextQuestion?.text ?? null, conversationScore: (topicScore + questionScore + repetitionScore) / 3, latencyMs: response.metrics.latencyMs, usage: response.metrics });
  } catch (error) {
    results.push({ id: item.id, name: item.name, ok: false, dataPass: false, error: error.message, latencyMs: Date.now() - started });
  }
}

const completed = results.filter(value => value.ok);
const summary = {
  model: config.model,
  actualApiCalls: cases.length,
  completed: completed.length,
  failed: results.length - completed.length,
  dataPassed: results.filter(value => value.dataPass).length,
  wrongAreaCount: results.reduce((count, value) => count + (value.wrong?.length ?? 0), 0),
  autoConfirmedCount: results.filter(value => value.ok && (value.fields?.length ?? 0) > 0 && value.requiresConfirmation !== true).length,
  averageConversationScore: completed.length ? completed.reduce((sum, value) => sum + value.conversationScore, 0) / completed.length : 0,
  totalInputTokens: completed.reduce((sum, value) => sum + (value.usage.inputTokens ?? 0), 0),
  totalOutputTokens: completed.reduce((sum, value) => sum + (value.usage.outputTokens ?? 0), 0),
  totalTokens: completed.reduce((sum, value) => sum + (value.usage.totalTokens ?? 0), 0),
  averageLatencyMs: completed.length ? Math.round(completed.reduce((sum, value) => sum + value.latencyMs, 0) / completed.length) : null,
  costUsd: 'UNKNOWN'
};
console.log(JSON.stringify({ criteria: { data: '기대 필드 포함, 잘못된 영역 0, AI_EXTRACTED, 명시적 확인 필요, 원문 근거 일치', conversation: '3개 항목 각 0~2점, 평균 1.5 이상' }, summary, results }, null, 2));
