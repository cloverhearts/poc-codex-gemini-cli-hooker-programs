import { execSync } from "node:child_process";
import { stripAnsi } from "./ansi.ai.js";

export async function runPrompt(options) {
  const runner = createPersistentPromptRunner(options);
  try {
    return await runner.sendPrompt(options.prompt);
  } finally {
    runner.close();
  }
}

export function createPersistentPromptRunner(options) {
  const {
    agents,
    pty,
    timeoutMs = 300000,
    relay = null,
    cwd = process.cwd(),
    env = process.env,
  } = options;

  if (!pty?.spawn) {
    throw new Error("PTY spawn 함수를 사용할 수 없습니다.");
  }

  const sessions = agents.map((agent) =>
    createSession({
      agent,
      pty,
      timeoutMs,
      relay,
      cwd,
      env,
    }),
  );

  return {
    async sendPrompt(prompt) {
      if (!prompt?.trim()) {
        throw new Error("빈 프롬프트는 실행할 수 없습니다.");
      }

      await waitForAllReady(sessions, relay);
      const promptResults = sessions.map((session) => session.send(prompt));
      const results = await waitForPromptResults({
        sessions,
        promptResults,
        timeoutMs,
      });

      return {
        prompt,
        startedAt: new Date(
          Math.min(...results.map((result) => Date.parse(result.startedAt))),
        ).toISOString(),
        finishedAt: new Date().toISOString(),
        results,
      };
    },
    close() {
      for (const session of sessions) {
        session.close();
      }
    },
  };
}

function waitForPromptResults({ sessions, promptResults, timeoutMs }) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(
        sessions.map((session) =>
          session.forceFinish("timeout", `타임아웃 초과: ${timeoutMs}ms`),
        ),
      );
    }, timeoutMs);

    Promise.all(promptResults).then((results) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(results);
    });
  });
}

async function waitForAllReady(sessions, relay) {
  const check = () => {
    const notReady = sessions.filter((s) => !s.isReady());
    if (notReady.length > 0) {
      relay?.setStatus?.(
        `준비 대기 중: ${notReady.map((s) => s.agentName()).join(", ")}`,
      );
      return false;
    }
    return true;
  };

  if (check()) {
    return;
  }

  await Promise.all(sessions.map((session) => session.waitUntilReady()));
}

