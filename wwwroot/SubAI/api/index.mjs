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
  const safe = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value) ? value : null;
  return {
    errorName: safe(error?.name) || 'Error',
    causeCode: safe(error?.cause?.code || error?.code)
  };
};
const vercelFetch = async (...args) => {
  try {
    return await fetch(...args);
  } catch (firstError) {
    console.error(JSON.stringify({ event: 'openai_transport_retry', model: config.model, ...transportDetail(firstError) }));
    await new Promise(resolve => setTimeout(resolve, 250));
    try {
      return await fetch(...args);
    } catch (secondError) {
      console.error(JSON.stringify({ event: 'openai_transport_failed', model: config.model, ...transportDetail(secondError) }));
      throw new HttpError(502, 'OpenAI 네트워크 연결에 실패했습니다. Vercel Logs의 진단 이벤트를 확인해 주세요.');
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
