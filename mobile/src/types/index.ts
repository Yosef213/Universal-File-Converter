export type StudioTab = 'home' | 'pdf' | 'image' | 'docs' | 'history';

export interface FileItem {
  id: string;
  name: string;
  uri: string;
  size?: number;
  mimeType?: string;
  type: 'pdf' | 'image' | 'text' | 'word' | 'other';
}

/** Result of any conversion: one or more output file URIs plus a summary line. */
export interface JobResult {
  outputs: string[];
  summary: string;
}

export type ProgressFn = (done: number, total: number, label?: string) => void;
