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

const eslintSupported: Record<string, boolean> = {
  ".json": true,
  ".ts": true,
  ".tsx": true,
  ".js": true,
  ".jsx": true,
  ".mjs": true,
  ".cjs": true,
  ".cts": true,
  ".mts": true
}

// Keep ESLint alive as a lazy singleton
const getESLintInstance = (() => {
  let instance: ESLint | undefined

  return () => {
    if (!instance) {
      instance = new ESLint()
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

  if (eslintSupported[fileExt]) {
    const lintResultPre = await getESLintInstance().lintText(modified, {
      filePath
    })
    modified = lintResultPre[0].output ?? modified
  }

  modified = await format(modified, { ...prettierOptions, parser })

  if (eslintSupported[fileExt]) {
    const lintResultPost = await getESLintInstance().lintText(modified, {
      filePath
    })
    modified = lintResultPost[0].output ?? modified
  }

  const hasChanges = modified !== content
  if (hasChanges) {
    // Only write modified files
    await writeFile(filePath, modified, "utf-8")
  }

  const stopTime = performance.now()
  const duration = `${Math.round(stopTime - startTime)}ms`

  console.log(
    `${
      hasChanges ? symbols.modified : symbols.skipped
    } ${filePath} (${duration})`
  )
}

async function main(patterns: string[] = []) {
  const files = await glob(patterns)
  console.log("FILES:", files)

  await Promise.all(files.map(processFile))

  console.log("DONE")
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
