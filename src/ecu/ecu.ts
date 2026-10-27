export interface Ecu {
  name: string;
  addr: string;           // CAN request ID, hex string (e.g. "7E0")
  rAddr: string;          // CAN response ID, hex string (e.g. "7E8")
  pids: Record<string, string>;
  dtcs?: string[];        // list of DTC codes (e.g. "P0133")
  vin?: string;           // VIN if ECU owns it (typically the ECU at 7E0)
}

/** Parse a hex CAN address into a number. */
export function parseAddr(hex: string): number {
  return parseInt(hex, 16);
}

/** OBD functional broadcast CAN ID. */
export const FUNCTIONAL_ADDR = 0x7df;

/**
 * Find the ECU targeted by a request CAN ID.
 *
 * - Functional address `0x7DF` (broadcast): returns the first ECU
 *   that declares responses (engine by convention).
 * - Physical addresses (`0x7E0`..`0x7E7`, `0x7F0`..`0x7F7`): matched
 *   against `Ecu.addr`.
 */
export function findEcuByRequest(ecus: Ecu[], reqIdHex: string): Ecu | undefined {
  if (ecus.length === 0) return undefined;
  const id = parseAddr(reqIdHex);
  if (id === FUNCTIONAL_ADDR) return ecus[0];
  return ecus.find((e) => parseAddr(e.addr) === id);
}

export const defaultEcus: Ecu[] = [
  {
    name: 'Engine',
    addr: '7E0',
    rAddr: '7E8',
    pids: {
      '0100': '41 00 BE 3F A8 13',
      '010C': '41 0C 0F A0',
      '010D': '41 0D 3C',
      '0105': '41 05 5A',
      '0104': '41 04 4B',
      '010B': '41 0B 7F',
      '010F': '41 0F 40',
      '0111': '41 11 7F',
      '011F': '41 1F 0A 3C',
      '012F': '41 2F 80',
    },
    dtcs: ['P0133'],
    vin: '5N3AA08D68D123456',
  },
  {
    name: 'Trans',
    addr: '7E1',
    rAddr: '7E9',
    pids: {
      '0100': '41 00 80 00 00 00',
    },
    dtcs: [],
  },
];
