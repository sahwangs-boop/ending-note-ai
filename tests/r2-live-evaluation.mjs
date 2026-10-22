import { fileURLToPath } from 'node:url';
import { loadConfig } from '../shared/config.mjs';
import { loadAgents } from '../shared/registry.mjs';
import { createOpenAiClient } from '../shared/openai.mjs';
import { consultRemote } from '../EndingNoteAI/r2-adapter.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = await loadConfig(root);
if (!config.apiKey) throw new Error('실제 LLM 평가용 API 키가 설정되지 않았습니다.');
const agent = (await loadAgents(root, config.agentsDirectory)).get('EndingNoteAI');
const respond = createOpenAiClient(config);

const scenarios = [
  { name: '장례 준비 첫 문의', question: '장례 준비는 무엇부터 해야 하나요?', expectedIntent: ['INFORMATION'], expectedFields: [] },
  { name: '장례계획과 비용', question: '가족장 비용을 알려주고, 나는 직계가족 중심 장례로 계획하고 싶어요.', expectedIntent: ['PLAN_CREATE'], expectedFields: ['funeral.scale'] },
  { name: '유언과 기부', question: '가상 아파트 일부는 가상 자녀에게 남기고 현금 일부는 기부하고 싶어요.', expectedIntent: ['PLAN_CREATE'], expectedFields: ['will.assets', 'will.beneficiaries', 'giving.donationWishes'] },
  { name: '디지털 사후정리', question: '온라인 계정과 구독은 정리하고 싶고 비밀번호는 저장하지 않을래요.', expectedIntent: ['PLAN_CREATE'], expectedFields: ['aftercare.accounts', 'aftercare.subscriptions'] },
  { name: '복수 주제', question: '장례는 가족장, 화장 후 수목장으로 하고 반려견은 가상 동생이 돌보며 가족에게 고맙다고 남기고 싶어요.', expectedIntent: ['PLAN_CREATE'], expectedFields: ['funeral.scale', 'burial.method', 'burial.placeType', 'pet.caregiverWish', 'messages.recipientMessages'] }
];

const results = [];
for (const scenario of scenarios) {
  const started = Date.now();
  try {
    const result = await consultRemote({ agent, question: scenario.question, history: [], planSummary: [], respond });
    const fields = result.data.planCandidates.map(item => `${item.areaId}.${item.fieldKey}`);
    const missing = scenario.expectedFields.filter(field => !fields.includes(field));
    const autoConfirmed = result.data.planCandidates.some(item => item.confirmedValue !== null || item.status !== 'AI_EXTRACTED');
    results.push({ name: scenario.name, ok: true, pass: scenario.expectedIntent.includes(result.data.intent) && missing.length === 0 && !autoConfirmed, intent: result.data.intent, answer: result.data.answer, citations: result.data.citations, fields, missing, requiresConfirmation: result.data.requiresConfirmation, latencyMs: result.metrics.latencyMs, tokens: result.metrics.totalTokens });
  } catch (error) {
    results.push({ name: scenario.name, ok: false, pass: false, error: error.message, latencyMs: Date.now() - started });
  }
}

const successful = results.filter(result => result.ok);
console.log(JSON.stringify({ model: config.model, scenarios: scenarios.length, completed: successful.length, passed: results.filter(result => result.pass).length, wrongAreaCount: results.reduce((sum, result) => sum + (result.fields ?? []).filter(field => !scenarioFieldAllowed(field)).length, 0), autoConfirmedCount: results.filter(result => result.ok && result.requiresConfirmation === false && (result.fields?.length ?? 0) > 0).length, averageLatencyMs: successful.length ? Math.round(successful.reduce((sum, result) => sum + result.latencyMs, 0) / successful.length) : null, totalTokens: successful.reduce((sum, result) => sum + (result.tokens ?? 0), 0), results }, null, 2));

function scenarioFieldAllowed(field) {
  return /^(people|life|funeral|burial|will|aftercare|giving|pet|memento|messages)\./.test(field);
}
