# Remote Control stdio for AI CLI - Spec

## 1. 목적

이 프로그램은 하나의 메인 CLI에서 입력한 프롬프트를 여러 AI CLI 에이전트에 전달하고, 각 에이전트의 실행 결과를 수집하기 위한 로컬 오케스트레이션 도구이다.

초기 대상 에이전트는 `gemini`와 `codex`이며, 구현은 복잡한 서버형 시스템이 아니라 로컬 터미널에서 동작하는 단순한 CLI 프로그램을 목표로 한다.

## 2. 기본 방향

- 런타임은 Node.js 25를 기준으로 한다.
- npm 의존성은 최소화하되, 실제 터미널 제어와 Windows 지원을 위해 `node-pty`는 핵심 의존성으로 허용한다.
- 초기 UI는 CLI만 제공한다.
- 네트워크 서버, 웹 UI, 데이터베이스는 초기 범위에 포함하지 않는다.
- 각 AI CLI는 메인 프로그램이 생성한 PTY 세션에서 실행한다.
- 메인 프로그램은 사용자 입력을 받아 각 에이전트 PTY에 전달하고, 각 PTY의 출력 스트림을 메인 화면에도 실시간 중계한다.
- 에이전트별 동작 차이는 설정 파일 또는 내부 어댑터로 분리한다.

## 3. 실행 환경

### 3.1 필수 조건

- Node.js 25 이상
- 로컬에서 실행 가능한 `gemini` CLI
- 로컬에서 실행 가능한 `codex` CLI
- `node-pty` 설치가 가능한 빌드 환경

### 3.2 권장 조건

- macOS, Linux, Windows 10 1809 이상 또는 Windows 11
- 사용자의 shell PATH에 `gemini`, `codex` 명령이 등록되어 있을 것
- 각 CLI는 사전에 인증 및 초기 설정이 완료되어 있을 것
- Windows에서는 Windows Terminal 또는 PowerShell 7 사용을 권장한다.

### 3.3 Windows 지원

초기 버전부터 Windows 지원을 설계 범위에 포함한다.

Windows에서는 `tmux` 대신 `node-pty`가 제공하는 ConPTY 기반 PTY를 사용한다. 따라서 사용자가 `tmux`를 별도로 설치할 필요가 없다.

단, `node-pty`는 native 모듈이므로 Windows에서 설치 시 Python, C++ 빌드 도구, Windows SDK가 필요할 수 있다. 배포 전 Node.js 25와 `node-pty`의 실제 설치 호환성을 검증해야 한다.

## 4. 주요 용어

- 메인 CLI: 사용자가 직접 실행하는 이 프로그램
- 에이전트: `gemini`, `codex`처럼 별도 CLI 프로세스로 실행되는 AI 도구
- 작업: 사용자가 입력한 하나의 프롬프트를 여러 에이전트에 전달하고 결과를 받는 단위
- 어댑터: 에이전트별 실행 명령, 인자, 상태 감지 규칙을 정의하는 모듈 (설정 기반의 일반화된 구조 지향)
- PTY: 실제 터미널처럼 동작하는 pseudo terminal
- 세션: 메인 프로그램이 에이전트별로 생성한 PTY 실행 단위
- 에이전트 상태: 에이전트의 현재 동작 상태 (Init, Ready, Busy, Error, Finished)
- 배리어(Barrier): 모든 에이전트가 Ready 상태가 될 때까지 사용자 입력을 버퍼링하고 동기화하는 메커니즘
- 중계: 에이전트 PTY 출력 스트림을 메인 CLI 출력에도 복사해 보여주는 동작 (ANSI Sanitization 포함)

## 5. 사용자 흐름

