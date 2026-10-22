const byId = id => document.getElementById(id);
let agent;
let email = '';
let messages = [];
let busy = false;
const SESSION_EMAIL_KEY = 'subai.session.email.v1';
const sessionChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('subai.session.v1') : null;
const storageKey = () => `subai.chat.v1:${agent.id}:${email}`;
const status = value => { byId('status').textContent = value; };

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function endSession(share = true) {
  if (busy) return;
  try { sessionStorage.removeItem(SESSION_EMAIL_KEY); } catch { /* 세션 저장소를 사용할 수 없어도 화면을 전환합니다. */ }
  if (share) sessionChannel?.postMessage({ type: 'logout' });
  email = ''; messages = [];
  byId('chat-panel').hidden = true;
  byId('login-panel').hidden = false;
  byId('question').value = '';
  byId('email').value = '';
  byId('email').focus(); status('');
}

function startRememberedSession(value) {
  if (!validEmail(value) || value === email) return;
  byId('email').value = value;
  byId('login-form').requestSubmit();
}

if (sessionChannel) sessionChannel.onmessage = event => {
  const message = event.data;
  if (message?.type === 'request') {
    try {
      const saved = sessionStorage.getItem(SESSION_EMAIL_KEY);
      if (validEmail(saved)) sessionChannel.postMessage({ type: 'email', email: saved });
    } catch { /* 세션 저장소를 사용할 수 없는 탭은 응답하지 않습니다. */ }
  } else if (message?.type === 'email' && validEmail(message.email)) {
    try { sessionStorage.setItem(SESSION_EMAIL_KEY, message.email); } catch { /* 현재 탭에서만 기억합니다. */ }
    if (message.email !== email) startRememberedSession(message.email);
  } else if (message?.type === 'logout') {
    endSession(false);
  }
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(75000) });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('서버 연결 또는 사이트 로그인 상태를 확인해 주세요.');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
  return result;
}

function persist() {
  try { localStorage.setItem(storageKey(), JSON.stringify(messages.slice(-200))); }
  catch { status('브라우저에 대화를 저장하지 못했습니다. 저장 공간과 설정을 확인해 주세요.'); }
}

function render() {
  byId('messages').replaceChildren();
  for (const item of messages) {
    const bubble = document.createElement('p');
    bubble.className = `message ${item.role}`;
    bubble.textContent = item.text;
    byId('messages').append(bubble);
  }
  byId('messages').lastElementChild?.scrollIntoView({ block: 'nearest' });
}

byId('login-form').onsubmit = event => {
  event.preventDefault();
  if (!agent || busy) return;
  email = byId('email').value.trim().toLowerCase();
  if (!validEmail(email)) { status('올바른 이메일 주소를 입력해 주세요.'); return; }
  try {
    const saved = localStorage.getItem(storageKey());
    const loaded = saved ? JSON.parse(saved) : [{ role: 'assistant', text: `안녕하세요. ${agent.title}입니다. 무엇을 도와드릴까요?` }];
    if (!Array.isArray(loaded) || loaded.length > 200 || loaded.some(item => !item ||
        !['user', 'assistant'].includes(item.role) || typeof item.text !== 'string' || item.text.length > 20000)) throw new Error();
    messages = loaded.map(item => ({ role: item.role, text: item.text, error: item.error === true }));
  } catch { status('저장된 대화를 읽지 못했습니다. 브라우저 저장소를 확인해 주세요.'); return; }
  try { sessionStorage.setItem(SESSION_EMAIL_KEY, email); } catch { /* 세션 저장소를 사용할 수 없어도 대화는 계속합니다. */ }
  sessionChannel?.postMessage({ type: 'email', email });
  byId('login-panel').hidden = true;
  byId('chat-panel').hidden = false;
  byId('account').textContent = email;
  status(''); render(); byId('question').focus();
};

byId('switch-user').onclick = () => {
  endSession();
};

byId('chat-form').onsubmit = async event => {
  event.preventDefault();
  const question = byId('question').value.trim();
  if (busy || !email || !question || question.length > 500) return;
  const history = messages.filter(item => !item.error).slice(-12).map(item => ({ role: item.role, text: item.text.slice(0, 1000) }));
  messages.push({ role: 'user', text: question });
  messages = messages.slice(-200);
  busy = true;
  byId('question').value = '';
  document.querySelectorAll('button, #question').forEach(item => { item.disabled = true; });
  status('답변을 준비하고 있습니다.'); render();
  try {
    // 이메일과 다른 Agent의 대화는 서버에 보내지 않습니다.
    const result = await request('./api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SubAI-Request': '1' },
      body: JSON.stringify({ question, history })
    });
    if (typeof result.message !== 'string' || !result.message.trim() || result.message.length > 20000) throw new Error('답변 형식이 올바르지 않습니다.');
    messages.push({ role: 'assistant', text: result.message });
    status('');
  } catch (error) {
    const message = error.name === 'TimeoutError' ? '응답 시간이 초과되었습니다. 다시 시도해 주세요.'
      : error instanceof TypeError ? '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' : error.message;
    messages.push({ role: 'assistant', text: message, error: true });
    byId('question').value = question;
    status('요청을 완료하지 못했습니다.');
  } finally {
    busy = false;
    messages = messages.slice(-200);
    document.querySelectorAll('button, #question').forEach(item => { item.disabled = false; });
    persist(); render(); byId('question').focus();
  }
};

try {
  agent = await request('./api/info');
  byId('title').textContent = agent.title;
  byId('description').textContent = agent.description;
  document.title = `${agent.title} · 대화`;
  byId('login-form').querySelector('button').disabled = false;
  try {
    const rememberedEmail = sessionStorage.getItem(SESSION_EMAIL_KEY);
    if (validEmail(rememberedEmail)) startRememberedSession(rememberedEmail);
  } catch { /* 세션 저장소를 사용할 수 없으면 이메일을 직접 입력받습니다. */ }
  if (!email && sessionChannel) sessionChannel.postMessage({ type: 'request' });
} catch { status('Agent 정보를 불러오지 못했습니다. 서버 연결과 사이트 로그인 상태를 확인해 주세요.'); }
