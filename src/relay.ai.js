import { getStringWidth } from "./ansi.ai.js";

export function createPrefixRelay(output = process.stdout) {
  const buffers = new Map();

  return {
    onData(agentName, chunk) {
      const text = String(chunk);
      const previous = buffers.get(agentName) ?? "";
      const parts = `${previous}${text}`.split(/\r?\n/);
      buffers.set(agentName, parts.pop() ?? "");

      for (const line of parts) {
        output.write(`[${agentName}] ${line}\n`);
      }
    },
    flush() {
      for (const [agentName, line] of buffers.entries()) {
        if (line) {
          output.write(`[${agentName}] ${line}\n`);
        }
      }
      buffers.clear();
    },
  };
}

export function createSplitRelay(agentNames, output = process.stdout) {
  const linesByAgent = new Map(agentNames.map((name) => [name, []]));
  const buffers = new Map(agentNames.map((name) => [name, ""]));
  const maxLines = Math.max(6, (output.rows ?? 30) - 8);
  let inputLine = "";
  let statusLine = "준비 중...";
  let renderScheduled = false;
  let closed = false;
  let lastFrame = "";

  if (output.isTTY) {
    output.write("\x1b[?1049h\x1b[?25l");
    output.on("resize", () => {
      scheduleRender();
    });
  }
  render();

  return {
    onData(agentName, chunk) {
      if (closed) {
        return;
      }
      const text = String(chunk);
      const previous = buffers.get(agentName) ?? "";
      const parts = `${previous}${text}`.split(/\r?\n/);
      buffers.set(agentName, parts.pop() ?? "");

      const lines = linesByAgent.get(agentName) ?? [];
      for (const line of parts) {
        lines.push(line);
      }
      linesByAgent.set(agentName, lines.slice(-maxLines));
      scheduleRender();
    },
    setInputLine(value) {
      inputLine = String(value);
      scheduleRender();
    },
    setStatus(value) {
      statusLine = String(value);
      scheduleRender();
    },
    flush() {
      if (closed) {
        return;
      }
      for (const [agentName, rest] of buffers.entries()) {
        if (!rest) {
          continue;
        }
        const lines = linesByAgent.get(agentName) ?? [];
        lines.push(rest);
        linesByAgent.set(agentName, lines.slice(-maxLines));
      }
      buffers.clear();
      render();
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      if (output.isTTY) {
        output.removeAllListeners("resize");
        output.write("\x1b[?25h\x1b[?1049l");
      } else {
        output.write("\x1b[?25h\n");
      }
    },
  };

  function scheduleRender() {
    if (renderScheduled) {
      return;
    }
    renderScheduled = true;
    setTimeout(() => {
      renderScheduled = false;
      render();
    }, 100);
  }

  function render() {
    if (closed) {
      return;
    }
    const names = [...linesByAgent.keys()];
    const width = output.columns ?? 120;
    const columnCount = Math.max(1, names.length);
    const columnWidth = Math.max(
      24,
      Math.floor((width - columnCount - 1) / columnCount),
    );
    const horizontal = "─".repeat(columnWidth);

    let frame = "";
    frame += `┌${names.map(() => horizontal).join("┬")}┐\n`;
    frame += `│${names.map((name) => pad(` ${name} `, columnWidth)).join("│")}│\n`;
    frame += `├${names.map(() => horizontal).join("┼")}┤\n`;

    for (let row = 0; row < maxLines; row += 1) {
      const cells = names.map((name) => {
        const lines = linesByAgent.get(name) ?? [];
        const start = Math.max(0, lines.length - maxLines);
        return pad(lines[start + row] ?? "", columnWidth);
      });
      frame += `│${cells.join("│")}│\n`;
    }

    frame += `└${names.map(() => horizontal).join("┴")}┘\n`;
    frame += `상태: ${clip(statusLine, Math.max(0, width - 8))}\n`;
    frame += `메인> ${clip(inputLine, Math.max(0, width - 7))}`;

    if (frame === lastFrame) {
      return;
    }
    lastFrame = frame;
    output.write("\x1b[H\x1b[2J");
    output.write(frame);
  }
}

function pad(value, width) {
  const text = String(value).replace(/\t/g, "  ");
  const currentWidth = getStringWidth(text);
  if (currentWidth >= width) {
    return clip(text, width);
  }
  return `${text}${" ".repeat(width - currentWidth)}`;
}

function clip(value, width) {
  if (getStringWidth(value) <= width) {
    return value;
  }
  let clipped = "";
  let currentWidth = 0;
  for (const char of value) {
    const charWidth = getStringWidth(char);
    if (currentWidth + charWidth > width - 1) {
      break;
    }
    clipped += char;
    currentWidth += charWidth;
  }
  return `${clipped}…`;
}
