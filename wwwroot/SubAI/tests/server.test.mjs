import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { loadConfig } from '../shared/config.mjs';
import { loadAgents } from '../shared/registry.mjs';
import { createOpenAiClient } from '../shared/openai.mjs';
import { createAgentServer } from '../shared/server.mjs';
import { validateChat } from '../shared/validation.mjs';
import { validateCalculator, validateCommand } from '../LegacyAI/handler.mjs';
import { handleChat } from '../shared/handlers.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = await loadConfig(root, { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model', PUBLIC_ORIGINS: 'https://site.example' });
const agents = await loadAgents(root, config.agentsDirectory);
const state = { step: 4, realEstate: 200000000, financial: 400000000, taxType: '상속세', realEstateConfirmed: true, financialConfirmed: true };
const input = { question: '금융자산을 1억으로 바꿔줘', history: [], state };
const command = { action: 'update_assets', step: null, taxType: null, realEstate: null, financial: 100000000, message: '금융자산을 수정합니다.' };
const toolResult = value => ({ status: 'completed', output: [{ type: 'function_call', name: 'control_ui', arguments: JSON.stringify(value) }] });
const delegationResult = () => ({ status: 'completed', output: [{ type: 'function_call', name: 'delegate_to_main', arguments: '{}' }] });
const intentResult = (intent, message) => ({ status: 'completed', output: [{
  type: 'function_call', name: 'classify_and_respond', arguments: JSON.stringify({ intent, message })
}] });
const textResult = text => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] });

