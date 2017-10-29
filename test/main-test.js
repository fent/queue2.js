const Q      = require('..');
const assert = require('assert');


// Shuffles an array.
function shuffle(arr) {
  var i = this.length, j, tmp;
  if (i === 0) return;
  while (--i) {
    j = Math.floor(Math.random() * (i + 1));
    tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

// Calls pushed callbacks in random order once they are all pushed.
class randomCall {
  constructor(c, list) {
    this.callbacks = [];
    this.c = c;
    this.list = list;
    this.n = 0;
  }

  push(callback) {
    this.callbacks.push(callback);
    this.n++;
    if (this.n % this.c === 0 || this.n === this.list.length) {
      shuffle(this.callbacks);

      var cb;
      while ((cb = this.callbacks.shift())) {
        cb();
      }
    }
  }
}


// Macro.
function createQ(c, inject, amount) {
  var list = ['a', 'b', 'c'];
  var random1 = new randomCall(c, list);
  var random2 = new randomCall(c, list);

  return (done) => {
    var n = 0;
    var q = new Q(function worker1(data, callback) {
      random1.push(() => {
        // Check for inject.
        if (typeof inject === 'number' &&
            inject === this.num && !this.injected) {
          amount = amount || 1;
          var arr = new Array(amount);
          for (var i = 0; i < amount; i++) {
            arr[i] = 'injected' + i;
          }

          list.splice.apply(list, [inject, 1].concat(arr));
          this.inject(arr, inject);
          return;
        }

        callback(null, data);
      });
    }, (data, callback) => {
      if (!data) { return callback(); }
      assert.equal(data, list[n]);

      if (++n === list.length) { done(); }
      random2.push(callback);
    }, c || 250);

    list.forEach((a) => {
      q.push(a);
    });
  };
}

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
      var worker1a = null, worker2a = null;
      var q = new Q((a, callback) => {
        worker1a = a;
        process.nextTick(callback);
      }, (a, callback) => {
        worker2a = a;
        process.nextTick(callback);
      });
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
    var q = new Q(() => {
      process.nextTick(() => {
        q.die();

        // `done` shouldn't be called twice.
        done();
      });
    }, () => {}, 1);
    q.push();
    q.push();
    q.push();
  });
});
