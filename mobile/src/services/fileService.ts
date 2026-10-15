import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { toByteArray, fromByteArray } from 'base64-js';
import { FileItem } from '../types';

export const OUTPUT_DIR = `${FileSystem.documentDirectory}converted/`;

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function detectType(name: string): FileItem['type'] {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|webp|bmp|gif|heic|heif)$/.test(n)) return 'image';
  if (/\.(docx)$/.test(n)) return 'word';
  if (/\.(txt|md|markdown|log|csv|json|xml)$/.test(n)) return 'text';
  return 'other';
}

let idCounter = 0;
const newId = () => `${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

export class FileService {
  static async pickDocuments(types: string[] = ['application/pdf'], allowMultiple = true): Promise<FileItem[]> {
    const result = await DocumentPicker.getDocumentAsync({
      type: types,
      multiple: allowMultiple,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets) return [];
    return result.assets.map((a) => ({
      id: newId(),
      name: a.name,
      uri: a.uri,
      size: a.size ?? 0,
      mimeType: a.mimeType ?? 'application/octet-stream',
      type: detectType(a.name),
    }));
  }

  static async pickImages(allowsMultiple = true): Promise<FileItem[]> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: allowsMultiple,
      quality: 1,
    });
    if (result.canceled || !result.assets) return [];
    return result.assets.map((a) => ({
      id: newId(),
      name: a.fileName || `IMG_${Date.now()}_${idCounter++}.jpg`,
      uri: a.uri,
      size: a.fileSize ?? 0,
      mimeType: a.mimeType ?? 'image/jpeg',
      type: 'image' as const,
    }));
  }

  static readBase64(uri: string): Promise<string> {
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  }

  static readText(uri: string): Promise<string> {
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  }

  static async readFileAsBytes(uri: string): Promise<Uint8Array> {
    return toByteArray(await this.readBase64(uri));
  }

  static async ensureOutputDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(OUTPUT_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(OUTPUT_DIR, { intermediates: true });
  }

  /** Strip the extension and unsafe characters from a file name. */
  static baseName(name: string): string {
    const noExt = name.replace(/\.[^./\\]+$/, '');
    return noExt.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'file';
  }

  /** Returns a file URI in the output folder that doesn't collide with an existing file. */
  static async uniqueOutputUri(filename: string): Promise<string> {
    await this.ensureOutputDir();
    const m = filename.match(/^(.*?)(\.[^.]+)?$/);
    const stem = m?.[1] ?? filename;
    const ext = m?.[2] ?? '';
    let candidate = `${OUTPUT_DIR}${filename}`;
    let n = 1;
    while ((await FileSystem.getInfoAsync(candidate)).exists) {
      candidate = `${OUTPUT_DIR}${stem} (${n++})${ext}`;
    }
    return candidate;
  }

  static async saveBase64(b64: string, filename: string): Promise<string> {
    const uri = await this.uniqueOutputUri(filename);
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  }

  static saveBytesToFile(bytes: Uint8Array, filename: string): Promise<string> {
    return this.saveBase64(fromByteArray(bytes), filename);
  }

  static async saveText(text: string, filename: string): Promise<string> {
    const uri = await this.uniqueOutputUri(filename);
    await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
    return uri;
  }

  static async moveIntoOutput(fromUri: string, filename: string): Promise<string> {
    const uri = await this.uniqueOutputUri(filename);
    await FileSystem.moveAsync({ from: fromUri, to: uri });
    return uri;
  }

  static async fileSize(uri: string): Promise<number> {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? info.size ?? 0 : 0;
  }

  static fileNameFromUri(uri: string): string {
    return decodeURIComponent(uri.substring(uri.lastIndexOf('/') + 1));
  }

  static mimeFor(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return MIME_BY_EXT[ext] ?? 'application/octet-stream';
  }

  static async shareFile(fileUri: string, mimeType?: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
    const mime = mimeType ?? this.mimeFor(this.fileNameFromUri(fileUri));
    await Sharing.shareAsync(fileUri, {
      mimeType: mime,
      dialogTitle: 'Share converted file',
      UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
    });
  }

  /**
   * Android: asks the user to pick a folder (e.g. Downloads) once, then copies all files there.
   * iOS: falls back to the share sheet ("Save to Files").
   * Returns the number of files saved.
   */
  static async saveToDeviceFolder(uris: string[]): Promise<number> {
    if (Platform.OS !== 'android') {
      for (const u of uris) await this.shareFile(u);
      return uris.length;
    }
    const SAF = FileSystem.StorageAccessFramework;
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return 0;
    let saved = 0;
    for (const u of uris) {
      const name = this.fileNameFromUri(u);
      const stem = name.replace(/\.[^.]+$/, '');
      const target = await SAF.createFileAsync(perm.directoryUri, stem, this.mimeFor(name));
      const b64 = await this.readBase64(u);
      await FileSystem.writeAsStringAsync(target, b64, { encoding: FileSystem.EncodingType.Base64 });
      saved++;
    }
    return saved;
  }

  static formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
