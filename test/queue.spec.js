// module dependencies
const assert = require('chai').assert
const path = require('path')
const async = require('async')
const fs = require('fs-extra')
const Queue = require('../lib/queue')

// describe test
let queue
describe('queue', function () {
  before(function () {
    queue = new Queue('test')
  })
  it('check methods', function () {
    assert.isFunction(queue.add)
    assert.isFunction(queue.pop)
    assert.isFunction(queue.list)
    assert.isFunction(queue.count)
  })
  it('add items', function (done) {
    async.times(10, (i, next) => {
      queue.add({
        message: 'item ' + i
      }).then(item => next(null, item)).catch(next)
    }, (err, items) => {
      // error handler
      if (err) return done(err)
      // get first item
      let item = items.pop()
      assert.isObject(item)
      assert.isString(item.id)
      assert.isObject(item.payload)
      assert.isFinite(item.retry)
      assert.instanceOf(item.createdAt, Date)
      assert.instanceOf(item.updatedAt, Date)
      done()
    })
  })
  it('count items', function () {
    return queue.count(count => {
      assert.isAbove(count, 0)
    })
  })
  it('pop item', function () {
    return queue.pop(item => {
      assert.isObject(item)
      assert.isObject(item.payload)
    })
  })
  it('file name validation', function () {
    return Promise.all([
      fs.writeFile(path.join(queue.new, '000000-test.json'), 'Hello'),
      fs.writeFile(path.join(queue.new, '1517771214392-test.yml'), 'Hello')
    ])
  })
  it('pop item fail', function () {
    return queue.pop(item => {
      let err = new Error('item failed')
      err.code = 'EFOOBAR'
      return Promise.reject(err)
    }).catch(err => {
      assert.equal(err.code, 'EFOOBAR')
    })
  })
  it('race condition', function () {
    let ids = []
    let handler = item => ids.push(item.id)
    let promises = []
    for (let i = 0; i < 25; i++) {
      promises.push(queue.pop(handler))
    }
    return Promise.all(promises).then(() => {
      let unique = ids.filter((val, index, self) => self.indexOf(val) === index)
      assert.equal(unique.length, ids.length)
    })
  })
})