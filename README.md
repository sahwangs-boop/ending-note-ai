# SubAI 공통 Node.js 서버

실행과 배포에 필요한 프로젝트는 `wwwroot/SubAI` 하나입니다. 이 폴더를 그대로 기존 .NET 8 사이트의 `wwwroot/SubAI`에 복사할 수 있습니다. 기존 .NET 소스와 설정은 수정하지 않습니다. IIS 연결 요건은 [HOSTING.md](HOSTING.md)를 참고하세요.

## 프로젝트 구조

```text
wwwroot/SubAI/
  .env                  공통 API 키·모델 설정(비밀 파일)
  .env.example          설정 예시
  config.json           공통 서버 설정
  package.json          실행·테스트 명령
  server.mjs            Node 서버 시작점
  run.ps1               Windows 수동 실행 스크립트
  web.config            IIS 역방향 프록시·파일 접근 차단 규칙
  shared/               설정, OpenAI 연결, 라우팅 및 검증
  public/               공통 화면과 정적 리소스
  LegacyAI/              상속증여 계산 Agent
  VFAAI/                 확장용 대화 Agent
  MediCodeAI/            확장용 대화 Agent
  tests/                 자동 회귀 테스트
```

각 Agent는 `agent.json`, `instructions.md`, `index.html`, `handler.mjs`, `main-ai.mjs`로 구성됩니다. 담당 주제 분류와 명령 처리는 Agent별 `handler.mjs`에서, 범위 밖 질문의 메인 AI 연결 지점은 Agent별 `main-ai.mjs`에서 관리합니다. LegacyAI는 상속·증여, VFAAI는 변액보험·펀드, MediCodeAI는 유전자분석·건강검진·맞춤보험·보장분석을 담당합니다. 현재 `main-ai.mjs`는 연결용 더미 응답을 반환합니다. 공통 OpenAI 통신과 기본 대화 코드는 `shared/`가 담당하며 API 키와 모델은 공유합니다.

## 실행

Node.js 22.18 이상이 필요합니다. 별도 npm 의존성 설치는 필요하지 않습니다.

```powershell
cd D:\Workspace\SVN\VibeLab\LegacyAI\HTML\wwwroot\SubAI
npm start
```

새 환경에서 `.env`가 없다면 `.env.example`을 복사해 `.env`를 만들고 `OPENAI_API_KEY`, `OPENAI_MODEL`을 설정합니다. 기존 `.env`는 덮어쓰지 마세요. API 키는 서버에서만 사용됩니다.

- Agent 목록: `http://127.0.0.1:5188/SubAI/`
- 상속증여 계산: `http://127.0.0.1:5188/SubAI/LegacyAI/`
- VFAAI: `http://127.0.0.1:5188/SubAI/VFAAI/`
- MediCodeAI: `http://127.0.0.1:5188/SubAI/MediCodeAI/`

HTML을 직접 열지 말고 서버 주소로 접속합니다.

## 공통 설정

우선순위는 서버 환경변수 → 이 폴더의 `.env` → `config.json`입니다. `OPENAI_API_KEY`, `OPENAI_MODEL`, `PUBLIC_ORIGINS`, `SUBAI_PORT`, `SUBAI_BASE_PATH` 등을 환경변수 또는 `.env`에 지정할 수 있습니다. 기본 포트는 5188이며 모델 기본값은 `gpt-5.6-luna`입니다. 운영 도메인에서 접속할 때는 `PUBLIC_ORIGINS`를 해당 출처로 설정하고 서버를 재시작하세요.

## 동작 및 검증

LegacyAI는 계산 요청에 1~3단계 UI를 표시하고, 입력 완료 시 코드가 상속세 합계의 10% 또는 증여세 합계의 12%를 계산합니다. 단계 이동, 계산 중·완료 후 금액 변경, 결과 조회를 지원합니다. 계산 전 LLM에는 일반 질문만 전달되며 계산을 마친 뒤에는 결과도 답변 문맥에 포함됩니다. 대화와 계산 상태는 이메일별 브라우저 localStorage에 저장되고 서버에는 보관되지 않습니다.

```powershell
npm test
```

실제 OpenAI 연결을 확인하는 `npm run test:live`는 API 비용이 발생합니다.

이 세율은 요청에 따른 단순 시뮬레이션이며 실제 신고·납부 계산식이 아닙니다. 세무 판단에는 최신 법령과 전문가 확인이 필요합니다.
