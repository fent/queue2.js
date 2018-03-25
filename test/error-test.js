const Q      = require('..');
const assert = require('assert');


describe('Worker 1 calls callback with error', () => {
  describe('With task callback', () => {
    it('Task callback gets error', (done) => {
      var q = new Q((a, callback) => {
        setTimeout(() => {
          callback(a === 1 ? new Error('hello') : null);
        });
      }, (callback) => { callback(); });
      q.push(1, (err) => {
        assert.ok(err);
        assert.equal(err.message, 'hello');
        done();
      });
      q.push(2);
      q.on('error', done);
    });
  });

  describe('Without task callback', () => {
    it('Error is emitted', (done) => {
      var q = new Q((a, callback) => {
        setTimeout(() => {
          callback(a === 1 ? new Error('foo') : null);
        });
      }, (callback) => { callback(); });
      q.on('error', (err) => {
        assert.ok(err);
        assert.equal(err.message, 'foo');
        done();
      });
      q.push(1);
    });
  });

  describe('Later task finishes before errored task', () => {
    it('All task finish', (done) => {
      var otherCallback, errored;
      var q = new Q((a, callback) => setTimeout(() => {
        console.log('worker1', a);
        if (a === 1) {
          otherCallback = callback;
        } else if (a === 2) {
          callback(null, a);
          otherCallback(new Error('thing'), a);
        }
      }), (a, callback) => {
        console.log('worker2', a, q.active);
        setTimeout(callback);
      });
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
      var q = new Q((a, callback) => {
        callback();
      }, (a, callback) => {
        callback(new Error('hello'));
      });
      q.push(1, (err) => {
        assert.ok(err);
        assert.equal(err.message, 'hello');
        done();
      });
      q.on('error', done);
    });
  });

  describe('Without task callback', () => {
    it('Error is emitted', (done) => {
      var q = new Q((callback) => {
        callback();
      }, (a, callback) => {
        callback(new Error('foo'));
      });
      q.on('error', (err) => {
        assert.ok(err);
        assert.equal(err.message, 'foo');
        done();
      });
      q.push(1);
    });
  });
});
