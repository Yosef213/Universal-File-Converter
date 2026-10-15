import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib';
import * as ImageManipulator from 'expo-image-manipulator';
import { FileService } from './fileService';

export class PdfEngine {
  /**
   * Merge multiple PDF files in order into a single unified PDF
   */
  static async mergePdfs(fileUris: string[], outputName: string = 'Merged_Document.pdf'): Promise<string> {
    if (fileUris.length < 2) {
      throw new Error('Please select at least 2 PDF files to merge.');
    }

    const mergedPdf = await PDFDocument.create();

    for (const uri of fileUris) {
      const bytes = await FileService.readFileAsBytes(uri);
      const donorPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(donorPdf, donorPdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    return await FileService.saveBytesToFile(pdfBytes, outputName);
  }

  /**
   * Split all pages of a PDF into individual 1-page PDF documents
   */
  static async splitPdf(fileUri: string, baseName: string = 'Page'): Promise<string[]> {
    const bytes = await FileService.readFileAsBytes(fileUri);
    const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = sourcePdf.getPageCount();
    const outputUris: string[] = [];

    for (let i = 0; i < pageCount; i++) {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(sourcePdf, [i]);
      singleDoc.addPage(copiedPage);

      const singleBytes = await singleDoc.save();
      const outputUri = await FileService.saveBytesToFile(
        singleBytes,
        `${baseName}_${i + 1}_of_${pageCount}.pdf`
      );
      outputUris.push(outputUri);
    }

    return outputUris;
  }

  /**
   * Extract specific page sequences (e.g. "1-3, 5, 8") into a new PDF
   */
  static async extractPages(
    fileUri: string,
    pageRangeStr: string,
    outputName: string = 'Extracted_Pages.pdf'
  ): Promise<string> {
    const bytes = await FileService.readFileAsBytes(fileUri);
    const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = sourcePdf.getPageCount();

    const pageIndices = this.parsePageRange(pageRangeStr, totalPages);
    if (pageIndices.length === 0) {
      throw new Error('No valid pages found in the specified range.');
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));

    const pdfBytes = await newDoc.save();
    return await FileService.saveBytesToFile(pdfBytes, outputName);
  }

  /**
   * Rotate pages clockwise (90, 180, 270 degrees)
   */
  static async rotatePdf(
    fileUri: string,
    angleDegrees: 90 | 180 | 270,
    pageRangeStr?: string,
    outputName: string = 'Rotated_Document.pdf'
  ): Promise<string> {
    const bytes = await FileService.readFileAsBytes(fileUri);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    const targetIndices = pageRangeStr
      ? this.parsePageRange(pageRangeStr, totalPages)
      : pdfDoc.getPageIndices();

    targetIndices.forEach((index) => {
      const page = pdfDoc.getPage(index);
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + angleDegrees) % 360));
    });

    const pdfBytes = await pdfDoc.save();
    return await FileService.saveBytesToFile(pdfBytes, outputName);
  }

  /**
   * Convert multiple images into a clean multi-page or single PDF
   */
  static async imagesToPdf(
    imageUris: string[],
    layout: 'fit' | 'a4' = 'fit',
    outputName: string = 'Images_Combined.pdf'
  ): Promise<string> {
    if (imageUris.length === 0) {
      throw new Error('Please select at least one image.');
    }

    const pdfDoc = await PDFDocument.create();

    // Standard A4 dimensions in points (72 points per inch)
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 36; // 0.5 inch margin

    for (const imgUri of imageUris) {
      // Normalize image to JPEG format using expo-image-manipulator for 100% pdf-lib compatibility
      const manipResult = await ImageManipulator.manipulateAsync(
        imgUri,
        [],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      const imgBytes = await FileService.readFileAsBytes(manipResult.uri);
      const embeddedImage = await pdfDoc.embedJpg(imgBytes);

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      if (layout === 'a4') {
        const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        const availWidth = A4_WIDTH - MARGIN * 2;
        const availHeight = A4_HEIGHT - MARGIN * 2;

        const scale = Math.min(availWidth / imgWidth, availHeight / imgHeight, 1);
        const finalWidth = imgWidth * scale;
        const finalHeight = imgHeight * scale;

        const x = MARGIN + (availWidth - finalWidth) / 2;
        const y = MARGIN + (availHeight - finalHeight) / 2;

        page.drawImage(embeddedImage, {
          x,
          y,
          width: finalWidth,
          height: finalHeight,
        });
      } else {
        // Fit exactly to image resolution
        const page = pdfDoc.addPage([imgWidth, imgHeight]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: imgWidth,
          height: imgHeight,
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    return await FileService.saveBytesToFile(pdfBytes, outputName);
  }

  /**
   * Render clean text / markdown into a paginated PDF document
   */
  static async textToPdf(
    text: string,
    title: string = 'Document',
    outputName: string = 'Text_Document.pdf'
  ): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_WIDTH = 595.28;
    const PAGE_HEIGHT = 841.89;
    const MARGIN = 48;
    const FONT_SIZE = 11;
    const LINE_HEIGHT = 16;
    const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
    const USABLE_HEIGHT = PAGE_HEIGHT - MARGIN * 2;

    const rawLines = text.split('\n');
    const wrappedLines: string[] = [];

    // Simple word wrapping
    for (const rawLine of rawLines) {
      if (rawLine.trim() === '') {
        wrappedLines.push('');
        continue;
      }
      const words = rawLine.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, FONT_SIZE);
        if (width <= USABLE_WIDTH) {
          currentLine = testLine;
        } else {
          wrappedLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    }

    const linesPerPage = Math.floor((USABLE_HEIGHT - 40) / LINE_HEIGHT);
    const totalPages = Math.max(1, Math.ceil(wrappedLines.length / linesPerPage));

    for (let p = 0; p < totalPages; p++) {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let y = PAGE_HEIGHT - MARGIN;

      // Header on first page
      if (p === 0 && title) {
        page.drawText(title, {
          x: MARGIN,
          y: y - 10,
          size: 18,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.15),
        });
        y -= 40;
      }

      // Draw page lines
      const start = p * linesPerPage;
      const end = Math.min(start + linesPerPage, wrappedLines.length);

      for (let i = start; i < end; i++) {
        const line = wrappedLines[i];
        if (line) {
          page.drawText(line, {
            x: MARGIN,
            y,
            size: FONT_SIZE,
            font,
            color: rgb(0.15, 0.15, 0.2),
          });
        }
        y -= LINE_HEIGHT;
      }

      // Footer page numbers
      const footerText = `Page ${p + 1} of ${totalPages}`;
      page.drawText(footerText, {
        x: PAGE_WIDTH - MARGIN - 70,
        y: MARGIN / 2,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const pdfBytes = await pdfDoc.save();
    return await FileService.saveBytesToFile(pdfBytes, outputName);
  }

  /**
   * Helper to parse page range strings like "1-3, 5, 8-10" into 0-based indices
   */
  private static parsePageRange(rangeStr: string, totalPages: number): number[] {
    const indices = new Set<number>();
    const parts = rangeStr.split(',').map((p) => p.trim());

    for (const part of parts) {
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        let start = parseInt(startStr, 10);
        let end = endStr ? parseInt(endStr, 10) : totalPages;

        if (isNaN(start)) start = 1;
        if (isNaN(end)) end = totalPages;

        start = Math.max(1, Math.min(start, totalPages));
        end = Math.max(1, Math.min(end, totalPages));

        for (let i = start; i <= end; i++) {
          indices.add(i - 1);
        }
      } else {
        const pageNum = parseInt(part, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
          indices.add(pageNum - 1);
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }
}
