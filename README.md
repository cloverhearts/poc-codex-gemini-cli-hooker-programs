# Remote Control stdio for AI CLI

하나의 메인 CLI에서 입력한 프롬프트를 여러 AI CLI 에이전트에 전달하고, 각 에이전트의 출력을 실시간으로 확인하기 위한 로컬 오케스트레이션 도구입니다.

초기 대상 에이전트는 `gemini`와 `codex`입니다. 이 프로젝트는 서버, 웹 UI, 데이터베이스를 먼저 만들기보다 로컬 터미널에서 직접 동작하는 단순한 CLI 프로그램을 목표로 합니다.

## 목표

- 메인 프로그램 하나를 실행한다.
- 메인 프로그램이 `gemini`와 `codex`를 병렬로 실행한다.
- 사용자가 메인 프로그램에 입력한 프롬프트를 각 에이전트에 전달한다.
- 각 에이전트의 실제 터미널 출력을 메인 화면에서 실시간으로 확인한다.
- 에이전트별 transcript를 수집해 결과를 비교할 수 있게 한다.

## 실행 모델

이 프로젝트의 기본 실행 모델은 `node-pty` 기반입니다.

- **PTY 세션 관리:** `node-pty`를 통해 각 에이전트를 실제 터미널 환경에서 실행합니다.
- **상태 머신 (State Machine):** 각 에이전트의 출력을 분석하여 `Ready`, `Busy` 상태를 관리합니다.
- **입력 동기화 (Barrier):** 모든 에이전트가 준비될 때까지 사용자 입력을 대기시켰다가 동시에 전송합니다.
- **출력 정화 (ANSI Sanitization):** 메인 화면 레이아웃을 깨뜨릴 수 있는 ANSI 제어 문자를 필터링하여 안전하게 중계합니다.

플랫폼별 방향:

- macOS/Linux: `node-pty` 기반 PTY 사용
- Windows: `node-pty`의 ConPTY 기반 실행 사용
- macOS/Linux 선택 모드: 필요 시 `tmux` 모드 제공 가능
- fallback: PTY가 불가능한 환경에서는 `pipe` 모드 검토

## 현재 상태

현재 구현된 항목:

- Node.js 25 기반 `package.json`
- `node-pty` 핵심 의존성 추가
- `node-pty` 설치 확인 명령
- `node-pty` 별도 설치 스크립트
- 메인 프로세스에서 `node-pty` 누락 감지
- `--install-deps`를 통한 자동 설치 시도
- CLI 인자 파싱
- `node-pty` 기반 PTY 실행기
- `pipe` fallback 실행기
- `prefix` 출력 중계
- 에이전트별 transcript 수집
- 타임아웃 및 실패 결과 처리
- 성공/실패 테스트 케이스

아직 구현 예정인 항목:

- `split`, `prefix` 화면 모드
- `split`, `tmux` 화면 모드
- 에이전트별 정교한 Ready/Busy 감지 규칙
- 실제 `gemini`, `codex` CLI 조합 검증
- 인터랙티브 모드의 고도화

## 요구 사항

- Node.js 25 이상
- npm
- 로컬에서 실행 가능한 `gemini` CLI
- 로컬에서 실행 가능한 `codex` CLI
- `node-pty` 설치가 가능한 빌드 환경

Windows에서는 Windows Terminal 또는 PowerShell 7 사용을 권장합니다. `node-pty`는 native 모듈이므로 Windows에서 Python, C++ 빌드 도구, Windows SDK가 필요할 수 있습니다.

## 설치

```bash
npm install
```

`node-pty`만 별도로 설치하려면 다음 명령을 사용합니다.

```bash
npm run install:pty
```

## node-pty 확인

```bash
npm run check:pty
```

또는 직접 실행할 수 있습니다.

```bash
node src/index.js --check-pty
```

정상 설치된 경우 다음과 같은 출력이 표시됩니다.

```text
node-pty 사용 가능
```

`node-pty` 모듈 로드는 가능하지만 실제 PTY 프로세스 생성이 실패하는 환경에서는 다음처럼 표시됩니다.

```text
node-pty 사용 불가: posix_spawnp failed.
```

## 자동 설치 옵션

메인 프로세스 실행 시 `node-pty`가 없으면 자동 설치를 시도할 수 있습니다.

```bash
node src/index.js --install-deps
```

이 명령은 `node-pty` 설치 또는 rebuild를 시도한 뒤 실제 PTY 생성 가능 여부까지 확인합니다.

설치 확인과 재설치 시도를 함께 실행할 수 있습니다.

```bash
node src/index.js --install-deps --check-pty
```

