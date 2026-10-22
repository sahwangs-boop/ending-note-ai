// HTML에 포함된 실제 스크립트와 폼 이벤트를 메모리 DOM에서 검증합니다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'LegacyAI', 'index.html'), 'utf8');
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.value = ''; this.textContent = ''; this.style = {}; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this[key] = value; }
  replaceChildren(...nodes) { this.children = nodes; }
  focus() {}
  scrollIntoView() {}
  get lastElementChild() { return this.children.at(-1); }
}
const elements = new Map();
const storage = new Map();
const session = new Map([['subai.session.email.v1', 'remember@example.com']]);
const broadcastMessages = [];
let sharedChannel;
class TestBroadcastChannel {
  constructor(name) { this.name = name; sharedChannel = this; }
  postMessage(message) { broadcastMessages.push(message); }
}
let nextResponse;
let submitted;
const context = vm.createContext({
  document: {
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }), querySelectorAll: () => []
  },
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  sessionStorage: {
    getItem: key => session.get(key) ?? null,
    setItem: (key, value) => session.set(key, value),
    removeItem: key => session.delete(key)
  },
  BroadcastChannel: TestBroadcastChannel,
  location: { protocol: 'http:', href: 'http://127.0.0.1:5188/SubAI/LegacyAI/' }, structuredClone, AbortController, setTimeout, clearTimeout,
  requestAnimationFrame: callback => callback(),
  fetch: async (url, options) => { submitted = { url, ...JSON.parse(options.body) }; return nextResponse; }
});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
const run = code => vm.runInContext(code, context);
const command = (action, extra = {}) => ({ action, step: null, taxType: null, realEstate: null, financial: null, message: '요청을 처리합니다.', ...extra });
const apply = value => {
  const result = run(`applyCommand(${JSON.stringify(value)})`);
  if (value.action !== 'reply' && run('user.state.step')) run('openCalculatorEntry()');
  return result;
};
function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) { const result = find(child, predicate); if (result) return result; }
}
function form() { return find(elements.get('conversation').lastElementChild, node => node.tag === 'form'); }
function enterAmount(value) {
  run('render()');
  find(form(), node => node.id === 'asset-amount').value = value;
  form().onsubmit({ preventDefault() {} });
}
async function main() {
  assert.equal(elements.get('email-label').textContent, 'remember@example.com');
  assert.equal(elements.get('login').hidden, true);
  assert(broadcastMessages.some(message => message.type === 'email' && message.email === 'remember@example.com'));
  elements.get('switch-user').onclick();
  assert.equal(session.has('subai.session.email.v1'), false);
  assert(broadcastMessages.some(message => message.type === 'logout'));
  elements.get('email').value = 'new@example.com';
  elements.get('login-form').onsubmit({ preventDefault() {} });
  assert.equal(session.get('subai.session.email.v1'), 'new@example.com');
  elements.get('switch-user').onclick();
  sharedChannel.onmessage({ data: { type: 'email', email: 'from-another-agent@example.com' } });
  assert.equal(elements.get('email-label').textContent, 'from-another-agent@example.com');
  sharedChannel.onmessage({ data: { type: 'logout' } });
  assert.equal(elements.get('login').hidden, false);
  run(`currentEmail = 'test@example.com'; user = initialUser()`);
  // 모델 명령을 통해 계산을 시작한 뒤 실제 확인 버튼 처리로 3단계까지 이동합니다.
  apply(command('start', { taxType: '상속세', step: 1 }));
  assert.equal(run('user.state.step'), 1);
  enterAmount('20000');
  enterAmount('40000');
  assert.equal(run('user.state.step'), 3);
  apply(command('show_step', { step: 1 }));
  assert.equal(run('user.state.step'), 1);
  assert.equal(run('user.state.realEstate'), 200000000);
  assert.equal(run('user.state.financial'), 400000000);
  enterAmount('20000');
  enterAmount('40000');
  form().onsubmit({ preventDefault() {} });
  assert.equal(run('user.state.result.tax'), 120000000);
  apply(command('update_assets', { financial: 100000000 }));
  assert.equal(run('user.state.step'), 4);
  assert.equal(run('user.state.financial'), 100000000);
  assert.equal(run('user.state.result.tax'), 50000000);
  apply(command('update_assets', { taxType: '증여세' }));
  assert.equal(run('user.state.result.tax'), 36000000);
  // 구간 경계의 누진세율과 누진공제를 확인합니다.
  run('user.state.realEstate = 500000000; user.state.financial = 0; user.state.taxType = "상속세"; user.state.result = calculate(user.state)');
  assert.equal(run('user.state.result.rate'), 20);
  assert.equal(run('user.state.result.tax'), 90000000);
  run('user.state.realEstate = 500000001; user.state.result = calculate(user.state)');
  assert.equal(run('user.state.result.rate'), 30);
  assert.equal(run('user.state.result.tax'), 90000000);
  run('user.state.realEstate = 200000000; user.state.financial = 100000000; user.state.taxType = "증여세"; user.state.result = calculate(user.state)');
  assert.match(apply(command('show_result')), /36,000,000/);
  const completedState = run('JSON.stringify(user.state)');
  for (const invalid of [command('update_assets', { financial: -1 }), command('show_step', { step: 9 }), command('execute'), command('reply', { financial: 0 })]) {
    assert.throws(() => apply(invalid));
    assert.equal(run('JSON.stringify(user.state)'), completedState);
  }
  run('persist()');
  assert.equal(run(`loadUser('test@example.com').state.result.tax`), 36000000);
  assert.equal(run(`loadUser('other@example.com').state.step`), 0);
  // 미입력 단계로 이동하더라도 자산 확인을 생략한 계산은 허용하지 않습니다.
  apply(command('start'));
  apply(command('show_step', { step: 3 }));
  run('render()');
  form().onsubmit({ preventDefault() {} });
  assert.equal(run('user.state.step'), 1);
  apply(command('update_assets', { financial: 100000000 }));
  assert.equal(run('user.state.step'), 2);
  assert.equal(run('user.state.financialConfirmed'), false);
  const beforeFailure = run('JSON.stringify(user.state)');
  nextResponse = { ok: false, headers: { get: () => 'application/json' }, json: async () => ({ error: 'API 오류' }) };
  await run(`submitQuestion('1단계를 다시 보여줘')`);
  assert.equal(run('JSON.stringify(user.state)'), beforeFailure);
  assert.equal(run('busy'), false);
  assert.equal(elements.get('chat-input').value, '1단계를 다시 보여줘');
  nextResponse = { ok: true, headers: { get: () => 'application/json' }, json: async () => command('show_step', { step: 1 }) };
  await run(`submitQuestion('1단계를 다시 보여줘')`);
  assert.equal(run('user.state.step'), 1);
  assert.equal(submitted.url, './api/chat');
  const visibleRows = elements.get('conversation').children;
  assert.equal(visibleRows.at(-1).children.some(child => child.className?.includes('calculator')), true);
  assert.equal(visibleRows.at(-2).className, 'message assistant');
  assert.equal(visibleRows.at(-3).className, 'message user');
  const calculatorEntries = run('user.messages.filter(message => message.role === "calculator")');
  assert.equal(calculatorEntries.at(-2).active, false);
  assert.equal(calculatorEntries.at(-1).active, true);
  assert.equal(JSON.stringify(submitted.history).includes('calculator'), false);
  for (const [page, expected] of [
    ['https://example.com/SubAI/LegacyAI/', '/SubAI/LegacyAI/api/chat'],
    ['https://example.com/SubAI/LegacyAI/index.html', '/SubAI/LegacyAI/api/chat'],
    ['https://example.com/portal/SubAI/LegacyAI/', '/portal/SubAI/LegacyAI/api/chat']
  ]) assert.equal(new URL(submitted.url, page).pathname, expected);
  assert(!JSON.stringify(submitted).includes('test@example.com'));
  assert(!html.includes('OPENAI_API_KEY'));
  assert(!html.includes('processQuestion('));
  assert(!html.includes('\uFFFD'));
  console.log('검증 통과: LLM 명령 적용, 단계 복귀, 재계산, 결과 조회, 저장 복원, API 실패 시 상태 보존');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
