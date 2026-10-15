import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { toByteArray, fromByteArray } from 'base64-js';
import { FileItem } from '../types';

export class FileService {
  /**
   * Pick any document or specific MIME types
   */
  static async pickDocuments(
    types: string[] = ['application/pdf'],
    allowMultiple: boolean = true
  ): Promise<FileItem[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: types,
        multiple: allowMultiple,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets) {
        return [];
      }

      return result.assets.map((asset) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: asset.name,
        uri: asset.uri,
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        type: asset.name.toLowerCase().endsWith('.pdf')
          ? 'pdf'
          : asset.name.toLowerCase().match(/\.(png|jpe?g|webp|bmp|gif)$/)
          ? 'image'
          : 'text',
      }));
    } catch (error) {
      console.error('Error picking documents:', error);
      throw error;
    }
  }

  /**
   * Pick images from user's gallery / camera roll
   */
  static async pickImages(allowsMultiple: boolean = true): Promise<FileItem[]> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: allowsMultiple,
        quality: 1,
      });

      if (result.canceled || !result.assets) {
        return [];
      }

      return result.assets.map((asset) => {
        const filename = asset.fileName || `IMG_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        return {
          id: Math.random().toString(36).substring(2, 9),
          name: filename,
          uri: asset.uri,
          size: asset.fileSize ?? 0,
          mimeType: asset.mimeType ?? 'image/jpeg',
          type: 'image',
        };
      });
    } catch (error) {
      console.error('Error picking images:', error);
      throw error;
    }
  }

  /**
   * Read file from URI into Uint8Array buffer
   */
  static async readFileAsBytes(uri: string): Promise<Uint8Array> {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return toByteArray(base64);
  }

  /**
   * Save Uint8Array bytes to the documents folder
   */
  static async saveBytesToFile(bytes: Uint8Array, filename: string): Promise<string> {
    const base64 = fromByteArray(bytes);
    const directory = `${FileSystem.documentDirectory}converted/`;

    // Ensure target output directory exists
    const dirInfo = await FileSystem.getInfoAsync(directory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }

    const fileUri = `${directory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  }

  /**
   * Share file via system native share sheet (AirDrop, WhatsApp, Save to Files, etc.)
   */
  static async shareFile(fileUri: string, mimeType: string = 'application/pdf'): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: 'Share Converted File',
      UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
    });
  }

  /**
   * Format bytes to readable string (e.g. 1.2 MB)
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
