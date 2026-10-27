import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';
import { TcpTransport } from '../../src/transport/tcp.js';
import { loadScenario } from '../../src/vehicle/scenario.js';
import { Vehicle } from '../../src/vehicle/vehicle.js';
import { runSession } from '../../src/core/elm.js';
import { fileURLToPath } from 'node:url';

describe('TCP end-to-end ELM session', () => {
  let transport: TcpTransport;
  let vehicle: Vehicle;
  let session: Promise<void>;

  beforeAll(async () => {
    transport = new TcpTransport('127.0.0.1', 0);
    const scenarioPath = fileURLToPath(new URL('../../scenarios/default.yaml', import.meta.url));
    vehicle = new Vehicle(loadScenario(scenarioPath));
    await transport.open();
    // Drive the ELM engine on the server side concurrently.
    session = runSession(transport, vehicle);
  }, 10000);

  it('accepts a TCP connection and answers commands', async () => {
    const port = transport.address()!.port;
    const client = net.connect({ host: '127.0.0.1', port }, () => {});
    const readUntil = (timeoutMs = 1500): Promise<string> =>
      new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => { client.end(); reject(new Error('tcp read timeout')); }, timeoutMs);
        client.on('data', (d) => {
          clearTimeout(t);
          client.removeAllListeners('data');
          resolve(d.toString('latin1'));
        });
        client.on('error', reject);
      });

    client.write('ATI\r');
    const out = await readUntil();
    expect(out).toContain('ELM327');
    expect(out).toContain('OK');

    client.write('ATZ\r');
    const out2 = await readUntil();
    expect(out2).toContain('ELM327');
    expect(out2).toContain('OK');

    client.write('010C\r');
    const out3 = await readUntil();
    expect(out3).toContain('41 0C 0F A0');

    client.write('0100\r');
    const out4 = await readUntil();
    expect(out4).toContain('41 00 BE 3F A8 13');

    client.end();
  }, 10000);

  afterAll(async () => {
    await transport.close();
  }, 10000);
});
