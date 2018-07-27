// debugger
const debug = require('debug')('queue')

// module dependencies
const fs = require('fs-extra')
const path = require('path')
const uuidv4 = require('uuid/v4')
const { detectSeries } = require('./utils')

const SEPARATOR = '_'
const EXTENSION = '.json'

function write (filename, data) {
  data = JSON.stringify(data, null, 2)
  return fs.writeFile(filename, data)
}

class Queue {
  constructor (name = 'default', opts = {}) {
    this.name = name
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
  add (payload = {}, envelope = {}) {
    let id = uuidv4()
    let now = new Date()
    let filename = now.getTime() + SEPARATOR + id + EXTENSION
    envelope = Object.assign({}, {
      id,
      payload,
      retry: 0,
      createdAt: now,
      updatedAt: now
    }, envelope)
    let tmp = path.join(this.tmp, filename)
    return write(tmp, envelope).then(() => {
      debug('written into tmp: ' + envelope.id)
      return fs.rename(tmp, path.join(this.new, filename))
    }).then(() => {
      debug('moved to new: ' + envelope.id)
      return envelope
    })
  }
  pop (handler) {
    return this.list().then(envelopes => detectSeries(envelopes, file => {
      // try to move file into cur
      let cur = path.join(this.cur, path.basename(file.filename))
      return fs.rename(file.filename, cur).then(() => {
        file.filename = cur
        return fs.readJSON(file.filename)
      }).then(envelope => {
        // parse timestamps
        envelope.createdAt = new Date(envelope.createdAt)
        envelope.updatedAt = new Date(envelope.updatedAt)
        file.envelope = envelope
        return true
      }).catch(err => {
        // error handler
        if (err.name === 'SyntaxError' || err.code === 'ENOENT') {
          return false
        } else {
          return Promise.reject(err)
        }
      })
    })).then(file => {
      // check envelope wrapper
      if (!file) return
      // call handler
      let result
      try {
        result = handler(file.envelope)
        if (!result || typeof result.then !== 'function') {
          result = Promise.resolve(result)
        }
      } catch (err) {
        result = Promise.reject(err)
      }
      return result.then(returned => {
        return fs.unlink(file.filename).catch(err => {
          console.warn('an error occured while removing file:')
          console.warn(file.filename)
          console.error(err.toString())
        })
      }).then(() => {
        return file.envelope
      }).catch(err => {
        // expose envelope in error
        err.envelope = file.envelope
        // check retries
        if (this.opts.retries >= 0 && file.envelope.retry >= this.opts.retries) {
          return fs.unlink(file.filename).then(() => Promise.reject(err))
        }
        // requeue file
        let now = new Date()
        file.envelope.updatedAt = now
        file.envelope.retry++
        return write(file.filename, file.envelope).then(() => {
          // rename file
          let target = now.getTime() + SEPARATOR + file.id + EXTENSION
          return fs.rename(file.filename, path.join(this.new, target))
        }).then(() => Promise.reject(err))
      })
    })
  }
  list () {
    let now = new Date()
    return fs.readdir(this.new).then(files => {
      debug('readdir: ' + files.length + ' files found')
      // iterate files
      let envelopes = []
      files.forEach(file => {
        // split filename into components
        let [updatedAt, idext] = file.split(SEPARATOR)
        // check extension
        if (!idext || path.extname(idext) !== EXTENSION) return false
        // check updatedAt
        if (!updatedAt || !updatedAt.match(/[0-9]{13}/)) return false
        updatedAt = new Date(parseInt(updatedAt))
        // check ttl
        if (this.opts.ttl && now - updatedAt > this.opts.ttl) return false
        // add envelope
        envelopes.push({
          id: path.basename(idext, EXTENSION),
          filename: path.join(this.new, file),
          updatedAt
        })
      })
      // sort envelopes by updatedAt
      envelopes.sort((a, b) => a.updatedAt - b.updatedAt)
      return envelopes
    })
  }
  count () {
    return this.list().then(envelopes => envelopes.length)
  }
  empty () {
    let now = new Date()
    let dirs = [this.new, this.tmp, this.cur]
    let promises = dirs.map(dir => {
      return fs.readdir(dir).then(files => detectSeries(files, file => {
        // split filename into components
        let [updatedAt, idext] = file.split(SEPARATOR)
        // check extension
        if (!idext || path.extname(idext) !== EXTENSION) {
          return Promise.resolve()
        }
        // check updatedAt
        if (!updatedAt || !updatedAt.match(/[0-9]{13}/)) {
          return Promise.resolve()
        }
        updatedAt = new Date(parseInt(updatedAt))
        // check ttl
        if (this.opts.ttl && now - updatedAt > this.opts.ttl) {
          // remove file
          let abs = path.join(dir, file)
          return fs.unlink(abs)
        }
        return Promise.resolve()
      }))
    })
    return Promise.all(promises)
  }
}

exports = module.exports = Queue