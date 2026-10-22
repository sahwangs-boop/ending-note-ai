import { HttpError } from '../shared/errors.mjs';
import { isObject, validateChat } from '../shared/validation.mjs';
import { answerWithMainAI } from './main-ai.mjs';

const validAmount = value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000_000_000;
const fields = ['action', 'step', 'taxType', 'realEstate', 'financial', 'message'];
const parameters = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['start', 'show_step', 'update_assets', 'show_result', 'reply'] },
    step: { type: ['integer', 'null'], enum: [1, 2, 3, null] },
    taxType: { type: ['string', 'null'], enum: ['상속세', '증여세', null] },
    realEstate: { type: ['integer', 'null'] }, financial: { type: ['integer', 'null'] }, message: { type: 'string' }
  },
  required: fields, additionalProperties: false
};

export function validateCalculator(input) {
  const chat = validateChat(input);
  const state = input.state;
  if (!isObject(state) || !Number.isInteger(state.step) || state.step < 0 || state.step > 4 ||
      !validAmount(state.realEstate) || !validAmount(state.financial) || !['상속세', '증여세'].includes(state.taxType) ||
      typeof state.realEstateConfirmed !== 'boolean' || typeof state.financialConfirmed !== 'boolean') {
    throw new HttpError(400, '계산기 상태를 확인해 주세요.');
  }
  return { ...chat, state: {
    step: state.step, realEstate: state.realEstate, financial: state.financial,
    taxType: state.taxType, realEstateConfirmed: state.realEstateConfirmed, financialConfirmed: state.financialConfirmed
  } };
}

export function validateCommand(command) {
  const invalid = () => { throw new HttpError(502, 'LLM의 UI 제어 응답이 올바르지 않습니다. 다시 요청해 주세요.'); };
  if (!isObject(command) || Object.keys(command).length !== fields.length || fields.some(key => !Object.hasOwn(command, key))) invalid();
  const { action, step, taxType, realEstate, financial, message } = command;
  if (!parameters.properties.action.enum.includes(action) || ![null, 1, 2, 3].includes(step) ||
      ![null, '상속세', '증여세'].includes(taxType) ||
      (realEstate !== null && !validAmount(realEstate)) || (financial !== null && !validAmount(financial)) ||
      typeof message !== 'string' || !message.trim() || message.length > 1500) invalid();
  if ((action === 'show_step' && step === null) ||
      (action === 'start' && ![null, 1].includes(step)) ||
      (!['start', 'show_step'].includes(action) && step !== null) ||
      (action !== 'update_assets' && (realEstate !== null || financial !== null)) ||
      (action === 'update_assets' && realEstate === null && financial === null && taxType === null)) invalid();
  return command;
}

export async function handleChat(agent, input, respond, signal) {
  const request = validateCalculator(input);
  const result = await respond({
    instructions: agent.instructions,
    input: JSON.stringify(request),
    tools: [
      { type: 'function', name: 'control_ui', strict: true, parameters,
        description: '상속·증여 범위의 계산기 UI 시작, 단계 이동, 자산 수정, 결과 조회 또는 관련 답변을 처리합니다.' },
      { type: 'function', name: 'delegate_to_main', strict: true,
        parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
        description: '상속·증여 담당 범위가 아닌 질문을 메인 AI로 전달합니다.' }
    ],
    tool_choice: 'required', parallel_tool_calls: false
  }, signal);
  const calls = result.output.filter(item => item.type === 'function_call');
  if (calls.length !== 1 || typeof calls[0].arguments !== 'string') {
    throw new HttpError(502, 'LLM이 UI 제어 명령을 반환하지 않았습니다. 다시 요청해 주세요.');
  }
  let command;
  try { command = JSON.parse(calls[0].arguments); }
  catch { throw new HttpError(502, 'LLM의 UI 제어 응답이 올바르지 않습니다.'); }
  if (calls[0].name === 'delegate_to_main') {
    if (!isObject(command) || Object.keys(command).length !== 0) throw new HttpError(502, '메인 AI 전달 명령이 올바르지 않습니다.');
    const message = await answerWithMainAI({ agent, question: request.question, history: request.history, signal });
    return { action: 'reply', step: null, taxType: null, realEstate: null, financial: null, message };
  }
  if (calls[0].name !== 'control_ui') throw new HttpError(502, '알 수 없는 Agent 명령입니다.');
  return validateCommand(command);
}
