# Smart Task Planner

"목표만 입력하면, AI가 실행 가능한 Task와 일정을 만들어주는" 바닐라 JavaScript 기반 To-Do List 앱입니다.

## 프로젝트 개요

- **목표 입력**: 큰 목표(예: 포트폴리오 웹사이트 만들기) 입력
- **AI Task 분해**: 목표를 5~10개 작업으로 분해하고 각 작업 예상 시간 포함
- **자동 일정 배치**: 하루 가능 시간 + 시작일 기준으로 날짜별 일정 생성
- **Task 관리**: 완료 체크, 수정, 삭제, 직접 추가
- **로컬 저장**: `localStorage`로 상태 유지
- **다크모드**: 시스템 테마 + 수동 토글 지원

## 기술 스택

- HTML5
- CSS3
- Vanilla JavaScript
- Node.js (간단한 API 프록시 서버)
- OpenAI API
- localStorage

## 폴더/파일 구조

```text
todo_List/
├── index.html
├── style.css
├── script.js
├── ai.js
├── server.js
└── .env.example
```

## 동작 흐름

1. 사용자가 목표를 입력하고 **AI 계획 생성** 클릭
2. `ai.js`가 `/api/plan`으로 목표 전달
3. `server.js`가 OpenAI API 호출 후 `tasks` JSON 반환
4. `script.js`가 Task 상태 저장 및 일정 자동 생성
5. 화면(Task 리스트/일정 보기) 렌더링 + `localStorage` 저장

## 핵심 데이터 모델

```js
{
  goal: string,
  dailyHours: number,
  startDate: "YYYY-MM-DD",
  tasks: [
    { id: string, title: string, durationHours: number, done: boolean }
  ]
}
```

## 일정 생성 로직 요약

- 미완료 Task만 대상으로 일정 계산
- 하루 가능 시간(`dailyHours`)을 넘는 작업은 여러 날짜로 분할
- 분할 시 작업명에 `(1/n)`, `(2/n)` 형태 라벨 부여
- 결과 형태: `{ date, task, hours }`

## 실행 방법

### 1) 환경 변수 설정

`todo_List` 폴더에서 `.env.example`을 복사해 `.env` 생성 후 API 키 입력:

```env
OPENAI_API_KEY=your_api_key_here
PORT=3000
# OPENAI_MODEL=gpt-4o-mini
```

Windows PowerShell 예시:

```powershell
Copy-Item .env.example .env
```

### 2) 서버 실행

```bash
node server.js
```

실행 후 브라우저에서 `http://localhost:3000` 접속

## 사용 방법

1. 목표를 입력하고 **AI 계획 생성** 클릭
2. 생성된 Task의 제목/시간을 필요 시 수정
3. 하루 가능 시간과 시작일을 설정
4. 자동 생성된 일정을 확인
5. 완료한 Task를 체크해 진행 관리

## 참고 사항

- `OPENAI_API_KEY`가 없으면 AI 계획 생성은 동작하지 않습니다.
- 상태는 브라우저 `localStorage`에 저장됩니다.
- 정적 파일을 `file://`로 직접 열면 `/api/plan`이 없어 AI 기능이 동작하지 않으므로, 반드시 `node server.js`로 실행하세요.
