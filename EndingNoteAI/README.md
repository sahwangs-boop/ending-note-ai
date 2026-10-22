# EndingNoteAI Phase 2-C 통합 Mock Prototype

## 범위

- P01~P09
- 삶의 기록·유언 준비·장례 준비·가족 메시지의 핵심 질문 12개
- 결정적 Mock 추출과 조건부 질문
- FieldStatus·SectionStatus·ConversationStatus
- 미정·건너뛰기·수정·중단 후 재개
- 브라우저 Mock Repository 및 AI 채팅/웹 App 상태 공유
- 영역별 답변 검토·수정·확정
- 인물 중복 후보·영역 간 제안·유언/장례 요청 충돌 확인
- 통합 Ending Note 미리보기
- Mock 문서 버전 저장·복원
- A4 인쇄 화면과 브라우저의 PDF 저장/인쇄 호출

실제 LLM, 운영 DB/API, MyData, 로그인·SSO, 가족 메시지 발송, 사후 자동 공개, 법적 효력 있는 유언장은 포함하지 않습니다.

## 실행

Node.js 22.18 이상에서 `wwwroot/SubAI`로 이동한 뒤 실행합니다.

```powershell
npm test
npm start
```

브라우저에서 다음 주소를 엽니다.

- Agent 목록: `http://127.0.0.1:5188/SubAI/`
- AI 채팅: `http://127.0.0.1:5188/SubAI/EndingNoteAI/`
- 웹 App: `http://127.0.0.1:5188/SubAI/EndingNoteAI/app.html`

별도 의존성 설치는 필요하지 않습니다. Phase 2-B Handler는 OpenAI 클라이언트를 호출하지 않으므로 API 키 없이 Mock 인터뷰를 실행할 수 있습니다.

## PDF로 저장

1. 웹 App에서 `미리보기`를 확인합니다.
2. `저장·출력`에서 새 Mock 버전을 저장합니다.
3. `PDF로 저장/인쇄`를 누릅니다.
4. 브라우저 인쇄 창에서 대상 프린터로 `PDF로 저장`을 선택합니다.

이 기능은 PDF 파일 생성 API가 아니라 브라우저의 인쇄 기능을 호출하는 Mock 방식입니다. 서버 저장·암호화·만료 정책은 구현하지 않았습니다.

## 주의

- 가상 데이터만 입력하세요.
- Mock 데이터는 브라우저 `localStorage`의 `endingnote.mock.v1:virtual-user`에 저장됩니다.
- 이메일은 사용하지 않으며 실제 인증 기능이 아닙니다.
- 저장값이 Schema와 맞지 않으면 AI 채팅 화면에서 안전하게 초기화하고 안내합니다.
- 운영 배포용이 아닙니다.
