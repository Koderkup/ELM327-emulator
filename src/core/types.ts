/**
 * Core type definitions for the ELM327 emulator.
 * Ported from elm/elm.py and elm/obd_message.py.
 */

// ── ECU addresses ────────────────────────────────────────────────

export interface EcuAddress {
    name: string;
    addr: string;       // Request address  (e.g. "7E0")
    rAddr: string;      // Response address (e.g. "7E8")
}

export const ECU_ADDRESSES: Record<string, EcuAddress> = {
    J: { name: 'J',  addr: '747', rAddr: '74F' },
    K: { name: 'K',  addr: '7D2', rAddr: '7DA' },
    H: { name: 'H',  addr: '7E2', rAddr: '7EA' }, // HVECU (Hybrid)
    E: { name: 'E',  addr: '7E0', rAddr: '7E8' }, // Engine / ECM
    T: { name: 'T',  addr: '7E1', rAddr: '7E9' }, // Transmission / TCM
    I: { name: 'I',  addr: '7C0', rAddr: '7C8' }, // ICE ECU
    B: { name: 'B',  addr: '7E3', rAddr: '7EB' }, // Traction Battery
    P: { name: 'P',  addr: '7C4', rAddr: '7CC' }, // Air Conditioning
    S: { name: 'S',  addr: '7B0', rAddr: '7B8' }, // Skid Control
};

// Individual exported constants for backward-compatible lookups
export const ECU_ADDR_J = '747';
export const ECU_R_ADDR_J = '74F';
export const ECU_ADDR_K = '7D2';
export const ECU_R_ADDR_K = '7DA';
export const ECU_ADDR_H = '7E2';
export const ECU_R_ADDR_H = '7EA';
export const ECU_ADDR_E = '7E0';
export const ECU_R_ADDR_E = '7E8';
export const ECU_ADDR_T = '7E1';
export const ECU_R_ADDR_T = '7E9';
export const ECU_ADDR_I = '7C0';
export const ECU_R_ADDR_I = '7C8';
export const ECU_ADDR_B = '7E3';
export const ECU_R_ADDR_B = '7EB';
export const ECU_ADDR_P = '7C4';
export const ECU_R_ADDR_P = '7CC';

// ── ELM constants ────────────────────────────────────────────────

export const ELM_VERSION = 'ELM327 v1.5';
export const ELM_HEADER_VERSION = '\r\r';
export const ELM_R_OK = 'OK\r';
export const ELM_R_UNKNOWN = '?\r';
export const ELM_VALID_CHARS = /^[a-zA-Z0-9 \n\r\b\t@,.?]*$/;

// Regex footer constants (ported from obd_message.py)
export const ELM_FOOTER = '[0123456]?$';
export const ELM_DATA_FOOTER = '([0-9A-Z][0-9A-Z])+$';

// DTC-related constants
export const DTC_STORED: string[] = [];
export const DTC_PENDING: string[] = [];
export const DTC_PERMANENT: string[] = [];

export const FUNCTIONAL_ADDR = ['7DF', '18DB33F1'];

// ── Thread state ─────────────────────────────────────────────────
export enum THREAD {
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    STOPPED = 'STOPPED',
    TERMINATED = 'TERMINATED',
}

// ── Task return values ───────────────────────────────────────────
export enum RETURN {
    CONTINUE = 'CONTINUE',
    TERMINATE = 'TERMINATE',
    ANSWER = 'ANSWER',
    ERROR = 'ERROR',
    TASK_CONTINUE = 'TASK_CONTINUE',
}

// ── DTCs (Diagnostic Trouble Codes) ──────────────────────────────
export interface DtcLists {
    stored: string[];
    pending: string[];
    permanent: string[];
}

export const DEFAULT_DTC: DtcLists = {
    stored: [],
    pending: [],
    permanent: [],
};

// Positive answer service IDs for DTC modes
export const DTC_SID: Record<string, string> = {
    '03': '43',
    '07': '47',
    '0A': '4A',
};


