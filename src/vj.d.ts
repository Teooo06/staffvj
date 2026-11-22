import type {
  DisplayInfo,
  ImportedFile,
  ProjectData,
  ShowState,
  NdiFrame,
  NdiSourceInfo,
  NdiStatus,
  TransportData,
} from './types';
import type { PerformanceSettings } from './preferences';

export interface VJApi {
  platform: string;
  isElectron: boolean;
  appInfo(): Promise<{
    version: string;
    platform: string;
    electron: string;
    chrome: string;
  }>;
  askMediaAccess(kind: 'camera' | 'microphone'): Promise<boolean>;
  openMediaDialog(): Promise<ImportedFile[]>;
  openHtmlDialog(): Promise<{ path: string; name: string } | null>;
  saveProject(
    data: ProjectData | unknown,
  ): Promise<{ canceled?: boolean; filePath?: string; error?: string }>;
  loadProject(): Promise<{
    canceled?: boolean;
    filePath?: string;
    data?: unknown;
    error?: string;
  }>;
  listDisplays(): Promise<DisplayInfo[]>;
  openOutput(displayId: number): Promise<boolean>;
  closeOutput(): Promise<boolean>;
  reloadOutput(): Promise<boolean>;
  reloadControl(): Promise<boolean>;
  reloadBrowserSources(): Promise<boolean>;
  setPerformanceSettings(settings: PerformanceSettings): Promise<boolean>;
  isOutputOpen(): Promise<boolean>;
  getSnapshot(): Promise<{
    state: ShowState | null;
    transport: TransportData | null;
    performance?: PerformanceSettings;
  }>;
  listNdiSources(): Promise<NdiSourceInfo[]>;
  refreshNdiSources(): Promise<NdiSourceInfo[]>;
  getNdiStatus(): Promise<NdiStatus>;
  setNdiOutput(enabled: boolean, name: string): Promise<boolean>;
  sendNdiOutputFrame(frame: Uint8Array, width: number, height: number): void;
  sendState(state: ShowState): void;
  sendTransport(transport: TransportData): void;
  rendererReady(): void;
  quit(): void;
  onState(callback: (state: ShowState) => void): () => void;
  onTransport(callback: (transport: TransportData) => void): () => void;
  onSnapshot(
    callback: (snapshot: {
      state: ShowState | null;
      transport: TransportData | null;
      performance?: PerformanceSettings;
    }) => void,
  ): () => void;
  onPerformanceSettings(callback: (settings: PerformanceSettings) => void): () => void;
  onOutputClosed(callback: () => void): () => void;
  onDisplaysChanged(callback: (displays: DisplayInfo[]) => void): () => void;
  onBrowserFrame(callback: (frame: {
    sourceId: string;
    width: number;
    height: number;
    sequence: number;
    bytes: Uint8Array;
  }) => void): () => void;
  onBrowserRemove(callback: (sourceId: string) => void): () => void;
  onNdiSources(callback: (sources: NdiSourceInfo[]) => void): () => void;
  onNdiStatus(callback: (status: NdiStatus) => void): () => void;
  onNdiFrame(callback: (frame: NdiFrame) => void): () => void;
  onNdiRemove(callback: (sourceId: string) => void): () => void;
  onNdiSourceError(callback: (error: { sourceId: string; error: string }) => void): () => void;
}

declare global {
  interface Window {
    vj?: VJApi;
  }
}

export {};
