import { describe, it, expect } from 'vitest';
import { IsoTpServer } from '../../src/protocol/isotp-server.js';
import { UdsServices } from '../../src/protocol/uds.js';
import { TaskRegistry, TaskHandler } from '../../src/protocol/uds-tasks.js';

describe('isotp-server', () => {
  it('processUds request-response', () => {
    const s = new IsoTpServer();
    const uds = new UdsServices({
      supportedSessions: [0x01],
      securityLevels: [0x01],
      getKey: () => new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
    });
    s.uds = uds;
    // Build ISO-TP First Frame (FF) for 2-byte payload [0x10, 0x03]
    // total = 2 -> FF = [0x10, 0x02, 0x10, 0x03]
    const ff = new Uint8Array([0x10, 0x02, 0x10, 0x03]);
    const frames = s.processUds(ff);
    expect(frames.length).toBeGreaterThan(0);
    const first = new Uint8Array(frames[0]);
    // Expected: ISO-TP FF frame containing NRC payload [0x7f, 0x10, 0x22]
    // FF = 0x10 | (total >> 8), total = 3 -> ff[0] = 0x10, ff[1] = 3
    expect(first[0]).toBe(0x10);
    expect(first[1]).toBe(0x03);
    // Payload follows: 0x7f 0x10 0x22 (NRC session not supported)
    expect(first[2]).toBe(0x7f);
    expect(first[3]).toBe(0x10);
    expect(first[4]).toBe(0x22);
  });
  it('segment/reassemble roundtrip', () => {
    const s = new IsoTpServer();
    const p = new Uint8Array([0x41, 0x00, 0xbe, 0xef]);
    const f = s.segment(p);
    expect(s.reassemble(f)).toEqual(p);
  });
});

describe('uds-services', () => {
  const cfg = {
    supportedSessions: [0x01, 0x02, 0x03],
    securityLevels: [0x01],
    getKey: () => new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
  };
  const uds = new UdsServices(cfg);

  it('session control', () => {
    const r = uds.handle(new Uint8Array([0x10, 0x03]));
    expect(r[0]).toBe(0x50);
    expect(r[1]).toBe(0x03);
    expect(uds.getSession()).toBe(0x03);
  });

  it('tester present', () => {
    const r = uds.handle(new Uint8Array([0x3e]));
    expect(r[0]).toBe(0x7e);
  });

  it('security access request seed', () => {
    const r = uds.handle(new Uint8Array([0x27, 0x01]));
    expect(r[0]).toBe(0x67);
    expect(r[1]).toBe(0x01);
    expect(r.length).toBe(7); // 0x67, sub, 5 seed bytes
  });

  it('security access send key', () => {
    uds.handle(new Uint8Array([0x27, 0x01])); // request seed
    const r = uds.handle(new Uint8Array([0x27, 0x02, 0xaa, 0xbb, 0xcc, 0xdd]));
    expect(r[0]).toBe(0x67);
    expect(r[1]).toBe(0x02);
    expect(uds.isSecurityUnlocked(0x01)).toBe(true);
  });

  it('read DID', () => {
    const r = uds.handle(new Uint8Array([0x22, 0xf1, 0x90]));
    expect(r[0]).toBe(0x62);
  });

  it('unsupported service returns NRC', () => {
    const r = uds.handle(new Uint8Array([0xff, 0x00]));
    expect(r[0]).toBe(0x7f);
    expect(r[1]).toBe(0xff);
  });
});

describe('uds-tasks', () => {
  it('task registry lifecycle', () => {
    const reg = new TaskRegistry();
    const handler: TaskHandler = {
      id: 'test-task',
      init: (ctx) => { ctx.state = 'running'; return true; },
      handle: () => new Uint8Array([0x01]),
      cancel: () => {},
      cleanup: () => {},
    };
    reg.register(handler);
    const ctx = reg.start('test-task', { id: 'test-task' });
    expect(ctx?.state).toBe('running');
    expect(reg.has('test-task')).toBe(true);
    reg.complete('test-task');
    expect(reg.has('test-task')).toBe(false);
    reg.cancelAll();
    expect(reg.size()).toBe(0);
  });
});

