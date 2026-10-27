import type { Vehicle } from '../vehicle/vehicle.js';

export interface ElmState {
  echo: boolean;
  linefeed: boolean;
  spaces: boolean;
  headers: boolean;
  protocol: string;
  /** Current CAN transmit header (e.g. "7E0") or "" for functional broadcast. */
  header: string;
}

export function defaultState(): ElmState {
  return {
    echo: true,
    linefeed: true,
    spaces: true,
    headers: false,
    protocol: 'AUTO',
    header: '',
  };
}

/** Format an OBD response byte string, applying spaces/header settings. */
function formatResponse(payload: string, respId: string | null, state: ElmState): string {
  let out = payload;
  if (state.spaces === false) out = out.replace(/\s/g, '');
  if (state.headers && respId) out = `${respId} ${out}`;
  return out + '\r>';
}

export function processAt(cmd: string, state: ElmState): string {
  const c = cmd.toUpperCase().trim();
  if (c === 'ATZ') { Object.assign(state, defaultState()); return 'ELM327 v1.5\r\r>'; }
  if (c === 'ATI') return 'ELM327 v1.5\r>';
  if (c === 'ATE0') { state.echo = false; return 'OK\r>'; }
  if (c === 'ATE1') { state.echo = true; return 'OK\r>'; }
  if (c === 'ATL0') { state.linefeed = false; return 'OK\r>'; }
  if (c === 'ATL1') { state.linefeed = true; return 'OK\r>'; }
  if (c === 'ATS0') { state.spaces = false; return 'OK\r>'; }
  if (c === 'ATS1') { state.spaces = true; return 'OK\r>'; }
  if (c === 'ATH0') { state.headers = false; return 'OK\r>'; }
  if (c === 'ATH1') { state.headers = true; return 'OK\r>'; }
  if (c === 'ATRV') return '12.6V\r>';
  if (c === 'ATDP') return 'AUTO\r>';
  if (c === 'ATDPN') return 'A6\r>';
  if (c === 'ATSP0') { state.protocol = 'AUTO'; return 'OK\r>'; }
  if (c.startsWith('ATSP')) { state.protocol = c.slice(4); return 'OK\r>'; }
  if (c === 'ATPP') return 'OK\r>';
  // Reset header with ATSH0
  if (c === 'ATSH0') { state.header = ''; return 'OK\r>'; }
  // Set header: ATSH <hex>
  if (c.startsWith('ATSH')) {
    const h = c.slice(4).replace(/\s/g, '');
    if (/^[0-9A-F]+$/.test(h)) { state.header = h.toUpperCase(); return 'OK\r>'; }
    return '?\r>';
  }
  return '';
}

/**
 * Process an OBD request using the loaded vehicle for ECU routing.
 *
 * `reqId` is derived from the current TX header (`ATSH`) for physical
 * addressing, or defaults to functional broadcast (`7DF`) when none is set.
 */
export function processObd(input: string, state: ElmState, vehicle?: Vehicle): string {
  const hex = input.replace(/\s/g, '').toUpperCase();
  const reqId = state.header || '7DF';
  const respId = vehicle ? vehicle.responseIdFor(reqId) : null;
  const payload = vehicle ? vehicle.respondObd(hex, reqId) : null;

  if (payload !== null && payload !== undefined) {
    return formatResponse(payload, respId, state);
  }

  // Fallback responses (when no vehicle is available)
  if (hex === '0100') return formatResponse('41 00 BE 3F A8 13', respId, state);
  if (hex === '010C') return formatResponse('41 0C 0F A0', respId, state);
  if (hex === '03') return formatResponse('43 01 33 00 00 00', respId, state);
  if (hex === '04') return formatResponse('44', respId, state);
  if (hex === '0902') return formatResponse('49 02 01 31 47 31 4A 43 35 34 34 34 52 37 32 35 32 33 36 37', respId, state);
  return formatResponse('NO DATA', respId, state);
}
