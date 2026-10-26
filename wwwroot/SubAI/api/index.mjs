import { fileURLToPath } from 'node:url';
import { loadConfig } from '../shared/config.mjs';
import { loadAgents } from '../shared/registry.mjs';
import { createOpenAiClient } from '../shared/openai.mjs';
import { createAgentServer } from '../shared/server.mjs';
import { HttpError } from '../shared/errors.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

if (!process.env.PUBLIC_ORIGINS) {
  const origins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter(Boolean)
    .map(host => `https://${host}`);
  if (origins.length) process.env.PUBLIC_ORIGINS = [...new Set(origins)].join(',');
}

const config = await loadConfig(root);
const agents = await loadAgents(root, config.agentsDirectory);
const transportDetail = error => {
  const code = error?.cause?.code || error?.code || error?.name || 'UNKNOWN';
  const message = String(error?.cause?.message || error?.message || '').replace(/[\r\n]/g, ' ').slice(0, 160);
  return `${code}${message ? `: ${message}` : ''}`;
};
const vercelFetch = async (...args) => {
  try {
    return await fetch(...args);
  } catch (firstError) {
    const firstCode = transportDetail(firstError);
    console.error(`OpenAI transport retry: ${firstCode}`);
    await new Promise(resolve => setTimeout(resolve, 250));
    try {
      return await fetch(...args);
    } catch (secondError) {
      const secondCode = transportDetail(secondError);
      console.error(`OpenAI transport failed: ${secondCode}`);
      throw new HttpError(502, `OpenAI 네트워크 연결 실패 (${secondCode}). Vercel Logs에서 같은 코드를 확인해 주세요.`);
    }
  }
};
const server = await createAgentServer({
  root,
  config,
  agents,
  respond: createOpenAiClient(config, vercelFetch)
});

// Vercel 요청을 기존 공통 Node 서버의 request 처리기로 전달합니다.
export default function handler(request, response) {
  if ((request.url === '/' || request.url === '') && ['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(308, { Location: `${config.basePath}/EndingNoteAI/` });
    response.end();
    return;
  }
  server.emit('request', request, response);
}
