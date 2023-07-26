import glob from "fast-glob"
import { processFile, runInParallel } from "./process.js"
import { normalize, relative, sep } from "node:path"

const PARALLEL_TASKS = 4

export function getCommonPath(paths: string[]): string {
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
  const files = await glob(patterns)
  const commonPath = getCommonPath(files)
  console.log(`- Root Path: ${commonPath}`)
  process.chdir(commonPath)

  const adjustedFiles = files.map((fileName) => relative(commonPath, fileName))

  console.log(`- Processing ${files.length} files...`)
  const tasks = adjustedFiles.map((fileName) => () => processFile(fileName))
  await runInParallel(tasks, PARALLEL_TASKS)
  console.log("- Done")
}

const args = process.argv.slice(2)

if (args.length !== 1) {
  console.error("Usage: effective-prettier <pattern>")
  process.exit(1)
}

try {
  void main(args)
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message)
  }

  process.exitCode = 1
}
