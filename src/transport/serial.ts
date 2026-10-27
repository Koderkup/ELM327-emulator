import { SerialPort } from 'serialport';
import type { Transport } from './transport.js';

export class SerialTransport implements Transport {
  private port?: SerialPort;
  constructor(private path: string, private baudRate = 38400) {}
  async open(): Promise<void> {
    this.port = new SerialPort({ path: this.path, baudRate: this.baudRate, autoOpen: false });
    await new Promise<void>((res, rej) => this.port!.open((e) => (e ? rej(e) : res())));
  }
  async *read(): AsyncIterable<Uint8Array> {
    if (!this.port) return;
    for await (const chunk of this.port) yield new Uint8Array(chunk);
  }
  async write(data: Uint8Array): Promise<void> {
    if (!this.port) return;
    await new Promise<void>((res, rej) => this.port!.write(Buffer.from(data), (e) => (e ? rej(e) : res())));
  }
  async close(): Promise<void> { await new Promise<void>((res) => this.port?.close(() => res())); }
}
