import * as Print from 'expo-print';
import { callEngine } from '../engine/EngineHost';
import { FileService } from './fileService';
import { JobResult, ProgressFn } from '../types';

export class DocsEngine {
  /**
   * Converts a Word document (.docx) to PDF using mammoth HTML rendering + native Print
   */
  static async docxToPdf(
    uri: string,
    name: string,
    onProgress?: ProgressFn
  ): Promise<JobResult> {
    onProgress?.(0, 2, 'Parsing Word document...');
    const data = await FileService.readBase64(uri);
    const { html, warnings } = await callEngine<{ html: string; warnings: number }>(
      'docxToHtml',
      { data }
    );

    if (!html || !html.trim()) {
      throw new Error('Could not extract any content from the Word document.');
    }

    onProgress?.(1, 2, 'Generating PDF...');

    const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      margin: 20mm;
      size: A4;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e293b;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      margin-top: 1.2em;
      margin-bottom: 0.5em;
      page-break-after: avoid;
    }
    h1 { font-size: 18pt; }
    h2 { font-size: 14pt; }
    h3 { font-size: 12pt; }
    p {
      margin: 0 0 1em 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
      font-size: 10pt;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 600;
    }
    img {
      max-width: 100%;
      height: auto;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `.trim();

    const printResult = await Print.printToFileAsync({
      html: styledHtml,
    });

    const outUri = await FileService.moveIntoOutput(
      printResult.uri,
      `${FileService.baseName(name)}.pdf`
    );

    onProgress?.(2, 2, 'Complete');
    return {
      outputs: [outUri],
      summary: `Word document converted to PDF${warnings > 0 ? ` (${warnings} warnings)` : ''}`,
    };
  }

  /**
   * Converts plain text, markdown, log, or CSV file to clean paginated PDF
   */
  static async textToPdf(
    content: string,
    title: string = 'Document',
    outputFilename?: string,
    isMonospace: boolean = false
  ): Promise<JobResult> {
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      margin: 20mm;
      size: A4;
    }
    body {
      font-family: ${
        isMonospace
          ? 'Consolas, Monaco, "Courier New", monospace'
          : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      };
      font-size: 10pt;
      line-height: 1.5;
      color: #1e293b;
      margin: 0;
    }
    header {
      border-bottom: 2px solid #6366f1;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0;
      font-size: 16pt;
      color: #0f172a;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: inherit;
      font-size: inherit;
      margin: 0;
    }
  </style>
</head>
<body>
  ${title ? `<header><h1>${title}</h1></header>` : ''}
  <pre>${escaped}</pre>
</body>
</html>
    `.trim();

    const printResult = await Print.printToFileAsync({
      html: styledHtml,
    });

    const targetName = outputFilename || `${FileService.baseName(title || 'Document')}.pdf`;
    const outUri = await FileService.moveIntoOutput(printResult.uri, targetName);

    return {
      outputs: [outUri],
      summary: `Text converted to PDF (${content.split('\n').length} lines)`,
    };
  }

  /**
   * Convert an existing text/markdown/csv file to PDF
   */
  static async textFileToPdf(
    uri: string,
    name: string,
    onProgress?: ProgressFn
  ): Promise<JobResult> {
    onProgress?.(0, 1, 'Reading file...');
    const content = await FileService.readText(uri);
    const isCodeOrCsv = /\.(csv|json|xml|log|py|js|ts|java|c|cpp|html|css)$/i.test(name);
    return await this.textToPdf(
      content,
      FileService.baseName(name),
      `${FileService.baseName(name)}.pdf`,
      isCodeOrCsv
    );
  }
}