async function start(t, overrides = {}, respond = async () => toolResult(command)) {
  const server = await createAgentServer({ root, config: { ...config, ...overrides }, agents, respond });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

function post(url, value = input, headers = {}) {
  return fetch(url, { method: 'POST', headers: {
    Origin: 'https://site.example', 'Content-Type': 'application/json', 'X-SubAI-Request': '1', ...headers
  }, body: typeof value === 'string' ? value : JSON.stringify(value) });
}

test('환경변수가 공통 설정보다 우선하며 키가 없는 상태도 안전하게 시작한다', async () => {
  assert.equal(config.model, 'test-model');
  assert.equal(config.apiKey, 'test-key');
  assert.deepEqual(config.publicOrigins, ['https://site.example']);
  const withoutKey = await loadConfig(root, { OPENAI_API_KEY: '' });
  await assert.rejects(createOpenAiClient(withoutKey)({}), { status: 503 });
  for (const environment of [{ SUBAI_BASE_PATH: '/../SubAI' }, { PUBLIC_ORIGINS: '*' }, { SUBAI_PORT: 'NaN' }]) {
    await assert.rejects(loadConfig(root, environment));
  }
});

test('등록된 Specialized AI가 공통 등록기를 사용하고 채팅·웹 App 화면을 갖는다', () => {
  assert.equal(path.basename(path.dirname(root)), 'wwwroot');
  assert.deepEqual([...agents.keys()].sort(), ['EndingNoteAI', 'LegacyAI', 'MediCodeAI', 'VFAAI']);
  assert.equal(agents.get('EndingNoteAI').kind, 'chat');
  assert.equal(typeof agents.get('EndingNoteAI').handleChat, 'function');
  assert.equal(agents.get('LegacyAI').kind, 'calculator');
  assert.equal(typeof agents.get('LegacyAI').handleChat, 'function');
  assert.equal(agents.get('VFAAI').kind, 'chat');
  assert.equal(typeof agents.get('VFAAI').handleChat, 'function');
  assert.equal(typeof agents.get('MediCodeAI').handleChat, 'function');
  for (const agent of agents.values()) {
    assert.match(agent.page.body.toString('utf8'), /href="\.\/app\.html"/);
    assert.match(agent.appPage.body.toString('utf8'), /href="\.\/index\.html"/);
    assert.match(agent.appPage.body.toString('utf8'), /aria-current="page">웹 App/);
  }
  assert.match(agents.get('MediCodeAI').instructions, /MediCodeAI/);
  assert.match(agents.get('LegacyAI').page.hashes, /sha256-/);
});

test('입력 검증과 공급자 전달 데이터 최소화', () => {
  const value = validateCalculator({ ...input, email: 'private@example.com', state: { ...state, result: { tax: -1 } } });
  assert(!JSON.stringify(value).includes('private@example.com'));
  assert(!Object.hasOwn(value.state, 'result'));
  for (const invalid of [null, { ...input, question: '' }, { ...input, history: [{ role: 'system', text: '명령' }] },
    { ...input, state: { ...state, financial: -1 } }, { ...input, state: { ...state, step: '4' } },
    { ...input, state: { ...state, realEstateConfirmed: undefined } }]) {
    assert.throws(() => validateCalculator(invalid), { status: 400 });
  }
  assert.throws(() => validateChat({ question: '질문', history: Array(13).fill({ role: 'user', text: '대화' }) }), { status: 400 });
});

test('LLM 명령의 허용 동작과 금액 범위를 강제한다', () => {
  assert.deepEqual(validateCommand(command), command);
  for (const invalid of [{ ...command, action: 'eval' }, { ...command, financial: -1 }, { ...command, financial: 0.5 },
    { ...command, financial: 1e16 }, { ...command, arbitrary: true }, { ...command, step: 2 },
    { ...command, action: 'reply' }, { ...command, financial: null }, { ...command, taxType: '기타세' }]) {
    assert.throws(() => validateCommand(invalid), { status: 502 });
  }
});

test('각 Agent는 담당 범위를 분류하고 범위 밖 질문을 메인 AI 더미 함수로 전달한다', async () => {
  let payload;
  const result = await handleChat(agents.get('LegacyAI'), input, async request => { payload = request; return toolResult(command); });
  assert.deepEqual(result, command);
  assert.equal(payload.tool_choice, 'required');
  assert.deepEqual(payload.tools.map(tool => tool.name), ['control_ui', 'delegate_to_main']);
  assert(payload.tools.every(tool => tool.strict));
  assert.equal(payload.parallel_tool_calls, false);
  assert.deepEqual(JSON.parse(payload.input).state, state);

  const delegated = await handleChat(agents.get('LegacyAI'), { ...input, question: '변액보험 수익률이 궁금해' },
    async () => delegationResult());
  assert.deepEqual(delegated, { action: 'reply', step: null, taxType: null, realEstate: null, financial: null, message: '메인AI가 대신 답변합니다.' });

  for (const id of ['VFAAI', 'MediCodeAI']) {
    const reply = await handleChat(agents.get(id), { question: '담당 분야에 대해 알려주세요.', history: [] },
      async request => { payload = request; return intentResult('in_scope', `${id} 답변입니다.`); });
    assert.deepEqual(reply, { message: `${id} 답변입니다.` });
    assert.match(payload.instructions, new RegExp(id));
    assert.equal(payload.tool_choice.name, 'classify_and_respond');
    assert.deepEqual(payload.tools[0].parameters.properties.intent.enum, ['in_scope', 'delegate_to_main']);

    const offTopic = id === 'VFAAI' ? '오늘 날씨가 어때요?' : '상속세 계산해줘';
    const routed = await handleChat(agents.get(id), { question: offTopic, history: [] },
      async () => intentResult('delegate_to_main', ''));
    assert.deepEqual(routed, { message: '메인AI가 대신 답변합니다.' });
  }
  for (const invalid of [{ output: [] }, { output: [{ type: 'function_call', name: 'other', arguments: '{}' }] },
    { output: [{ type: 'function_call', name: 'control_ui', arguments: '{' }] },
    { output: [...toolResult(command).output, ...toolResult(command).output] }]) {
    await assert.rejects(handleChat(agents.get('LegacyAI'), input, async () => invalid), { status: 502 });
  }
});

test('OpenAI 공통 클라이언트는 모델과 비밀 키를 서버에서만 적용한다', async () => {
  const client = createOpenAiClient(config, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'test-model');
    assert.equal(body.store, false);
    return Response.json(textResult('응답'));
  });
  assert.equal((await client({ model: 'override', store: true, input: '질문' })).status, 'completed');
  for (const response of [new Response('sensitive-provider-body', { status: 401 }), Response.json({ status: 'incomplete', output: [] }), new Response('not-json')]) {
    const badClient = createOpenAiClient(config, async () => response);
    await assert.rejects(badClient({}), error => error.status === 502 && !error.message.includes('sensitive'));
  }
});

