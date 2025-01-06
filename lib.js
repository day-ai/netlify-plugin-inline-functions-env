export function normalizeInputValue(singleOrArrayValue) {
  if (!singleOrArrayValue) {
    return singleOrArrayValue
  } else if (Array.isArray(singleOrArrayValue)) {
    return singleOrArrayValue
  } else {
    return [singleOrArrayValue]
  }
}

export function isJsFunction({ runtime, extension, srcFile }) {
  return (
    runtime === 'js' &&
    extension === '.js' &&
    !srcFile.includes('/node_modules/')
  )
}

export function getSrcFile({ srcFile }) {
  return srcFile
}

export function uniq(items) {
  const uniqItems = []

  items.forEach((item) => {
    if (!uniqItems.includes(item)) {
      uniqItems.push(item)
    }
  })

  return uniqItems
}
