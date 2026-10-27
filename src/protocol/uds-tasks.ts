export type TaskState = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskContext {
  /** Task identifier (e.g. "security-access", "routine-control"). */
  readonly id: string;
  /** Current lifecycle state. */
  state: TaskState;
  /** Elapsed milliseconds since start. */
  elapsed: number;
  /** Optional error message when state === 'failed'. */
  error?: string;
}

export interface TaskHandler<T extends TaskContext = TaskContext> {
  /** Unique task id. */
  readonly id: string;
  /** Initialize the task. Return false to reject start. */
  init?(ctx: T): boolean | Promise<boolean>;
  /** Process one diagnostic request step. Return response bytes or null. */
  handle?(req: Uint8Array, ctx: T): Uint8Array | null | Promise<Uint8Array | null>;
  /** Called when task should be cancelled/timed out. */
  cancel?(ctx: T): void;
  /** Cleanup after completion/failure. */
  cleanup?(ctx: T): void;
}

/** Registry of stateful diagnostic tasks. */
export class TaskRegistry {
  private tasks = new Map<string, TaskHandler>();
  private active = new Map<string, TaskContext>();

  register(handler: TaskHandler): void {
    this.tasks.set(handler.id, handler);
  }

  unregister(id: string): void {
    this.tasks.delete(id);
    this.active.delete(id);
  }

  start(id: string, ctx: Partial<TaskContext>): TaskContext | undefined {
    const handler = this.tasks.get(id);
    if (!handler) return undefined;
    const fullCtx: TaskContext = { id, state: 'idle', elapsed: 0, ...ctx } as TaskContext;
    if (handler.init && !handler.init(fullCtx)) return undefined;
    fullCtx.state = 'running';
    this.active.set(id, fullCtx);
    return fullCtx;
  }

  get(id: string): TaskContext | undefined {
    return this.active.get(id);
  }

  has(id: string): boolean {
    return this.active.has(id);
  }

  async handle(id: string, req: Uint8Array): Promise<Uint8Array | null> {
    const ctx = this.active.get(id);
    const handler = this.tasks.get(id);
    if (!ctx || !handler || !handler.handle) return null;
    return handler.handle(req, ctx);
  }

  cancel(id: string): void {
    const ctx = this.active.get(id);
    const handler = this.tasks.get(id);
    if (!ctx || !handler) return;
    handler.cancel?.(ctx);
    ctx.state = 'cancelled';
    this.active.delete(id);
    handler.cleanup?.(ctx);
  }

  complete(id: string): void {
    const ctx = this.active.get(id);
    const handler = this.tasks.get(id);
    if (!ctx || !handler) return;
    ctx.state = 'completed';
    this.active.delete(id);
    handler.cleanup?.(ctx);
  }

  fail(id: string, error: string): void {
    const ctx = this.active.get(id);
    const handler = this.tasks.get(id);
    if (!ctx) return;
    ctx.state = 'failed';
    ctx.error = error;
    this.active.delete(id);
    handler?.cleanup?.(ctx);
  }

  /** Cancel all active tasks (e.g. on shutdown). */
  cancelAll(): void {
    for (const id of [...this.active.keys()]) this.cancel(id);
  }

  /** Number of currently active tasks. */
  size(): number {
    return this.active.size;
  }
}

export const defaultTaskRegistry = new TaskRegistry();
