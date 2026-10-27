import { TaskHandler, TaskContext } from './uds-tasks.js';

export interface UdsServiceConfig {
  /** Supported sessions: default=0x01, programming=0x02, extended=0x03. */
  supportedSessions: number[];
  /** Security access levels available. */
  securityLevels: number[];
  /** Seed/key simulation callback. Returns key for a given seed/level. */
  getKey?: (seed: Uint8Array, level: number) => Uint8Array | null;
  /** Custom service handlers: sid -> response bytes. */
  customServices?: Record<number, (req: Uint8Array) => Uint8Array | null>;
  /** KWP2000: whether to enable KWP2000 services (0x10 diagnostic start, etc.). */
  kwp2000?: boolean;
}

export class UdsServices {
  private session = 0x01;
  private securityUnlocked = new Set<number>();
  private seed: Uint8Array | null = null;
  private seedLevel = 0;
  private kwpCommunicationStarted = false;

  constructor(private cfg: UdsServiceConfig) {
    if (cfg.kwp2000) this.kwpCommunicationStarted = false;
  }

  /** Current diagnostic session. */
  getSession(): number {
    return this.session;
  }

  /** Check if a security level is currently unlocked. */
  isSecurityUnlocked(level: number): boolean {
    return this.securityUnlocked.has(level);
  }

  /** Main dispatch: returns positive response or negative response (0x7f sid nrc). */
  handle(req: Uint8Array): Uint8Array {
    const sid = req[0];
    const data = req.slice(1);

    // Tester Present 0x3E (can be 1 byte)
    if (sid === 0x3E) {
      return new Uint8Array([0x7e]);
    }

    // KWP2000: require StartCommunication before other services (except tester present)
    if (this.cfg.kwp2000 && sid !== 0x10 && sid !== 0x3E && !this.kwpCommunicationStarted) {
      return this.nrc(sid, 0x22); // conditions not correct
    }

    // Session Control 0x10 / KWP2000 StartCommunication
    if (sid === 0x10) {
      if (data.length < 1) return this.nrc(sid, 0x13);
      const sub = data[0];
      if (!this.cfg.supportedSessions.includes(sub)) return this.nrc(sid, 0x22);
      this.session = sub;
      this.kwpCommunicationStarted = true;
      return new Uint8Array([0x50, sub]);
    }

    // ECU Reset 0x11
    if (sid === 0x11) {
      if (data.length < 1) return this.nrc(sid, 0x13);
      return new Uint8Array([0x51, data[0]]);
    }

    // Security Access 0x27
    if (sid === 0x27) {
      return this.securityAccess(data);
    }

    // Read Data By Identifier 0x22 (basic simulation)
    if (sid === 0x22) {
      if (data.length < 2) return this.nrc(sid, 0x13);
      const did = (data[0] << 8) | data[1];
      // Return did echoed with dummy data for common DIDs
      const dummy = new Uint8Array([did >> 8, did & 0xff, 0x00, 0x01]);
      return new Uint8Array([0x62, ...dummy]);
    }

    // Clear Diagnostic Information 0x14
    if (sid === 0x14) {
      return new Uint8Array([0x54]);
    }

    // Custom services
    const custom = this.cfg.customServices?.[sid];
    if (custom) {
      const resp = custom(req);
      if (resp) return resp;
    }

    return this.nrc(sid, 0x11); // service not supported
  }

  securityAccess(data: Uint8Array): Uint8Array {
    if (data.length < 1) return this.nrc(0x27, 0x13);
    const sub = data[0];
    const level = sub; // odd = request seed, even = send key

    // Request seed (odd sub-function)
    if (sub % 2 === 1) {
      if (!this.cfg.securityLevels.includes(level)) return this.nrc(0x27, 0x22);
      // Generate a random seed
      const seed = new Uint8Array([0x1a, 0x2b, 0x3c, 0x4d, level]);
      this.seed = seed;
      this.seedLevel = level;
      return new Uint8Array([0x67, sub, ...seed]);
    }

    // Send key (even sub-function)
    if (sub % 2 === 0) {
      const prev = sub - 1;
      if (this.seedLevel !== prev || !this.seed) return this.nrc(0x27, 0x24); // invalid key
      const expected = this.cfg.getKey?.(this.seed, prev);
      if (!expected || !this.keysEqual(expected, data.slice(1))) {
        return this.nrc(0x27, 0x35); // invalid key
      }
      this.securityUnlocked.add(prev);
      this.seed = null;
      this.seedLevel = 0;
      return new Uint8Array([0x67, sub]);
    }

    return this.nrc(0x27, 0x13);
  }

  private nrc(sid: number, nrc: number): Uint8Array {
    return new Uint8Array([0x7f, sid, nrc]);
  }

  private keysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
}

/** Built-in Security Access task handler for stateful seed/key flow. */
export class SecurityAccessTask implements TaskHandler {
  readonly id = 'security-access';
  private cfg: UdsServiceConfig;

  constructor(cfg: UdsServiceConfig) {
    this.cfg = cfg;
  }

  init(ctx: TaskContext): boolean {
    ctx.state = 'running';
    return true;
  }

  handle(req: Uint8Array, _ctx: TaskContext): Uint8Array | null {
    // Delegate to UDS services security access logic
    return new UdsServices(this.cfg).securityAccess(req);
  }

  cancel(_ctx: TaskContext): void {}
}

export function createUdsTask(cfg: UdsServiceConfig): TaskHandler {
  return new SecurityAccessTask(cfg);
}
