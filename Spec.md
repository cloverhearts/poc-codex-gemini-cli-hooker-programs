# Remote Control stdio for AI CLI - Spec

## 1. 목적

이 프로그램은 하나의 메인 CLI에서 입력한 프롬프트를 여러 AI CLI 에이전트에 전달하고, 각 에이전트의 실행 결과를 수집하기 위한 로컬 오케스트레이션 도구이다.

초기 대상 에이전트는 `gemini`와 `codex`이며, 구현은 복잡한 서버형 시스템이 아니라 로컬 터미널에서 동작하는 단순한 CLI 프로그램을 목표로 한다.

## 2. 기본 방향

- 런타임은 Node.js 25를 기준으로 한다.
- npm 의존성은 최소화한다.
- 초기 UI는 CLI만 제공한다.
- 네트워크 서버, 웹 UI, 데이터베이스는 초기 범위에 포함하지 않는다.
- 각 AI CLI는 사용자가 실제 화면을 볼 수 있는 별도 터미널 세션으로 실행한다.
- 메인 프로그램은 사용자 입력을 받아 각 에이전트 세션에 전달하고, 각 세션의 화면 출력 또는 transcript를 메인 화면에도 중계한다.
- 에이전트별 동작 차이는 설정 파일 또는 내부 어댑터로 분리한다.

## 3. 실행 환경

### 3.1 필수 조건

- Node.js 25 이상
- 로컬에서 실행 가능한 `tmux`
- 로컬에서 실행 가능한 `gemini` CLI
- 로컬에서 실행 가능한 `codex` CLI
- POSIX 계열 터미널 환경을 우선 지원

### 3.2 권장 조건

- macOS 또는 Linux
- tmux 3.x 이상
- 사용자의 shell PATH에 `gemini`, `codex` 명령이 등록되어 있을 것
- 각 CLI는 사전에 인증 및 초기 설정이 완료되어 있을 것

### 3.3 Windows 지원

초기 버전에서는 Windows 네이티브 터미널 지원을 보장하지 않는다. 단, Node.js의 `child_process` 기반 구현을 유지하여 향후 Windows 지원 가능성을 열어둔다.

## 4. 주요 용어

- 메인 CLI: 사용자가 직접 실행하는 이 프로그램
- 에이전트: `gemini`, `codex`처럼 별도 CLI 프로세스로 실행되는 AI 도구
- 작업: 사용자가 입력한 하나의 프롬프트를 여러 에이전트에 전달하고 결과를 받는 단위
- 어댑터: 에이전트별 실행 명령, 인자, 입력 방식, 종료 방식, 출력 파싱 방식을 감싸는 내부 모듈
- 세션: `tmux` 안에서 에이전트가 실행되는 독립 실행 단위
- 팬: 사용자가 실제 에이전트 화면을 확인하는 `tmux` pane
- 중계: 에이전트 화면 또는 transcript를 메인 CLI 출력에도 복사해 보여주는 동작

## 5. 사용자 흐름

1. 사용자가 메인 CLI를 실행한다.
2. 메인 CLI는 `tmux` 세션을 생성한다.
3. 메인 CLI는 `gemini`, `codex` 팬을 생성하고 각 CLI를 실행한다.
4. 사용자는 같은 터미널의 `tmux` 화면에서 실제 `gemini`, `codex` 화면을 확인한다.
5. 사용자가 메인 CLI에 프롬프트를 입력한다.
6. 메인 CLI는 입력한 프롬프트를 각 에이전트 팬에 전송한다.
7. 각 에이전트 팬에는 사용자가 입력한 프롬프트와 에이전트 응답이 실시간으로 표시된다.
8. 메인 CLI는 각 팬의 화면 내용을 주기적으로 캡처하거나 로그 파일을 tail하여 메인 화면에도 중계한다.
9. 사용자는 에이전트별 실제 화면과 메인 화면의 중계 결과를 함께 확인한다.
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
node src/index.js --view tmux
```

초기 기본값은 `tmux`로 한다.

지원 모드:

- `tmux`: 실제 `gemini`, `codex` 화면을 `tmux` 팬으로 보여주고 메인 CLI가 입력과 출력을 중계한다.
- `pipe`: `child_process.spawn`으로 실행하고 결과만 수집한다. 화면 관찰은 제공하지 않는 fallback 모드이다.

### 6.7 세션 유지

```bash
node src/index.js --keep-session
```

기본적으로 프로그램 종료 시 생성한 `tmux` 세션을 정리한다. `--keep-session`을 사용하면 디버깅을 위해 세션을 남긴다.

## 7. 출력 형식

### 7.1 메인 화면 출력

메인 CLI는 사용자가 보낸 프롬프트와 각 에이전트 화면에서 캡처된 신규 출력을 에이전트별로 구분해 표시한다.

```text
[main] prompt sent: 이 코드를 리뷰해줘

