import { PDFDocument, degrees, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { toByteArray } from 'base64-js';
import { callEngine } from '../engine/EngineHost';
import { FileService } from './fileService';
import { JobResult, ProgressFn } from '../types';
import { PageText, parsePageRange, toParagraphs, pageToGrid, pageToPlainText } from './textLayout';

export type CompressLevel = 'light' | 'balanced' | 'strong';

let docCounter = 0;

/** Opens a PDF in the WebView engine (pdf.js), runs fn, and always closes it. */
async function withEnginePdf<T>(
  uri: string,
  password: string | undefined,
  fn: (id: string, numPages: number) => Promise<T>
): Promise<T> {
  const id = `d${++docCounter}`;
  const data = await FileService.readBase64(uri);
  const { numPages } = await callEngine<{ numPages: number }>('openPdf', { id, data, password });
  try {
    return await fn(id, numPages);
  } finally {
    await callEngine('closePdf', { id }).catch(() => {});
  }
}

async function loadLib(uri: string, password?: string): Promise<PDFDocument> {
  const bytes = await FileService.readFileAsBytes(uri);
  return PDFDocument.load(bytes, password ? { password } : { ignoreEncryption: true });
}

const pageText = (id: string, page: number) => callEngine<PageText>('pageText', { id, page });

export class PdfEngine {
  // ---------------------------------------------------------------- conversions

  static async toWord(uri: string, name: string, range?: string, onProgress?: ProgressFn): Promise<JobResult> {
    return withEnginePdf(uri, undefined, async (id, total) => {
      const pages = parsePageRange(range, total);
      const paragraphs: { text: string; pageBreakBefore?: boolean }[] = [];
      for (let i = 0; i < pages.length; i++) {
        onProgress?.(i, pages.length, `Reading page ${pages[i] + 1}`);
        const paras = toParagraphs(await pageText(id, pages[i]));
        paras.forEach((t, j) => paragraphs.push({ text: t.replace(/\n/g, ' '), pageBreakBefore: i > 0 && j === 0 }));
      }
      if (!paragraphs.length) throw new Error('No selectable text found. The PDF may be a scanned image.');
      const { data } = await callEngine<{ data: string }>('buildDocx', { paragraphs });
      const out = await FileService.saveBase64(data, `${FileService.baseName(name)}.docx`);
      return { outputs: [out], summary: `${pages.length} page(s) converted to Word` };
    });
  }

  static async toExcel(uri: string, name: string, range?: string, onProgress?: ProgressFn): Promise<JobResult> {
    return withEnginePdf(uri, undefined, async (id, total) => {
      const pages = parsePageRange(range, total);
      const sheets: { name: string; rows: string[][] }[] = [];
      for (let i = 0; i < pages.length; i++) {
        onProgress?.(i, pages.length, `Analysing page ${pages[i] + 1}`);
        sheets.push({ name: `Page ${pages[i] + 1}`, rows: pageToGrid(await pageText(id, pages[i])) });
      }
      const { data } = await callEngine<{ data: string }>('buildXlsx', { sheets });
      const out = await FileService.saveBase64(data, `${FileService.baseName(name)}.xlsx`);
      return { outputs: [out], summary: `${pages.length} sheet(s) exported to Excel` };
    });
  }

  static async extractText(uri: string, name: string, range?: string, onProgress?: ProgressFn): Promise<JobResult> {
    return withEnginePdf(uri, undefined, async (id, total) => {
      const pages = parsePageRange(range, total);
      const chunks: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        onProgress?.(i, pages.length, `Reading page ${pages[i] + 1}`);
        chunks.push(`--- Page ${pages[i] + 1} ---\n${pageToPlainText(await pageText(id, pages[i]))}`);
      }
      const out = await FileService.saveText(chunks.join('\n\n'), `${FileService.baseName(name)}.txt`);
      return { outputs: [out], summary: `Text extracted from ${pages.length} page(s)` };
    });
  }

  static async toImages(
    uri: string,
    name: string,
    opts: { range?: string; dpi: number; format: 'png' | 'jpg'; quality: number },
    onProgress?: ProgressFn
  ): Promise<JobResult> {
    return withEnginePdf(uri, undefined, async (id, total) => {
      const pages = parsePageRange(opts.range, total);
      const outputs: string[] = [];
      const mime = opts.format === 'png' ? 'image/png' : 'image/jpeg';
      for (let i = 0; i < pages.length; i++) {
        onProgress?.(i, pages.length, `Rendering page ${pages[i] + 1}`);
        const r = await callEngine<{ data: string }>('renderPage', {
          id,
          page: pages[i],
          scale: opts.dpi / 72,
          mime,
          quality: opts.quality / 100,
        });
        outputs.push(
          await FileService.saveBase64(r.data, `${FileService.baseName(name)}_page${pages[i] + 1}.${opts.format}`)
        );
      }
      return { outputs, summary: `${outputs.length} page image(s) at ${opts.dpi} DPI` };
    });
  }

  // ---------------------------------------------------------------- page tools

  static async merge(files: { uri: string }[], outputName: string, onProgress?: ProgressFn): Promise<JobResult> {
    if (files.length < 2) throw new Error('Add at least 2 PDFs to merge.');
    const merged = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      onProgress?.(i, files.length, `Adding file ${i + 1}`);
      const src = await loadLib(files[i].uri);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    const out = await FileService.saveBytesToFile(await merged.save(), `${FileService.baseName(outputName)}.pdf`);
    return { outputs: [out], summary: `${files.length} PDFs merged (${merged.getPageCount()} pages)` };
  }

  static async split(uri: string, name: string, range?: string, onProgress?: ProgressFn): Promise<JobResult> {
    const src = await loadLib(uri);
    const pages = parsePageRange(range, src.getPageCount());
    const outputs: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i, pages.length, `Page ${pages[i] + 1}`);
      const doc = await PDFDocument.create();
      const [p] = await doc.copyPages(src, [pages[i]]);
      doc.addPage(p);
      outputs.push(await FileService.saveBytesToFile(await doc.save(), `${FileService.baseName(name)}_page${pages[i] + 1}.pdf`));
    }
    return { outputs, summary: `Split into ${outputs.length} PDF file(s)` };
  }

  static async extractPages(uri: string, name: string, range: string): Promise<JobResult> {
    if (!range.trim()) throw new Error('Enter the pages to extract, e.g. 1-3, 5');
    const src = await loadLib(uri);
    const pages = parsePageRange(range, src.getPageCount());
    const doc = await PDFDocument.create();
    (await doc.copyPages(src, pages)).forEach((p) => doc.addPage(p));
    const out = await FileService.saveBytesToFile(await doc.save(), `${FileService.baseName(name)}_extracted.pdf`);
    return { outputs: [out], summary: `${pages.length} page(s) extracted` };
  }

  static async rotate(uri: string, name: string, angle: 90 | 180 | 270, range?: string): Promise<JobResult> {
    const doc = await loadLib(uri);
    const pages = parsePageRange(range, doc.getPageCount());
    pages.forEach((i) => {
      const p = doc.getPage(i);
      p.setRotation(degrees((p.getRotation().angle + angle) % 360));
    });
    const out = await FileService.saveBytesToFile(await doc.save(), `${FileService.baseName(name)}_rotated.pdf`);
    return { outputs: [out], summary: `${pages.length} page(s) rotated ${angle}°` };
  }

  // ---------------------------------------------------------------- optimise & security

  static async compress(uri: string, name: string, level: CompressLevel, onProgress?: ProgressFn): Promise<JobResult> {
    const before = await FileService.fileSize(uri);
    let bytes: Uint8Array;

    if (level === 'light') {
      // Lossless: rebuild the file with compressed object streams and no metadata.
      const doc = await loadLib(uri);
      doc.setProducer('');
      doc.setCreator('');
      bytes = await doc.save({ useObjectStreams: true });
    } else {
      // Lossy: re-render every page as a JPEG at reduced resolution.
      const dpi = level === 'balanced' ? 150 : 96;
      const quality = level === 'balanced' ? 0.72 : 0.5;
      bytes = await withEnginePdf(uri, undefined, async (id, total) => {
        const out = await PDFDocument.create();
        for (let i = 0; i < total; i++) {
          onProgress?.(i, total, `Compressing page ${i + 1}`);
          const r = await callEngine<{ data: string; pointWidth: number; pointHeight: number }>('renderPage', {
            id,
            page: i,
            scale: dpi / 72,
            mime: 'image/jpeg',
            quality,
          });
          const img = await out.embedJpg(toByteArray(r.data));
          const page = out.addPage([r.pointWidth, r.pointHeight]);
          page.drawImage(img, { x: 0, y: 0, width: r.pointWidth, height: r.pointHeight });
        }
        return out.save({ useObjectStreams: true });
      });
    }

    const outUri = await FileService.saveBytesToFile(bytes, `${FileService.baseName(name)}_compressed.pdf`);
    const after = bytes.length;
    const pct = before ? Math.round((1 - after / before) * 100) : 0;
    return {
      outputs: [outUri],
      summary:
        pct > 0
          ? `${FileService.formatBytes(before)} → ${FileService.formatBytes(after)} (−${pct}%)`
          : `Already optimised: ${FileService.formatBytes(before)} → ${FileService.formatBytes(after)}`,
    };
  }

  static async encrypt(uri: string, name: string, password: string): Promise<JobResult> {
    if (!password) throw new Error('Enter a password.');
    const doc = await loadLib(uri);
    doc.encrypt({ userPassword: password, ownerPassword: password });
    const out = await FileService.saveBytesToFile(await doc.save(), `${FileService.baseName(name)}_protected.pdf`);
    return { outputs: [out], summary: 'Password protection added' };
  }

  static async decrypt(uri: string, name: string, password: string): Promise<JobResult> {
    // Validate the password first with pdf.js (clear error on a wrong password).
    await withEnginePdf(uri, password, async () => undefined);
    const src = await loadLib(uri, password);
    const doc = await PDFDocument.create();
    (await doc.copyPages(src, src.getPageIndices())).forEach((p) => doc.addPage(p));
    const out = await FileService.saveBytesToFile(await doc.save(), `${FileService.baseName(name)}_unlocked.pdf`);
    return { outputs: [out], summary: 'Password removed' };
  }

  // ---------------------------------------------------------------- shared

  /** Stamps "Page X of N" at the bottom right of every page. */
  static async addPageNumbers(uri: string): Promise<void> {
    const doc = await loadLib(uri);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    pages.forEach((p, i) => {
      const text = `Page ${i + 1} of ${pages.length}`;
      const w = font.widthOfTextAtSize(text, 9);
      p.drawText(text, { x: p.getWidth() - 40 - w, y: 22, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
    });
    const bytes = await doc.save();
    const { fromByteArray } = await import('base64-js');
    const FS = await import('expo-file-system/legacy');
    await FS.writeAsStringAsync(uri, fromByteArray(bytes), { encoding: FS.EncodingType.Base64 });
  }
}
