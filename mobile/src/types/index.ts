export type StudioTab = 'home' | 'pdf' | 'image' | 'text' | 'history';

export interface FileItem {
  id: string;
  name: string;
  uri: string;
  size?: number;
  mimeType?: string;
  type: 'pdf' | 'image' | 'text' | 'other';
}

export interface ProcessedItem {
  id: string;
  name: string;
  uri: string;
  size: number;
  date: string;
  operation: string;
  type: 'pdf' | 'image' | 'text';
}

export type PdfOperation = 
  | 'merge'
  | 'split'
  | 'extract'
  | 'rotate'
  | 'protect'
  | 'decrypt'
  | 'images_to_pdf';

export type ImageOperation = 
  | 'convert'
  | 'resize'
  | 'compress'
  | 'combine_pdf';

export interface PdfOptions {
  pageRange?: string;
  rotationDegrees?: 90 | 180 | 270;
  password?: string;
  pageSize?: 'fit' | 'a4' | 'letter';
}

export interface ImageOptions {
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number; // 0 - 100
  scale?: number; // 25, 50, 75, 100
}