## gemini

...gemini pane에서 새로 관측된 출력...

## codex

...codex pane에서 새로 관측된 출력...
```

### 7.2 오류 출력

세션 생성 실패, 에이전트 실행 실패, 팬 캡처 실패, 타임아웃은 에이전트별로 표시한다.

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
      "lastCapture": "...",
      "durationMs": 10000
    }
  ]
}
```

JSON 출력은 실시간 화면 표시와 별개로 최종 transcript를 구조화해서 내보내기 위한 옵션이다.

## 8. 프로세스 실행 모델

### 8.1 기본 방식: tmux 세션 제어

초기 구현은 `tmux`를 제어하는 방식으로 실제 에이전트 화면을 제공한다.

초기 구현은 다음 원칙을 따른다.

- 메인 프로그램은 고유한 `tmux` 세션 이름을 생성한다.
- 에이전트마다 독립 `tmux` 팬을 생성한다.
- 각 팬에서 `gemini`, `codex` CLI를 실행한다.
- 사용자 프롬프트는 `tmux send-keys`로 각 팬에 전송한다.
- 각 팬의 화면은 `tmux capture-pane`으로 주기적으로 캡처한다.
- 캡처된 신규 출력은 메인 CLI에도 에이전트별로 중계한다.
- 에이전트별 전체 transcript는 메모리 또는 임시 파일에 누적한다.
- 프로그램 종료 시 생성한 `tmux` 세션을 정리한다.

### 8.2 tmux를 사용하는 이유

`gemini`와 `codex` 같은 AI CLI는 일반 stdin/stdout 파이프보다 실제 TTY 환경에서 안정적으로 동작할 가능성이 높다. 또한 사용자가 "가동된 화면"을 직접 봐야 하므로 단순 `spawn` 파이프만으로는 요구를 만족하기 어렵다.

초기 구현에서 `tmux`를 사용하면 다음 장점이 있다.

- npm native 모듈 없이 실제 터미널 팬을 제공할 수 있다.
- 사용자가 각 에이전트의 실제 화면을 볼 수 있다.
- 메인 프로그램이 `send-keys`, `capture-pane`으로 입력 전송과 출력 관측을 수행할 수 있다.
- 세션을 남겨 디버깅할 수 있다.

단점은 `tmux`가 설치되어 있어야 하고, Windows 네이티브 터미널 지원이 어렵다는 점이다.

### 8.3 pipe fallback

`--view pipe` 모드는 기존 `child_process.spawn` 기반 실행 방식이다.

이 모드는 다음 상황에서 사용한다.

- `tmux`가 설치되어 있지 않음
- CI 또는 자동화 환경에서 화면 표시가 필요 없음
- 에이전트 CLI가 비대화형 stdin 입력을 안정적으로 지원함

단, 이 모드에서는 사용자가 실제 `gemini`, `codex` 화면을 볼 수 없다.

### 8.4 PTY 직접 구현

`node-pty`를 사용해 프로그램 내부에서 직접 PTY를 생성하는 방식은 후속 후보로 둔다.

이 방식은 `tmux` 의존성을 줄일 수 있지만, 여러 전체 화면 TUI를 하나의 CLI 안에 안정적으로 렌더링하려면 터미널 에뮬레이션과 화면 분할 처리가 필요하다. 따라서 MVP에서는 구현하지 않는다.

