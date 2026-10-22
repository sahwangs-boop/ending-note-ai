import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function readPublicFile(filePath, contentType) {
  if (!(await lstat(filePath)).isFile()) throw new Error('공개 파일은 일반 파일이어야 합니다.');
  const body = await readFile(filePath);
  const hashes = contentType.startsWith('text/html')
    ? [...body.toString('utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`).join(' ')
    : '';
  return { body, contentType, hashes };
}

export async function loadAgents(root, agentsDirectory = 'SubAI') {
  const directory = path.join(root, agentsDirectory);
  const registry = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(entry.name)) continue;
    const agentRoot = path.join(directory, entry.name);
    const manifestPath = path.join(agentRoot, 'agent.json');
    try { if (!(await lstat(manifestPath)).isFile()) throw new Error('Agent 설정 파일을 확인해 주세요.'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.enabled === false) continue;
    if (typeof manifest.title !== 'string' || !manifest.title.trim() || manifest.title.length > 100 ||
        typeof manifest.description !== 'string' || manifest.description.length > 500 ||
        !['calculator', 'chat'].includes(manifest.kind)) throw new Error(`${entry.name}의 agent.json 형식을 확인해 주세요.`);
    const instructionsPath = path.join(agentRoot, 'instructions.md');
    if (!(await lstat(instructionsPath)).isFile()) throw new Error('Agent 지침 파일을 확인해 주세요.');
    const instructions = await readFile(instructionsPath, 'utf8');
    if (!instructions.trim() || instructions.length > 30000) throw new Error('Agent 지침 길이를 확인해 주세요.');
    let handleChat;
    if (manifest.handlerModule !== undefined) {
      if (typeof manifest.handlerModule !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,49}\.mjs$/.test(manifest.handlerModule)) {
        throw new Error(`${entry.name}의 handlerModule 설정을 확인해 주세요.`);
      }
      const handlerPath = path.join(agentRoot, manifest.handlerModule);
      if (!(await lstat(handlerPath)).isFile()) throw new Error(`${entry.name}의 처리기 파일을 확인해 주세요.`);
      ({ handleChat } = await import(pathToFileURL(handlerPath).href));
      if (typeof handleChat !== 'function') throw new Error(`${entry.name}의 처리기는 handleChat 함수를 내보내야 합니다.`);
    }
    registry.set(entry.name, Object.freeze({
      id: entry.name, title: manifest.title, description: manifest.description, kind: manifest.kind,
      instructions, handleChat,
      page: await readPublicFile(path.join(agentRoot, 'index.html'), 'text/html; charset=utf-8'),
      appPage: await readPublicFile(path.join(agentRoot, 'app.html'), 'text/html; charset=utf-8')
    }));
  }
  if (!registry.size) throw new Error('활성화된 Agent가 없습니다.');
  return registry;
}

export const publicAgent = agent => ({ id: agent.id, title: agent.title, description: agent.description, kind: agent.kind });
