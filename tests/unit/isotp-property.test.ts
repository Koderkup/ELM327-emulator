import { describe, it, expect } from 'vitest';
import * as fc from "fast-check";;
import { IsoTpServer } from '../../src/protocol/isotp-server.js';

describe('ISO-TP property tests', () => {
  it('segment + reassemble roundtrip for random payload sizes (1..40 bytes)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), (len: number) => {
        const payload = new Uint8Array(len);
        for (let i = 0; i < len; i++) payload[i] = i % 256;
        const server = new IsoTpServer();
        const frames = server.segment(payload);
        expect(frames.length).toBeGreaterThan(0);
        const reassembled = server.reassemble(frames);
        expect(reassembled).not.toBeNull();
        if (reassembled) {
          expect(reassembled.length).toBe(len);
          for (let i = 0; i < len; i++) {
            expect(reassembled[i]).toBe(payload[i]);
          }
        }
      }),
      { verbose: true, seed: 42 }
    );
  });

  it('rejects CF frame without preceding FF', () => {
    fc.assert(
      fc.property(fc.boolean(), (_: boolean) => {
        const server = new IsoTpServer();
        const cf = new Uint8Array([0x30, 0x00]);
        const result = server.reassemble([cf]);
        return result === null;
      }),
      { verbose: true, seed: 7 }
    );
  });

  it('allows FF + CF reassembly and rejects invalid CF', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), (len: number) => {
        const server = new IsoTpServer();
        const payload = new Uint8Array(len);
        for (let i = 0; i < len; i++) payload[i] = i % 256;
        // Build proper EFR FF for the payload length
        const ff = new Uint8Array(2 + payload.length);
        ff[0] = 0x10 | ((payload.length >> 8) & 0x0f);
        ff[1] = payload.length & 0xff;
        ff.set(payload, 2);
        // CF valid seq=1
        const cfValid = new Uint8Array([0x20, 0x01]);
        // CF alone must be null
        const cfOnly = server.reassemble([cfValid]);
        if (cfOnly !== null) return false;
        // FF + CF (valid sequence) should reassemble to payload
        const combined = server.reassemble([ff, cfValid]);
        return combined !== null && combined.length === payload.length;
      }),
      { verbose: true, seed: 11 }
    );
  });
});
