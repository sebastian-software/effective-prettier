import { ESLint } from "eslint"
import { format, resolveConfig } from "prettier"
import glob from "fast-glob"
import { readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import figures from "figures"
import chalk from "chalk"

const prettierParser: Record<string, string> = {
  ".json": "json",
  ".css": "css",
  ".tsc": "typescript",
  ".ts": "typescript",
  ".md": "markdown",
  ".mdx": "mdx",
  ".html": "html",
  ".yaml": "yaml",
  ".yml": "yaml"
}

const eslintSupported = new Set([
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".cjs",
  ".cts"
])

// Keep ESLint alive as a lazy singleton
const getESLintInstance = (() => {
  let instance: ESLint | undefined

  return () => {
    if (!instance) {
      instance = new ESLint({
        fix: true
      })
    }

    return instance
  }
})()

const symbols: Record<string, string> = {
  skipped: chalk.dim(figures.bullet),
  modified: chalk.green(figures.tick),
  error: chalk.red(figures.cross)
}

async function processFile(filePath: string) {
  const startTime = performance.now()

  const fileExt = extname(filePath)
  const parser = prettierParser[fileExt] ?? "babel"
  const prettierOptions = await resolveConfig(filePath)

  const content = await readFile(filePath, "utf-8")
  let modified = content

  let hasPrettierChanges = false
  let hasESLintChanges = false

  if (eslintSupported.has(fileExt)) {
    const lintResultPre = await getESLintInstance().lintText(modified, {
      filePath
    })
    const lintOutput = lintResultPre[0].output
    if (lintOutput && lintOutput !== modified) {
      modified = lintOutput
      hasESLintChanges = true
    }
  }

  const prettierModified = await format(modified, {
    ...prettierOptions,
    parser
  })
  if (prettierModified !== modified) {
    modified = prettierModified
    hasPrettierChanges = true
  }

  if (eslintSupported.has(fileExt)) {
    const lintResultPost = await getESLintInstance().lintText(modified, {
      filePath
    })
    const lintOutput = lintResultPost[0].output
    if (lintOutput && lintOutput !== modified) {
      modified = lintOutput
      hasESLintChanges = true
    }
  }

  const hasChanges = modified !== content
  if (hasChanges) {
    // Only write modified files
    await writeFile(filePath, modified, "utf-8")
  }

  const stopTime = performance.now()
  const duration = `${Math.round(stopTime - startTime)}ms`

  console.log(
    `${hasPrettierChanges ? symbols.modified : symbols.skipped} ${
      hasESLintChanges ? symbols.modified : symbols.skipped
    } ${filePath} (${duration})`
  )
}

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
