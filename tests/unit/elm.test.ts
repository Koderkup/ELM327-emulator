import { describe, it, expect } from 'vitest';
import { defaultState, processAt, processObd } from '../../src/core/elm.js';
import { defaultEcus, findEcuByRequest, parseAddr, FUNCTIONAL_ADDR } from '../../src/ecu/ecu.js';
import { Vehicle } from '../../src/vehicle/vehicle.js';

describe('elm', () => {
  it('ATZ resets', () => {
    const s = defaultState();
    s.echo = false;
    const r = processAt('ATZ', s);
    expect(r).toContain('ELM327');
    expect(s.echo).toBe(true);
  });

  it('processObd 0100', () => {
    expect(processObd('0100', defaultState())).toContain('41 00');
  });

  it('ATSH sets header then physical routing', () => {
    const s = defaultState();
    processAt('ATH1', s);
    processAt('ATSH 7E1', s);
    expect(s.header).toBe('7E1');
    const vehicle = new Vehicle({ name: 'test', ecus: defaultEcus });
    const out = processObd('0100', s, vehicle);
    // physical addressing to 7E1 -> Trans ECU, response id 7E9
    expect(out).toContain('7E9');
    expect(out).toContain('41 00 80 00 00 00');
  });

  it('headers flag prepends response id', () => {
    const s = defaultState();
    processAt('ATH1', s);
    processAt('ATSH 7E0', s);
    const vehicle = new Vehicle({ name: 'test', ecus: defaultEcus });
    const out = processObd('0100', s, vehicle);
    expect(out.startsWith('7E8 41 00')).toBe(true);
  });

  it('functional broadcast routes to engine', () => {
    const s = defaultState();
    const vehicle = new Vehicle({ name: 'test', ecus: defaultEcus });
    const out = processObd('0100', s, vehicle);
    expect(out).toContain('41 00 BE 3F A8 13');
  });

  it('VIN request returns vehicle VIN', () => {
    const vehicle = new Vehicle({ name: 'test', vin: '5N3AA08D68D123456', ecus: defaultEcus });
    const out = processObd('0902', defaultState(), vehicle);
    expect(out).toContain('4E');  // hex for 'N'
    expect(out).toContain('35');  // hex for '5'
  });

  it('DTB request returns engine DTCs', () => {
    const vehicle = new Vehicle({ name: 'test', ecus: defaultEcus });
    const out = processObd('03', defaultState(), vehicle);
    expect(out).toContain('43');
  });
});

describe('ecu routing', () => {
  it('parseAddr', () => {
    expect(parseAddr('7E0')).toBe(0x7e0);
    expect(parseAddr('7df')).toBe(0x7df);
  });

  it('functional address 7DF returns first ECU', () => {
    const e = findEcuByRequest(defaultEcus, '7DF');
    expect(e?.name).toBe('Engine');
  });

  it('physical address 7E1 returns Trans ECU', () => {
    const e = findEcuByRequest(defaultEcus, '7E1');
    expect(e?.name).toBe('Trans');
    expect(e?.rAddr).toBe('7E9');
  });

  it('unknown physical address returns undefined', () => {
    const e = findEcuByRequest(defaultEcus, '7F0');
    expect(e).toBeUndefined();
  });

  it('FUNCTIONAL_ADDR constant', () => {
    expect(FUNCTIONAL_ADDR).toBe(0x7df);
  });
});

describe('vehicle', () => {
  const vehicle = new Vehicle({ name: 'test', vin: '5N3AA08D68D123456', ecus: defaultEcus });

  it('responseIdFor functional', () => {
    expect(vehicle.responseIdFor()).toBe('7E8');
  });

  it('responseIdFor physical 7E1', () => {
    expect(vehicle.responseIdFor('7E1')).toBe('7E9');
  });

  it('respondObd returns configured PID', () => {
    expect(vehicle.respondObd('010C', '7DF')).toBe('41 0C 0F A0');
  });

  it('respondObd NO DATA for unknown PID', () => {
    expect(vehicle.respondObd('0199', '7DF')).toBeNull();
  });

  it('clearDtcs removes DTCs', () => {
    const v = new Vehicle({ name: 't', ecus: [JSON.parse(JSON.stringify(defaultEcus[0]))] });
    expect(v.ecus[0].dtcs?.length).toBe(1);
    v.clearDtcs();
    expect(v.ecus[0].dtcs?.length).toBe(0);
  });
});

