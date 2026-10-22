// Turns OCR lines into the text + confidence contract of spec 9.3: one confidence per UTF-16
// unit of the text. Provider-neutral and pure.
//
// line: { text, box: [x1,y1, x2,y2, x3,y3, x4,y4] (pixels), words: [{ text, confidence }] }

const VERTICAL_RATIO = 1.5; // a line this much taller than wide (and 2+ characters) is a vertical column

function extent(box, angleDeg) {
  // Undo the page tilt so "vertical" means vertical on the label, not in the photo.
  const a = (-(angleDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const xs = [];
  const ys = [];
  for (let i = 0; i + 1 < (box || []).length; i += 2) {
    xs.push(box[i] * cos - box[i + 1] * sin);
    ys.push(box[i] * sin + box[i + 1] * cos);
  }
  if (!xs.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2 };
}

// Reading order. Horizontal lines keep the provider's order (top to bottom). Vertical Japanese
// columns are read right to left, each column top to bottom; columns that overlap horizontally
// are one column. The larger group (by characters) comes first.
export function orderLines(lines, angleDeg = 0) {
  const items = lines.map((line, i) => {
    const e = extent(line.box, angleDeg);
    const vertical = Boolean(e) && [...(line.text || '')].length >= 2 && e.h > VERTICAL_RATIO * e.w;
    return { line, i, e, vertical };
  });
  const horizontal = items.filter((x) => !x.vertical);
  const vertical = items.filter((x) => x.vertical).sort((a, b) => b.e.cx - a.e.cx);

  const columns = [];
  for (const item of vertical) {
    const col = columns.find((c) => item.e.maxX > c.minX && item.e.minX < c.maxX);
    if (col) {
      col.items.push(item);
      col.minX = Math.min(col.minX, item.e.minX);
      col.maxX = Math.max(col.maxX, item.e.maxX);
    } else {
      columns.push({ minX: item.e.minX, maxX: item.e.maxX, items: [item] });
    }
  }
  columns.sort((a, b) => b.maxX + b.minX - (a.maxX + a.minX));
  const verticalOrdered = columns.flatMap((c) => c.items.sort((a, b) => a.e.minY - b.e.minY));

  const chars = (xs) => xs.reduce((n, x) => n + (x.line.text || '').length, 0);
  const first = chars(verticalOrdered) > chars(horizontal) ? [verticalOrdered, horizontal] : [horizontal, verticalOrdered];
  return [...first[0], ...first[1]].map((x) => x.line);
}

const clamp = (c) => (Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0);
const isSpace = (ch) => /\s/.test(ch);

// Lines joined by '\n'. Each character gets its word's confidence; whitespace gets 1; a
// non-space character that no word accounts for gets 0 (unreadable), so it can never look clean.
export function buildText(lines) {
  let raw = '';
  const confidence = [];
  lines.forEach((line, n) => {
    if (n > 0) {
      raw += '\n';
      confidence.push(1);
    }
    const text = line.text || '';
    const conf = Array.from({ length: text.length }, (_, i) => (isSpace(text[i]) ? 1 : 0));
    let cursor = 0;
    for (const w of line.words || []) {
      if (!w.text) continue;
      const at = text.indexOf(w.text, cursor);
      if (at < 0) continue;
      for (let i = at; i < at + w.text.length; i++) if (!isSpace(text[i])) conf[i] = clamp(w.confidence);
      cursor = at + w.text.length;
    }
    raw += text;
    confidence.push(...conf);
  });
  return { raw, confidence };
}

// Mean confidence over non-space characters; null when there are none.
export function pageConfidence(raw, confidence) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < raw.length; i++) {
    if (isSpace(raw[i])) continue;
    sum += clamp(confidence[i]);
    n++;
  }
  return n ? sum / n : null;
}
