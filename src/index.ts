import { EventEmitter } from 'node:events';

const padArgs = (args: unknown[], targetLength: number): void => {
  while (args.length < targetLength) {
    args.push(undefined);
  }
};

class Queue2<
  TArgs extends readonly unknown[] = unknown[],
  TResults extends readonly unknown[] = unknown[],
> extends EventEmitter {
  static Queue2 = Queue2;
  static Queue = Queue2;
  static default = Queue2;
  static Q = Queue2;

  public worker1: (
    this: Queue2.Worker1Context,
    ...args: [...TArgs, Queue2.Worker1Callback]
  ) => unknown;
  public worker2: (...args: [...TResults, Queue2.Worker2Callback]) => unknown;
  public concurrency: number | undefined;
  public queue: Queue2.Task[];
  public running1: Queue2.Task[];
  public running2: Queue2.Task[];
  public active: number;
  private _num: number;
  private _current: number;

  /**
   * @param concurrency Number of parallel workers.
   */
  constructor(
    worker1: (
      this: Queue2.Worker1Context,
      ...args: [...TArgs, Queue2.Worker1Callback]
    ) => unknown,
    worker2: (...args: [...TResults, Queue2.Worker2Callback]) => unknown,
    concurrency?: number,
  ) {
    super();

    this.worker1 = worker1;
    this.worker2 = worker2;
    this.concurrency = concurrency;
    this.queue = [];
    this.running1 = [];
    this.running2 = [];
    this.active = 0;
    this._num = 0;
    this._current = 0;
  }

  /**
   * Add new task to queue.
   */
  push(...args: [...TArgs, Queue2.TaskCallback<TResults>?]): void;
  push(...args: [...Partial<TArgs>]): void;
  push(...args: unknown[]): void {
    this.queue.push({
      num: this._num++,
      injected: false,
      args,
    });
    this._next1();
  }

  /**
   * Adds a task in place of another running task.
   */
  private _inject(list: unknown[], num: number): void {
    const len = list.length;
    const shiftDelta = len - 1;
    this.active--;

    // Edit order of items in queue and running.
    if (shiftDelta > 0) {
      this._offsetAllTaskNums(num, shiftDelta);
    }

    // Inject items to the beginning of queue with custom priority.
    for (let i = len - 1; i >= 0; i--) {
      const args = list[i];
      this.queue.unshift({ num: num + i, args: [args], injected: true });
    }
    for (let i = 0; i < len; i++) {
      this._next1();
    }
  }

  /**
   * Offsets `num` of all lists by given amount.
   */
  private _offsetAllTaskNums(num: number, amount: number): void {
    this._offsetTaskNums('queue', num, amount);
    this._offsetTaskNums('running1', num, amount);
    this._offsetTaskNums('running2', num, amount);
  }

  /**
   * Offsets `num` in tasks by given amount.
   */
  private _offsetTaskNums(
    listName: 'queue' | 'running1' | 'running2',
    num: number,
    amount: number,
  ): void {
    for (let i = 0, len = this[listName].length; i < len; i++) {
      const task = this[listName][i];
      if (task.num > num) task.num += amount;
    }
  }

  /**
   * Decrements active count, triggers next queue task, and emits drain when empty.
   */
  private _taskDone(): void {
    this.active--;
    this._next1();
    if (this.active === 0) {
      this.emit('drain');
    }
  }

  /**
   * Processes tasks in queue if it can.
   */
  private _next1(): void {
    if (this.concurrency !== undefined && this.active >= this.concurrency) {
      return;
    }

    const task = this.queue.shift();
    if (!task) {
      this.emit('empty');
      return;
    }

    this.running1.push(task);
    this.active++;
    if (this.concurrency !== undefined && this.active === this.concurrency) {
      this.emit('full');
    }

    const context: Queue2.Worker1Context = {
      num: task.num,
      injected: task.injected,
      inject: (list: unknown[]) => {
        this._inject(list, task.num);
      },
    };

    const args = task.args;
    const callback = args.splice(this.worker1.length - 1, 1)[0] as
      | Queue2.TaskCallback
      | undefined;

    // Add missing arguments.
    padArgs(args, this.worker1.length - 1);

    // Add custom callback to args.
    args.push((err: Error | null | undefined, ...results: unknown[]) => {
      this.running1.splice(this.running1.indexOf(task), 1);
      const hasCallback = typeof callback === 'function';

      if (err) {
        this._offsetAllTaskNums(task.num, -1);
        if (hasCallback) {
          callback(err);
        } else {
          this.emit('error', err);
        }
        this._next2();
        this._taskDone();
        return;
      }

      this.running2.push({
        num: task.num,
        injected: false,
        callback: hasCallback ? callback : undefined,
        args: results,
      });
      this._next2();
    });
    (this.worker1 as Queue2.AnyWorker1).apply(context, args);
  }

  /**
   * Looks for the next task in the second queue to run.
   */
  private _next2(): void {
    for (let i = 0, len = this.running2.length; i < len; i++) {
      const task = this.running2[i];
      if (task.num === this._current) {
        this._current++;
        this.running2.splice(i, 1);
        this._run(task);
        this._next2();
        break;
      }
    }
  }

  /**
   * Runs a task through the second worker.
   */
  private _run(task: Queue2.Task): void {
    // Add missing arguments.
    padArgs(task.args, this.worker2.length - 1);

    // Add callback for worker2
    task.args.push((err?: Error | null) => {
      if (typeof task.callback === 'function') {
        task.callback(err, ...task.args);
      } else if (err) {
        this.emit('error', err);
      }
      this._taskDone();
    });
    (this.worker2 as Queue2.AnyWorker2)(...task.args);
  }

  /**
   * Kills the queue.
   */
  die(): void {
    this.active = 0;
    this._num = 0;
    this._current = 0;
    this.queue = [];
    this.running1 = [];
    this.running2 = [];
  }
}

