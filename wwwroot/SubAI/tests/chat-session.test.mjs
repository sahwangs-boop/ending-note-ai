import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = await readFile(path.join(root, 'public', 'chat.js'), 'utf8');

class Element {
  constructor() { this.children = []; this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  focus() {}
  scrollIntoView() {}
  querySelector() { return { disabled: false }; }
  requestSubmit() { this.onsubmit({ preventDefault() {} }); }
  get lastElementChild() { return this.children.at(-1); }
}

test('Agent 탭은 세션 이메일을 공유하고 사용자 변경 시 전체 탭에서 지운다', async () => {
  const channels = new Set();
  class TestBroadcastChannel {
    constructor(name) { this.name = name; this.onmessage = null; channels.add(this); }
    postMessage(data) {
      for (const channel of channels) {
        if (channel !== this && channel.name === this.name) queueMicrotask(() => channel.onmessage?.({ data }));
      }
    }
  }
  function createTab(title, session) {
    const elements = new Map();
    const local = new Map();
    const document = {
      getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
      createElement: () => new Element()
    };
    const response = { headers: { get: () => 'application/json' }, ok: true, json: async () => ({ id: title, title, description: '검증용' }) };
    const browserSession = {
      getItem: key => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, value),
      removeItem: key => session.delete(key)
    };
    return { elements, local, session, browserSession, document, response };
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  async function loadTab(tab) {
    await new AsyncFunction('document', 'localStorage', 'sessionStorage', 'fetch', 'BroadcastChannel', `${script}\nreturn true;`)(
      tab.document,
      { getItem: key => tab.local.get(key) ?? null, setItem: (key, value) => tab.local.set(key, value) },
      tab.browserSession,
      async () => tab.response,
      TestBroadcastChannel
    );
  }

  const first = createTab('VFAAI', new Map([['subai.session.email.v1', 'remember@example.com']]));
  await loadTab(first);
  assert.equal(first.elements.get('email').value, 'remember@example.com');
  assert.equal(first.elements.get('login-panel').hidden, true);
  assert.equal(first.elements.get('chat-panel').hidden, false);

  const second = createTab('MediCodeAI', new Map());
  await loadTab(second);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(second.elements.get('email').value, 'remember@example.com');
  assert.equal(second.elements.get('chat-panel').hidden, false);

  second.elements.get('switch-user').onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(first.elements.get('login-panel').hidden, false);
  assert.equal(first.session.has('subai.session.email.v1'), false);
  assert.equal(second.session.has('subai.session.email.v1'), false);
});
