import { listFunctionsFiles } from '@netlify/zip-it-and-ship-it'

import fs from 'node:fs'
import util from 'node:util'
import babel from '@babel/core'
import inlinePlugin from 'babel-plugin-transform-inline-environment-variables'
import { normalizeInputValue, isJsFunction, getSrcFile, uniq } from './lib'
const writeFile = util.promisify(fs.writeFile)

async function inlineEnv(path, options = {}, verbose = false) {
  console.log('inlining', path)

  const transformed = await babel.transformFileAsync(path, {
    configFile: false,
    plugins: [babel.createConfigItem([inlinePlugin, options])],
    retainLines: true,
  })

  if (verbose) {
    console.log('transformed code', transformed.code)
  }

  await writeFile(path, transformed.code, 'utf8')
}

async function processFiles({ inputs, utils, netlifyConfig }) {
  const verbose = !!inputs.verbose

  if (verbose) {
    console.log(
      'build env contains the following environment variables',
      Object.keys(process.env)
    )
  }

  let netlifyFunctions = []

  try {
    console.log('netlifyConfig.build.functions: ', netlifyConfig.build.functions)
    netlifyFunctions = await listFunctionsFiles(netlifyConfig.build.functions)
  } catch (functionMissingErr) {
    console.log(functionMissingErr) // functions can be there but there is an error when executing
    return utils.build.failBuild(
      'Failed to inline function files because netlify function folder was not configured or pointed to a wrong folder, please check your configuration'
    )
  }

  const files = uniq(netlifyFunctions.filter(isJsFunction).map(getSrcFile))

  if (files.length !== 0) {
    try {
      if (verbose) {
        console.log('found function files', files)
      }

      const include = normalizeInputValue(inputs.include)
      const exclude = normalizeInputValue(inputs.exclude)

      if (verbose) {
        console.log('flags.include=', include)
        console.log('flags.exclude=', exclude)
      }

      await Promise.all(
        files.map((f) => inlineEnv(f, { include, exclude }, verbose))
      )

      utils.status.show({
        summary: `Processed ${files.length} function file(s).`,
      })
    } catch (err) {
      return utils.build.failBuild(
        `Failed to inline function files due to the following error:\n${err.message}`,
        { error: err }
      )
    }
  } else {
    utils.status.show({
      summary: 'Skipped processing because the project had no functions.',
    })
  }
}

const handler = (inputs) => {
  // Use user configured buildEvent
  const buildEvent = inputs.buildEvent || 'onPreBuild'

  return {
    [buildEvent]: processFiles,
  }
}

// expose for testing
handler.processFiles = processFiles

export default handler
