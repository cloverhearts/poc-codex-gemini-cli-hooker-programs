import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/cli.ai.js";

test("CLI 인자를 파싱한다", () => {
  const options = parseArgs([
    "--agents",
    "gemini,codex",
    "--timeout",
    "1000",
    "--view",
    "prefix",
    "--json",
    "한글",
    "프롬프트"
  ]);

  assert.deepEqual(options.agents, ["gemini", "codex"]);
  assert.equal(options.timeoutMs, 1000);
  assert.equal(options.view, "prefix");
  assert.equal(options.json, true);
  assert.equal(options.prompt, "한글 프롬프트");
});

test("잘못된 timeout은 실패한다", () => {
  assert.throws(() => parseArgs(["--timeout", "0", "작업"]), /timeout은 양의 정수/);
});

test("npm run start --agents gemini 형태로 전달된 npm config를 복구한다", () => {
  const options = parseArgs(["gemini"], { npm_config_agents: "true" });

  assert.deepEqual(options.agents, ["gemini"]);
  assert.equal(options.prompt, "");
});
