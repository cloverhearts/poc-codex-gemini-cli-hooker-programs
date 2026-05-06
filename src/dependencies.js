import { spawnSync } from "node:child_process";
import process from "node:process";

const NODE_PTY_PACKAGE = "node-pty";

export async function loadNodePty(options = {}) {
  const { autoInstall = false } = options;

  try {
    return await importNodePty();
  } catch (error) {
    if (!isMissingNodePty(error)) {
      throw error;
    }

    if (!autoInstall) {
      throw new Error(
        [
          "node-pty가 설치되어 있지 않습니다.",
          "다음 명령으로 설치할 수 있습니다: npm run install:pty",
          "메인 프로세스에서 자동 설치를 시도하려면 --install-deps 옵션을 사용하십시오."
        ].join("\n"),
        { cause: error }
      );
    }

    installNodePty();
    return await importNodePty();
  }
}

export async function checkNodePty() {
  const pty = await loadNodePty();
  return {
    ok: Boolean(pty?.spawn),
    hasSpawn: typeof pty?.spawn === "function"
  };
}

async function importNodePty() {
  const imported = await import(NODE_PTY_PACKAGE);
  return imported.default ?? imported;
}

function installNodePty() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["install", "node-pty@^1.0.0", "--save"], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env
  });

  if (result.error) {
    throw new Error(`node-pty 설치 명령 실행 실패: ${result.error.message}`, {
      cause: result.error
    });
  }

  if (result.status !== 0) {
    throw new Error(`node-pty 설치 실패. 종료 코드: ${result.status}`);
  }
}

function isMissingNodePty(error) {
  return (
    error?.code === "ERR_MODULE_NOT_FOUND" &&
    typeof error?.message === "string" &&
    error.message.includes(NODE_PTY_PACKAGE)
  );
}
