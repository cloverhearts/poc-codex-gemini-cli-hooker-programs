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