1. 사용자가 메인 CLI를 실행한다.
2. 메인 CLI는 에이전트별 PTY 세션을 생성한다.
3. 메인 CLI는 각 PTY 안에서 `gemini`, `codex` CLI를 실행한다.
4. 메인 CLI는 에이전트별 출력을 감시하여 'Ready' 상태(입력 가능 상태)가 될 때까지 대기한다.
5. 사용자가 메인 CLI에 프롬프트를 입력한다.
6. **입력 동기화(Barrier):** 메인 CLI는 모든 활성 에이전트가 Ready 상태인지 확인한다.
   - 아직 Busy인 에이전트가 있다면 입력을 버퍼에 담아둔다.
   - 모든 에이전트가 Ready가 되면 버퍼링된 입력을 각 PTY에 전송한다.
7. 각 에이전트 PTY는 프롬프트를 수신하고 실행(Busy 상태)으로 전환된다.
8. 메인 CLI는 각 PTY의 출력 스트림을 실시간으로 수신하고, 위험한 ANSI 제어 문자를 정화(Sanitize)한 후 메인 화면에 중계한다.
9. 응답이 완료되어 다시 Ready 패턴이 감지되면 상태를 Ready로 변경한다.
10. 사용자는 다음 프롬프트를 입력하거나 프로그램을 종료한다.

## 6. CLI 인터페이스

### 6.1 기본 실행

```bash
node src/index.js
```

또는 패키지 설정 이후:

```bash
npx remote-stdio-ai
```

### 6.2 단일 프롬프트 실행

```bash
node src/index.js "이 코드를 리뷰해줘"
```

이 경우 프로그램은 전달된 문자열을 한 번 실행하고 결과 출력 후 종료한다.

### 6.3 인터랙티브 실행

```bash
node src/index.js --interactive
```

인터랙티브 모드에서는 프롬프트 입력을 반복해서 받는다.

특수 명령:

- `/exit`: 프로그램 종료
- `/agents`: 현재 활성 에이전트 목록 표시
- `/help`: 사용 가능한 명령 표시

### 6.4 에이전트 선택

```bash
node src/index.js --agents gemini,codex "작업 지시문"
```

초기 기본값:

```text
gemini,codex
```

### 6.5 타임아웃 설정

```bash
node src/index.js --timeout 120000 "작업 지시문"
```

단위는 밀리초이며, 기본값은 300000ms로 한다.

### 6.6 화면 모드

```bash
node src/index.js --view split
```

초기 기본값은 `split`으로 한다.

지원 모드:

- `split`: 메인 CLI 안에서 에이전트별 출력을 패널처럼 구분해 보여준다.
- `prefix`: 각 출력 줄 앞에 `[gemini]`, `[codex]` prefix를 붙여 한 화면에 중계한다.
- `tmux`: macOS/Linux에서만 선택적으로 사용한다. 실제 `tmux` 팬으로 보여주고 메인 CLI가 입력과 출력을 중계한다.
- `pipe`: `child_process.spawn`으로 실행하고 결과만 수집한다. 화면 관찰은 제공하지 않는 fallback 모드이다.

### 6.7 세션 유지

```bash
node src/index.js --keep-session
```

`tmux` 모드에서만 사용한다. 기본적으로 프로그램 종료 시 생성한 `tmux` 세션을 정리한다. `--keep-session`을 사용하면 디버깅을 위해 세션을 남긴다.

### 6.8 node-pty 설치 확인 및 자동 설치

```bash
node src/index.js --check-pty
```

`node-pty`가 현재 프로젝트에서 로드 가능한지 확인한다.

```bash
npm run install:pty
```

`node-pty`만 별도로 설치한다.

```bash
node src/index.js --install-deps
```

메인 프로세스 시작 시 `node-pty`가 없으면 `npm install node-pty@^1.0.0 --save`를 실행해 설치를 시도한다.

환경변수로도 자동 설치를 활성화할 수 있다.

```bash
REMOTE_STDIO_AUTO_INSTALL=1 node src/index.js
```

자동 설치는 로컬 개발 편의를 위한 기능이다. 배포 환경에서는 기본적으로 `npm install` 단계에서 `node-pty`가 설치되어 있어야 한다.

## 7. 출력 형식

### 7.1 메인 화면 출력

