import { getStringWidth, stripAnsi } from "./ansi.ai.js";

export function createPrefixRelay(output = process.stdout) {
  const buffers = new Map();

  return {
    onData(agentName, chunk) {
      const text = stripAnsi(chunk);
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
  const screensByAgent = new Map(
    agentNames.map((name) => [name, createTerminalScreen()]),
  );
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
      const screen = screensByAgent.get(agentName);
      screen?.write(String(chunk));
      scheduleRender();
    },
    setInputLine(value, immediate = false) {
      inputLine = String(value);
      if (immediate) {
        render();
      } else {
        scheduleRender();
      }
    },
    setStatus(value, immediate = false) {
      statusLine = String(value);
      if (immediate) {
        render();
      } else {
        scheduleRender();
      }
    },
    flush() {
      if (closed) {
        return;
      }
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
    }, 30);
  }

  function render() {
    if (closed) {
      return;
    }
    const names = [...screensByAgent.keys()];
    const width = output.columns ?? 120;
    const height = output.rows ?? 30;
    const columnCount = Math.max(1, names.length);
    const columnWidth = Math.max(
      24,
      Math.floor((width - columnCount - 1) / columnCount),
    );
    const maxLines = Math.max(6, height - 8);
    const horizontal = "─".repeat(columnWidth);

    for (const screen of screensByAgent.values()) {
      screen.resize(columnWidth, maxLines);
    }

    let frame = "";
    frame += `┌${names.map(() => horizontal).join("┬")}┐\n`;
    frame += `│${names.map((name) => pad(` ${name} `, columnWidth)).join("│")}│\n`;
    frame += `├${names.map(() => horizontal).join("┼")}┤\n`;

    for (let row = 0; row < maxLines; row += 1) {
      const cells = names.map((name) => {
        const screen = screensByAgent.get(name);
        return pad(screen?.lineAt(row) ?? "", columnWidth);
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

function createTerminalScreen() {
  let width = 80;
  let height = 24;
  let rows = createRows(width, height);
  let cursorX = 0;
  let cursorY = 0;
  let pending = "";

  return {
    resize(nextWidth, nextHeight) {
      const boundedWidth = Math.max(1, nextWidth);
      const boundedHeight = Math.max(1, nextHeight);
      if (boundedWidth === width && boundedHeight === height) {
        return;
      }
      const previous = rows.map((row) => row.join(""));
      width = boundedWidth;
      height = boundedHeight;
      rows = createRows(width, height);
      for (
        let index = 0;
        index < Math.min(previous.length, height);
        index += 1
      ) {
        writePlainText(previous[index].slice(0, width), index, 0);
      }
      cursorX = clamp(cursorX, 0, width - 1);
      cursorY = clamp(cursorY, 0, height - 1);
    },
    write(value) {
      pending += value;
      pending = consumeInput(pending);
    },
    lineAt(index) {
      return (rows[index] ?? []).join("").trimEnd();
    },
  };

  function consumeInput(value) {
    let index = 0;
    while (index < value.length) {
      const char = value[index];

      if (char === "\x1b") {
        const consumed = consumeEscape(value, index);
        if (consumed === 0) {
          return value.slice(index);
        }
        index += consumed;
        continue;
      }

      if (char === "\r") {
        cursorX = 0;
        index += 1;
        continue;
      }

      if (char === "\n") {
        newline();
        index += 1;
        continue;
      }

      if (char === "\b") {
        cursorX = Math.max(0, cursorX - 1);
        index += 1;
        continue;
      }

      if (char < " " || char === "\x7f") {
        index += 1;
        continue;
      }

      writeChar(char);
      index += char.length;
    }
    return "";
  }

  function consumeEscape(value, start) {
    const next = value[start + 1];
    if (!next) {
      return 0;
    }

    if (next === "]") {
      const bellIndex = value.indexOf("\x07", start + 2);
      const stIndex = value.indexOf("\x1b\\", start + 2);
      const end =
        bellIndex === -1
          ? stIndex
          : stIndex === -1
            ? bellIndex
            : Math.min(bellIndex, stIndex);
      if (end === -1) {
        return 0;
      }
      return end + (end === stIndex ? 2 : 1) - start;
    }

    if (next === "[") {
      for (let end = start + 2; end < value.length; end += 1) {
        const code = value[end];
        if (code >= "@" && code <= "~") {
          applyCsi(value.slice(start + 2, end), code);
          return end - start + 1;
        }
      }
      return 0;
    }

    if (next === "c") {
      clearAll();
    }
    return 2;
  }

  function applyCsi(paramsText, code) {
    const cleanParams = paramsText.replace(/[?>=]/g, "");
    const params = cleanParams
      .split(";")
      .filter((part) => part.length > 0)
      .map((part) => Number(part));

    if (code === "H" || code === "f") {
      cursorY = clamp((params[0] || 1) - 1, 0, height - 1);
      cursorX = clamp((params[1] || 1) - 1, 0, width - 1);
      return;
    }
    if (code === "A") {
      cursorY = clamp(cursorY - (params[0] || 1), 0, height - 1);
      return;
    }
    if (code === "B") {
      cursorY = clamp(cursorY + (params[0] || 1), 0, height - 1);
      return;
    }
    if (code === "C") {
      cursorX = clamp(cursorX + (params[0] || 1), 0, width - 1);
      return;
    }
    if (code === "D") {
      cursorX = clamp(cursorX - (params[0] || 1), 0, width - 1);
      return;
    }
    if (code === "G") {
      cursorX = clamp((params[0] || 1) - 1, 0, width - 1);
      return;
    }
    if (code === "J") {
      clearDisplay(params[0] ?? 0);
      return;
    }
    if (code === "K") {
      clearLine(params[0] ?? 0);
    }
  }

  function writePlainText(text, y, x) {
    const previousX = cursorX;
    const previousY = cursorY;
    cursorX = x;
    cursorY = y;
    for (const char of text) {
      writeChar(char);
    }
    cursorX = previousX;
    cursorY = previousY;
  }

  function writeChar(char) {
    const charWidth = getStringWidth(char);
    const cellWidth = charWidth > 1 ? 2 : 1;
    if (cursorX >= width) {
      newline();
    }
    if (cellWidth === 2 && cursorX === width - 1) {
      newline();
    }

    rows[cursorY][cursorX] = char;
    if (cellWidth === 2 && cursorX + 1 < width) {
      rows[cursorY][cursorX + 1] = "";
    }
    cursorX += cellWidth;
    if (cursorX >= width) {
      cursorX = width - 1;
    }
  }

  function newline() {
    cursorX = 0;
    cursorY += 1;
    if (cursorY >= height) {
      rows.shift();
      rows.push(createRow(width));
      cursorY = height - 1;
    }
  }

  function clearAll() {
    rows = createRows(width, height);
    cursorX = 0;
    cursorY = 0;
  }

  function clearDisplay(mode) {
    if (mode === 2 || mode === 3) {
      clearAll();
      return;
    }
    if (mode === 1) {
      for (let y = 0; y < cursorY; y += 1) {
        rows[y] = createRow(width);
      }
      for (let x = 0; x <= cursorX; x += 1) {
        rows[cursorY][x] = " ";
      }
      return;
    }
    clearLine(0);
    for (let y = cursorY + 1; y < height; y += 1) {
      rows[y] = createRow(width);
    }
  }

  function clearLine(mode) {
    if (mode === 2) {
      rows[cursorY] = createRow(width);
      return;
    }
    if (mode === 1) {
      for (let x = 0; x <= cursorX; x += 1) {
        rows[cursorY][x] = " ";
      }
      return;
    }
    for (let x = cursorX; x < width; x += 1) {
      rows[cursorY][x] = " ";
    }
  }
}

function createRows(width, height) {
  return Array.from({ length: height }, () => createRow(width));
}

function createRow(width) {
  return Array.from({ length: width }, () => " ");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
