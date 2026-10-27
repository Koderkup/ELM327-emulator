# ELM327 Emulator (TypeScript-first)

ELM327-совместимый эмулятор диагностических запросов, написанный на TypeScript
с нуля. Имитирует поведение ELM327-адаптера и simulated vehicle:

- AT-команды и OBD-II Mode 01/
- ISO-TP, UDS, KWP2000 для многобайтовых запросов
- TCP, Serial/PTY, SLCAN, K-Line транспорты
- Конфигурируемые сценарии vehicle/ECU в YAML
- CLI, интерактивная консоль, структурированное логирование

## Requirements

- Node.js >= 20
- npm

## Install

```bash
npm ci
```

## CLI

```bash
npm run dev -- -t tcp -H 127.0.0.1 -p 35000 -s default -l debug
npm run dev -- -t serial -d /dev/pts/1 -b 38400
npm run dev -- -t slcan -d /dev/pts/1 -b 500000
npm run dev -- -t kline -d /dev/pts/1 -b 10400
npm run console -- -s default
```

Flags:

- `-t, --transport <type>`: tcp (default), serial, slcan, kline
- `-H, --host <host>`: host for TCP (default 127.0.0.1)
- `-p, --port <port>`: port for TCP (default 35000)
- `-d, --device <path>`: serial/slcan/kline device path
- `-b, --baud <n>`: baud rate (serial SLCAN K-Line)
- `-s, --scenario <name>`: scenario file name (default default)
- `-l, --log-level <level>`: fatal|error|warn|info|debug|trace (default info)

## Interactive console

```bash
npm run console
```

Type `ATZ`, `010C` OBD requests, `quit`/`exit` to exit.

## Tests

```bash
npm run typecheck   # strict type check
npm test            # unit + integration tests
npm run build       # production build
```

## Architecture

- `src/core/elm.ts` — ELM command engine, state machine
- `src/ecu/ecu.ts` — ECU profiles and PID simulation
- `src/vehicle/vehicle.ts` — Vehicle simulation and scenario loading
- `src/protocol/isotp.ts` — ISO-TP segmentation / reassembly (client)
- `src/protocol/isotp-server.ts` — ISO-TP server (FF/CF, processUds)
- `src/protocol/uds.ts` — UDS services (0x10, 0x11, 0x22, 0x27, 0x3E, 0x14)
- `src/protocol/uds-tasks.ts` — Task registry and stateful handlers
- `src/transport/tcp.ts` — TCP transport (node:net)
- `src/transport/serial.ts` — Serial/PTY transport (serialport)
- `src/transport/slcan.ts` — SLCAN ASCII transport
- `src/transport/kline.ts` — K-Line single-wire transport (minimal)
- `src/logging/logger.ts` — Pino structured logging

## Feature matrix

| Capability | Status |
|---|---|
| AT commands | Implemented |
| OBD-II Mode 01 PIDs | Implemented |
| ISO-TP client (FF/CF) | Implemented |
| ISO-TP server flow control | Implemented |
| UDS services | Implemented |
| KWP2000 Start/Stop | Partial |
| TCP transport | Implemented |
| Serial/PTY transport | Implemented |
| SLCAN transport | Implemented |
| K-Line transport | Minimal implementation |
| Interactive console | Implemented |
| Structured logging (pino) | Implemented |
| CI (GitHub Actions) | Implemented |
| Property-based tests (fast-check) | Not implemented |

## Limitations

- Not fully ELM327-compatible yet (command set partial)
- K-Line is minimal; use hardware adapter for production
- UDS security access used simulation (seed/key)
- Native C++ component not implemented (Bluetooth RFCOMM deferred)
