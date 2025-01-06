import fs from 'node:fs'
import util from 'node:util'
import process from 'node:process'
import babel from '@babel/core'
import inlinePlugin from 'babel-plugin-transform-inline-environment-variables'
import path from 'node:path'
const writeFile = util.promisify(fs.writeFile)

const DIRECTORY_TO_INLINE = `${process.cwd()}/api/dist`
const ALLOWED_EXTENSIONS = ['.js']
const EXCLUDED_DIRECTORIES = ['node_modules']

function normalizeInputValue(singleOrArrayValue) {
  if (!singleOrArrayValue) {
    return singleOrArrayValue
  } else if (Array.isArray(singleOrArrayValue)) {
    return singleOrArrayValue
  } else {
    return [singleOrArrayValue]
  }
}

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

function getAllowedFiles(dirPath, extensions, excludedDirectories) {
  const files = []
  
  function traverse(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        traverse(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(fullPath)
        if (extensions.includes(ext) && !excludedDirectories.some(dir => fullPath.includes(dir))) {
          files.push(fullPath)
        }
      }
    }
  }
  
  traverse(dirPath)
  
  return files
}

async function processFiles({ inputs, utils }) {
  const verbose = !!inputs.verbose

  if (verbose) {
    console.log(
      'build env contains the following environment variables',
      Object.keys(process.env)
    )
  }

  let files

  try{
    files = getAllowedFiles(DIRECTORY_TO_INLINE, ALLOWED_EXTENSIONS, EXCLUDED_DIRECTORIES)
  } catch (err) {
    return utils.build.failBuild(
      `Failed to read files from target directory for inlining:\n${err.message}`,
      { error: err }
    )
  }

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