// ── SLCAN constants ──────────────────────────────────────────────
export const SLCAN_BAUDRATE = 115200;
export const SLCAN_VERSION = '1013';
export const SLCAN_SERIAL_NUMBER = '12345';
export const SLCAN_DEFAULT_BITRATE = 'S6';
export const SLCAN_FC_TIMEOUT = 0.5;
export const SLCAN_MAX_DLC = 8;

// ── K-Line constants ─────────────────────────────────────────────
export const KLINE_BAUDRATE = 10400;
export const KLINE_SYNC_RESPONSE = [0x55, 0x08, 0x08];
export const KLINE_IDLE_TIMEOUT = 0.02;
export const KLINE_TESTER_ADDR = 0xF1;
export const KLINE_RESPONSE_TIMEOUT = 1.0;

// ── Configuration constants ───────────────────────────────────────
export const FORWARD_READ_TIMEOUT = 0.2; // seconds
export const SERIAL_BAUDRATE = 38400;
export const NETWORK_INTERFACE = '127.0.0.1';
export const MAX_TASKS = 20;
export const MIN_SIZE_UDS_LENGTH = 20;

// ── Task plugin system ───────────────────────────────────────────
export const ECU_TASK_PREFIX = 'task_ecu_';
export const DEFAULT_ECU_TASK = 'Default ECU Task module';

// ── Preserved counters (ELM settings) ───────────────────────────
export interface ElmCounters {
    [key: string]: string | number | boolean | null | undefined;
}

// ── Emulator configuration ───────────────────────────────────────
export interface EmulatorConfig {
    serialPort?: string;
    devicePort?: string;
    baudrate?: number;
    netPort?: number;
    netInterface?: string;
    bluetoothName?: string;
    bluetoothChannel?: number;
    slcanPort?: string;
    klinePort?: string;
    scenario?: string;
    noEcho?: boolean;
    newline?: boolean;
    logLevel?: string;
    logFile?: string;
    forwardHost?: string;
    forwardPort?: number;
    forwardSerial?: string;
    forwardBaud?: number;
    forwardTimeout?: number;
    batchFile?: string;
    daemon?: boolean;
    terminate?: boolean;
}

// ── Transport interface ──────────────────────────────────────────
export interface Transport {
    open(): Promise<void>;
    close(): Promise<void>;
    readLine(): Promise<string | null>;
    write(data: string | Buffer): Promise<void>;
    getPortName(extended?: boolean): string;
    on(event: 'data', cb: (data: Buffer) => void): void;
    on(event: 'close', cb: () => void): void;
}

// ── ObdMessage dictionary entry ──────────────────────────────────
// Ported from elm/obd_message.py dictionary structure.

export type XmlTagHandler = (
    ctx: ResponseContext
) => string;

export interface ResponseContext {
    self: any;            // The emulator instance (Elm)
    cmd: string;          // The request (hex, unspaced, uppercase)
    pid: string;          // The PID name/key
    ucVal: string | null; // Upper-case value
}

export interface ObdMessageEntry {
    Request: string;
    Descr: string;
    Response?: string;
    ResponseHeader?: XmlTagHandler | string;
    ResponseFooter?: XmlTagHandler | string;
    ExecFn?: XmlTagHandler;            // TS callback replacing Python Exec
    ExecFnAsync?: (ctx: ResponseContext) => Promise<void>;
    Log?: string[];
    Priority?: number;
    PosAnswer?: string;
    NegAnswer?: string;
    Answer?: string;
}

export type ObdMessageDict = Record<string, ObdMessageEntry>;

export interface ObdMessageScenarios {
    AT: ObdMessageDict;
    default: ObdMessageDict;
    car: ObdMessageDict;
    engineoff: ObdMessageDict;
    [scenario: string]: ObdMessageDict;
}

// ── Task plugin context ──────────────────────────────────────────
export interface TaskContext {
    emulator: any;
    pid: string | null;
    header: string | null;
    ecu: string | null;
    request: string;
    attrib: string | null;
    doWrite: boolean;
}

