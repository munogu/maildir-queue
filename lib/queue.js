// debugger
const debug = require('debug')('queue')

// module dependencies
const fs = require('fs-extra')
const path = require('path')
const crypto = require('crypto')
const { detectSeries } = require('./utils')

const SEPARATOR = '-'
const EXTENSION = '.json'

function write (filename, data) {
  data = JSON.stringify(data, null, 2)
  return fs.writeFile(filename, data)
}

class Queue {
  constructor (name = 'default', opts = {}) {
    // set default options
    this.opts = Object.assign({}, {
      dir: path.join(__dirname, '../output'),
      ttl: 86400 * 1000,
      retries: 10
    }, opts)
    // set directories
    this.dir = path.join(this.opts.dir, name)
    this.cur = path.join(this.dir, 'cur')
    this.tmp = path.join(this.dir, 'tmp')
    this.new = path.join(this.dir, 'new')
    // ensure output dir
    fs.ensureDirSync(this.cur)
    fs.ensureDirSync(this.tmp)
    fs.ensureDirSync(this.new)
    debug('output directories created')
  }
  add (payload = {}) {
    let id = crypto.randomBytes(16).toString('hex')
    let now = new Date()
    let filename = now.getTime() + SEPARATOR + id + EXTENSION
    let data = {
      id,
      payload,
      retry: 0,
      createdAt: now,
      updatedAt: now
    }
    let tmp = path.join(this.tmp, filename)
    return write(tmp, data).then(() => {
      debug('written into tmp: ' + data.id)
      return fs.rename(tmp, path.join(this.new, filename))
    }).then(() => {
      debug('moved to new: ' + data.id)
      return data
    })
  }
  pop (handler) {
    return this.list().then(items => detectSeries(items, item => {
      // try to move file into cur
      let cur = path.join(this.cur, path.basename(item.filename))
      return fs.rename(item.filename, cur).then(() => {
        item.filename = cur
        return fs.readJSON(item.filename)
      }).then(data => {
        // parse timestamps
        data.createdAt = new Date(data.createdAt)
        data.updatedAt = new Date(data.updatedAt)
        item.data = data
        return true
      }).catch(err => {
        // error handler
        if (err.name === 'SyntaxError' || err.code === 'ENOENT') {
          return false
        } else {
          return Promise.reject(err)
        }
      })
    })).then(item => {
      // check item
      if (!item) return
      // call handler
      let result
      try {
        result = handler(item.data)
        if (!result || typeof result.then !== 'function') {
          result = Promise.resolve(result)
        }
      } catch (err) {
        result = Promise.reject(err)
      }
      return result.then(returned => {
        return fs.unlink(item.filename).catch(err => {
          console.warn('an error occured while removing file:')
          console.warn(item.filename)
          console.error(err.toString())
        })
      }).then(() => {
        return item.data
      }).catch(err => {
        if (this.opts.retries >= 0 && item.data.retry >= this.opts.retries) {
          return fs.unlink(item.filename).then(() => Promise.reject(err))
        }
        // requeue file
        let now = new Date()
        item.data.updatedAt = now
        item.data.retry++
        return write(item.filename, item.data).then(() => {
          // rename file
          let target = now.getTime() + SEPARATOR + item.id + EXTENSION
          return fs.rename(item.filename, path.join(this.new, target))
        }).then(() => Promise.reject(err))
      })
    })
  }
  list () {
    return fs.readdir(this.new).then(files => {
      debug('readdir: ' + files.length + ' files found')
      // iterate files
      let items = []
      files.forEach(file => {
        // split filename into components
        let [updatedAt, idext] = file.split(SEPARATOR)
        // check extension
        if (!idext || path.extname(idext) !== EXTENSION) return false
        // check updatedAt
        if (!updatedAt || !updatedAt.match(/[0-9]{13}/)) return false
        updatedAt = new Date(parseInt(updatedAt))
        // check ttl
        let now = new Date()
        if (this.opts.ttl && now - updatedAt > this.opts.ttl) return false
        // add item
        items.push({
          id: path.basename(idext, EXTENSION),
          filename: path.join(this.new, file),
          updatedAt
        })
      })
      // sort items by updatedAt
      items.sort((a, b) => a.updatedAt - b.updatedAt)
      return items
    })
  }
  count () {
    return this.list().then(items => items.length)
  }
}

exports = module.exports = Queue