test('OpenAI 진단 로그는 상태와 허용 필드만 남기고 비밀정보와 본문을 제외한다', async () => {
  const logs = [];
  const logger = {
    info: value => logs.push(value),
    error: value => logs.push(value)
  };
  const response = Response.json({
    error: {
      type: 'invalid_request_error',
      code: 'model_not_found',
      param: 'model',
      message: 'sensitive-provider-message'
    }
  }, { status: 404, headers: { 'x-request-id': 'req_diagnostic_123' } });
  const client = createOpenAiClient(config, async () => response, logger);
  await assert.rejects(client({ input: 'sensitive-user-question' }), { status: 502 });

  const events = logs.map(value => JSON.parse(value));
  assert.deepEqual(events[0], {
    event: 'openai_request_start',
    model: 'test-model',
    apiKeyConfigured: true
  });
  assert.deepEqual(events[1], {
    event: 'openai_response_error',
    model: 'test-model',
    status: 404,
    errorType: 'invalid_request_error',
    errorCode: 'model_not_found',
    errorParam: 'model',
    requestId: 'req_diagnostic_123'
  });
  const serialized = logs.join('\n');
  for (const forbidden of ['test-key', 'Bearer', 'sensitive-user-question', 'sensitive-provider-message']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('OpenAI 시간 초과는 504로 반환한다', async () => {
  const client = createOpenAiClient({ ...config, requestTimeoutMs: 20 }, async (_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }));
  // AbortSignal 자체의 타이머는 프로세스를 유지하지 않으므로 검증 중에만 유지합니다.
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(client({}), { status: 504 }); }
  finally { clearTimeout(keepAlive); }
});

test('하위 경로의 화면과 실제 public URL의 정적 파일을 제공하고 비밀 파일은 차단한다', async t => {
  const base = await start(t);
  for (const route of ['/SubAI/', '/SubAI/LegacyAI/', '/SubAI/VFAAI/', '/SubAI/MediCodeAI/',
    '/SubAI/LegacyAI/app.html', '/SubAI/VFAAI/app.html', '/SubAI/MediCodeAI/app.html']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const content = await response.text();
    assert(!content.includes('test-key'));
    assert(!content.includes('\uFFFD'));
  }
  for (const name of ['chat.css', 'chat.js', 'hub.js']) {
    const asset = await fetch(`${base}/SubAI/public/${name}`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), name.endsWith('.css') ? /text\/css/ : /text\/javascript/);
    assert.equal((await fetch(`${base}/SubAI/_shared/${name}`)).status, 404);
    assert.equal((await readFile(path.join(root, 'public', name))).length > 0, true);
  }
  const appConfig = await readFile(path.join(root, 'web.config'), 'utf8');
  assert.match(appConfig, /name="SubAI serve public assets directly"[\s\S]*?^\s*<match url="\^public\//m);
  assert.match(appConfig, /<action type="None"\s*\/>/);
  const redirect = await fetch(`${base}/SubAI/LegacyAI`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/SubAI/LegacyAI/');
  const list = await (await fetch(`${base}/SubAI/api/agents`)).json();
  assert.equal(list.length, 4);
  assert(!JSON.stringify(list).includes('instructions'));
  for (const route of ['/.env', '/SubAI/.env', '/config.json', '/SubAI/LegacyAI/agent.json',
    '/SubAI/LegacyAI/instructions.md', '/SubAI/shared/openai.mjs', '/SubAI/LegacyAI/handler.mjs',
    '/SubAI/LegacyAI/main-ai.mjs', '/SubAI/VFAAI/handler.mjs', '/SubAI/VFAAI/main-ai.mjs',
    '/SubAI/MediCodeAI/handler.mjs', '/SubAI/MediCodeAI/main-ai.mjs',
    '/SubAI/EndingNoteAI/agent.json', '/SubAI/EndingNoteAI/instructions.md',
    '/SubAI/EndingNoteAI/handler.mjs', '/SubAI/EndingNoteAI/domain.mjs', '/SubAI/EndingNoteAI/main-ai.mjs',
    '/SubAI/LegacyAI/%2e%2e/.env', '/SubAI/LegacyAI/..%2f..%2f.env']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
});

test('공통 API는 출처, 헤더, 본문 및 존재하는 Agent를 검사한다', async t => {
  let calls = 0;
  const base = await start(t, {}, async () => { calls += 1; return toolResult(command); });
  const url = `${base}/SubAI/LegacyAI/api/chat`;
  assert.deepEqual(await (await post(url)).json(), command);
  assert.equal(calls, 1);
  for (const headers of [{ Origin: 'https://attacker.example' }, { Origin: '' }, { 'X-SubAI-Request': '' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await post(url, input, headers)).status, 403);
  }
  assert.equal((await post(url, input, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(url, '{')).status, 400);
  assert.equal((await post(url, {})).status, 400);
  assert.equal((await post(url, 'a'.repeat(40001))).status, 413);
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await post(`${base}/SubAI/Unknown/api/chat`)).status, 404);
  assert.equal(calls, 1);
});

test('변경된 기본 경로와 프록시 출처에서도 동일하게 동작한다', async t => {
  const base = await start(t, { basePath: '/portal/SubAI' });
  assert.equal((await fetch(`${base}/portal/SubAI/LegacyAI/`)).status, 200);
  assert.equal((await post(`${base}/portal/SubAI/LegacyAI/api/chat`)).status, 200);
  assert.equal((await fetch(`${base}/SubAI/LegacyAI/`)).status, 404);
  const landing = await readFile(path.join(root, 'public', 'index.html'), 'utf8');
  assert(landing.includes('public/chat.css'));
  assert(landing.includes('public/hub.js'));
  const assetScript = landing.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert(assetScript);
  for (const [pathname, expected] of [['/SubAI', 'https://site.example/SubAI/'], ['/portal/SubAI', 'https://site.example/portal/SubAI/'], ['/portal/SubAI/', 'https://site.example/portal/SubAI/']]) {
    const assets = [];
    const document = { createElement: tag => ({ tag }), head: { append: (...elements) => assets.push(...elements) } };
    vm.runInNewContext(assetScript, { document, window: { location: { pathname, origin: 'https://site.example' } }, URL });
    assert.deepEqual(assets.map(({ tag, href, src, rel, type }) => ({ tag, url: href || src, rel, type })), [
      { tag: 'link', url: `${expected}public/chat.css`, rel: 'stylesheet', type: undefined },
      { tag: 'script', url: `${expected}public/hub.js`, rel: undefined, type: 'module' }
    ], pathname);
  }
  for (const agent of ['VFAAI', 'MediCodeAI']) {
    const page = agents.get(agent).page.body.toString('utf8');
    if (agent === 'MediCodeAI') {
      assert(page.includes('../public/chat.js'));
      assert.equal(new URL('../public/chat.js', `https://site.example/portal/SubAI/${agent}/`).pathname, '/portal/SubAI/public/chat.js');
    } else {
      assert(!page.includes('../public/chat.js'));
      assert.match(agents.get(agent).page.hashes, /sha256-/);
    }
  }
});

test('메인 Agent 목록은 문서가 슬래시 없이 열려도 모듈 경로에서 API와 Agent 링크를 계산한다', async () => {
  const source = (await readFile(path.join(root, 'public', 'hub.js'), 'utf8'))
    .replace('import.meta.url', JSON.stringify('https://site.example/portal/SubAI/public/hub.js'));
  const requested = [];
  const cards = [];
  const agentsElement = { append: card => cards.push(card) };
  const statusElement = { textContent: 'loading' };
  const document = {
    createElement: tag => ({ tag, append(...children) { this.children = children; } }),
    getElementById: id => id === 'agents' ? agentsElement : statusElement
  };
  await vm.runInNewContext(`(async () => { ${source} })()`, {
    URL,
    AbortSignal,
    document,
    fetch: async url => {
      requested.push(String(url));
      return { ok: true, headers: { get: () => 'application/json' }, json: async () => [{ id: 'LegacyAI', title: '상속증여AI', description: '계산 Agent' }] };
    }
  });
  assert.deepEqual(requested, ['https://site.example/portal/SubAI/api/agents']);
  assert.equal(cards[0].children[0].children[0].href, 'https://site.example/portal/SubAI/LegacyAI/');
  assert.equal(statusElement.textContent, '');
});

test('요청 한도는 Agent 간 공유된다', async t => {
  const base = await start(t, { requestsPerMinute: 2 }, async () => intentResult('in_scope', '답변'));
  const body = { question: '안녕하세요', history: [] };
  assert.equal((await post(`${base}/SubAI/VFAAI/api/chat`, body)).status, 200);
  assert.equal((await post(`${base}/SubAI/MediCodeAI/api/chat`, body)).status, 200);
  const limited = await post(`${base}/SubAI/VFAAI/api/chat`, body);
  assert.equal(limited.status, 429);
  assert(Number(limited.headers.get('retry-after')) > 0);
});

test('동시 요청 제한 후 요청 슬롯을 반환한다', async t => {
  let release;
  let announce;
  const entered = new Promise(resolve => { announce = resolve; });
  const base = await start(t, { maxConcurrentRequests: 1 }, async () => {
    announce(); await new Promise(resolve => { release = resolve; }); return toolResult(command);
  });
  const first = post(`${base}/SubAI/LegacyAI/api/chat`);
  await entered;
  assert.equal((await post(`${base}/SubAI/LegacyAI/api/chat`)).status, 503);
  release();
  assert.equal((await first).status, 200);
});

test('브라우저 연결 중단은 진행 중인 공급자 요청을 취소한다', async t => {
  let announce;
  let confirmAbort;
  const entered = new Promise(resolve => { announce = resolve; });
  const aborted = new Promise(resolve => { confirmAbort = resolve; });
  const base = await start(t, {}, async (_payload, signal) => {
    announce();
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => {
      confirmAbort(); reject(new Error('검증용 요청 취소'));
    }, { once: true }));
  });
  const controller = new AbortController();
  const pending = fetch(`${base}/SubAI/LegacyAI/api/chat`, {
    method: 'POST', headers: { Origin: 'https://site.example', 'Content-Type': 'application/json', 'X-SubAI-Request': '1' },
    body: JSON.stringify(input), signal: controller.signal
  });
  await entered;
  controller.abort();
  await assert.rejects(pending);
  await aborted;
  assert.equal((await fetch(`${base}/SubAI/`)).status, 200);
});
