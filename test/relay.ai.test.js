import test from "node:test";
import assert from "node:assert/strict";
import { createPrefixRelay, createSplitRelay } from "../src/relay.ai.js";

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

test("prefix relay는 원본 ANSI 제어문자를 제거한다", () => {
  let outputText = "";
  const output = {
    write(value) {
      outputText += value;
    }
  };

  const relay = createPrefixRelay(output);
  relay.onData("gemini", "\x1b[2J\x1b[Hhello\n");
  relay.flush();

  assert.match(outputText, /\[gemini\] hello/);
  assert.doesNotMatch(outputText, /\x1b/);
});

test("split relay는 TUI 화면 갱신을 스크롤 로그로 누적하지 않는다", () => {
  let outputText = "";
  const output = {
    columns: 60,
    rows: 12,
    write(value) {
      outputText += value;
    }
  };

  const relay = createSplitRelay(["gemini"], output);
  relay.onData("gemini", "\x1b[2J\x1b[Hfirst screen");
  relay.onData("gemini", "\x1b[2J\x1b[Hsecond screen");
  relay.flush();

  assert.match(outputText, /second screen/);
  assert.doesNotMatch(outputText.slice(outputText.lastIndexOf("second screen")), /first screen/);
});
