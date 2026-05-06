import test from "node:test";
import assert from "node:assert/strict";
import { createSplitRelay } from "../src/relay.ai.js";

test("split relay는 에이전트별 컬럼을 렌더링한다", () => {
  let outputText = "";
  const output = {
    columns: 80,
    rows: 12,
    write(value) {
      outputText += value;
    }
  };

  const relay = createSplitRelay(["gemini", "codex"], output);
  relay.onData("gemini", "안녕\n");
  relay.onData("codex", "hello\n");
  relay.setStatus("준비됨");
  relay.setInputLine("다음 프롬프트");
  relay.flush();

  assert.match(outputText, /gemini/);
  assert.match(outputText, /codex/);
  assert.match(outputText, /안녕/);
  assert.match(outputText, /hello/);
  assert.match(outputText, /상태: 준비됨/);
  assert.match(outputText, /메인> 다음 프롬프트/);
});
