import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './shared/config.mjs';
import { loadAgents } from './shared/registry.mjs';
import { createOpenAiClient } from './shared/openai.mjs';
import { createAgentServer } from './shared/server.mjs';
import './EndingNoteAI/handler.mjs';
import './LegacyAI/handler.mjs';
import './MediCodeAI/handler.mjs';
import './VFAAI/handler.mjs';

// Vercel의 Node 서버 감지용 진입점입니다. 공통 Framework 코드는 변경하지 않습니다.
const root = fileURLToPath(new URL('.', import.meta.url));

// 런타임에서 읽는 비코드 파일을 Vercel Node File Trace에 명시합니다.
const deploymentAssets = [
  './config.json',
  './public/index.html', './public/chat.js', './public/hub.js', './public/chat.css',
  './EndingNoteAI/agent.json', './EndingNoteAI/index.html', './EndingNoteAI/app.html', './EndingNoteAI/instructions.md',
  './LegacyAI/agent.json', './LegacyAI/index.html', './LegacyAI/app.html', './LegacyAI/instructions.md',
  './MediCodeAI/agent.json', './MediCodeAI/index.html', './MediCodeAI/app.html', './MediCodeAI/instructions.md',
  './VFAAI/agent.json', './VFAAI/index.html', './VFAAI/app.html', './VFAAI/instructions.md'
].map(file => new URL(file, import.meta.url));
await Promise.all(deploymentAssets.map(file => access(file)));

if (process.env.PORT && !process.env.SUBAI_PORT) {
  process.env.SUBAI_PORT = process.env.PORT;
}

if (!process.env.PUBLIC_ORIGINS) {
  const origins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter(Boolean)
    .map(host => `https://${host}`);
  if (origins.length) process.env.PUBLIC_ORIGINS = [...new Set(origins)].join(',');
}

const config = await loadConfig(root);
const agents = await loadAgents(root, config.agentsDirectory);
const server = await createAgentServer({
  root,
  config,
  agents,
  respond: createOpenAiClient(config)
});

server.listen(config.port, '0.0.0.0');

