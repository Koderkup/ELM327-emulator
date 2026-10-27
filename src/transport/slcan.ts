import { SerialPort } from 'serialport';
import type { Transport } from './transport.js';

export interface SlcanFrame {
  id: number;           // CAN identifier (11 or 29 bit)
  extended: boolean;    // true = 29-bit extended frame
  remote: boolean;      // true = remote request frame
  data: Uint8Array;     // payload (0-8 bytes for standard CAN)
}

export class SlcanTransport implements Transport {
  private port?: SerialPort;
  private lineBuf = '';
  private openChannel = false;

  constructor(private path: string, private baudRate = 500000) {}

  async open(): Promise<void> {
    this.port = new SerialPort({ path: this.path, baudRate: this.baudRate, autoOpen: false });
    await new Promise<void>((res, rej) => this.port!.open((e) => (e ? rej(e) : res())));
    this.port.on('data', (chunk) => {
      this.lineBuf += chunk.toString('latin1');
      let idx: number;
      while ((idx = this.lineBuf.indexOf('\r')) >= 0) {
        this.lineBuf = this.lineBuf.slice(idx + 1);
      }
    });
    this.openChannel = true;
  }

  /** Parse an SLCAN ASCII line into a frame. Returns null if invalid/ignored. */
  private parseLine(line: string): SlcanFrame | null {
    const c = line[0];
    const rest = line.slice(1);

    // Version / info queries (no frame)
    if (c === 'V' || c === 'v' || c === 'N' || c === 'S' || c === 'C' || c === 'O') return null;

    let extended = false;
    let remote = false;
    let idHex: string;
    let dataHex: string;

    switch (c) {
      case 't': // standard transmit, 3 hex ID
        idHex = rest.slice(0, 3);
        dataHex = rest.slice(3);
        break;
      case 'T': // extended transmit, 8 hex ID
        extended = true;
        idHex = rest.slice(0, 8);
        dataHex = rest.slice(8);
        break;
      case 'r': // standard remote
        remote = true;
        idHex = rest.slice(0, 3);
        dataHex = '';
        break;
      case 'R': // extended remote
        extended = true;
        remote = true;
        idHex = rest.slice(0, 8);
        dataHex = '';
        break;
      default:
        return null;
    }

    const id = parseInt(idHex, 16);
    if (Number.isNaN(id)) return null;

    const data = dataHex ? new Uint8Array(dataHex.match(/[0-9A-Fa-f]{2}/g)!.map((b) => parseInt(b, 16))) : new Uint8Array(0);
    return { id, extended, remote, data };
  }

  async *read(signal?: AbortSignal): AsyncIterable<Uint8Array> {
    if (!this.port) return;
    let buf = '';
    for await (const chunk of this.port) {
      buf += chunk.toString('latin1');
      while (true) {
        const idx = buf.indexOf('\r');
        if (idx < 0) break;
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        const frame = this.parseLine(line);
        if (frame) {
          yield this.frameToBytes(frame);
        }
        if (signal?.aborted) return;
      }
    }
  }

  /** Convert an SLCAN frame to raw bytes for the ELM core (ISO-TP style payload). */
  private frameToBytes(frame: SlcanFrame): Uint8Array {
    const idBytes = frame.extended ? new Uint8Array([(frame.id >> 24) & 0xff, (frame.id >> 16) & 0xff, (frame.id >> 8) & 0xff, frame.id & 0xff]) : new Uint8Array([(frame.id >> 8) & 0xff, frame.id & 0xff]);
    const dlc = frame.data.length;
    const out = new Uint8Array(2 + dlc);
    out.set(idBytes, 0);
    out[2] = dlc;
    out.set(frame.data, 3);
    return out;
  }

  /** Format raw bytes back into an SLCAN transmit frame (standard, 11-bit ID). */
  private bytesToSlcan(payload: Uint8Array, id: number = 0x7e0): string {
    const idHex = id.toString(16).toUpperCase().padStart(3, '0');
    const dataHex = Array.from(payload, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
    return `t${idHex}${dataHex}\r`;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port || !this.openChannel) return;
    // Default: echo payload back as an SLCAN frame to engine address 7E0
    const line = this.bytesToSlcan(data, 0x7e8); // response ID
    await new Promise<void>((res, rej) => this.port!.write(line, (e) => (e ? rej(e) : res())));
  }

  async close(): Promise<void> {
    this.openChannel = false;
    await new Promise<void>((res) => this.port?.close(() => res()));
  }
}
