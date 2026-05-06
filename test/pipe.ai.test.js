import test from "node:test";
import assert from "node:assert/strict";
import { runPipePrompt } from "../src/pipe.ai.js";

test("pipe 모드는 stdin으로 한글 프롬프트를 전달하고 stdout을 수집한다", async () => {
  const script = [
    "process.stdin.setEncoding('utf8');",
    "let input = '';",
    "process.stdin.on('data', chunk => input += chunk);",
    "process.stdin.on('end', () => { process.stdout.write('받음:' + input.trim()); });"
  ].join("");

  const result = await runPipePrompt({
    agents: [
      {
        name: "node",
        command: process.execPath,
        args: ["-e", script],
        inputSuffix: "\n"
      }
    ],
    prompt: "한글 입력",
    timeoutMs: 1000
  });

  assert.equal(result.results[0].status, "success");
  assert.equal(result.results[0].transcript, "받음:한글 입력");
});

test("pipe 모드는 비정상 종료를 실패 결과로 반환한다", async () => {
  const result = await runPipePrompt({
    agents: [
      {
        name: "node",
        command: process.execPath,
        args: ["-e", "process.exit(7)"]
      }
    ],
    prompt: "작업",
    timeoutMs: 1000
  });

  assert.equal(result.results[0].status, "failed");
  assert.equal(result.results[0].exitCode, 7);
});
