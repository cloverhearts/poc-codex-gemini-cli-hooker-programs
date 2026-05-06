#!/usr/bin/env node

import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const args = ["install", "node-pty@^1.1.0", "--save"];

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

repairNodePtyPermissions();

console.log("[remote-stdio-ai] node-pty 설치가 완료되었습니다.");

function repairNodePtyPermissions() {
  if (process.platform === "win32") {
    return;
  }

  const helperPath = join(
    process.cwd(),
    "node_modules",
    "node-pty",
    "prebuilds",
    `${process.platform}-${process.arch}`,
    "spawn-helper"
  );

  if (!existsSync(helperPath)) {
    return;
  }

  chmodSync(helperPath, 0o755);
  console.log("[remote-stdio-ai] node-pty spawn-helper 실행 권한을 복구했습니다.");
}