function createSession({ agent, pty, timeoutMs, relay, cwd, env }) {
  const createdAt = new Date();
  let state = "Init";
  let transcript = "";
  let lastOutput = "";
  let processHandle = null;
  let closed = false;
  let ready = false;
  let readyTimer = null;
  let readyWaiters = [];
  let activePrompt = null;
  let startupFailure = null;

  let spawnCommand = agent.command;
  let spawnArgs = agent.args ?? [];

  if (process.platform === "win32") {
    // Windows에서 .cmd/.exe 파일을 직접 실행할 때 새 창이 뜨지 않고 PTY 안에서만 동작하도록 cmd.exe /c를 사용한다.
    // powershell.exe -Command는 간혹 자식 프로세스를 외부 콘솔로 분리하는 경우가 있어 cmd.exe가 더 안정적이다.
    const shellPath = process.env.ComSpec || "cmd.exe";
    spawnCommand = shellPath;

    const resolvedCommand = resolveWindowsCommand(agent.command);
    // cmd.exe /c 에서는 전체 명령어를 하나의 문자열로 묶어 전달한다.
    const fullCommandLine = [resolvedCommand, ...spawnArgs]
      .map((arg) => (arg.includes(" ") ? `"${arg}"` : arg))
      .join(" ");

    spawnArgs = ["/c", fullCommandLine];
  }

  try {
    processHandle = pty.spawn(spawnCommand, spawnArgs, {
      name: "xterm-color",
      cols: 100,
      rows: 30,
      cwd,
      env,
    });
  } catch (error) {
    state = "Error";
    closed = true;
    ready = false;
    startupFailure = createResult("failed", { error: error.message });
    relay?.onData?.(agent.name, `에이전트 실행 실패: ${error.message}\n`);
    notifyReady(false);
    return {
      waitUntilReady: () => Promise.resolve(false),
      send: () => Promise.resolve(startupFailure),
      close: () => {},
      isReady: () => true,
      agentName: () => agent.name,
    };
  }

  const startupTimer = setTimeout(() => {
    if (!ready && !closed) {
      state = "Error";
      closed = true;
      startupFailure = createResult("timeout", {
        error: `타임아웃 초과: ${timeoutMs}ms`,
      });
      relay?.onData?.(agent.name, `에이전트 준비 타임아웃 (${timeoutMs}ms)\n`);
      tryKill(processHandle);
      notifyReady(false);
    }
  }, timeoutMs);

  processHandle.onData((chunk) => {
    const cleanChunk =
      agent.stripAnsi === false ? String(chunk) : stripAnsi(chunk);
    transcript += cleanChunk;
    lastOutput = tailText(transcript);
    relay?.onData?.(agent.name, cleanChunk);

    if (activePrompt) {
      activePrompt.lastOutput = lastOutput;
      activePrompt.transcriptEnd = transcript.length;
      schedulePromptCompletion();
    }

    if (activePrompt && agent.completeOnReady === false) {
      return;
    }

    if (
      isReady(
        agent,
        activePrompt ? transcript.slice(activePrompt.sentAtLength) : transcript,
      )
    ) {
      scheduleReady();
    } else {
      if (!readyTimer) {
        ready = false;
      }
    }
  });

  processHandle.onExit?.((event = {}) => {
    const wasClosed = closed;
    closed = true;
    state = event.exitCode === 0 ? "Finished" : "Error";
    clearTimeout(startupTimer);
    clearTimeout(readyTimer);
    notifyReady(false);

    if (!wasClosed && event.exitCode !== 0) {
      relay?.onData?.(
        agent.name,
        `\n프로세스가 비정상 종료되었습니다. (코드: ${event.exitCode})\n`,
      );
    }

    if (activePrompt) {
      finishPrompt(event.exitCode === 0 ? "success" : "failed", {
        exitCode: event.exitCode ?? null,
        error:
          event.exitCode === 0 ? null : `프로세스 종료 코드: ${event.exitCode}`,
      });
    }
  });

  return {
    waitUntilReady,
    send,
    forceFinish,
    close,
    isReady: () => ready || closed,
    agentName: () => agent.name,
  };

  function waitUntilReady() {
    if (closed) {
      return Promise.resolve(false);
    }
    if (ready) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      readyWaiters.push(resolve);
    });
  }

  function send(prompt) {
    if (closed) {
      return Promise.resolve(
        startupFailure ??
          createResult("failed", {
            error: "에이전트 프로세스가 종료되었습니다.",
          }),
      );
    }
    if (activePrompt) {
      return Promise.resolve(
        createResult("failed", {
          error: "이전 프롬프트가 아직 완료되지 않았습니다.",
        }),
      );
    }

    ready = false;
    clearTimeout(readyTimer);
    state = "Busy";

    activePrompt = {
      startedAt: new Date(),
      sentAtLength: transcript.length,
      transcriptStart: transcript.length,
      transcriptEnd: transcript.length,
      lastOutput: "",
      timer: null,
      idleTimer: null,
      enterTimer: null,
      resolve: null,
    };

    const result = new Promise((resolve) => {
      activePrompt.resolve = resolve;
    });

    activePrompt.timer = setTimeout(() => {
      finishPrompt("timeout", { error: `타임아웃 초과: ${timeoutMs}ms` });
    }, timeoutMs);

    writePrompt(prompt);
    schedulePromptCompletion();
    return result;
  }

  function writePrompt(prompt) {
    if (agent.clearLineBeforeInput) {
      processHandle.write("\x15");
    }
    if (agent.bracketedPaste !== false) {
      processHandle.write("\x1b[200~");
      processHandle.write(prompt);
      processHandle.write("\x1b[201~");
    } else {
      processHandle.write(prompt);
    }
    const enterDelayMs =
      agent.enterDelayMs ?? (agent.bracketedPaste !== false ? 50 : 0);
    if (enterDelayMs <= 0) {
      processHandle.write(agent.inputSuffix ?? "\r");
      return;
    }
    activePrompt.enterTimer = setTimeout(() => {
      if (activePrompt) {
        processHandle.write(agent.inputSuffix ?? "\r");
      }
    }, enterDelayMs);
  }

  function scheduleReady() {
    if (readyTimer) {
      return;
    }
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      readyTimer = null;
      if (closed) {
        notifyReady(false);
        return;
      }
      ready = true;
      state = "Ready";
      clearTimeout(startupTimer);
      notifyReady(true);
      if (activePrompt) {
        finishPrompt("success", { exitCode: 0 });
      }
    }, agent.readyQuietMs ?? 300);
  }

  function schedulePromptCompletion() {
    if (!activePrompt) {
      return;
    }
    clearTimeout(activePrompt.idleTimer);
    activePrompt.idleTimer = setTimeout(() => {
      if (activePrompt) {
        state = "Ready";
        ready = true;
        finishPrompt("success", { exitCode: 0 });
      }
    }, agent.idleCompletionMs ?? 5000);
  }

  function finishPrompt(status, extra = {}) {
    if (!activePrompt) {
      return;
    }

    const promptState = activePrompt;
    clearTimeout(promptState.timer);
    clearTimeout(promptState.idleTimer);
    clearTimeout(promptState.enterTimer);
    activePrompt = null;

    promptState.resolve(
      createResult(status, {
        ...extra,
        startedAt: promptState.startedAt,
        transcriptStart: promptState.transcriptStart,
        transcriptEnd: promptState.transcriptEnd,
        lastOutput: promptState.lastOutput,
      }),
    );
  }

  function forceFinish(status, error) {
    if (activePrompt) {
      const promptState = activePrompt;
      clearTimeout(promptState.timer);
      clearTimeout(promptState.idleTimer);
      clearTimeout(promptState.enterTimer);
      activePrompt = null;
      const result = createResult(status, {
        error,
        startedAt: promptState.startedAt,
        transcriptStart: promptState.transcriptStart,
        transcriptEnd: promptState.transcriptEnd,
        lastOutput: promptState.lastOutput,
      });
      promptState.resolve(result);
      return result;
    }

    return createResult(status, { error });
  }

  function createResult(status, extra = {}) {
    const startedAt = extra.startedAt ?? createdAt;
    const transcriptStart = extra.transcriptStart ?? 0;
    const transcriptEnd = extra.transcriptEnd ?? transcript.length;
    const resultTranscript = transcript.slice(transcriptStart, transcriptEnd);

    return {
      agent: agent.name,
      status,
      state,
      exitCode: extra.exitCode ?? null,
      error: extra.error ?? null,
      transcript: resultTranscript,
      lastOutput: extra.lastOutput ?? tailText(resultTranscript),
      durationMs: Date.now() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  function notifyReady(value) {
    const waiters = readyWaiters;
    readyWaiters = [];
    for (const resolve of waiters) {
      resolve(value);
    }
  }

  function close() {
    closed = true;
    clearTimeout(startupTimer);
    clearTimeout(readyTimer);
    if (activePrompt) {
      finishPrompt("failed", { error: "세션이 종료되었습니다." });
    }
    notifyReady(false);
    tryKill(processHandle);
  }
}

function isReady(agent, text) {
  if (!agent.promptRegex) {
    return true;
  }
  const regex = new RegExp(
    agent.promptRegex.source,
    agent.promptRegex.flags.replace("g", ""),
  );
  // TUI가 프롬프트 뒤에 빈 줄이나 터미널 제목 제어문자를 계속 출력할 수 있어 넉넉하게 검사한다.
  return regex.test(tailText(text, 4000).trimEnd());
}

function tailText(value, maxLength = 2000) {
  return value.length > maxLength
    ? value.slice(value.length - maxLength)
    : value;
}

function tryKill(processHandle) {
  try {
    processHandle?.kill?.();
  } catch {
    // 종료 중 실패는 결과 수집을 막지 않는다.
  }

  const pid = processHandle?.pid;
  if (typeof pid !== "number" || pid <= 0) {
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  setTimeout(() => {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // 이미 종료된 경우 무시한다.
    }
  }, 500);
}

function resolveWindowsCommand(command) {
  if (command.includes("\\") || command.includes("/")) {
    return command;
  }
  try {
    const output = execSync(`where.exe ${command}`, { encoding: "utf8" });
    const firstPath = output.split(/\r?\n/)[0].trim();
    return firstPath || command;
  } catch {
    return command;
  }
}
