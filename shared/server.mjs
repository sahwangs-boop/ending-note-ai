import http from 'node:http';
import path from 'node:path';
import { HttpError } from './errors.mjs';
import { readPublicFile, publicAgent } from './registry.mjs';
import { handleChat } from './handlers.mjs';

function headers(response, hashes = '') {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' ${hashes}; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'`);
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function readBody(request, limit) {
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > limit)) {
    request.resume();
    throw new HttpError(413, '요청 데이터가 너무 큽니다.');
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const cleanup = () => {
      clearTimeout(timer);
      request.off('data', data);
      request.off('end', end);
      request.off('aborted', aborted);
      request.off('error', aborted);
    };
    const fail = error => { cleanup(); request.resume(); reject(error); };
    const aborted = () => fail(new HttpError(400, '요청 수신이 중단되었습니다.'));
    const data = chunk => {
      size += chunk.length;
      if (size > limit) return fail(new HttpError(413, '요청 데이터가 너무 큽니다.'));
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, '올바른 JSON 요청이 아닙니다.')); }
    };
    const timer = setTimeout(() => fail(new HttpError(408, '요청 수신 시간이 초과되었습니다.')), 10000);
    request.on('data', data).once('end', end).once('aborted', aborted).once('error', aborted);
  });
}

export async function createAgentServer({ root, config, agents, respond }) {
  const files = new Map();
  files.set(`${config.basePath}/`, await readPublicFile(path.join(root, 'public', 'index.html'), 'text/html; charset=utf-8'));
  for (const [name, type] of [['chat.js', 'text/javascript'], ['hub.js', 'text/javascript'], ['chat.css', 'text/css']]) {
    files.set(`${config.basePath}/public/${name}`, await readPublicFile(path.join(root, 'public', name), `${type}; charset=utf-8`));
  }
  for (const agent of agents.values()) {
    files.set(`${config.basePath}/${agent.id}/`, agent.page);
    files.set(`${config.basePath}/${agent.id}/index.html`, agent.page);
    files.set(`${config.basePath}/${agent.id}/app.html`, agent.appPage);
    if (agent.kind === 'calculator') files.set(`${config.basePath}/${agent.id}/calculator.html`, agent.page);
  }
  let windowStart = Date.now();
  let count = 0;
  let active = 0;
  const server = http.createServer({ maxHeaderSize: 16384 }, async (request, response) => {
    headers(response);
    const controller = new AbortController();
    // 연결 중단 뒤 발생하는 스트림 오류도 처리해 서버 프로세스를 보호합니다.
    request.on('error', () => controller.abort());
    response.on('error', () => controller.abort());
    response.on('close', () => { if (!response.writableFinished) controller.abort(); });
    try {
      // 요청 경로를 파일 시스템 경로로 변환하지 않고 등록된 URL만 허용합니다.
      const url = new URL(request.url, 'http://localhost');
      const pathname = url.pathname;
      const redirect = pathname === '/' ? `${config.basePath}/`
        : pathname === config.basePath ? `${config.basePath}/`
          : [...agents.keys()].some(id => pathname === `${config.basePath}/${id}`) ? `${pathname}/` : null;
      if (redirect && ['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(308, { Location: redirect }); response.end(); return;
      }
      const publicFile = files.get(pathname);
      if (publicFile && ['GET', 'HEAD'].includes(request.method)) {
        headers(response, publicFile.hashes);
        response.writeHead(200, { 'Content-Type': publicFile.contentType, 'Content-Length': publicFile.body.length });
        response.end(request.method === 'HEAD' ? undefined : publicFile.body);
        return;
      }
      if (pathname === `${config.basePath}/api/agents` && request.method === 'GET') {
        json(response, 200, [...agents.values()].map(publicAgent)); return;
      }
      const relative = pathname.startsWith(`${config.basePath}/`) ? pathname.slice(config.basePath.length + 1) : '';
      const parts = relative.split('/');
      const agent = agents.get(parts[0]);
      if (!agent || parts.length !== 3 || parts[1] !== 'api' || !['info', 'chat'].includes(parts[2])) {
        throw new HttpError(404, '요청한 화면 또는 API가 없습니다.');
      }
      if (parts[2] === 'info' && request.method === 'GET') { json(response, 200, publicAgent(agent)); return; }
      if (parts[2] !== 'chat' || request.method !== 'POST') throw new HttpError(405, '허용되지 않은 요청 방식입니다.');
      // 전달 헤더는 신뢰하지 않습니다. 배포 도메인은 서버 설정에서 명시합니다.
      if (!config.publicOrigins.includes(request.headers.origin) || request.headers['sec-fetch-site'] === 'cross-site' ||
          (request.headers['x-subai-request'] !== '1' && request.headers['x-legacyai-request'] !== '1')) {
        throw new HttpError(403, '허용된 웹사이트에서 요청해 주세요.');
      }
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
        throw new HttpError(415, 'JSON 요청만 지원합니다.');
      }
      if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); count = 0; }
      if (count >= config.requestsPerMinute) {
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((windowStart + 60000 - Date.now()) / 1000))));
        throw new HttpError(429, '공통 서버의 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
      }
      if (active >= config.maxConcurrentRequests) throw new HttpError(503, '처리 중인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
      count += 1;
      active += 1;
      try {
        const body = await readBody(request, config.maxBodyBytes);
        const result = await handleChat(agent, body, respond, controller.signal);
        if (!response.destroyed) json(response, 200, result);
      } finally { active -= 1; }
    } catch (error) {
      request.resume();
      if (!response.destroyed && !response.headersSent) {
        json(response, error instanceof HttpError ? error.status : 500, {
          error: error instanceof HttpError ? error.message : '서버 처리 중 오류가 발생했습니다. 다시 시도해 주세요.'
        });
      }
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
