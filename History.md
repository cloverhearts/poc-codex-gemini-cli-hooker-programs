# History.md

[2026-05-07 00:03] AGENTS.md에 사람 작성 문서 보호, 변경 이력 기록, 최소 변경 원칙을 추가함.
[2026-05-07 00:06] Spec.md를 tmux 기반 실시간 에이전트 화면 표시 및 메인 중계 구조로 수정함.
[2026-05-07 00:07] Codex, Claude, Gemini가 AGENTS.md를 참조하도록 CODEX.md, CLAUDE.md, GEMINI.md를 추가함.
[2026-05-07 00:12] Spec.md를 node-pty 중심 구조로 전환하고 Windows ConPTY 지원 방향을 반영함.
[2026-05-07 00:13] AGENTS.md에 CLI 기반 Git 커밋 요청 처리 원칙을 추가함.
[2026-05-07 00:19] node-pty 핵심 의존성, 설치 보조 스크립트, 메인 프로세스 의존성 확인 흐름을 추가함.
[2026-05-07 00:20] npm install로 node-pty 설치를 검증하고 node_modules 제외용 .gitignore를 추가함.
[2026-05-07 00:21] 프로젝트 소개, 설치, 실행 방향을 정리한 README.md를 추가함.
[2026-05-07 00:30] Spec.md 및 README.md 업데이트: 일반화된 어댑터 인터페이스, ANSI 정화 정책, 입력 동기화(Barrier) 메커니즘 설계 반영.
[2026-05-07 00:32] node-pty 기반 에이전트 실행, CLI 인자 파싱, prefix 중계, 성공/실패 테스트를 구현함.
[2026-05-07 00:32] node-pty 실제 spawn 확인을 추가하고 의존성 없는 pipe 실행 모드와 성공/실패 테스트를 구현함.
[2026-05-07 00:32] README.md에 현재 구현 상태, pipe fallback 실행법, node-pty spawn 검증 결과 설명을 반영함.
[2026-05-07 00:47] npm run start --agents 형태의 인자 복구와 node-pty spawn 실패 시 pipe 자동 전환을 구현함.
[2026-05-07 00:47] 프롬프트 없는 실행에서는 런타임 초기화 없이 도움말을 출력하도록 순서를 수정함.
[2026-05-07 00:53] --install-deps가 --check-pty 및 런타임 확인에서 node-pty 자동 설치와 재설치를 시도하도록 수정함.
[2026-05-07 00:53] --install-deps 단독 실행 시 node-pty rebuild/install 후 실제 PTY 생성 가능 여부를 확인하도록 수정함.
[2026-05-07 00:56] node-pty spawn-helper 실행 권한 누락으로 인한 posix_spawnp failed 문제를 --install-deps에서 복구하도록 수정함.
[2026-05-07 00:56] npm run install:pty 스크립트에도 node-pty spawn-helper 실행 권한 복구를 추가함.
[2026-05-07 01:03] split 화면 릴레이를 구현하고 Gemini/Codex 준비 상태 감지 및 입력 전송 완료 판정을 보강함.
[2026-05-07 01:08] 모든 에이전트가 Ready가 된 뒤 프롬프트와 Enter를 별도 write로 broadcast하도록 Barrier 전송 방식을 구현함.
[2026-05-07 01:13] Gemini/Codex 기본 Enter를 carriage return으로 변경하고 Ready 감지 후 quiet 대기 시간을 추가함.
[2026-05-07 01:28] interactive 모드에서 PTY 세션을 재사용하는 persistent runner와 bracketed paste 입력 전송을 구현함.
[2026-05-07 01:36] split interactive 전용 입력 루프를 추가하고 메인 프롬프트와 상태를 split 화면 하단에 통합 렌더링하도록 수정함.
[2026-05-07 01:43] 반복 Ready 출력이 완료 판정을 계속 지연시키지 않도록 Ready 타이머 재설정 조건을 수정하고 단발 실행 후 split relay를 닫도록 보강함.
[2026-05-07 01:45] Codex 입력 전 현재 줄을 Ctrl+U로 지우고 Codex 완료 판정을 idle 기반으로 조정함.
[2026-05-07 01:48] split 단발 실행 상태 문구를 프롬프트 전송 대기 및 완료 상태로 갱신하도록 수정함.
[2026-05-07 02:15] 한글 전각 문자 너비 계산(getStringWidth)을 도입하여 split 렌더링 깨짐 현상을 수정함.
[2026-05-07 02:15] 기본 화면 모드를 Spec.md에 맞춰 split으로 변경함.
[2026-05-07 02:15] 에이전트 실행 실패 시 릴레이 화면에 즉시 오류를 표시하도록 개선하고, 준비 상태 감지 로직을 보강함.
[2026-05-07 02:15] split 뷰에 터미널 크기 조정(resize) 대응 로직을 추가함.
[2026-05-07 02:30] Windows 환경에서 .cmd 에이전트 실행 실패 문제를 해결하기 위해 PowerShell 래퍼를 도입하고, shell 환경설정을 로드하도록 수정함.
[2026-05-07 02:45] PowerShell 대신 cmd.exe /c를 사용하도록 변경하여 Windows에서 새 창이 뜨는 현상을 방지하고 stdio 제어 안정성을 확보함.
[2026-05-07 03:00] Windows 입력 전달 문제를 해결하기 위해 bracketed paste를 비활성화하고 줄 바꿈 문자(\r\n)를 조정함. 또한 어떤 에이전트의 준비를 기다리는지 상태 메시지에 표시하도록 개선함.
[2026-05-07 03:10] 프롬프트 감지 로직에 trimEnd()를 적용하고 정규표현식을 보강하여, 화면에 프롬프트가 보임에도 대기 상태가 해제되지 않는 문제를 개선함.
[2026-05-07 12:52] TUI 출력 잡음으로 Ready 감지가 취소되어 interactive 모드에서 입력이 전달되지 않는 문제를 수정하고 OSC 제어문자 제거 테스트를 추가함.
[2026-05-07 13:04] Windows node-pty 종료 시 conpty_console_list_agent의 AttachConsole failed 오류가 화면에 섞이지 않도록 내부 보조 프로세스 stderr를 숨김.
[2026-05-07 13:08] split 화면이 에이전트 TUI 출력을 스크롤 로그처럼 누적하지 않도록 고정 screen buffer 렌더링으로 변경함.
[2026-05-07 13:14] split interactive 입력을 raw keypress 방식에서 readline 방식으로 변경하여 한글 IME 조합 중 입력 표시 지연을 개선함.
