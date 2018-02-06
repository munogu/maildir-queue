// module dependencies
const assert = require('chai').assert
const path = require('path')
const fs = require('fs-extra')
const Queue = require('../lib/queue')

// describe test
describe('queue', function () {
  describe('default options', function () {
    let queue
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
      let promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(queue.add({ message: 'item ' + i }))
      }
      Promise.all(promises).then(items => {
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
        fs.writeFile(path.join(queue.new, '000000_test.json'), 'Hello'),
        fs.writeFile(path.join(queue.new, '1517771214392_test.yml'), 'Hello')
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
    it('pop item sync fail', function () {
      return queue.pop(item => {
        throw new Error('item failed')
      }).catch(err => {
        assert.isObject(err.item)
      })
    })
    it('item expired ttl', function () {
      let now = new Date('2017-01-01')
      let filename = now.getTime() + '_ABCDEF0123456789.json'
      let data = JSON.stringify({})
      // create a "fake" old file
      return fs.writeFile(path.join(queue.new, filename), data).then(() => {
        return queue.list()
      })
    })
    it('fail at unlink', function () {
      return queue.pop(item => {
        let filename = item.updatedAt.getTime() + '_' + item.id + '.json'
        return fs.unlink(path.join(queue.cur, filename))
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
        let unique = ids.filter((val, i, self) => self.indexOf(val) === i)
        assert.equal(unique.length, ids.length)
      })
    })
  })
  describe('no retry', function () {
    let queue
    before(function () {
      queue = new Queue('test-no-retry', {
        retries: 0
      })
    })
    it('pop item fail', function () {
      return queue.add({ hello: 'world' }).then(() => {
        return queue.pop(item => {
          let err = new Error('Nope')
          return Promise.reject(err)
        }).catch(() => {})
      })
    })
    it('unreadable file', function () {
      let now = new Date()
      let filename = now.getTime() + '_ABCDEF0123456789.json'
      let data = JSON.stringify({})
      // create a "fake" file
      return fs.writeFile(path.join(queue.new, filename), data, {
        mode: 0o300
      }).then(() => {
        return queue.pop().catch(err => {
          assert.equal(err.code, 'EACCES')
        })
      })
    })
  })
})