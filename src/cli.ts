import glob from "fast-glob"
import {
  initSharedESLintInstance,
  processFile,
  runInParallel
} from "./process.js"
import { normalize, relative, sep } from "node:path"
import { measureExecutionTime } from "./measureExecutionTime.js"
import { PARALLEL_TASKS } from "./config.js"

export function getCommonPath(paths: string[]): string {
  if (paths.length === 0) {
    return ""
  }

  const splitPaths = paths.map((singlePath) => singlePath.split(sep))
  let commonPath = ""

  for (let i = 0; i < splitPaths[0].length; i++) {
    const thisFolder = splitPaths[0][i]
    const isCommon = splitPaths.every(
      (singlePath) => singlePath[i] === thisFolder
    )

    if (!isCommon) {
      break
    } else {
      commonPath += thisFolder + sep
    }
  }

  return normalize(commonPath)
}

async function main(patterns: string[] = []) {
  const prevCwd = process.cwd()

  for (const pattern of patterns) {
    console.log()
    const result = await measureExecutionTime(() => processPattern(pattern))
    console.log(`- Done: ${Math.round(result.runtime)}ms`)
    process.chdir(prevCwd)
  }
}

const args = process.argv.slice(2)

if (args.length < 1) {
  console.error("Usage: effective-prettier <pattern[s]>")
  process.exit(1)
}

try {
  await main(args)
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message)
  }

  process.exitCode = 1
}

async function processPattern(pattern: string) {
  console.log(`- Searching for files using: ${pattern}...`)
  const files = await glob(pattern)
  if (files.length === 0) {
    throw new Error(`- No files found for pattern: ${pattern}`)
  }

  console.log(`- Found ${files.length} files.`)
  const commonPath = getCommonPath(files)
  process.chdir(commonPath)
  console.log(`- Detected root folder: ${commonPath}`)

  await initSharedESLintInstance()

  console.log(`- Processing ${files.length} files...`)
  const adjustedFiles = files.map((fileName) => relative(commonPath, fileName))
  const tasks = adjustedFiles.map((fileName) => () => processFile(fileName))
  await runInParallel(tasks, PARALLEL_TASKS)
}
