import { describe, it, expect } from 'vitest';
import { loadScenario, validateScenario } from '../../src/vehicle/scenario.js';
import { Vehicle } from '../../src/vehicle/vehicle.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const scenarioPath = fileURLToPath(new URL('../../scenarios/default.yaml', import.meta.url));

describe('scenario loading', () => {
  it('loads and validates default.yaml', () => {
    const scenario = loadScenario(scenarioPath);
    expect(scenario.name).toBe('default');
    expect(scenario.vin).toBe('5N3AA08D68D123456');
    expect(scenario.ecus?.length).toBe(2);
    expect(scenario.ecus?.[0].name).toBe('Engine');
    expect(scenario.ecus?.[1].name).toBe('Transmission');
  });

  it('vehicle built from default scenario routes Engine PID', () => {
    const scenario = loadScenario(scenarioPath);
    const vehicle = new Vehicle(scenario);
    const out = vehicle.respondObd('010C', '7DF');
    expect(out).toBe('41 0C 0F A0');
  });

  it('vehicle built from default scenario routes Trans PID physically', () => {
    const scenario = loadScenario(scenarioPath);
    const vehicle = new Vehicle(scenario);
    expect(vehicle.findEcuById('7E1')?.name).toBe('Transmission');
    const out = vehicle.respondObd('0100', '7E1');
    expect(out).toBe('41 00 80 00 00 00');
  });

  it('rejects invalid scenario missing name', () => {
    expect(() => validateScenario({ ecus: [] })).toThrow('missing name');
  });

  it('can read raw scenario file', () => {
    const raw = readFileSync(scenarioPath, 'utf8');
    expect(raw).toContain('5N3AA08D68D123456');
  });
});
