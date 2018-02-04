// module dependencies
const Queue = require('./')

// initialize queue
let queue = new Queue('default')

// add item to queue
queue.add({
  hello: 'world'
}).then(() => {
  // pop item from queue
  return queue.pop(data => {
    return true
  })
}).then(item => {
  if (item) {
    console.log('item %s finished', item.id)
  } else {
    console.log('no item found')
  }
})