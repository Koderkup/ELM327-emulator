import { describe, it, expect } from 'vitest';
import { IsoTpServer } from '../../src/protocol/isotp-server.js';

/** Integration: ISO-TP server segments and reassembles payloads correctly. */
describe('transport integration', () => {
  it('ISO-TP server roundtrips 2-byte, 4-byte and 6-byte payloads', () => {
    const server = new IsoTpServer();

    // 2-byte payload
    const p2 = new Uint8Array([0x10, 0x02]);
    const f2 = server.segment(p2);
    expect(f2.length).toBeGreaterThan(0);
    const a2 = server.reassemble(f2)!;
    expect(a2).toBeTruthy();

    // 4-byte payload
    const p4 = new Uint8Array([0x10, 0x04, 0x10, 0x02]);
    const f4 = server.segment(p4);
    expect(f4.length).toBeGreaterThan(0);
    const a4 = server.reassemble(f4)!;
    expect(a4.length).toBe(4);
    expect(a4).toEqual(p4);

    // 6-byte payload
    const p6 = new Uint8Array([0x10, 0x04, 0x10, 0x02, 0x10, 0x02]);
    const f6 = server.segment(p6);
    expect(f6.length).toBeGreaterThan(0);
    const a6 = server.reassemble(f6)!;
    expect(a6.length).toBe(6);
    expect(a6).toEqual(p6);
  });
});
