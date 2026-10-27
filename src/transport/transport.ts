export interface Transport {
  open(): Promise<void>;
  read(signal?: AbortSignal): AsyncIterable<Uint8Array>;
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}
