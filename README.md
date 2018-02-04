# Maildir queue [![Build Status](https://travis-ci.org/munogu/maildir-queue.svg?branch=master)](https://travis-ci.org/munogu/maildir-queue)

File system backed lock-free and atomic message queue for Node.js. Stores messages using Maildir format to avoid using file locks.

[![Standard - JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [API](#api)
- [Debugging](#debugging)

## Requirements

* [Node.js][node-url] >= 6.0

## Installation

```
$ npm install maildir-queue
```

## Quick Start

```js
// module dependencies
const Queue = require('maildir-queue')

// initialize queue
let queue = new Queue('your_queue_name')
```

## Usage

```js
// module dependencies
const Queue = require('maildir-queue')

// queue options
let options = {
  // output directory
  dir: '/path/to/output/directory',
  // time to live in milliseconds
  ttl: 86400 * 1000,
  // max retries, -1 for infinite, 0 for no retries
  retries: 10
}

// initialize queue
let queue = new Queue('your_queue_name', options)

// add new item to queue
queue.add({
  foo: 'bar'
})

// pop item from queue
queue.pop(item => {
  console.log('item id %s', item.id)
})
```

## API

### add(payload = object) - Promise

```js
queue.add({
  this: 'is',
  the: 'payload object'
})
```

### pop(handler = function) - Promise

```js
queue.pop(item => {
  console.log('received item with id %s', item.id)
})
```

### count() - Promise

Returns total count of items in the queue. 

```js
queue.count().then(count => {
  console.log('%s item(s) found', count)
})
```

## Debugging

Maildir queue along with many of the libraries it's built with support the **DEBUG** environment variable from [debug][debug-url] which provides simple conditional logging.

For example to see all maildir-queue specific debugging information just pass `DEBUG=queue*` and upon boot you'll see the list of middleware used, among other things.

[node-url]: https://nodejs.org
[debug-url]: https://github.com/visionmedia/debug