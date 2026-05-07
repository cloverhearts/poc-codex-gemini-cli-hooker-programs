const ANSI_PATTERN =
  /(?:\u001B\][^\u0007]*(?:\u0007|\u001B\\))|(?:[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])))/g;

export function stripAnsi(value) {
  return String(value).replace(ANSI_PATTERN, "");
}

export function getStringWidth(str) {
  let width = 0;
  const stripped = stripAnsi(str);
  for (let i = 0; i < stripped.length; i += 1) {
    const code = stripped.charCodeAt(i);
    // Basic CJK range check (Simplified)
    if (
      (code >= 0x1100 && code <= 0x11ff) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0x9fff) || // CJK Radicals to Ideographs
      (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0xff00 && code <= 0xffef) // Halfwidth and Fullwidth Forms
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}
