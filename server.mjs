import { fileURLToPath } from 'node:url';
import { loadConfig } from './shared/config.mjs';
import { loadAgents } from './shared/registry.mjs';
import { createOpenAiClient } from './shared/openai.mjs';
import { createAgentServer } from './shared/server.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
try {
  const config = await loadConfig(root);
  const agents = await loadAgents(root, config.agentsDirectory);
  const server = await createAgentServer({ root, config, agents, respond: createOpenAiClient(config) });
  server.on('error', () => {
    console.error('공통 Agent 서버를 실행하지 못했습니다. 포트 사용 여부를 확인해 주세요.');
    process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => {
    console.log(`공통 Agent 서버: http://${config.host}:${config.port}${config.basePath}/`);
    console.log(`등록된 Agent: ${[...agents.keys()].join(', ')}`);
    if (!config.apiKey) console.warn('API 키가 없습니다. 이 폴더의 .env 또는 서버 환경변수를 설정한 뒤 재시작해 주세요.');
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => process.exit(0));
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, config.requestTimeoutMs + 1000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch {
  // 비밀 설정이 예외 메시지에 포함될 수 있으므로 원문은 출력하지 않습니다.
  console.error('공통 서버 설정 또는 Agent 파일을 읽지 못했습니다. config.json, .env, agent.json과 instructions.md를 확인해 주세요.');
  process.exitCode = 1;
}
