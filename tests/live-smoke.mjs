// 명시적으로 실행할 때만 실제 API를 호출합니다. OpenAI 사용 비용이 발생합니다.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../shared/config.mjs';

const config = await loadConfig(fileURLToPath(new URL('..', import.meta.url)));
const root = `http://127.0.0.1:${config.port}${config.basePath}`;
const initial = { step: 0, realEstate: 0, financial: 0, taxType: '상속세', realEstateConfirmed: false, financialConfirmed: false };
const completed = { ...initial, step: 4, realEstate: 200000000, financial: 400000000, realEstateConfirmed: true, financialConfirmed: true };

async function ask(agent, question, state) {
  const response = await fetch(`${root}/${agent}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: config.publicOrigins[0], 'X-SubAI-Request': '1' },
    body: JSON.stringify({ question, history: [], ...(state ? { state } : {}) }),
    signal: AbortSignal.timeout(75000)
  });
  const result = await response.json();
  assert.equal(response.status, 200, result.error || '정상 응답이 아닙니다.');
  return result;
}

for (const question of ['상속세 계산해줘', '증여세 계산해줘', '상속세 얼마야?', '증여세 얼마야?']) {
  const command = await ask('LegacyAI', question, initial);
  assert.equal(command.action, 'start');
  assert.equal(command.step, 1);
  assert.equal(command.taxType, question.startsWith('상속') ? '상속세' : '증여세');
  console.log(`계산 시작 확인: ${question}`);
}
const back = await ask('LegacyAI', '1단계를 다시 보여줘', { ...completed, step: 3 });
assert.equal(back.action, 'show_step'); assert.equal(back.step, 1);
console.log('3단계에서 1단계로 복귀 확인');
const modified = await ask('LegacyAI', '금융자산을 1억으로 바꿔줘', completed);
assert.equal(modified.action, 'update_assets'); assert.equal(modified.financial, 100000000);
assert.equal(modified.realEstate, null);
console.log('계산 완료 후 금융자산 변경 명령 확인');
assert.equal((await ask('LegacyAI', '내 상속세가 얼마야?', completed)).action, 'show_result');
console.log('저장된 결과 조회 명령 확인');
for (const agent of ['VFAAI', 'MediCodeAI']) {
  const result = await ask(agent, '안녕하세요. 이름을 알려주세요.');
  assert.equal(typeof result.message, 'string');
  assert(result.message.includes(agent));
  console.log(`${agent} 공통 LLM 연결 확인`);
}
console.log('실제 LLM 연결 검증을 완료했습니다.');
