import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { PDFDocument } from '@cantoo/pdf-lib';
import { FileService } from './fileService';
import { JobResult, ProgressFn } from '../types';

export interface ImageProcessOptions {
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number; // 10 to 100
  scale?: number; // 25, 50, 75, 100
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err)
    );
  });
}

export class ImageEngine {
  /**
   * Process a single image: format conversion, scaling (25-100%), and quality compression
   */
  static async processImage(
    uri: string,
    name: string,
    options: ImageProcessOptions = {}
  ): Promise<string> {
    const { format = 'jpeg', quality = 85, scale = 100 } = options;
    const actions: ImageManipulator.Action[] = [];

    if (scale < 100) {
      try {
        const { width } = await getImageSize(uri);
        const targetWidth = Math.max(16, Math.round(width * (scale / 100)));
        actions.push({ resize: { width: targetWidth } });
      } catch {
        // If size measurement fails, proceed without resize action
      }
    }

    let saveFormat = ImageManipulator.SaveFormat.JPEG;
    let ext = 'jpg';

    if (format === 'png') {
      saveFormat = ImageManipulator.SaveFormat.PNG;
      ext = 'png';
    } else if (format === 'webp') {
      saveFormat = ImageManipulator.SaveFormat.WEBP;
      ext = 'webp';
    }

    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: Math.max(0.1, Math.min(quality / 100, 1.0)),
        format: saveFormat,
      }
    );

    const targetName = `${FileService.baseName(name)}_${scale < 100 ? `${scale}pct_` : ''}q${quality}.${ext}`;
    return await FileService.moveIntoOutput(manipResult.uri, targetName);
  }

  /**
   * Batch process multiple images
   */
  static async batchProcessImages(
    files: { uri: string; name: string }[],
    options: ImageProcessOptions = {},
    onProgress?: ProgressFn
  ): Promise<JobResult> {
    const outputs: string[] = [];

    for (let i = 0; i < files.length; i++) {
      onProgress?.(i, files.length, `Processing ${files[i].name}...`);
      const out = await this.processImage(files[i].uri, files[i].name, options);
      outputs.push(out);
    }

    const fmt = (options.format || 'jpeg').toUpperCase();
    return {
      outputs,
      summary: `${outputs.length} image(s) converted to ${fmt} (${options.scale || 100}% scale, ${options.quality || 85}% quality)`,
    };
  }

  /**
   * Combine multiple images into a multi-page PDF (Fit to Image or A4 layout)
   */
  static async imagesToPdf(
    files: { uri: string; name: string }[],
    layout: 'fit' | 'a4' = 'fit',
    outputName: string = 'Images_Combined.pdf',
    onProgress?: ProgressFn
  ): Promise<JobResult> {
    if (files.length === 0) {
      throw new Error('Please select at least one image.');
    }

    const pdfDoc = await PDFDocument.create();
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 36;

    for (let i = 0; i < files.length; i++) {
      onProgress?.(i, files.length, `Embedding image ${i + 1} of ${files.length}...`);

      // Normalize to JPEG for 100% pdf-lib compatibility
      const manipResult = await ImageManipulator.manipulateAsync(
        files[i].uri,
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

        page.drawImage(embeddedImage, {
          x: MARGIN + (availWidth - finalWidth) / 2,
          y: MARGIN + (availHeight - finalHeight) / 2,
          width: finalWidth,
          height: finalHeight,
        });
      } else {
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
    const outUri = await FileService.saveBytesToFile(
      pdfBytes,
      `${FileService.baseName(outputName)}.pdf`
    );

    return {
      outputs: [outUri],
      summary: `${files.length} image(s) combined into PDF (${layout === 'a4' ? 'Standard A4' : 'Fit to Image'})`,
    };
  }
}