### 8.5 화면 표시 정책

초기 버전의 기본 화면은 `tmux` 분할 화면이다.

권장 배치:

```text
┌───────────────────────────────┬───────────────────────────────┐
│ gemini                        │ codex                         │
│ 실제 gemini CLI 화면          │ 실제 codex CLI 화면           │
├───────────────────────────────┴───────────────────────────────┤
│ main relay                                                     │
│ 입력 프롬프트, 전송 상태, 캡처된 결과 요약                     │
└───────────────────────────────────────────────────────────────┘
```

구현 난이도를 낮추기 위해 MVP에서는 메인 CLI를 별도 팬으로 둘 수 있다. 이 경우 같은 `tmux` 세션 안에 `main`, `gemini`, `codex` 팬이 존재한다.

## 9. 에이전트 어댑터

### 9.1 공통 인터페이스

각 에이전트는 내부적으로 다음 정보를 제공해야 한다.

```js
{
  name: "codex",
  command: "codex",
  args: [],
  startCommand() {},
  buildInput(prompt) {},
  detectReady(captureText) {},
  parseTranscript(captureText) {}
}
```

### 9.2 codex 어댑터

초기 가정:

- 명령: `codex`
- 실행 위치: `tmux` 팬
- 입력: `tmux send-keys`로 프롬프트 전달 후 Enter 전송
- 출력: `tmux capture-pane`으로 화면 캡처
- 준비 상태: 초기 화면 캡처에서 입력 가능 상태를 확인

실제 CLI 옵션이 필요한 경우 구현 과정에서 조정한다.

### 9.3 gemini 어댑터

초기 가정:

- 명령: `gemini`
- 실행 위치: `tmux` 팬
- 입력: `tmux send-keys`로 프롬프트 전달 후 Enter 전송
- 출력: `tmux capture-pane`으로 화면 캡처
- 준비 상태: 초기 화면 캡처에서 입력 가능 상태를 확인

실제 CLI 옵션이 필요한 경우 구현 과정에서 조정한다.

## 10. 설정

초기 버전은 설정 파일 없이도 동작해야 한다.

후속 버전에서는 프로젝트 루트의 `remote-stdio.config.json`을 지원한다.

예상 형식:

