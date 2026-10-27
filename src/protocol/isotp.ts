export function segment(payload: Uint8Array, _blockSize = 8): Uint8Array[] {
  const frames: Uint8Array[] = [];
  if (payload.length <= 7) {
    const f = new Uint8Array(1 + payload.length);
    f[0] = payload.length;
    f.set(payload, 1);
    frames.push(f);
    return frames;
  }
  // first frame
  const ff = new Uint8Array(2 + Math.min(6, payload.length));
  const total = payload.length;
  ff[0] = 0x10 | ((total >> 8) & 0x0f);
  ff[1] = total & 0xff;
  ff.set(payload.slice(0, 6), 2);
  frames.push(ff);
  let offset = 6;
  let seq = 1;
  while (offset < total) {
    const chunk = payload.slice(offset, offset + 7);
    const cf = new Uint8Array(1 + chunk.length);
    cf[0] = 0x20 | (seq & 0x0f);
    cf.set(chunk, 1);
    frames.push(cf);
    offset += 7;
    seq = (seq + 1) & 0x0f;
  }
  return frames;
}

export function reassemble(frames: Uint8Array[]): Uint8Array | null {
  if (frames.length === 0) return null;
  const first = frames[0];
  if ((first[0] & 0xf0) === 0x00) {
    const len = first[0];
    return first.slice(1, 1 + len);
  }
  if ((first[0] & 0xf0) !== 0x10) return null;
  const total = ((first[0] & 0x0f) << 8) | first[1];
  const out: number[] = [];
  out.push(...first.slice(2));
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i];
    if ((f[0] & 0xf0) !== 0x20) return null;
    out.push(...f.slice(1));
  }
  return new Uint8Array(out.slice(0, total));
}
