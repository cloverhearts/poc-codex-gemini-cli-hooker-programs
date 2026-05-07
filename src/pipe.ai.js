import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";

export async function runPipePrompt(options) {
  const {
    agents,
    prompt,
    timeoutMs = 300000,
    relay = null,
    cwd = process.cwd(),
    env = process.env,
  } = options;

  if (!prompt?.trim()) {
    throw new Error("빈 프롬프트는 실행할 수 없습니다.");
  }

  const results = await Promise.all(
    agents.map((agent) =>
      runPipeAgent({
        agent,
        prompt,
        timeoutMs,
        relay,
        cwd,
        env,
      }),
    ),
  );

  return {
    prompt,
    startedAt: new Date(
      Math.min(...results.map((result) => Date.parse(result.startedAt))),
    ).toISOString(),
    finishedAt: new Date().toISOString(),
    results,
  };
}

function runPipeAgent({ agent, prompt, timeoutMs, relay, cwd, env }) {
  const startedAt = new Date();
  let transcript = "";
  let lastOutput = "";
  let settled = false;
  let child = null;

  return new Promise((resolve) => {
    const settle = (status, extra = {}) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (status === "timeout") {
        try {
          child?.kill?.();
        } catch {
          // timeout 정리 중 실패는 결과 반환을 막지 않는다.
        }
      }
      resolve({
        agent: agent.name,
        status,
        state: status === "success" ? "Finished" : "Error",
        exitCode: extra.exitCode ?? null,
        error: extra.error ?? null,
        transcript,
        lastOutput,
        durationMs: Date.now() - startedAt.getTime(),
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      });
    };

    const timer = setTimeout(() => {
      settle("timeout", { error: `타임아웃 초과: ${timeoutMs}ms` });
    }, timeoutMs);

    try {
      const useShell =
        process.platform === "win32" &&
        !isAbsolute(agent.command) &&
        !agent.command.includes("\\") &&
        !agent.command.includes("/");
      child = spawn(agent.command, agent.args ?? [], {
        cwd,
        env,
        shell: useShell,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      settle("failed", { error: error.message });
      return;
    }

    child.stdout.on("data", (chunk) => {
      appendOutput(agent.name, chunk, relay);
    });
    child.stderr.on("data", (chunk) => {
      appendOutput(agent.name, chunk, relay);
    });
    child.on("error", (error) => {
      settle("failed", { error: error.message });
    });
    child.on("close", (exitCode) => {
      settle(exitCode === 0 ? "success" : "failed", {
        exitCode,
        error: exitCode === 0 ? null : `프로세스 종료 코드: ${exitCode}`,
      });
    });

    child.stdin.end(`${prompt}${agent.inputSuffix ?? "\n"}`);
  });

  function appendOutput(agentName, chunk, outputRelay) {
    const text = String(chunk);
    transcript += text;
    lastOutput =
      transcript.length > 2000
        ? transcript.slice(transcript.length - 2000)
        : transcript;
    outputRelay?.onData?.(agentName, text);
  }
}
