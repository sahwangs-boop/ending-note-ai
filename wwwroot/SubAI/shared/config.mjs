import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import path from 'node:path';

function integer(value, name, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${name} 설정 범위를 확인해 주세요.`);
  }
  return number;
}

export async function loadConfig(root, environment = process.env) {
  const file = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'));
  const envFile = environment.SUBAI_ENV_FILE?.trim() || path.join(root, '.env');
  let secrets = {};
  try { secrets = parseEnv(await readFile(envFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // 서버 환경변수 > 공통 .env > 공통 config.json 순으로 적용합니다.
  const read = (key, fallback) => environment[key]?.trim() ?? secrets[key]?.trim() ?? fallback;
  const basePath = read('SUBAI_BASE_PATH', file.basePath);
  if (typeof basePath !== 'string' || !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(basePath)) {
    throw new Error('basePath는 /SubAI처럼 끝에 슬래시가 없는 경로여야 합니다.');
  }
  const origins = read('PUBLIC_ORIGINS', undefined)?.split(',').map(value => value.trim()) ?? file.publicOrigins;
  if (!Array.isArray(origins) || !origins.length || origins.some(origin => {
    try { const url = new URL(origin); return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin; }
    catch { return true; }
  })) throw new Error('publicOrigins에는 경로 없는 정확한 웹사이트 출처를 지정해 주세요.');
  const model = read('OPENAI_MODEL', file.model);
  if (typeof model !== 'string' || !model || model.length > 150) throw new Error('OPENAI_MODEL 설정을 확인해 주세요.');
  const agentsDirectory = read('SUBAI_AGENTS_DIRECTORY', file.agentsDirectory ?? 'SubAI');
  if (typeof agentsDirectory !== 'string' || !/^(?:\.|[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)$/.test(agentsDirectory)) {
    throw new Error('agentsDirectory는 상대 폴더 경로여야 합니다.');
  }
  return Object.freeze({
    host: '127.0.0.1',
    port: integer(read('SUBAI_PORT', file.port), 'port', 1, 65535),
    basePath,
    agentsDirectory,
    publicOrigins: Object.freeze([...new Set(origins)]),
    apiKey: read('OPENAI_API_KEY', ''), model,
    requestTimeoutMs: integer(file.requestTimeoutMs, 'requestTimeoutMs', 1000, 65000),
    maxBodyBytes: integer(file.maxBodyBytes, 'maxBodyBytes', 1000, 100000),
    requestsPerMinute: integer(file.requestsPerMinute, 'requestsPerMinute', 1, 10000),
    maxConcurrentRequests: integer(file.maxConcurrentRequests, 'maxConcurrentRequests', 1, 100)
  });
}
