import { SerialPort } from 'serialport';
import type { Transport } from './transport.js';

/**
 * K-Line transport for automotive diagnostic communication (ISO 14230).
 *
 * K-Line uses single-wire half-duplex communication with:
 * - Dominant state: 0 (250 ohm drive, ~90–120% VCC)
 * - Recessive state: 1
 * - Bit stuffing: 5 consecutive 1 bits followed by 0
 * - Timing: 250 µs per bit, differential or single-ended
 *
 * This is a minimal implementation; use a hardware K-Line adapter for production.
 */
export class KLineTransport implements Transport {
  private port?: SerialPort;

  constructor(private path: string, private baudRate = 10400) {}

  async open(): Promise<void> {
    this.port = new SerialPort({ path: this.path, baudRate: this.baudRate, autoOpen: false, dataBits: 8, parity: 'none', stopBits: 1, rtscts: false, xon: false, xoff: false });
    await new Promise<void>((res, rej) => this.port!.open((e) => (e ? rej(e) : res())));
  }

  private async readLine(timeoutMs: number): Promise<string> {
    const args = {};
    return new Promise((resolve, reject) => {
      let data = '';
      const timer = setTimeout(() => {
        this.port?.removeListener('data', onData);
        this.port?.removeListener('error', onError);
        this.port?.unpipe?.(this.port!);
        resolve(data);
      }, timeoutMs);

      const onData = (chunk: Buffer) => {
        data += chunk.toString('latin1');
        if (data.includes('\r')) {
          clearTimeout(timer);
          this.port?.removeListener('data', onData);
          this.port?.removeListener('error', onError);
          this.port?.unpipe?.(this.port!);
          resolve(data.replace(/\r$/, ''));
        }
      };
      const onError = (err: Error) => {
        clearTimeout(timer);
        this.port?.removeListener('data', onData);
        this.port?.removeListener('error', onError);
        this.port?.unpipe?.(this.port!);
        reject(err);
      };
      this.port?.on('data', onData);
      this.port?.on('error', onError);
      this.port?.pipe(this.port!, args);
    });
  }

  private encodeKLine(payload: Uint8Array, id: number = 0x7e0): Uint8Array {
    // K-Line: address (ID) + CAN-style data, bit-stuffed, low-pass filtered
    // Minimal: return raw bytes (real hardware handles physical signaling)
    const out = new Uint8Array(payload.length + 1);
    out[0] = id & 0x7f;
    out.set(payload, 1);
    return out;
  }

  async *read(signal?: AbortSignal): AsyncGenerator<Uint8Array> {
    if (!this.port) return;
    // K-Line transport uses polling at 10Hz for simplicity
    while (!signal?.aborted) {
      try {
        const line = await this.readLine(100);
        if (!line) continue;
        const payload = new Uint8Array(line.length - 1);
        for (let i = 0; i < payload.length; i++) payload[i] = line.charCodeAt(i + 1);
        if (payload.length > 0) yield payload;
      } catch {
        // ignore; retry on next tick
      }
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port) return;
    // Encode: K-Line uses single-wire; echo back with address
    const out = this.encodeKLine(data, 0x7e0);
    await new Promise<void>((resolve, reject) => this.port!.write(out, (e) => (e ? reject(e) : resolve())));
  }

  async close(): Promise<void> {
    await new Promise<void>((res) => {
      this.port?.close(() => res());
      this.port = undefined;
    });
  }
}
