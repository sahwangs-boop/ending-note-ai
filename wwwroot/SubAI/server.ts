import { loadConfig } from './shared/config.mjs';
import { loadAgents } from './shared/registry.mjs';
import { createOpenAiClient } from './shared/openai.mjs';
import { createAgentServer } from './shared/server.mjs';

// Vercel의 Node 서버 감지용 진입점입니다. 공통 Framework 코드는 변경하지 않습니다.
// Vercel에서는 진입 파일이 별도 함수 번들 위치로 이동할 수 있으므로,
// 설정과 Agent 파일을 찾는 기준은 배포 프로젝트의 작업 디렉터리로 고정합니다.
const root = process.cwd();

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

