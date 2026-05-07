const isWindows =
  typeof process !== "undefined" && process.platform === "win32";

export const defaultAgents = [
  {
    name: "gemini",
    command: "gemini",
    args: [],
    promptRegex: /Type your message|>\s*$|❯\s*|:\s*$/,
    inputSuffix: isWindows ? "\r\n" : "\r",
    readyQuietMs: 1200,
    enterDelayMs: 200,
    clearLineBeforeInput: true,
    bracketedPaste: false,
  },
  {
    name: "codex",
    command: "codex",
    args: [],
    promptRegex: /›|Run \/review|>\s*$|\$\s*|:\s*$/,
    inputSuffix: isWindows ? "\r\n" : "\r",
    readyQuietMs: 1500,
    enterDelayMs: 200,
    clearLineBeforeInput: true,
    completeOnReady: false,
    idleCompletionMs: 8000,
    bracketedPaste: false,
  },
];

export function resolveAgents(agentNames, availableAgents = defaultAgents) {
  const requestedNames = agentNames?.length ? agentNames : ["gemini", "codex"];
  const resolved = [];

  for (const name of requestedNames) {
    const agent = availableAgents.find((candidate) => candidate.name === name);
    if (!agent) {
      throw new Error(`알 수 없는 에이전트입니다: ${name}`);
    }
    resolved.push(agent);
  }

  return resolved;
}

export function parseAgentNames(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}
