import type { UdsServices } from './uds.js';
import { IsoTpServer } from './isotp-server.js';

export interface IsoTpUdsOptions {
  /** ISO-TP configuration. */
  iso?: IsoTpServer;
  /** UDS services instance. */
  uds?: UdsServices;
}

/** ISO-TP ↔ UDS bridge: turns binary frames into UDS service calls and back. */
export class IsoTpUdsBridge {
  private iso: IsoTpServer;

  constructor(opts: IsoTpUdsOptions) {
    this.iso = opts.iso ?? new IsoTpServer();
  }

  /** Process a client ISO-TP payload and return the response payload (may be multi-frame). */
  async process(raw: Uint8Array): Promise<Uint8Array[]> {
    // Step 1: ISO-TP reassembly
    const payload = this.iso.reassemble([raw]);
    if (!payload) throw new Error('ISO-TP reassembly failed (invalid sequence or incomplete frame)');

    // Step 2: UDS dispatch
    const uds = this.iso.uds; if (!uds) throw new Error('IsoTpServer.uds is not set — cannot process UDS over ISO-TP'); const resp = uds.handle(payload);

    // Step 3: Return as ISO-TP frames (client receives multi-frame answer)
    return this.iso.segment(resp);
  }

  /** Single-frame request (used for quick UDS queries without full iso loop). */
  async handleUds(req: Uint8Array): Promise<Uint8Array> {
    const uds = this.iso.uds; if (!uds) throw new Error('IsoTpServer.uds is not set — cannot process UDS'); return uds.handle(req);
  }
}
