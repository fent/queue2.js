var Q = require('..');
var assert = require('assert');


describe('Worker 1 calls callback with error', function() {
  describe('With task callback', function() {
    it('Task callback gets error', function(done) {
      var q = new Q(function(a, callback) {
        setTimeout(function() {
          callback(a === 1 ? new Error('hello') : null);
        });
      }, function(callback) { callback(); });
      q.push(1, function(err) {
        assert.ok(err);
        assert.equal(err.message, 'hello');
        done();
      });
      q.push(2);
      q.on('error', done);
    });
  });

  describe('Without task callback', function() {
    it('Error is emitted', function(done) {
      var q = new Q(function(a, callback) {
        setTimeout(function() {
          callback(a === 1 ? new Error('foo') : null);
        });
      }, function(callback) { callback(); });
      q.on('error', function(err) {
        assert.ok(err);
        assert.equal(err.message, 'foo');
        done();
      });
      q.push(1);
    });
  });
});

describe('Worker 2 calls callback with error', function() {
  describe('With task callback', function() {
    it('Task callback gets error', function(done) {
      var q = new Q(function(a, callback) {
        callback();
      }, function(a, callback) {
        callback(new Error('hello'));
      });
      q.push(1, function(err) {
        assert.ok(err);
        assert.equal(err.message, 'hello');
        done();
      });
      q.on('error', done);
    });
  });

  describe('Without task callback', function() {
    it('Error is emitted', function(done) {
      var q = new Q(function(callback) {
        callback();
      }, function(a, callback) {
        callback(new Error('foo'));
      });
      q.on('error', function(err) {
        assert.ok(err);
        assert.equal(err.message, 'foo');
        done();
      });
      q.push(1);
    });
  });
});
