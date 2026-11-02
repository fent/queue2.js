import assert from 'node:assert';
import Queue2, { Queue2 as NamedQueue2, Q, Queue } from '..';

describe('Exports', () => {
  it('Exposes class as default and named export', () => {
    assert.strictEqual(Queue2, NamedQueue2);
    assert.strictEqual(Queue2.Queue2, Queue2);
    assert.strictEqual(Queue2.Queue, Queue2);
    assert.strictEqual(Queue2.Q, Queue2);
    assert.strictEqual(Queue2.default, Queue2);
    assert.strictEqual(Queue, Q);
  });
});
