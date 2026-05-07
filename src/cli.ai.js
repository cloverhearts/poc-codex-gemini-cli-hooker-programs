import { parseAgentNames } from "./agents.ai.js";

const VALID_VIEWS = new Set(["prefix", "split", "pipe", "tmux"]);

export function parseArgs(argv, env = process.env) {
  const options = {
    agents: [],
    timeoutMs: 300000,
    view: "split",
    json: false,
    interactive: false,
    checkPty: false,
    installDeps: false,
    help: false,
    prompt: "",
  };

  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--check-pty") {
      options.checkPty = true;
    } else if (arg === "--install-deps") {
      options.installDeps = true;
    } else if (arg === "--interactive") {
      options.interactive = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--agents") {
      options.agents = parseAgentNames(readOptionValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--agents=")) {
      options.agents = parseAgentNames(arg.slice("--agents=".length));
    } else if (arg === "--timeout") {
      options.timeoutMs = parseTimeout(readOptionValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--timeout=")) {
      options.timeoutMs = parseTimeout(arg.slice("--timeout=".length));
    } else if (arg === "--view") {
      options.view = parseView(readOptionValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--view=")) {
      options.view = parseView(arg.slice("--view=".length));
    } else if (arg.startsWith("-")) {
      throw new Error(`알 수 없는 옵션입니다: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  applyNpmRunConfig(options, positional, env);

  options.prompt = positional.join(" ").trim();
  return options;
}

export function createHelpText() {
  return [
    "Remote Control stdio for AI CLI",
    "",
    "사용법:",
    '  node src/index.js [옵션] "작업 지시문"',
    "  node src/index.js --interactive",
    "",
    "옵션:",
    "  --agents gemini,codex   실행할 에이전트 목록",
    "  --timeout 300000        작업 타임아웃(ms)",
    "  --view prefix           출력 모드(prefix, split, pipe, tmux)",
    "  --json                  최종 결과를 JSON으로 출력",
    "  --check-pty             node-pty 로드 가능 여부 확인",
    "  --install-deps          node-pty 누락 시 자동 설치 시도",
    "  --help                  도움말 출력",
  ].join("\n");
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${optionName} 옵션 값이 필요합니다.`);
  }
  return value;
}

function parseTimeout(value) {
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new Error(`timeout은 양의 정수여야 합니다: ${value}`);
  }
  return timeout;
}

function parseView(value) {
  if (!VALID_VIEWS.has(value)) {
    throw new Error(`지원하지 않는 화면 모드입니다: ${value}`);
  }
  return value;
}

function applyNpmRunConfig(options, positional, env) {
  if (!options.agents.length && env.npm_config_agents) {
    if (env.npm_config_agents === "true") {
      const agentValue = positional.shift();
      options.agents = parseAgentNames(agentValue);
    } else {
      options.agents = parseAgentNames(env.npm_config_agents);
    }
  }

  if (
    options.view === "prefix" &&
    env.npm_config_view &&
    env.npm_config_view !== "true"
  ) {
    options.view = parseView(env.npm_config_view);
  }

  if (
    options.timeoutMs === 300000 &&
    env.npm_config_timeout &&
    env.npm_config_timeout !== "true"
  ) {
    options.timeoutMs = parseTimeout(env.npm_config_timeout);
  }
}
