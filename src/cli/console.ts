import { createInterface } from 'node:readline/promises';
import { defaultState, buildResponse } from '../core/elm.js';
import { loadScenario } from '../vehicle/scenario.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { fileURLToPath } from 'node:url';
import { logger } from '../logging/logger.js';

export async function runConsole(scenarioName: string = 'default'): Promise<void> {
  const scenarioPath = fileURLToPath(new URL(`../../scenarios/${scenarioName}.yaml`, import.meta.url));
  const scenario = loadScenario(scenarioPath);
  const vehicle = new Vehicle(scenario);
  const state = defaultState();

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  logger.info('ELM327 interactive console -- type AT/OBD commands or quit');

  rl.prompt();
  for await (const line of rl) {
    const cmd = line.trim();
    if (cmd.toLowerCase() === 'quit' || cmd.toLowerCase() === 'exit') break;
    if (!cmd) { rl.prompt(); continue; }

    const out = buildResponse(cmd, state, vehicle);
    if (out) {
      process.stdout.write(out.replace(/\r/g, '\n') + '\n');
    }
    rl.prompt();
  }
  rl.close();
  logger.info('console exited');
}
