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
