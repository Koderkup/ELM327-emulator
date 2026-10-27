import net from 'node:net';
import type { Transport } from './transport.js';

export class TcpTransport implements Transport {
  private server?: net.Server;
  private socket?: net.Socket;
  constructor(private host = '127.0.0.1', private port = 35000) {}
  async open(): Promise<void> {
    this.server = net.createServer((s) => { this.socket = s; });
    await new Promise<void>((res, rej) => {
      this.server!.listen(this.port, this.host, () => res());
      this.server!.on('error', rej);
    });
  }
  async *read(signal?: AbortSignal): AsyncIterable<Uint8Array> {
    if (!this.socket) {
      await new Promise<void>((res) => this.server!.on('connection', () => res()));
    }
    const sock = this.socket!;
    for await (const chunk of sock) {
      yield new Uint8Array(chunk);
      if (signal?.aborted) break;
    }
  }
  async write(data: Uint8Array): Promise<void> {
    if (!this.socket) return;
    await new Promise<void>((res, rej) => this.socket!.write(Buffer.from(data), (e) => (e ? rej(e) : res())));
  }
  async close(): Promise<void> {
    this.socket?.destroy();
    this.server?.close();
  }
}
