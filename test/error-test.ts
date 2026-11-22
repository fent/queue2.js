import assert from 'node:assert';
import Q from '../src';

describe('Worker 1 calls callback with error', () => {
  describe('With task callback', () => {
    it('Task callback gets error', (done) => {
      const q = new Q(
        (a: number, callback: (err: Error | null) => void) => {
          setTimeout(() => {
            callback(a === 1 ? new Error('hello') : null);
          });
        },
        (callback: () => void) => {
          callback();
        },
      );
      q.push(1, (err?: Error | null) => {
        assert.ok(err);
        assert.equal(err?.message, 'hello');
        done();
      });
      q.push(2);
      q.on('error', done);
    });
  });

  describe('Without task callback', () => {
    it('Rejects returned promise', async () => {
      const q = new Q(
        (a: number, callback: (err: Error | null) => void) => {
          setTimeout(() => {
            callback(a === 1 ? new Error('foo') : null);
          });
        },
        (callback: () => void) => {
          callback();
        },
      );
      await assert.rejects(() => q.push(1), /foo/);
    });

    it('Emits error for injected task', (done) => {
      const q = new Q(
        function (
          this: Q.Worker1Context,
          a: number,
          callback: (err: Error | null) => void,
        ) {
          if (a === 0) {
            this.inject([1]);
            return;
          }
          setTimeout(() => callback(new Error('injected w1')));
        },
        (callback: () => void) => {
          callback();
        },
      );
      q.on('error', (err: Error) => {
        assert.equal(err.message, 'injected w1');
        done();
      });
      q.push(0);
    });
  });

  describe('Later task finishes before errored task', () => {
    it('All task finish', (done) => {
      let otherCallback:
        | ((err: Error | null, res?: unknown) => void)
        | undefined;
      let errored: boolean | undefined;
      const q = new Q(
        (a: number, callback: (err: Error | null, res?: unknown) => void) =>
          setTimeout(() => {
            if (a === 1) {
              otherCallback = callback;
            } else if (a === 2) {
              callback(null, a);
              otherCallback?.(new Error('thing'), a);
            }
          }),
        (_a: unknown, callback: () => void) => {
          setTimeout(callback);
        },
      );
      q.on('drain', () => {
        assert.ok(errored);
        done();
      });
      q.push(1).catch(() => {
        errored = true;
      });
      q.push(2);
    });
  });
});

describe('Worker 2 calls callback with error', () => {
  describe('With task callback', () => {
    it('Task callback gets error', (done) => {
      const q = new Q(
        (_a: unknown, callback: () => void) => {
          callback();
        },
        (_a: unknown, callback: (err: Error) => void) => {
          callback(new Error('hello'));
        },
      );
      q.push(1, (err?: Error | null) => {
        assert.ok(err);
        assert.equal(err?.message, 'hello');
        done();
      });
      q.on('error', done);
    });
  });

  describe('Without task callback', () => {
    it('Rejects returned promise', async () => {
      const q = new Q(
        (_a: unknown, callback: () => void) => {
          callback();
        },
        (_a: unknown, callback: (err: Error) => void) => {
          callback(new Error('foo'));
        },
      );
      await assert.rejects(() => q.push(1), /foo/);
    });

    it('Emits error for injected task', (done) => {
      const q = new Q(
        function (this: Q.Worker1Context, a: number, callback: () => void) {
          if (a === 0) {
            this.inject([1]);
            return;
          }
          callback();
        },
        (_a: unknown, callback: (err: Error) => void) => {
          callback(new Error('injected w2'));
        },
      );
      q.on('error', (err: Error) => {
        assert.equal(err.message, 'injected w2');
        done();
      });
      q.push(0);
    });
  });
});
