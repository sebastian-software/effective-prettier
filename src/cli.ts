import { glob } from "fast-glob"
import { processFile } from "./process.js"

async function main(patterns: string[] = []) {
  const files = await glob(patterns)

  console.log(`Processing ${files.length} files...`)
  await Promise.all(files.map(processFile))
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