메인 CLI는 사용자가 보낸 프롬프트와 각 에이전트 PTY에서 수신한 신규 출력을 에이전트별로 구분해 표시한다.

```text
[main] prompt sent: 이 코드를 리뷰해줘

## gemini

...gemini PTY에서 수신한 출력...

## codex

...codex PTY에서 수신한 출력...
```

### 7.2 오류 출력

세션 생성 실패, 에이전트 실행 실패, PTY write 실패, 타임아웃은 에이전트별로 표시한다.

```text
## codex

상태: failed
종료 코드: 1
오류:
...stderr...
```

### 7.3 JSON 출력

향후 자동화 사용을 위해 JSON 출력 옵션을 제공한다.

```bash
node src/index.js --json "작업 지시문"
```

예상 형식:

```json
{
  "prompt": "작업 지시문",
  "startedAt": "2026-05-06T00:00:00.000Z",
  "finishedAt": "2026-05-06T00:00:10.000Z",
  "results": [
    {
      "agent": "gemini",
      "status": "success",
      "exitCode": 0,
      "transcript": "...",
      "lastOutput": "...",
      "durationMs": 10000
    }
  ]
}
```

JSON 출력은 실시간 화면 표시와 별개로 최종 transcript를 구조화해서 내보내기 위한 옵션이다.

## 8. 프로세스 실행 모델

### 8.1 기본 방식: node-pty 세션 제어

초기 구현은 `node-pty`로 에이전트별 PTY를 생성해 실제 터미널 환경을 제공한다.

초기 구현은 다음 원칙을 따른다.

- 메인 프로그램은 에이전트마다 독립 PTY를 생성한다.
- 각 PTY에서 에이전트 명령을 실행하고 **State Machine**으로 상태를 관리한다.
  - **Init**: 프로세스 시작 중
  - **Ready**: 사용자 입력을 받을 준비가 됨 (`promptRegex` 매칭)
  - **Busy**: 프롬프트 처리 중 및 응답 출력 중
  - **Finished**: 프로세스 종료됨
- **입력 동기화(Barrier)**: 사용자의 입력을 모든 에이전트에게 동시에 전달하기 위해, 모든 세션이 `Ready` 상태가 될 때까지 입력을 유보(Buffering)한다.
- **ANSI Sanitization**: `onData`로 수신한 스트림에서 화면 지우기, 커서 강제 이동 등 메인 터미널의 레이아웃을 파괴할 수 있는 ANSI 제어 문자를 필터링한다.
- 에이전트별 전체 transcript는 메모리에 누적하며, ANSI 코드가 제거된 텍스트 기반으로 저장한다.

### 8.2 node-pty를 사용하는 이유

`gemini`와 `codex` 같은 AI CLI는 일반 stdin/stdout 파이프보다 실제 TTY 환경에서 안정적으로 동작할 가능성이 높다. 또한 사용자가 "가동된 화면"을 직접 봐야 하므로 단순 `spawn` 파이프만으로는 요구를 만족하기 어렵다.

초기 구현에서 `node-pty`를 사용하면 다음 장점이 있다.

- 사용자가 `tmux`를 별도 설치하지 않아도 된다.
- macOS, Linux, Windows를 하나의 실행 모델로 다룰 수 있다.
- 각 에이전트가 실제 TTY에 연결된 것처럼 동작한다.
- 메인 프로그램이 입력 전송과 출력 수신을 직접 제어할 수 있다.

단점은 `node-pty`가 native 모듈이기 때문에 설치와 배포가 단순 순수 JS 패키지보다 어렵다는 점이다. 특히 Node.js 25와의 호환성은 구현 시작 시점에 실제 설치 테스트가 필요하다.

### 8.3 tmux 선택 모드

`--view tmux` 모드는 macOS/Linux에서 선택적으로 제공한다.

이 모드는 다음 상황에서 사용한다.

