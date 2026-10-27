import { spawn } from 'node:child_process';
import { SerialPort } from 'serialport';
import type { Transport } from './transport.js';

export class BluetoothTransport implements Transport {
  private rfcomm?: ReturnType<typeof spawn>;
  private port?: SerialPort;
  constructor(private channel = 1, private device = '/dev/rfcomm0') {}
  async open(): Promise<void> {
    this.rfcomm = spawn('rfcomm', ['listen', this.device.replace('/dev/', ''), String(this.channel)], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 1000));
    this.port = new SerialPort({ path: this.device, baudRate: 9600, autoOpen: false });
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
  async close(): Promise<void> {
    await new Promise<void>((res) => this.port?.close(() => res()));
    this.rfcomm?.kill();
  }
}
