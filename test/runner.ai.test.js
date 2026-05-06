import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { runPrompt } from "../src/runner.ai.js";

test("Ready 상태가 감지되면 프롬프트를 전송하고 성공 결과를 반환한다", async () => {
  const fakeProcess = new FakePtyProcess();
  const pty = {
    spawn() {
      queueMicrotask(() => fakeProcess.emitData("READY> "));
      return fakeProcess;
    }
  };

  const result = await runPrompt({
    agents: [
      {
        name: "dummy",
        command: "dummy",
        args: [],
        promptRegex: />\s*$/,
        inputSuffix: "\n",
        bracketedPaste: false,
        readyQuietMs: 0
      }
    ],
    prompt: "안녕하세요",
    pty,
    timeoutMs: 1000
  });

  assert.deepEqual(fakeProcess.writes.slice(0, 2), ["안녕하세요", "\n"]);
  assert.equal(result.results[0].status, "success");
  assert.match(result.results[0].transcript, /READY>/);
});

test("Gemini 입력 안내 문구가 감지되면 프롬프트를 전송한다", async () => {
  const fakeProcess = new FakePtyProcess();
  const pty = {
    spawn() {
      queueMicrotask(() => fakeProcess.emitData(" >   Type your message or @path/to/file"));
      return fakeProcess;
    }
  };

  const result = await runPrompt({
    agents: [
      {
        name: "gemini",
        command: "gemini",
        args: [],
        promptRegex: /Type your message/,
        inputSuffix: "\n",
        bracketedPaste: false,
        readyQuietMs: 0,
        idleCompletionMs: 10
      }
    ],
    prompt: "안녕 너는 누구니?",
    pty,
    timeoutMs: 1000
  });

  assert.deepEqual(fakeProcess.writes.slice(0, 2), ["안녕 너는 누구니?", "\n"]);
  assert.equal(result.results[0].status, "success");
});

test("모든 에이전트가 Ready가 된 뒤 프롬프트와 Enter를 각각 broadcast한다", async () => {
  const fastProcess = new FakePtyProcess();
  const slowProcess = new FakePtyProcess();
  let spawnCount = 0;
  const pty = {
    spawn() {
      spawnCount += 1;
      const process = spawnCount === 1 ? fastProcess : slowProcess;
      const delay = spawnCount === 1 ? 0 : 30;
      setTimeout(() => process.emitData("READY> "), delay);
      return process;
    }
  };

  const result = await runPrompt({
    agents: [
      {
        name: "fast",
        command: "fast",
        args: [],
        promptRegex: /READY>\s*$/,
        inputSuffix: "\n",
        bracketedPaste: false,
        readyQuietMs: 0,
        idleCompletionMs: 10
      },
      {
        name: "slow",
        command: "slow",
        args: [],
        promptRegex: /READY>\s*$/,
        inputSuffix: "\n",
        bracketedPaste: false,
        readyQuietMs: 0,
        idleCompletionMs: 10
      }
    ],
    prompt: "동시 전달",
    pty,
    timeoutMs: 1000
  });

  assert.deepEqual(fastProcess.writes.slice(0, 2), ["동시 전달", "\n"]);
  assert.deepEqual(slowProcess.writes.slice(0, 2), ["동시 전달", "\n"]);
  assert.equal(result.results[0].status, "success");
  assert.equal(result.results[1].status, "success");
});

test("기본 전송은 bracketed paste와 Enter 이벤트를 사용한다", async () => {
  const fakeProcess = new FakePtyProcess();
  const pty = {
    spawn() {
      queueMicrotask(() => fakeProcess.emitData("READY> "));
      return fakeProcess;
    }
  };

  await runPrompt({
    agents: [
      {
        name: "tui",
        command: "tui",
        args: [],
        promptRegex: /READY>\s*$/,
        inputSuffix: "\r",
        clearLineBeforeInput: true,
        readyQuietMs: 0,
        enterDelayMs: 0,
        idleCompletionMs: 10
      }
    ],
    prompt: "붙여넣기 입력",
    pty,
    timeoutMs: 1000
  });

  assert.deepEqual(fakeProcess.writes.slice(0, 5), ["\x15", "\x1b[200~", "붙여넣기 입력", "\x1b[201~", "\r"]);
});