- 사용자가 실제 `tmux` 분할 화면을 선호함
- 에이전트 화면을 프로그램 종료 후에도 유지하고 싶음
- `node-pty` 설치가 실패했지만 시스템에 `tmux`가 설치되어 있음

Windows에서는 기본적으로 `tmux` 모드를 지원하지 않는다.

### 8.4 pipe fallback

`--view pipe` 모드는 기존 `child_process.spawn` 기반 실행 방식이다.

이 모드는 다음 상황에서 사용한다.

- `node-pty` 설치 또는 실행이 불가능함
- CI 또는 자동화 환경에서 화면 표시가 필요 없음
- 에이전트 CLI가 비대화형 stdin 입력을 안정적으로 지원함

단, 이 모드에서는 사용자가 실제 `gemini`, `codex` 화면을 볼 수 없다.

### 8.5 화면 표시 정책

초기 버전의 기본 화면은 메인 CLI 내부 중계 화면이다.

`split` 모드의 권장 배치:

```text
┌───────────────────────────────┬───────────────────────────────┐
│ gemini                        │ codex                         │
│ gemini PTY 출력             │ codex PTY 출력              │
├───────────────────────────────┼───────────────────────────────┤
│ main input / relay status                                      │
└───────────────────────────────────────────────────────────────┘
```

MVP에서는 완전한 터미널 에뮬레이터를 구현하지 않는다. ANSI 제어 문자는 가능한 범위에서 그대로 출력하거나 최소 정리만 수행한다.

`split` 렌더링이 복잡할 경우 첫 구현은 `prefix` 모드로 시작할 수 있다.

## 9. 에이전트 어댑터

### 9.1 일반화된 어댑터 인터페이스

각 에이전트는 코드 수정 없이 설정(JSON/JS)만으로 정의할 수 있도록 일반화된 인터페이스를 가진다.

```js
{
  name: "gemini",
  command: "gemini",
  args: [],
  // 상태 감지를 위한 설정
  promptRegex: /❯\s*$/,      // 입력을 받을 수 있는 상태를 나타내는 정규식
  busyRegex: null,           // (옵션) 실행 중임을 나타내는 패턴
  stopSequence: null,        // (옵션) 응답의 끝을 알리는 특정 문자열
  // 초기화 및 입력 변환
  initCommands: [],          // 시작 직후 PTY에 보낼 명령 목록
  inputSuffix: "\n",         // 입력 전송 시 뒤에 붙일 문자열 (주로 Enter)
  // 출력 처리
  stripAnsi: true,           // 중계 시 ANSI 코드 제거 여부
  parseTranscript(text) {    // (옵션) 최종 결과에서 필요한 부분만 추출하는 함수
    return text;
  }
}
```

### 9.2 에이전트별 설정 예시

- **codex**: `promptRegex`를 통해 명령 입력 프롬프트(`$ ` 또는 `> `)가 나타날 때까지 기다린 후 입력을 전송한다.
- **gemini**: 대화형 모드의 고유 프롬프트 패턴을 감지하여 Ready 상태를 확인한다.

## 10. 설정

초기 버전은 설정 파일 없이도 동작해야 한다.

후속 버전에서는 프로젝트 루트의 `remote-stdio.config.js`를 지원하여 동적인 Regex와 함수를 정의할 수 있게 한다.

예상 형식:

```js
export default {
  agents: [
    {
      name: "codex",
      command: "codex",
      args: [],
      promptRegex: /\$\s*$/,
    },
    {
      name: "gemini",
      command: "gemini",
      args: [],
      promptRegex: /❯\s*$/,
    },
  ],
  defaults: {
    timeoutMs: 300000,
    view: "prefix",
    keepSession: false,
  },
};
```

## 11. 프로젝트 구조

초기 구현은 다음 구조를 목표로 한다.

```text
.
├── Ideation.md
├── Spec.md
├── package.json
└── src
    ├── index.js
    ├── cli.js
    ├── runner.js
    ├── pty.js
    ├── tmux.js
    ├── relay.js
    └── agents
        ├── codex.js
        └── gemini.js
```

