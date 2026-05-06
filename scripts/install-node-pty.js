#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const args = ["install", "node-pty@^1.0.0", "--save"];

console.log("[remote-stdio-ai] node-pty 설치를 시작합니다.");
console.log(`[remote-stdio-ai] 실행 명령: ${npmCommand} ${args.join(" ")}`);

const result = spawnSync(npmCommand, args, {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env
});

if (result.error) {
  console.error("[remote-stdio-ai] node-pty 설치 명령을 실행하지 못했습니다.");
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[remote-stdio-ai] node-pty 설치가 실패했습니다. 종료 코드: ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log("[remote-stdio-ai] node-pty 설치가 완료되었습니다.");