환경변수로도 자동 설치를 활성화할 수 있습니다.

```bash
REMOTE_STDIO_AUTO_INSTALL=1 node src/index.js
```

자동 설치는 로컬 개발 편의 기능입니다. 일반적인 배포나 CI 환경에서는 `npm install` 단계에서 의존성을 미리 설치하는 것을 권장합니다.

`node-pty`가 이미 설치되어 있지만 실제 PTY 생성이 실패하는 경우 `--install-deps` 또는 `--install-deps --check-pty`는 `npm rebuild node-pty`를 먼저 시도하고, 그래도 실패하면 `node-pty` 재설치를 한 번 시도한 뒤 다시 확인합니다.

macOS/Linux에서 `node-pty`의 `spawn-helper` 실행 권한이 빠져 `posix_spawnp failed`가 발생하는 경우에는 `--install-deps`가 실행 권한 복구도 함께 시도합니다.

## 기본 실행

```bash
npm start
```

에이전트나 옵션을 npm script에 전달할 때는 npm 표준 방식인 `--` 구분자를 사용하는 것을 권장합니다.

```bash
npm run start -- --agents gemini "작업 지시문"
```

도움말은 다음 명령으로 확인할 수 있습니다.

```bash
node src/index.js --help
```

PTY 모드 실행 형태:

```bash
node src/index.js --agents gemini,codex --view prefix "작업 지시문"
```

`node-pty`가 실제 spawn에 실패하는 환경에서는 `pipe` 모드를 사용할 수 있습니다.

```bash
node src/index.js --agents gemini,codex --view pipe "작업 지시문"
```

예상 흐름:

1. 메인 CLI가 `gemini`, `codex`용 PTY를 생성한다.
2. 각 PTY에서 에이전트 CLI를 실행한다.
3. 메인 CLI가 모든 에이전트의 입력 가능 상태를 기다린다.
4. 사용자가 메인 CLI에 프롬프트를 입력한다.
5. 모든 에이전트가 준비되면 메인 CLI가 같은 입력을 각 에이전트 PTY에 전달한다.
6. 메인 CLI는 메시지 본문과 Enter 입력을 별도 PTY write 이벤트로 전달한다.
   - 메시지 본문: `write(prompt)`
   - Enter 입력: `write("\r")`
7. 각 에이전트의 출력을 메인 화면에 실시간 중계한다.

## 예정 CLI 옵션

```bash
node src/index.js --agents gemini,codex
node src/index.js --view split
node src/index.js --view prefix
node src/index.js --timeout 300000
node src/index.js --json "작업 지시문"
```

화면 모드:

- `split`: 에이전트별 출력을 패널처럼 구분해 표시
- `prefix`: 각 출력 줄 앞에 `[gemini]`, `[codex]` prefix를 붙여 표시
- `tmux`: macOS/Linux에서 선택적으로 실제 tmux pane 사용
- `pipe`: PTY 없이 stdout/stderr만 수집하는 fallback

현재 구현에서 안정적으로 검증된 모드는 `prefix`와 `pipe`입니다.

`split` 모드는 기본 분할 렌더러로 구현되어 있습니다. 완전한 터미널 에뮬레이터는 아니지만 에이전트별 출력 영역을 나눠 표시하고, 모든 에이전트가 준비된 뒤 동일 프롬프트와 Enter 입력을 broadcast합니다.

Gemini/Codex 같은 TUI CLI는 준비 문구가 보인 직후에도 인증, MCP 부팅, 업데이트 알림 등 추가 출력이 이어질 수 있습니다. 이 때문에 기본 에이전트는 Ready 패턴 감지 후 짧은 quiet 대기 시간을 둔 뒤 프롬프트를 전송합니다.

인터랙티브 모드에서는 에이전트 PTY를 프롬프트마다 재시작하지 않습니다. 프로그램 시작 시 생성한 PTY 세션을 유지하고, 다음 프롬프트를 같은 세션에 계속 전달합니다. 메시지 입력은 TUI 호환성을 위해 bracketed paste 시퀀스와 Enter 이벤트를 사용합니다.

## 프로젝트 구조

```text
.
├── README.md
├── Ideation.md
├── Spec.md
├── History.md
├── package.json
├── scripts
│   └── install-node-pty.js
└── src
    ├── index.js
    └── dependencies.js
```

예정 구조:

```text
src
├── cli.js
├── runner.js
├── pty.js
├── relay.js
└── agents
    ├── codex.js
    └── gemini.js
```

## 설계 문서

자세한 스펙은 `Spec.md`를 참조하십시오.

초기 아이디어는 `Ideation.md`에 정리되어 있습니다.