### 11.1 파일 역할

- `src/index.js`: 엔트리 포인트
- `src/cli.js`: 인자 파싱, 인터랙티브 입력 처리, 출력 포맷
- `src/runner.js`: 작업 실행 흐름 제어
- `src/pty.js`: `node-pty` 기반 PTY 생성, 입력 전송, 출력 수신 제어
- `src/tmux.js`: 선택적 `tmux` 모드 제어
- `src/relay.js`: PTY별 출력 결과를 메인 화면에 중계하고 transcript 관리
- `src/agents/codex.js`: codex 실행 어댑터
- `src/agents/gemini.js`: gemini 실행 어댑터

## 12. 의존성 정책

초기 버전에서는 npm 외부 의존성을 최소화한다. 단, 실제 터미널 제어와 Windows 지원을 위해 `node-pty`를 핵심 의존성으로 사용한다.

Node.js 내장 모듈 사용 범위:

- `node:child_process`
- `node:readline/promises`
- `node:process`
- `node:fs`
- `node:path`
- `node:os`

초기 npm 의존성:

- `node-pty`: macOS/Linux PTY와 Windows ConPTY 제어

설치 보조 명령:

- `npm run install:pty`: `node-pty`만 별도 설치
- `node src/index.js --install-deps`: 메인 프로세스에서 `node-pty` 누락 시 설치 시도
- `REMOTE_STDIO_AUTO_INSTALL=1 node src/index.js`: 환경변수 기반 자동 설치

후속 단계에서 필요성이 명확할 때만 의존성을 추가한다.

후보:

- `commander`: CLI 옵션이 복잡해질 경우
- `chalk`: 출력 가독성 개선이 필요할 경우
- `ansi-regex` 또는 유사 패키지: ANSI 제어 문자 정리가 필요할 경우

## 13. 오류 처리

프로그램은 다음 오류를 명확히 구분해야 한다.

- 에이전트 명령을 찾을 수 없음
- `node-pty` 로드 실패
- PTY 생성 실패
- PTY write 실패
- PTY 프로세스 종료 실패
- `tmux` 명령을 찾을 수 없음
- `tmux` 세션 생성 실패
- `tmux` 팬 생성 실패
- `tmux send-keys` 실패
- `tmux capture-pane` 실패
- 에이전트 프로세스 실행 실패
- 에이전트 타임아웃
- 에이전트 비정상 종료
- 사용자가 빈 프롬프트를 입력함
- 알 수 없는 에이전트 이름을 지정함

오류는 전체 프로그램을 즉시 중단하지 않고, 가능한 경우 에이전트별 실패 결과로 수집한다.

## 14. 종료 처리

사용자가 `Ctrl+C`를 입력하면 다음 순서로 종료한다.

1. 실행 중인 에이전트 프로세스 목록을 확인한다.
2. 생성한 PTY 세션 목록을 확인한다.
3. 각 PTY 프로세스에 종료 신호를 보낸다.
4. `tmux` 모드이고 `--keep-session`이 없으면 생성한 `tmux` 세션을 종료한다.
5. `tmux` 모드이고 `--keep-session`이 있으면 세션 이름과 재접속 명령을 표시한다.
6. 메인 CLI를 종료한다.

## 15. 보안 및 안전성

- 사용자 프롬프트를 shell 문자열로 직접 조합하지 않는다.
- PTY 입력은 `write()`로 전달하되, 에이전트 명령 자체는 shell 문자열로 조합하지 않는다.
- `tmux` 모드에서 `tmux send-keys` 호출 시 프롬프트는 인자 배열로 전달한다.
- `spawn(command, args, options)` 형태로 실행한다.
- 기본적으로 임의 shell 실행을 허용하지 않는다.
- 설정 파일에 정의된 command와 args는 사용자가 직접 신뢰 가능한 환경에서 작성한다고 가정한다.
- transcript에는 민감 정보가 포함될 수 있으므로 초기 버전에서는 영구 저장을 기본값으로 하지 않는다.

