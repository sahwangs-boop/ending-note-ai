import { HttpError } from './errors.mjs';

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateChat(input) {
  if (!isObject(input) || typeof input.question !== 'string' || !input.question.trim() || input.question.length > 500 ||
      !Array.isArray(input.history) || input.history.length > 12 || input.history.some(item =>
        !isObject(item) || !['user', 'assistant'].includes(item.role) || typeof item.text !== 'string' || item.text.length > 1000)) {
    throw new HttpError(400, '질문 또는 대화 형식을 확인해 주세요.');
  }
  // 이메일이나 임의 필드는 공급자에게 전달하지 않습니다.
  return { question: input.question.trim(), history: input.history.map(({ role, text }) => ({ role, text })) };
}
