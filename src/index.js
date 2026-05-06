#!/usr/bin/env node

import process from "node:process";
import { checkNodePty, loadNodePty } from "./dependencies.js";

async function main() {
  const args = process.argv.slice(2);
  const autoInstall = args.includes("--install-deps") || process.env.REMOTE_STDIO_AUTO_INSTALL === "1";

  if (args.includes("--check-pty")) {
    const result = await checkNodePty();
    console.log(result.ok ? "node-pty 사용 가능" : "node-pty 사용 불가");
    process.exit(result.ok ? 0 : 1);
  }

  await loadNodePty({ autoInstall });

  console.log("remote-stdio-ai 메인 프로세스가 node-pty를 정상적으로 로드했습니다.");
  console.log("다음 단계에서 PTY 기반 gemini/codex 실행기를 연결합니다.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
