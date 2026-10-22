import { fileURLToPath } from 'node:url';
import { loadConfig } from './shared/config.mjs';
import { loadAgents } from './shared/registry.mjs';
import { createOpenAiClient } from './shared/openai.mjs';
import { createAgentServer } from './shared/server.mjs';

// Vercel의 Node 서버 감지용 진입점입니다. 공통 Framework 코드는 변경하지 않습니다.
const root = fileURLToPath(new URL('.', import.meta.url));

if (process.env.PORT && !process.env.SUBAI_PORT) {
  process.env.SUBAI_PORT = process.env.PORT;
}

if (process.env.VERCEL_URL && !process.env.PUBLIC_ORIGINS) {
  process.env.PUBLIC_ORIGINS = `https://${process.env.VERCEL_URL}`;
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

