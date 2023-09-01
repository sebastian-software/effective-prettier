import glob from "fast-glob"
import { relative } from "node:path"
import { PARALLEL_TASKS } from "./config.js"
import { getCommonPath } from "./getCommonPath.js"
import { measureExecutionTime } from "./measureExecutionTime.js"
import {
  initSharedESLintInstance,
  processFile,
  runInParallel
} from "./process.js"

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
  const files = await glob(pattern, { ignore: ["node_modules"] })
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
