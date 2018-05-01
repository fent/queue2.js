const EventEmitter = require('events').EventEmitter;


module.exports = class Q extends EventEmitter {
  /**
   * @constructor
   * @param {Function} worker1
   * @param {Function} worker2
   * @param {Number} concurrency Number of parallel workers.
   */
  constructor(worker1, worker2, concurrency) {
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
   *
   * @param {Object} data...
   */
  push() {
    this.queue.push({
      num: this._num++,
      args: Array.prototype.slice.call(arguments),
      injected: false
    });
    this._next1();
  }


  /**
   * Adds a task in place of another running task.
   *
   * @param {Array.<Object>} list
   * @param {Number} num
   */
  _inject(list, num) {
    var i, len = list.length, len2 = len - 1, args;
    this.active--;

    // Edit order of items in queue and running.
    if (len2 > 0) {
      this._incrAll(num, len2);
    }

    // Inject items to the beginning of queue with custom priority.
    for (i = len - 1; i >= 0; i--) {
      args = list[i];
      this.queue.unshift({ num: num + i, args: [args], injected: true });
    }
    for (i = 0; i < len; i++) {
      this._next1();
    }
  }


  /**
   * Increases `num` of all lists by given amount.
   *
   * @param {Number} num
   * @param {Number} amount
   */
  _incrAll(num, amount) {
    this._incr('queue', num, amount);
    this._incr('running1', num, amount);
    this._incr('running2', num, amount);
  }


  /**
   * Increases `num` in tasks by given amount.
   *
   * @param {Array.<Object>} list
   * @param {Number} num
   * @param {Number} amount
   */
  _incr(list, num, amount) {
    for (var i = 0, len = this[list].length; i < len; i++) {
      var task = this[list][i];
      if (task.num > num) task.num += amount;
    }
  }


  /**
   * Processes tasks in queue if it can.
   */
  _next1() {
    if (this.active >= this.concurrency) { return; }

    var task = this.queue.shift();
    if (!task) { return this.emit('empty'); }

    this.running1.push(task);
    this.active++;
    if (this.active === this.concurrency) {
      this.emit('full');
    }

    var world = {
      num: task.num,
      injected: task.injected,
      inject: (list) => {
        this._inject(list, task.num);
      },
    };

    var args = task.args;
    var callback = args.splice(this.worker1.length - 1, 1)[0];

    // Add missing arguments.
    while (args.length < this.worker1.length - 1) {
      args.push(undefined);
    }

    // Add custom callback to args.
    var self = this;
    args.push(function worker1Callback(err) {
      self.running1.splice(self.running1.indexOf(task), 1);
      var hasCallback = typeof callback === 'function';

      if (err) {
        self._incrAll(task.num, -1);
        self.active--;
        if (hasCallback) {
          callback(err);
        } else {
          self.emit('error', err);
        }
        self._next2();
        self._next1();
        if (self.active === 0) { self.emit('drain'); }
        return;
      }

      self.running2.push({
        num: task.num,
        callback,
        args: Array.prototype.slice.call(arguments, 1)
      });
      self._next2();

    });
    this.worker1.apply(world, args);
  }


  /**
   * Looks for the next task in the second queue to run.
   */
  _next2() {
    for (var i = 0, len = this.running2.length; i < len; i++) {
      var task = this.running2[i];
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
   *
   * @param {Object} task
   */
  _run(task) {
    // Add missing arguments.
    while (task.args.length < this.worker2.length - 1) {
      task.args.push(undefined);
    }

    // Add callback for worker2
    task.args.push((err) => {
      if (typeof task.callback === 'function') {
        task.callback.apply(null, [err].concat(task.args));
      } else if (err) {
        this.emit('error', err);
      }
      this.active--;
      this._next1();
      if (this.active === 0) { this.emit('drain'); }
    });
    this.worker2.apply(null, task.args);
  }


  /**
   * Kills the queue.
   */
  die() {
    this.active = 0;
    this._num = 0;
    this._current = 0;
    this.queue = [];
    this.running1 = [];
    this.running2 = [];
  }
};
