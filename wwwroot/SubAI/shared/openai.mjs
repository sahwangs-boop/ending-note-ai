import { HttpError } from './errors.mjs';

// 키, 모델, 통신 정책은 모든 Agent에서 이 클라이언트 하나를 공유합니다.
export function createOpenAiClient(config, fetchImpl = fetch) {
  return async function respond(payload, signal) {
    if (!config.apiKey) throw new HttpError(503, '서버 폴더의 .env 또는 OPENAI_API_KEY 환경변수를 설정하고 재시작해 주세요.');
    const timeout = AbortSignal.timeout(config.requestTimeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, model: config.model, store: false }),
        signal: combined,
        redirect: 'error'
      });
      if (!response.ok) {
        // 공급자 오류 본문이나 API 키를 브라우저 및 로그에 노출하지 않습니다.
        await response.body?.cancel();
        const message = [401, 403].includes(response.status)
          ? 'OpenAI API 키 또는 모델 접근 권한을 확인해 주세요.'
          : [400, 404].includes(response.status)
            ? 'OPENAI_MODEL 값과 해당 모델의 Responses API 지원 여부를 확인해 주세요.'
            : response.status === 429
              ? 'OpenAI 사용량 또는 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
              : 'OpenAI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
        throw new HttpError(502, message);
      }
      const result = await response.json();
      if (result?.status !== 'completed' || !Array.isArray(result.output)) {
        throw new HttpError(502, 'LLM 응답이 완료되지 않았습니다. 다시 시도해 주세요.');
      }
      return result;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (timeout.aborted) throw new HttpError(504, '응답 시간이 초과되었습니다. 다시 시도해 주세요.');
      if (signal?.aborted) throw new HttpError(499, '요청이 취소되었습니다.');
      throw new HttpError(502, 'OpenAI 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };
}
