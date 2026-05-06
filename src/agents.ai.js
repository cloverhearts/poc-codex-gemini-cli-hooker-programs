export const defaultAgents = [
  {
    name: "gemini",
    command: "gemini",
    args: [],
    promptRegex: /Type your message|>\s*$|❯\s*$/,
    inputSuffix: "\r",
    readyQuietMs: 1200,
    enterDelayMs: 150,
    clearLineBeforeInput: true,
    bracketedPaste: true
  },
  {
    name: "codex",
    command: "codex",
    args: [],
    promptRegex: /›|Run \/review|>\s*$|\$\s*$/,
    inputSuffix: "\r",
    readyQuietMs: 1500,
    enterDelayMs: 100,
    clearLineBeforeInput: true,
    completeOnReady: false,
    idleCompletionMs: 8000,
    bracketedPaste: true
  }
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
