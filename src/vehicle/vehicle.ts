import type { Ecu } from '../ecu/ecu.js';
import { FUNCTIONAL_ADDR, findEcuByRequest, parseAddr } from '../ecu/ecu.js';
import type { Scenario } from './scenario.js';

/**
 * A Vehicle is the runtime representation of a loaded scenario.
 *
 * It owns ECU profiles, a VIN, and the routing logic that maps an OBD
 * request (optionally accompanied by a CAN header) to the appropriate ECU
 * and returns that ECU's configured response.
 */
export class Vehicle {
  readonly ecus: Ecu[];
  readonly vin: string | undefined;

  constructor(public readonly scenario: Scenario) {
    this.ecus = scenario.ecus ?? [];
    this.vin = scenario.vin;
  }

  /** Find the ECU responding to a given request CAN ID (hex). */
  findEcuById(reqIdHex: string): Ecu | undefined {
    return findEcuByRequest(this.ecus, reqIdHex);
  }

  /**
   * Resolve the CAN response ID for a given request header.
   *
   * - When a physical header is provided (e.g. `7E0`), the matching ECU's
   *   `rAddr` is returned.
   * - When the header is functional (`7DF`) or absent, the first ECU's
   *   `rAddr` is used (functional broadcast).
   * - Falls back to `7E8` if no ECU is configured.
   */
  responseIdFor(reqIdHex?: string): string {
    const id = reqIdHex ? findEcuByRequest(this.ecus, reqIdHex) : this.ecus[0];
    return id ? id.rAddr : '7E8';
  }

  /**
   * Build the OBD response payload for a request.
   *
   * `request` is the upper-hex OBD service/PID bytes, e.g. `010C`.
   * `reqIdHex` is the CAN request ID from `ATSH` (physical) or undefined
   * (functional broadcast).
   *
   * Routing rules:
   * - Physical addressing (reqIdHex set, not 7DF): route to the matching ECU.
   * - Functional/empty: route to the first ECU (engine by convention).
   */
  respondObd(request: string, reqIdHex?: string): string | null {
    const hex = request.replace(/\s/g, '').toUpperCase();
    let target: Ecu | undefined;

    if (reqIdHex) {
      const id = parseAddr(reqIdHex);
      if (id === FUNCTIONAL_ADDR) {
        target = this.ecus[0];
      } else {
        target = findEcuByRequest(this.ecus, reqIdHex);
      }
    } else {
      target = this.ecus[0];
    }

    if (target && target.pids && target.pids[hex]) {
      return target.pids[hex];
    }

    // Global fallbacks (not ECU-specific)
    if (hex === '03') {
      // Report DTCs from the engine ECU
      const engine = this.ecus[0];
      if (engine?.dtcs && engine.dtcs.length > 0) {
        // Pack DTCs into OBD response bytes (simplified)
        return `43 ${engine.dtcs.length} 00 00 00`;
      }
      return '43 ';
    }
    if (hex === '0100' && !target) {
      return '41 00 BE 3F A8 13';
    }
    if (hex === '0902') {
      if (this.vin) {
        const vinBytes = Array.from(this.vin, (c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
        return `49 02 01 ${vinBytes.join(' ')}`;
      }
    }
    return null;
  }

  /** Number of supported PIDs (Mode $01 PID $00 bitmap width) for an ECU. */
  supportedPidCount(ecu: Ecu): number {
    return Object.keys(ecu.pids ?? {}).length;
  }

  /** Clear DTCs for the engine ECU (Mode $01 PID $04). */
  clearDtcs(): void {
    const engine = this.ecus[0];
    if (engine && engine.dtcs) engine.dtcs.length = 0;
  }
}