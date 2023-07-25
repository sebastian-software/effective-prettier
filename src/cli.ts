import glob from "fast-glob"
import { processFile, runInParallel } from "./process.js"

const PARALLEL_TASKS = 4

async function main(patterns: string[] = []) {
  const files = await glob(patterns)

  console.log(`Processing ${files.length} files...`)
  const tasks = files.map((fileName) => () => processFile(fileName))
  await runInParallel(tasks, PARALLEL_TASKS)
  console.log("Done")
}

const args = process.argv.slice(2)

if (args.length !== 1) {
  console.error("Usage: effective-prettier <pattern>")
  process.exit(1)
}

try {
  main(args)
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message)
  }

  process.exitCode = 1
}