namespace Queue2 {
  export type AnyWorker1 = (
    this: Worker1Context,
    ...args: unknown[]
  ) => unknown;

  export type AnyWorker2 = (...args: unknown[]) => unknown;

  export type Worker1Callback<TResults extends readonly unknown[] = unknown[]> =
    (err?: Error | null, ...results: TResults) => void;

  export type Worker2Callback = (err?: Error | null) => void;

  export type TaskCallback<TResults extends readonly unknown[] = unknown[]> = (
    err?: Error | null,
    ...results: TResults
  ) => void;

  export interface Task {
    num: number;
    injected: boolean;
    args: unknown[];
    callback?: TaskCallback | undefined;
  }

  export interface Worker1Context {
    num: number;
    injected: boolean;
    inject: (list: unknown[]) => void;
  }

  export type Worker1<
    TArgs extends readonly unknown[] = unknown[],
    TResults extends readonly unknown[] = unknown[],
  > = (
    this: Worker1Context,
    ...args: [...TArgs, Worker1Callback<TResults>]
  ) => unknown;

  export type Worker2<TResults extends readonly unknown[] = unknown[]> = (
    ...args: [...TResults, Worker2Callback]
  ) => unknown;

  export type Queue<
    TArgs extends readonly unknown[] = unknown[],
    TResults extends readonly unknown[] = unknown[],
  > = Queue2<TArgs, TResults>;

  export type Q<
    TArgs extends readonly unknown[] = unknown[],
    TResults extends readonly unknown[] = unknown[],
  > = Queue2<TArgs, TResults>;
}

// Statically recognizable exports for Node.js cjs-module-lexer (ESM named import support)
module.exports = Queue2;
module.exports.default = Queue2;
module.exports.Queue2 = Queue2;
module.exports.Queue = Queue2;
module.exports.Q = Queue2;

export = Queue2;