## 16. MVP 범위

MVP에서 반드시 구현할 기능:

- Node.js 25 기반 실행
- `node-pty` 기반 package 구성
- PTY 기반 `gemini`, `codex` 병렬 실행
- Windows ConPTY 지원 설계
- 실제 에이전트 화면 표시
- 메인 CLI 입력을 각 에이전트 PTY에 전달
- 각 에이전트 PTY의 출력 스트림 수신
- 수신된 결과를 메인 화면에 중계
- 타임아웃 처리
- 인터랙티브 모드
- `/exit`, `/agents`, `/help` 명령

MVP에서 제외할 기능:

- 웹 UI
- 데이터베이스 저장
- 작업 히스토리 저장
- PTY 기반 완전한 TUI 제어
- 원격 머신 실행
- 다중 사용자 지원

## 17. 구현 순서

1. `package.json` 생성
2. `src/agents`에 기본 어댑터 작성
3. `node-pty` 설치 및 Node.js 25 호환성 확인
4. `src/pty.js`에서 PTY 생성, 입력 전송, 출력 수신 구현
5. `src/relay.js`에서 PTY별 출력 중계 구현
6. `src/runner.js`에서 작업 실행 흐름 제어 구현
7. `src/cli.js`에서 인자 파싱과 인터랙티브 입력 구현
8. `src/index.js`에서 실행 연결
9. 로컬 더미 명령으로 PTY 제어 테스트
10. 실제 `gemini`, `codex` 명령으로 화면 표시와 입력 전송 확인
11. Windows 환경에서 ConPTY 실행 확인
12. CLI 옵션과 오류 메시지 정리

## 18. 테스트 전략

초기에는 Node.js 내장 테스트 러너를 사용한다.

```bash
node --test
```

테스트 대상:

- 에이전트 이름 파싱
- 알 수 없는 에이전트 처리
- PTY 생성 옵션 구성
- PTY 출력 이벤트 처리
- transcript 누적
- 타임아웃 처리
- JSON 출력 형식

실제 `gemini`, `codex` CLI를 호출하는 테스트는 기본 단위 테스트에 포함하지 않는다. 대신 테스트용 더미 Node.js 스크립트를 PTY에서 실행한다.

## 19. 미해결 쟁점

- Node.js 25에서 `node-pty`가 안정적으로 설치되고 실행되는지 확인이 필요하다.
- Windows ConPTY에서 `gemini`와 `codex`가 안정적으로 동작하는지 확인이 필요하다.
- `gemini`와 `codex`가 PTY `write()` 입력으로 안정적으로 동작하는지 확인이 필요하다.
- 각 CLI의 입력 가능 상태를 어떤 화면 패턴으로 감지할지 확인이 필요하다.
- PTY 출력에서 ANSI 제어 문자와 전체 화면 갱신을 어떻게 정리할지 결정해야 한다.
- CLI별 비대화형 실행 옵션이 존재한다면 어댑터에 반영해야 한다.
- `split` 모드를 직접 구현할지, 첫 구현은 `prefix` 모드로 제한할지 결정해야 한다.
- `node-pty`가 설치되지 않는 환경에서 `pipe` fallback을 자동 사용할지, 명시 옵션으로만 허용할지 결정해야 한다.
- `tmux` 모드를 유지할지, macOS/Linux 디버깅용 선택 기능으로만 둘지 결정해야 한다.

## 20. 현재 결론

첫 번째 구현은 "`node-pty`로 `gemini`와 `codex`를 각각 실제 PTY 안에서 실행하고, 메인 CLI 입력을 각 PTY에 전송하며, 각 PTY의 출력을 메인 화면에도 실시간 중계하는 CLI"로 제한한다.

이 범위는 Node.js 25, `node-pty`, Node.js 내장 모듈로 구현한다. `tmux`는 사용자가 별도로 설치해야 하는 시스템 도구이므로 기본 의존성에서 제외하고, macOS/Linux의 선택 모드로만 유지한다.
