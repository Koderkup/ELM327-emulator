/**
 * Response helper functions and utilities.
 * Ported from elm/obd_message.py helper functions.
 */

// ── XML tag helpers ──────────────────────────────────────────────

/** Size tag. e.g. SZ('06') → '<size>06</size>' */
export function SZ(size: string): string {
    return '<size>' + size + '</size>';
}

/** Header tag. e.g. HD('7E8') → '<header>7E8</header>' */
export function HD(header: string): string {
    return '<header>' + header + '</header>';
}

/** Data tag. e.g. DT('41 00 BE 3F') → '<data>41 00 BE 3F</data>' */
export function DT(data: string): string {
    return '<data>' + data + '</data>';
}

/** Writeln tag (adds line separator). */
export function ST(writeln: string): string {
    return '<writeln>' + writeln + '</writeln>';
}

/** Answer tag. */
export function AW(answer: string): string {
    return '<answer>' + answer + '</answer>';
}

/** Positive answer tag. */
export function PA(posAnswer: string): string {
    return '<pos_answer>' + posAnswer + '</pos_answer>';
}

/** Negative answer tag. */
export function NA(negAnswer: string): string {
    return '<neg_answer>' + negAnswer + '</neg_answer>';
}

/** Space tag (adds space, no newline). */
export function SP(content: string): string {
    return '<space>' + content + '</space>';
}

/** Raw string tag (no separator). */
export function STR(content: string): string {
    return '<string>' + content + '</string>';
}

// ── ISO-TP frame builder ─────────────────────────────────────────
// Ported from elm/obd_message.py iso_tp_frames()

/**
 * Frame a payload into ISO-TP (ISO 15765-2) single or multiple CAN frames.
 * @param data  list of hexadecimal data bytes (e.g. ['43', '01', '43'])
 * @param header response header (CAN identifier)
 * @returns response string including <header>, <size> and <data> tags
 */
export function iso_tp_frames(
    data: string[],
    header: string = '7E8'
): string {
    const length = data.length;
    if (length <= 7) {
        const sizeByte = length.toString(16).toUpperCase().padStart(2, '0');
        const frameData = data.join(' ');
        return HD(header) + SZ(sizeByte) + DT(frameData);
    }

    // Multi-frame: First Frame (FF) + Consecutive Frames (CF)
    const totalLen = length.toString(16).toUpperCase().padStart(4, '0');
    const ffData = data.slice(0, 6).join(' ');
    let result = HD(header) + SZ(totalLen) + DT('10 ' + totalLen.substring(0, 2) + ' ' + ffData);

    let remaining = data.slice(6);
    let seqNum = 1;
    while (remaining.length > 0) {
        const chunk = remaining.slice(0, 7);
        remaining = remaining.slice(7);
        const frame = [seqNum.toString(16).toUpperCase()];
        frame.push(...chunk);
        result += '\n' + HD(header) + SZ(chunk.length.toString(16).toUpperCase().padStart(2, '0')) + DT(frame.join(' '));
        seqNum = (seqNum + 1) & 0x0F;
        if (seqNum === 0) seqNum = 1;
    }
    return result;
}

// ── Supported PIDs bitmap ────────────────────────────────────────

/**
 * Compute the "supported PIDs" bitmap for a given OBD mode.
 * Ported from elm/obd_message.py supported_pids_bitmap().
 *
 * @param self emulator instance (for accessing sortedOBDMsg)
 * @param mode the OBD mode as hex string (e.g. '01', '09')
 * @returns hex bitmap string, e.g. "BE 3F A8 13"
 */
export function supported_pids_bitmap(self: any, mode: string): string {
    const pids: string[] = [];
    const pattern = new RegExp(`^${mode}`, 'i');
    const sorted = (self as any).sortedOBDMsg || {};
    for (const [key, entry] of Object.entries(sorted)) {
        const req = (entry as any)?.Request || '';
        if (req && pattern.test(req)) {
            const match = req.match(new RegExp(`\\^${mode}(\\w{2})`, 'i'));
            if (match && match[1]) {
                const pidByte = match[1].toUpperCase();
                if (!pids.includes(pidByte)) {
                    pids.push(pidByte);
                }
            }
        }
    }
    if (pids.length === 0) return '00 00 00 00';

    const bytes = [0, 0, 0, 0];
    for (const pid of pids) {
        const pidNum = parseInt(pid, 16);
        if (pidNum >= 1 && pidNum <= 32) {
            bytes[(pidNum - 1) >> 3] |= 1 << (7 - ((pidNum - 1) & 7));
        }
    }
    return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

// ── Misc helpers ─────────────────────────────────────────────────

/**
 * Choice: pick from available answers (deterministic by default).
 * In Python, emulator uses `random.choices`. Here we default to first item.
 */
export function choice<T>(arr: T[]): T {
    if (arr.length === 0) throw new Error('choice() called on empty array');
    return arr[0];
}

/**
 * Normalize a hex request: uppercase, strip whitespace.
 * e.g. "41 0c" → "410C"
 */
export function normalize_cmd(cmd: string): string {
    return cmd.replace(/\s+/g, '').toUpperCase();
}

/**
 * Convert a hex string to array of byte strings.
 * e.g. "410C" → ["41", "0C"]
 */
export function hex_to_bytes(hex: string): string[] {
    const clean = hex.replace(/\s+/g, '');
    const bytes: string[] = [];
    for (let i = 0; i < clean.length; i += 2) {
        bytes.push(clean.substring(i, i + 2));
    }
    return bytes;
}

/**
 * Convert array of byte strings to hex string.
 * e.g. ["41", "0C"] → "410C"
 */
export function bytes_to_hex(bytes: string[]): string {
    return bytes.join('');
}

/**
 * Convert byte array to hex display string with spaces.
 * e.g. [0x41, 0x0C] → "41 0C"
 */
export function bytes_to_display(data: number[]): string {
    return data.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}



