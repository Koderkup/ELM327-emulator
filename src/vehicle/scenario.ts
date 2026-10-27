import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Ecu } from '../ecu/ecu.js';

export interface Scenario {
  name: string;
  vin?: string;
  ecus?: Ecu[];
  pids?: Record<string, string>;   // legacy flat PID map (fallback)
}

export function validateScenario(obj: unknown): Scenario {
  if (!obj || typeof obj !== 'object') throw new Error('invalid scenario: not an object');
  const s = obj as Record<string, unknown>;
  if (typeof s.name !== 'string') throw new Error('invalid scenario: missing name');
  const ecus = Array.isArray(s.ecus) ? (s.ecus as Ecu[]) : undefined;
  if (ecus) {
    for (const e of ecus) {
      if (typeof e.name !== 'string' || typeof e.addr !== 'string' || typeof e.rAddr !== 'string') {
        throw new Error(`invalid scenario: ECU ${String(e.name)} missing required address fields`);
      }
      if (!e.pids || typeof e.pids !== 'object') {
        throw new Error(`invalid scenario: ECU ${e.name} missing pids`);
      }
    }
  }
  return obj as Scenario;
}

export function loadScenario(path: string): Scenario {
  const raw = readFileSync(path, 'utf8');
  const obj = path.endsWith('.yaml') || path.endsWith('.yml') ? parse(raw) : JSON.parse(raw);
  return validateScenario(obj);
}
