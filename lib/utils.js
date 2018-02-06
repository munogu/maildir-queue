exports.detectSeries = function (values, handler) {
  let copy = [].concat(values)
  let iterate = () => {
    let value = copy.shift()
    if (value) {
      return handler(value).then(result => {
        if (!!result) {
          return value
        } else {
          return iterate()
        }
      })
    } else {
      return Promise.resolve(value)
    }
  }
  return iterate()
}