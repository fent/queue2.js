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
    it('Error is emitted', (done) => {
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
      q.on('error', (err: Error) => {
        assert.ok(err);
        assert.equal(err.message, 'foo');
        done();
      });
      q.push(1);
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
      q.on('error', () => {
        errored = true;
      });
      q.on('drain', () => {
        assert.ok(errored);
        done();
      });
      q.push(1);
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
    it('Error is emitted', (done) => {
      const q = new Q(
        (_a: unknown, callback: () => void) => {
          callback();
        },
        (_a: unknown, callback: (err: Error) => void) => {
          callback(new Error('foo'));
        },
      );
      q.on('error', (err: Error) => {
        assert.ok(err);
        assert.equal(err.message, 'foo');
        done();
      });
      q.push(1);
    });
  });
});
