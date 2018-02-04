exports.detectSeries = function (values, handler) {
  let copy = [].concat(values)
  let iterate = () => {
    let value = copy.shift()
    return handler(value).then(result => {
      if (!!result) {
        return value
      } else if (copy.length) {
        return iterate()
      } else {
        return Promise.resolve()
      }
    })
  }
  return iterate()
}