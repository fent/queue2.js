const Q      = require('..');
const assert = require('assert');


// Shuffles an array.
const shuffle = (arr) => {
  let i = arr.length, j, tmp;
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

      let cb;
      while ((cb = this.callbacks.shift())) {
        cb();
      }
    }
  }
}


// Macro.
const createQ = (c, inject, amount) => {
  let list = ['a', 'b', 'c'];
  let random1 = new RandomCall(c, list);
  let random2 = new RandomCall(c, list);

  return (done) => {
    let n = 0;
    let q = new Q(function worker1(data, callback) {
      random1.push(() => {
        // Check for inject.
        if (typeof inject === 'number' &&
            inject === this.num && !this.injected) {
          amount = amount || 1;
          let arr = new Array(amount);
          for (let i = 0; i < amount; i++) {
            arr[i] = 'injected' + i;
          }

          list.splice(inject, 1, ...arr);
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
      let worker1a = null, worker2a = null;
      let q = new Q((a, callback) => {
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
    let q = new Q(() => {
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
