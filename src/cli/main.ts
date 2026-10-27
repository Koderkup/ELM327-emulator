import { Command } from 'commander';
import { TcpTransport } from '../transport/tcp.js';
import { SerialTransport } from '../transport/serial.js';
import { BluetoothTransport } from '../transport/bluetooth.js';
import { SlcanTransport } from '../transport/slcan.js';
import { KLineTransport } from '../transport/kline.js';
import { runSession } from '../core/elm.js';
import type { Transport } from '../transport/transport.js';
import { loadScenario } from '../vehicle/scenario.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { fileURLToPath } from 'node:url';
import { logger, setLogLevel } from '../logging/logger.js';

const program = new Command();
program.name('elm').version('0.1.0').description('ELM327 emulator');
program.option('-t, --transport <type>', 'transport', 'tcp');
program.option('-H, --host <host>', 'host', '127.0.0.1');
program.option('-p, --port <port>', 'port', '35000');
program.option('-d, --device <path>', 'serial device', '/dev/pts/1');
program.option('-b, --baud <n>', 'baud', '38400');
program.option('-k, --kline', 'use K-Line serial transport', false);
program.option('-s, --scenario <name>', 'scenario', 'default');
program.option('-l, --log-level <level>', 'log level (fatal|error|warn|info|debug|trace)', 'info');

program.action(async (opts) => {
  setLogLevel((opts.logLevel ?? opts.log_level) as any);

  let transport: Transport;
  if (opts.transport === 'serial') transport = new SerialTransport(opts.device, Number(opts.baud));
  else if (opts.transport === 'bluetooth') transport = new BluetoothTransport(Number(opts.channel ?? 1));
  else if (opts.transport === 'kline') transport = new KLineTransport(opts.device, Number(opts.baud));
  else if (opts.transport === 'slcan') transport = new SlcanTransport(opts.device, Number(opts.baud));
  else transport = new TcpTransport(opts.host, Number(opts.port));

  const scenarioPath = fileURLToPath(new URL(`../../../scenarios/${opts.scenario}.yaml`, import.meta.url));
  const scenario = loadScenario(scenarioPath);
  const vehicle = new Vehicle(scenario);

  await transport.open();
  logger.info(`ELM327 emulator started (${opts.transport}) — scenario: ${vehicle.scenario.name}`);

  const ac = new AbortController();
  process.on('SIGINT', () => { logger.info('shutdown'); ac.abort(); });
  await runSession(transport, vehicle, ac.signal);
  await transport.close();
  process.exit(0);
});

program.parseAsync().catch((e) => { logger.error(e); process.exit(1); });
