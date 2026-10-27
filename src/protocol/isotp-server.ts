import type { UdsServices } from './uds.js';

export interface IsoTpConfig {
  blockSize: number;
  stMinMs: number;
  timeoutMs: number;
}

export const defaultConfig: IsoTpConfig = {
  blockSize: 8,
  stMinMs: 5,
  timeoutMs: 1000,
};

export class IsoTpServer {
  constructor() {}

  /** Optional UDS services instance for ISO-TP/UDS bridging. */
  uds?: UdsServices;

  /** Segment a payload into ISO-TP frames (client->server transmission). */
  segment(payload: Uint8Array): Uint8Array[] {
    // ISO-TP First Frame (EFR) for small payloads
    if (payload.length <= 6) {
      const ff = new Uint8Array(2 + payload.length);
      ff[0] = 0x10 | ((payload.length >> 8) & 0x0f);
      ff[1] = payload.length & 0xff;
      ff.set(payload, 2);
      return [ff];
    }
    // Full ISO-TP: FF + CF frames
    const frames: Uint8Array[] = [];
    const total = payload.length;
    const ff = new Uint8Array(2 + Math.min(6, payload.length));
    ff[0] = 0x10 | ((total >> 8) & 0x0f);
    ff[1] = total & 0xff;
    ff.set(payload.slice(0, 6), 2);
    frames.push(ff);
    let offset = 6;
    let seq = 1;
    while (offset < total) {
      const chunk = payload.slice(offset, offset + 7);
      const cf = new Uint8Array(1 + chunk.length);
      cf[0] = 0x20 | (seq & 0x0f);
      cf.set(chunk, 1);
      frames.push(cf);
      offset += 7;
      seq = (seq + 1) & 0x0f;
    }
    return frames;
  }

  /** Reassemble frames into a single payload. Returns null on invalid sequence. */
  reassemble(frames: Uint8Array[]): Uint8Array | null {
    if (frames.length === 0) return null;
    const first = frames[0];
    if ((first[0] & 0xf0) === 0x00) {
      // Basic frame: 1-byte length prefix
      const len = first[0];
      return first.slice(1, 1 + len);
    }
    if ((first[0] & 0xf0) === 0x10) {
      // Extended First Frame (EFR): 2-byte total length
      // For EFR, the payload follows immediately after the 2-byte header
      const total = ((first[0] & 0x0f) << 8) | first[1];
      const out: number[] = [];
      // EFR payload is the bytes following the 2-byte FF header
      out.push(...first.slice(2));
      for (let i = 1; i < frames.length; i++) {
        const f = frames[i];
        if ((f[0] & 0xf0) !== 0x20) return null;
        out.push(...f.slice(1));
      }
      return new Uint8Array(out.slice(0, total));
    }
    if ((first[0] & 0xf0) !== 0x10) return null;
    const total = ((first[0] & 0x0f) << 8) | first[1];
    const out: number[] = [];
    out.push(...first.slice(2));
    for (let i = 1; i < frames.length; i++) {
      const f = frames[i];
      if ((f[0] & 0xf0) !== 0x20) return null;
      out.push(...f.slice(1));
    }
    return new Uint8Array(out.slice(0, total));
  }

  /** Process a client ISO-TP frame payload through UDS and return the response frames. */
  processUds(raw: Uint8Array): Uint8Array[] {
    if (!this.uds) throw new Error('IsoTpServer.uds is not set — cannot process UDS over ISO-TP');
    const payload = this.reassemble([raw]);
    if (!payload) throw new Error('ISO-TP reassembly failed (invalid sequence or incomplete frame)');
    const resp = this.uds.handle(payload);
    return this.segment(resp);
  }
}
