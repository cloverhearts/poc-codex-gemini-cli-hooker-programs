#!/usr/bin/env node

import process from "node:process";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { defaultAgents, resolveAgents } from "./agents.ai.js";
import { createHelpText, parseArgs } from "./cli.ai.js";
import { checkNodePty, loadNodePty } from "./dependencies.js";
import { runPipePrompt } from "./pipe.ai.js";
import { createPrefixRelay, createSplitRelay } from "./relay.ai.js";
import { createPersistentPromptRunner, runPrompt } from "./runner.ai.js";

async function main() {
  const options = parseArgs(process.argv.slice(2), process.env);
  const autoInstall = options.installDeps || process.env.REMOTE_STDIO_AUTO_INSTALL === "1";

  if (options.help) {
    console.log(createHelpText());
    return;
  }

  if (options.checkPty) {
    const result = await checkNodePty({ autoInstall, repairInstall: options.installDeps });
    console.log(result.ok ? "node-pty 사용 가능" : `node-pty 사용 불가: ${result.error ?? "알 수 없는 오류"}`);
    process.exit(result.ok ? 0 : 1);
  }

  if (options.installDeps && !options.interactive && !options.prompt) {
    const result = await checkNodePty({ autoInstall: true, repairInstall: true });
    console.log(result.ok ? "node-pty 설치 및 확인 완료" : `node-pty 설치 후 확인 실패: ${result.error ?? "알 수 없는 오류"}`);
    process.exit(result.ok ? 0 : 1);
  }

  const agents = resolveAgents(options.agents, defaultAgents);

  if (!options.interactive && !options.prompt) {
    console.log(createHelpText());
    return;
  }

  const runtime = await resolveRuntime({ options, autoInstall });

  if (options.interactive) {
    await runInteractive({ options: runtime.options, agents, pty: runtime.pty });
    return;
  }

  const result = await runOnce({ options: runtime.options, agents, pty: runtime.pty });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function runInteractive({ options, agents, pty }) {
  if (options.view === "split" && options.view !== "pipe") {
    await runSplitInteractive({ options, agents, pty });
    return;
  }

  const input = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const relay = createRelay({ options: { ...options, json: false }, agents });
  const runner =
    options.view === "pipe"
      ? null
      : createPersistentPromptRunner({
          agents,
          pty,
          timeoutMs: options.timeoutMs,
          relay
        });

  try {
    console.log("인터랙티브 모드를 시작합니다. 종료하려면 /exit를 입력하십시오.");
    for (;;) {
      const prompt = (await input.question("> ")).trim();
      if (!prompt) {
        continue;
      }
      if (prompt === "/exit") {
        break;
      }
      if (prompt === "/agents") {
        console.log(agents.map((agent) => agent.name).join(", "));
        continue;
      }
      if (prompt === "/help") {
        console.log("사용 가능 명령: /exit, /agents, /help");
        continue;
      }

      if (runner) {
        await runner.sendPrompt(prompt);
      } else {
        await runOnce({
          options: { ...options, prompt, json: false },
          agents,
          pty
        });
      }
    }
  } finally {
    relay?.flush();
    runner?.close();
    input.close();
  }
}

async function runSplitInteractive({ options, agents, pty }) {
  const relay = createRelay({ options: { ...options, json: false }, agents });
  const runner = createPersistentPromptRunner({
    agents,
    pty,
    timeoutMs: options.timeoutMs,
    relay
  });

  let inputLine = "";
  let busy = false;
  let done = false;
  const wasRaw = Boolean(process.stdin.isRaw);

  relay?.setStatus?.("에이전트 준비 대기 중");
  relay?.setInputLine?.(inputLine);

  emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  try {
    await new Promise((resolve) => {
      const onKeypress = async (_str, key = {}) => {
        if (done) {
          return;
        }
        if (key.ctrl && key.name === "c") {
          done = true;
          resolve();
          return;
        }
        if (busy) {
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          const prompt = inputLine.trim();
          inputLine = "";
          relay?.setInputLine?.(inputLine);
          if (!prompt) {
            return;
          }
          if (prompt === "/exit") {
            done = true;
            resolve();
            return;
          }
          if (prompt === "/agents") {
            relay?.setStatus?.(`활성 에이전트: ${agents.map((agent) => agent.name).join(", ")}`);
            return;
          }
          if (prompt === "/help") {
            relay?.setStatus?.("명령: /exit, /agents, /help");
            return;
          }

          busy = true;
          relay?.setStatus?.("프롬프트 전송 및 응답 대기 중");
          try {
            await runner.sendPrompt(prompt);
            relay?.setStatus?.("준비됨");
          } catch (error) {
            relay?.setStatus?.(`오류: ${error.message}`);
          } finally {
            busy = false;
          }
          return;
        }
        if (key.name === "backspace" || key.name === "delete") {
          inputLine = inputLine.slice(0, -1);
          relay?.setInputLine?.(inputLine);
          return;
        }
        if (key.name === "escape") {
          inputLine = "";
          relay?.setInputLine?.(inputLine);
          return;
        }
        if (typeof _str === "string" && _str >= " " && !key.ctrl && !key.meta) {
          inputLine += _str;
          relay?.setInputLine?.(inputLine);
        }
      };

      process.stdin.on("keypress", onKeypress);
    });
  } finally {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(wasRaw);
    }
    process.stdin.pause();
    runner.close();
    relay?.flush();
    relay?.close?.();
  }
}

async function runOnce({ options, agents, pty }) {
  const relay = createRelay({ options, agents });
  const run = options.view === "pipe" ? runPipePrompt : runPrompt;
  try {
    relay?.setStatus?.("에이전트 준비 및 프롬프트 전송 대기 중");
    const result = await run(
      options.view === "pipe"
        ? {
            agents,
            prompt: options.prompt,
            timeoutMs: options.timeoutMs,
            relay
          }
        : {
            agents,
            prompt: options.prompt,
            pty,
            timeoutMs: options.timeoutMs,
            relay
          }
    );

    relay?.setStatus?.("완료");
    relay?.flush();

    if (!options.json) {
      for (const agentResult of result.results) {
        if (agentResult.status !== "success") {
          console.error(`[${agentResult.agent}] ${agentResult.status}: ${agentResult.error ?? "오류"}`);
        }
      }
    }

    return result;
  } finally {
    relay?.close?.();
  }
}

function createRelay({ options, agents }) {
  if (options.json) {
    return null;
  }
  if (options.view === "split") {
    return createSplitRelay(
      agents.map((agent) => agent.name),
      process.stdout
    );
  }
  return createPrefixRelay(process.stdout);
}

async function resolveRuntime({ options, autoInstall }) {
  if (options.view === "pipe") {
    return { options, pty: null };
  }

  let pty = null;
  try {
    const ptyCheck = await checkNodePty({ autoInstall, repairInstall: options.installDeps });
    if (!ptyCheck.ok) {
      console.error(`node-pty 사용 불가: ${ptyCheck.error ?? "알 수 없는 오류"}`);
      console.error("자동으로 pipe 모드로 전환합니다.");
      return { options: { ...options, view: "pipe" }, pty: null };
    }
    pty = await loadNodePty({ autoInstall });
  } catch (error) {
    console.error(`node-pty 초기화 실패: ${error.message}`);
    console.error("자동으로 pipe 모드로 전환합니다.");
    return { options: { ...options, view: "pipe" }, pty: null };
  }

  return { options, pty };
}
