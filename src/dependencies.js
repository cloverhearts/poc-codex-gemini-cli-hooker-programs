import { chmodSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";

const NODE_PTY_PACKAGE = "node-pty";
const require = createRequire(import.meta.url);
const childProcess = require("node:child_process");
const { spawnSync } = childProcess;
let consoleListAgentPatched = false;

export async function loadNodePty(options = {}) {
  const { autoInstall = false, forceInstall = false } = options;

  if (forceInstall) {
    installNodePty();
  }
  repairNodePtyPermissions();

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

export async function checkNodePty(options = {}) {
  const { autoInstall = false, repairInstall = false } = options;
  let pty = await loadNodePty({ autoInstall });
  let spawnCheck = await checkNodePtySpawn(pty);

  if (!spawnCheck.ok && repairInstall) {
    repairNodePtyPermissions();
    spawnCheck = await checkNodePtySpawn(pty);
  }

  if (!spawnCheck.ok && repairInstall) {
    rebuildNodePty();
    repairNodePtyPermissions();
    pty = await importNodePty();
    spawnCheck = await checkNodePtySpawn(pty);

    if (!spawnCheck.ok) {
      installNodePty();
      repairNodePtyPermissions();
      pty = await importNodePty();
      spawnCheck = await checkNodePtySpawn(pty);
    }
  }

  return {
    ok: Boolean(pty?.spawn) && spawnCheck.ok,
    hasSpawn: typeof pty?.spawn === "function",
    canSpawn: spawnCheck.ok,
    error: spawnCheck.error
  };
}

async function importNodePty() {
  patchConptyConsoleListAgentStderr();
  const imported = await import(NODE_PTY_PACKAGE);
  return imported.default ?? imported;
}

function patchConptyConsoleListAgentStderr() {
  if (consoleListAgentPatched || process.platform !== "win32") {
    return;
  }

  const originalFork = childProcess.fork;
  childProcess.fork = function forkWithHiddenConptyAgentStderr(modulePath, args, options) {
    if (typeof modulePath !== "string" || !modulePath.includes("conpty_console_list_agent")) {
      return originalFork.apply(this, arguments);
    }

    const forkArgs = Array.isArray(args) ? args : [];
    const forkOptions = Array.isArray(args) ? options : args;
    return originalFork.call(this, modulePath, forkArgs, {
      ...(forkOptions ?? {}),
      stdio: ["ignore", "ignore", "ignore", "ipc"]
    });
  };
  consoleListAgentPatched = true;
}

function installNodePty() {
  runNpmCommand(["install", "node-pty@^1.0.0", "--save"], "node-pty 설치");
}

function rebuildNodePty() {
  runNpmCommand(["rebuild", "node-pty"], "node-pty rebuild");
}

function runNpmCommand(args, label) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env
  });

  if (result.error) {
    throw new Error(`${label} 명령 실행 실패: ${result.error.message}`, {
      cause: result.error
    });
  }

  if (result.status !== 0) {
    throw new Error(`${label} 실패. 종료 코드: ${result.status}`);
  }
}

function repairNodePtyPermissions() {
  if (process.platform === "win32") {
    return;
  }

  const platformArch = `${process.platform}-${process.arch}`;
  const helperPath = join(process.cwd(), "node_modules", NODE_PTY_PACKAGE, "prebuilds", platformArch, "spawn-helper");

  if (!existsSync(helperPath)) {
    return;
  }

  try {
    chmodSync(helperPath, 0o755);
  } catch {
    // 권한 복구 실패는 이후 spawn 검사에서 명확한 오류로 드러난다.
  }
}

function isMissingNodePty(error) {
  return (
    error?.code === "ERR_MODULE_NOT_FOUND" &&
    typeof error?.message === "string" &&
    error.message.includes(NODE_PTY_PACKAGE)
  );
}

function checkNodePtySpawn(pty) {
  if (typeof pty?.spawn !== "function") {
    return Promise.resolve({ ok: false, error: "node-pty spawn 함수를 찾을 수 없습니다." });
  }

  return new Promise((resolve) => {
    let settled = false;
    let processHandle = null;

    const settle = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        processHandle?.kill?.();
      } catch {
        // 검사 종료 중 kill 실패는 무시한다.
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      settle({ ok: false, error: "node-pty spawn 확인 시간이 초과되었습니다." });
    }, 1000);

    try {
      const command = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
      const args = process.platform === "win32" ? ["/c", "echo", "ok"] : ["-lc", "printf ok"];
      processHandle = pty.spawn(command, args, {
        name: "xterm-color",
        cols: 20,
        rows: 5,
        cwd: process.cwd(),
        env: process.env
      });
      processHandle.onData((data) => {
        if (String(data).includes("ok")) {
          settle({ ok: true, error: null });
        }
      });
      processHandle.onExit?.((event) => {
        if (event?.exitCode === 0) {
          settle({ ok: true, error: null });
        } else {
          settle({ ok: false, error: `node-pty spawn 종료 코드: ${event?.exitCode}` });
        }
      });
    } catch (error) {
      settle({ ok: false, error: error.message });
    }
  });
}