```json
{
  "agents": {
    "codex": {
      "command": "codex",
      "args": []
    },
    "gemini": {
      "command": "gemini",
      "args": []
    }
  },
  "defaults": {
    "agents": ["gemini", "codex"],
    "timeoutMs": 300000,
    "view": "tmux",
    "captureIntervalMs": 1000,
    "keepSession": false
  }
}
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
- `src/tmux.js`: `tmux` 세션, 팬, 입력 전송, 화면 캡처 제어
- `src/relay.js`: 팬별 캡처 결과를 메인 화면에 중계하고 transcript 관리
- `src/agents/codex.js`: codex 실행 어댑터
- `src/agents/gemini.js`: gemini 실행 어댑터

## 12. 의존성 정책

초기 버전에서는 npm 외부 의존성을 사용하지 않는다. 단, 실제 화면 표시를 위해 시스템 의존성으로 `tmux`를 사용한다.

Node.js 내장 모듈 사용 범위:

- `node:child_process`
- `node:readline/promises`
- `node:process`
- `node:fs`
- `node:path`
- `node:os`

후속 단계에서 필요성이 명확할 때만 의존성을 추가한다.

후보:

- `node-pty`: `tmux` 없이 직접 PTY를 제어해야 할 경우
- `commander`: CLI 옵션이 복잡해질 경우
- `chalk`: 출력 가독성 개선이 필요할 경우

## 13. 오류 처리

프로그램은 다음 오류를 명확히 구분해야 한다.

- 에이전트 명령을 찾을 수 없음
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
2. 생성한 `tmux` 세션과 팬 목록을 확인한다.
3. `--keep-session`이 없으면 생성한 `tmux` 세션을 종료한다.
4. `--keep-session`이 있으면 세션 이름과 재접속 명령을 표시한다.
5. 메인 CLI를 종료한다.

## 15. 보안 및 안전성

- 사용자 프롬프트를 shell 문자열로 직접 조합하지 않는다.
- `tmux send-keys` 호출 시 프롬프트는 인자 배열로 전달한다.
- `spawn(command, args, options)` 형태로 실행한다.
- 기본적으로 임의 shell 실행을 허용하지 않는다.
- 설정 파일에 정의된 command와 args는 사용자가 직접 신뢰 가능한 환경에서 작성한다고 가정한다.
- transcript에는 민감 정보가 포함될 수 있으므로 초기 버전에서는 영구 저장을 기본값으로 하지 않는다.

## 16. MVP 범위

MVP에서 반드시 구현할 기능:

- Node.js 25 기반 실행
- 외부 의존성 없는 package 구성
- `tmux` 기반 `gemini`, `codex` 병렬 실행
- 실제 에이전트 화면 표시
- 메인 CLI 입력을 각 에이전트 팬에 전달
- 각 에이전트 팬의 출력 캡처
- 캡처된 결과를 메인 화면에 중계
- 타임아웃 처리
- 인터랙티브 모드
- `/exit`, `/agents`, `/help` 명령
- `--keep-session` 디버깅 옵션

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
3. `src/tmux.js`에서 세션 생성, 팬 생성, 입력 전송, 화면 캡처 구현
4. `src/relay.js`에서 팬별 캡처 결과 중계 구현
5. `src/runner.js`에서 작업 실행 흐름 제어 구현
6. `src/cli.js`에서 인자 파싱과 인터랙티브 입력 구현
7. `src/index.js`에서 실행 연결
8. 로컬 더미 명령으로 `tmux` 팬 제어 테스트
9. 실제 `gemini`, `codex` 명령으로 화면 표시와 입력 전송 확인
10. CLI 옵션과 오류 메시지 정리

## 18. 테스트 전략

초기에는 Node.js 내장 테스트 러너를 사용한다.

```bash
node --test
```

테스트 대상:

- 에이전트 이름 파싱
- 알 수 없는 에이전트 처리
- `tmux` 명령 호출 인자 생성
- 팬별 캡처 결과 diff 처리
- transcript 누적
- 타임아웃 처리
- JSON 출력 형식

실제 `gemini`, `codex` CLI를 호출하는 테스트는 기본 단위 테스트에 포함하지 않는다. 대신 테스트용 더미 Node.js 스크립트를 `tmux` 팬에서 실행한다.

## 19. 미해결 쟁점

- `gemini`와 `codex`가 `tmux send-keys` 입력으로 안정적으로 동작하는지 확인이 필요하다.
- 각 CLI의 입력 가능 상태를 어떤 화면 패턴으로 감지할지 확인이 필요하다.
- `tmux capture-pane` 결과에서 ANSI 제어 문자와 전체 화면 갱신을 어떻게 정리할지 결정해야 한다.
- CLI별 비대화형 실행 옵션이 존재한다면 어댑터에 반영해야 한다.
- 메인 relay 팬을 같은 `tmux` 세션 안에 둘지, 원래 실행 터미널에 둘지 결정해야 한다.
- `tmux`가 없는 환경에서 `pipe` fallback을 자동 사용할지, 명시 옵션으로만 허용할지 결정해야 한다.
- `node-pty` 도입 여부는 `tmux` 방식의 한계가 명확해진 뒤 결정한다.

## 20. 현재 결론

첫 번째 구현은 "`tmux` 세션 안에서 `gemini`와 `codex`의 실제 화면을 보여주고, 메인 CLI 입력을 각 화면에 전송하며, 각 화면의 출력을 메인 화면에도 중계하는 CLI"로 제한한다.

이 범위는 npm 의존성 없이 Node.js 25 내장 모듈과 시스템 `tmux` 명령으로 구현 가능하다. 이후 실제 AI CLI의 입출력 특성에 따라 `node-pty`, 설정 파일, transcript 저장 기능을 단계적으로 추가한다.
