# Feature Matrix

| Capability | Status |
|---|---|
| AT commands (`Z`, `I`, `E`, `L`, `S`, `H`, `P`, `R`, `DP`, `SP`, `PP`, `SH`, `VR`) | Implemented |
| Echo / linefeed / spaces / headers modifiers | Implemented |
| OBD-II Mode 01 PIDs (0100, 0104, 0105, 010C, 010D, 010B, 010F, 0111, 011F, 012F, 0100 frozen) | Implemented |
| OBD-II Mode 02 freeze-frame | Partial (configured via scenario `0902`) |
| OBD-II Mode 03 DTCs | Implemented |
| OBD-II Mode 04 clear DTCs | Implemented |
| OBD-II Mode 07 pending DTCs | Implemented |
| OBD-II Mode 09 VIN | Implemented |
| ISO-TP segmentation / reassembly (FF/CF, EFR) | Implemented |
| ISO-TP server flow control | Implemented |
| UDS services (0x10, 0x11, 0x22, 0x27, 0x3E, 0x14) | Implemented |
| KWP2000 Start/Stop | Partial |
| TCP transport | Implemented |
| Serial/PTY transport | Implemented |
| SLCAN transport | Implemented |
| K-Line transport | Minimal implementation |
| Interactive console | Implemented |
| Structured logging (pino) | Implemented |
| Property-based tests (fast-check) | Not implemented |
| GitHub Actions CI | Not implemented |
