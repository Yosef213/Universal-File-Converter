/** Helpers that turn raw positioned PDF text items into lines, paragraphs and table cells. */

export interface TextItem {
  str: string;
  x: number;
  y: number; // distance from top of page
  w: number;
  h: number;
  eol: boolean;
}

export interface PageText {
  width: number;
  height: number;
  items: TextItem[];
}

export interface Line {
  y: number;
  h: number;
  items: TextItem[];
}

export function groupLines(items: TextItem[]): Line[] {
  const sorted = items
    .filter((i) => i.str.trim().length > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    const tol = Math.max(2, Math.min(it.h, last?.h ?? it.h) * 0.5);
    if (last && Math.abs(it.y - last.y) <= tol) {
      last.items.push(it);
      last.h = Math.max(last.h, it.h);
    } else {
      lines.push({ y: it.y, h: it.h, items: [it] });
    }
  }
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  return lines;
}

export function lineToText(line: Line): string {
  let out = '';
  let prevEnd: number | null = null;
  for (const it of line.items) {
    if (prevEnd !== null) {
      const gap = it.x - prevEnd;
      if (gap > line.h * 0.15 && !out.endsWith(' ') && !it.str.startsWith(' ')) out += ' ';
    }
    out += it.str;
    prevEnd = it.x + it.w;
  }
  return out.replace(/\s+$/, '');
}

/** Split a line into cells wherever there is a wide horizontal gap (table columns). */
export function lineToCells(line: Line): { x: number; text: string }[] {
  const cells: { x: number; text: string; end: number }[] = [];
  const gapLimit = Math.max(8, line.h * 1.2);
  for (const it of line.items) {
    const last = cells[cells.length - 1];
    if (last && it.x - last.end <= gapLimit) {
      const sep = it.x - last.end > line.h * 0.15 && !last.text.endsWith(' ') ? ' ' : '';
      last.text += sep + it.str;
      last.end = it.x + it.w;
    } else {
      cells.push({ x: it.x, text: it.str, end: it.x + it.w });
    }
  }
  return cells.map((c) => ({ x: c.x, text: c.text.trim() }));
}

/** Plain text for a page, with blank lines between paragraphs. */
export function pageToPlainText(page: PageText): string {
  return toParagraphs(page).join('\n\n');
}

/** Group lines into paragraphs using vertical spacing. */
export function toParagraphs(page: PageText): string[] {
  const lines = groupLines(page.items);
  const paras: string[] = [];
  let current: string[] = [];
  let prev: Line | null = null;
  for (const l of lines) {
    if (prev && l.y - prev.y > Math.max(prev.h, l.h) * 1.7) {
      paras.push(current.join('\n'));
      current = [];
    }
    current.push(lineToText(l));
    prev = l;
  }
  if (current.length) paras.push(current.join('\n'));
  return paras.filter((p) => p.trim().length > 0);
}

/**
 * Builds a 2D grid for a page: column boundaries are derived from cell start
 * positions across all lines, so aligned tables land in consistent columns.
 */
export function pageToGrid(page: PageText): string[][] {
  const lines = groupLines(page.items);
  const rows = lines.map(lineToCells);
  const starts: number[] = [];
  const tol = 12;
  rows.flat().forEach((c) => {
    if (!starts.some((s) => Math.abs(s - c.x) <= tol)) starts.push(c.x);
  });
  starts.sort((a, b) => a - b);
  const colOf = (x: number) => {
    let best = 0;
    let bestD = Infinity;
    starts.forEach((s, i) => {
      const d = Math.abs(s - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };
  return rows.map((cells) => {
    const row: string[] = new Array(starts.length).fill('');
    for (const c of cells) {
      const i = colOf(c.x);
      row[i] = row[i] ? `${row[i]} ${c.text}` : c.text;
    }
    while (row.length && row[row.length - 1] === '') row.pop();
    return row;
  });
}

/** Parses "1-3, 5, 8-" into sorted 0-based page indices. Empty spec = all pages. */
export function parsePageRange(spec: string | undefined, total: number): number[] {
  if (!spec || !spec.trim()) return Array.from({ length: total }, (_, i) => i);
  const set = new Set<number>();
  for (const raw of spec.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    if (part.includes('-')) {
      const [a, b] = part.split('-');
      let s = parseInt(a, 10);
      let e = b && b.trim() ? parseInt(b, 10) : total;
      if (isNaN(s)) s = 1;
      if (isNaN(e)) e = total;
      s = Math.max(1, Math.min(s, total));
      e = Math.max(1, Math.min(e, total));
      if (s > e) [s, e] = [e, s];
      for (let i = s; i <= e; i++) set.add(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= total) set.add(n - 1);
    }
  }
  const out = Array.from(set).sort((a, b) => a - b);
  if (!out.length) throw new Error(`No valid pages in "${spec}" (document has ${total} pages).`);
  return out;
}
