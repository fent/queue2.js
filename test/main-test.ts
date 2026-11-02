import assert from 'node:assert';
import Q from '../src';

const { Queue } = Q;

// Shuffles an array.
const shuffle = <T>(arr: T[]): void => {
  let i = arr.length;
  let j: number;
  let tmp: T;
  if (i === 0) return;
  while (--i) {
    j = Math.floor(Math.random() * (i + 1));
    tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
};

// Calls pushed callbacks in random order once they are all pushed.
class RandomCall {
  private callbacks: (() => void)[];
  private batchSize?: number;
  private list: string[];
  private callCount: number;

  constructor(batchSize: number | undefined, list: string[]) {
    this.callbacks = [];
    this.batchSize = batchSize;
    this.list = list;
    this.callCount = 0;
  }

  push(callback: () => void): void {
    this.callbacks.push(callback);
    this.callCount++;
    if (
      (this.batchSize !== undefined && this.callCount % this.batchSize === 0) ||
      this.callCount === this.list.length
    ) {
      shuffle(this.callbacks);

      while (this.callbacks.length > 0) {
        const cb = this.callbacks.shift();
        cb?.();
      }
    }
  }
}

// Macro.
const createQ = (concurrency?: number, inject?: number, amount?: number) => {
  const list = ['a', 'b', 'c'];
  const random1 = new RandomCall(concurrency, list);
  const random2 = new RandomCall(concurrency, list);

  return (done: (err?: unknown) => void) => {
    let callIndex = 0;
    const q = new Queue(
      function worker1(
        this: Q.Worker1Context,
        data: string,
        callback: (err: null, res: string) => void,
      ) {
        random1.push(() => {
          // Check for inject.
          if (
            typeof inject === 'number' &&
            inject === this.num &&
            !this.injected
          ) {
            const count = amount || 1;
            const arr = new Array(count);
            for (let i = 0; i < count; i++) {
              arr[i] = `injected${i}`;
            }

            list.splice(inject, 1, ...arr);
            this.inject(arr);
            return;
          }

          callback(null, data);
        });
      },
      (data: string, callback: () => void) => {
        if (!data) {
          return callback();
        }
        assert.equal(data, list[callIndex]);

        if (++callIndex === list.length) {
          done();
        }
        random2.push(callback);
      },
      concurrency || 250,
    );

    list.forEach((a) => {
      q.push(a);
    });
  };
};

describe('Queue jobs', () => {
  it('Calls methods in the order they were pushed', createQ());

  describe('with small concurrency', () => {
    it('Calls methods in correct order', createQ(2));
  });

  describe('with 1 concurrency', () => {
    it('Calls methods in correct order', createQ(1));
  });

  describe('and inject', () => {
    describe('one job', () => {
      describe('in the beginning', () => {
        it('Calls methods in correct order', createQ(200, 0));
      });

      describe('in the middle', () => {
        it('Calls methods in correct order', createQ(200, 1));
      });

      describe('in the end', () => {
        it('Calls methods in correct order', createQ(200, 2));
      });
    });

    describe('several jobs', () => {
      describe('in the beginning', () => {
        it('Calls methods in correct order', createQ(200, 0, 3));
      });

      describe('in the middle', () => {
        it('Calls methods in correct order', createQ(200, 1, 3));
      });

      describe('in the end', () => {
        it('Calls methods in correct order', createQ(200, 2, 3));
      });

      describe('with low concurrency', () => {
        it('Calls methods in correct order', createQ(2, 2, 3));
      });
    });
  });

  describe('Push without all arguments', () => {
    it('Worker gets called with `undefined` arguments', (done) => {
      let worker1a: unknown = null;
      let worker2a: unknown = null;
      const q = new Q(
        (a: unknown, callback: () => void) => {
          worker1a = a;
          process.nextTick(callback);
        },
        (a: unknown, callback: () => void) => {
          worker2a = a;
          process.nextTick(callback);
        },
      );
      q.on('drain', () => {
        assert.equal(worker1a, undefined);
        assert.equal(worker2a, undefined);
        done();
      });
      q.push();
    });
  });
});

describe('Kill a queue mid task', () => {
  it('Survives', (done) => {
    const q = new Q(
      () => {
        process.nextTick(() => {
          q.die();

          // `done` shouldn't be called twice.
          done();
        });
      },
      () => {},
      1,
    );
    q.push();
    q.push();
    q.push();
  });
});

describe('Module exports interop', () => {
  it('exports Queue2, Queue, default, and Q aliases', () => {
    assert.strictEqual(typeof Q, 'function');
    assert.strictEqual(typeof Queue, 'function');
    assert.strictEqual(Q, Queue);
    assert.strictEqual((Q as unknown as Record<string, unknown>).default, Q);
    assert.strictEqual((Q as unknown as Record<string, unknown>).Queue2, Q);
    assert.strictEqual((Q as unknown as Record<string, unknown>).Queue, Q);
    assert.strictEqual((Q as unknown as Record<string, unknown>).Q, Q);
  });
});

describe('Generics typing', () => {
  it('supports strongly typed workers and push arguments', (done) => {
    const q = new Q(
      function (
        this: Q.Worker1Context,
        item: string,
        multiplier: number,
        callback: (err: null, result: number) => void,
      ) {
        callback(null, item.length * multiplier);
      },
      (result: number, callback: () => void) => {
        assert.strictEqual(result, 15);
        callback();
      },
    );

    q.push('hello', 3, (err, result) => {
      assert.ifError(err);
      assert.strictEqual(result, 15);
      done();
    });
  });
});