test("persistent runner는 같은 세션에 여러 프롬프트를 순서대로 전달한다", async () => {
  const fakeProcess = new FakePtyProcess();
  let spawnCount = 0;
  const pty = {
    spawn() {
      spawnCount += 1;
      queueMicrotask(() => fakeProcess.emitData("READY> "));
      return fakeProcess;
    }
  };
  const { createPersistentPromptRunner } = await import("../src/runner.ai.js");
  const runner = createPersistentPromptRunner({
    agents: [
      {
        name: "persistent",
        command: "persistent",
        args: [],
        promptRegex: /READY>\s*$/,
        inputSuffix: "\n",
        bracketedPaste: false,
        readyQuietMs: 0,
        idleCompletionMs: 10
      }
    ],
    pty,
    timeoutMs: 1000
  });

  try {
    await runner.sendPrompt("첫번째");
    await runner.sendPrompt("두번째");
  } finally {
    runner.close();
  }

  assert.equal(spawnCount, 1);
  assert.deepEqual(fakeProcess.writes, ["첫번째", "\n", "두번째", "\n"]);
});

test("Ready 패턴 이후 출력이 이어지면 quiet 대기 후 전송한다", async () => {
  const fakeProcess = new FakePtyProcess();
  const pty = {
    spawn() {
      queueMicrotask(() => fakeProcess.emitData("›"));
      setTimeout(() => fakeProcess.emitData("Booting MCP server"), 5);
      setTimeout(() => fakeProcess.emitData("›"), 10);
      return fakeProcess;
    }
  };

  await runPrompt({
    agents: [
      {
        name: "codex",
        command: "codex",
        args: [],
        promptRegex: /›/,
        inputSuffix: "\r",
        bracketedPaste: false,
        readyQuietMs: 20,
        idleCompletionMs: 10
      }
    ],
    prompt: "늦게 전달",
    pty,
    timeoutMs: 1000
  });

  assert.deepEqual(fakeProcess.writes.slice(0, 2), ["늦게 전달", "\r"]);
});

test("프로세스 생성 실패를 실패 결과로 반환한다", async () => {
  const pty = {
    spawn() {
      throw new Error("spawn failed");
    }
  };

  const result = await runPrompt({
    agents: [
      {
        name: "broken",
        command: "broken",
        args: [],
        promptRegex: />\s*$/
      }
    ],
    prompt: "작업",
    pty,
    timeoutMs: 1000
  });

  assert.equal(result.results[0].status, "failed");
  assert.equal(result.results[0].error, "spawn failed");
});

test("Ready 상태가 감지되지 않으면 타임아웃 결과를 반환한다", async () => {
  const fakeProcess = new FakePtyProcess();
  const pty = {
    spawn() {
      queueMicrotask(() => fakeProcess.emitData("booting"));
      return fakeProcess;
    }
  };

  const result = await runPrompt({
    agents: [
      {
        name: "slow",
        command: "slow",
        args: [],
        promptRegex: /READY>\s*$/,
        bracketedPaste: false,
        readyQuietMs: 0
      }
    ],
    prompt: "작업",
    pty,
    timeoutMs: 20
  });

  assert.equal(result.results[0].status, "timeout");
  assert.match(result.results[0].error, /타임아웃 초과/);
});

class FakePtyProcess extends EventEmitter {
  writes = [];
  killed = false;

  onData(listener) {
    this.on("data", listener);
  }

  onExit(listener) {
    this.on("exit", listener);
  }

  write(value) {
    this.writes.push(value);
    if (value === "\n" || value === "\r") {
      queueMicrotask(() => this.emitData(`응답 완료\nREADY> `));
    }
  }

  kill() {
    this.killed = true;
  }

  emitData(value) {
    this.emit("data", value);
  }
}
