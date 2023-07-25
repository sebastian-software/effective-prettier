import { ESLint } from "eslint"
import { format, resolveConfig } from "prettier"
import { readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import figures from "figures"
import chalk from "chalk"

type CallableFunction<T> = () => Promise<T>

interface TimedResult<T> {
  result: T
  runtime: number
}

async function measureExecutionTime<T>(
  fn: CallableFunction<T>
): Promise<TimedResult<T>> {
  const startTime = performance.now()
  const result = await fn()
  const endTime = performance.now()

  const runtime = endTime - startTime

  return {
    result,
    runtime
  }
}

async function formatWithESLint(text: string, filePath: string) {
  let isModified = false

  const returnValue = await measureExecutionTime(async () => {
    const result = await getESLintInstance().lintText(text, {
      filePath
    })

    return result[0]
  })

  const lintOutput = returnValue.result.output
  if (lintOutput && lintOutput !== text) {
    text = lintOutput
    isModified = true
  }

  return {
    text,
    isModified
  }
}

export async function runInParallel<T>(
  tasks: Array<() => Promise<T>>,
  maxParallel: number
): Promise<T[]> {
  const results: Promise<T>[] = []
  const executing: Promise<T>[] = []

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task())
    results.push(p)

    if (maxParallel <= tasks.length) {
      const e: Promise<T> = p.finally(() => {
        executing.splice(executing.indexOf(e), 1)
      })
      executing.push(e)
      if (executing.length >= maxParallel) {
        await Promise.race(executing)
      }
    }
  }

  return Promise.all(results)
}

const prettierParser: Record<string, string> = {
  ".json": "json",
  ".css": "css",
  ".tsx": "typescript",
  ".ts": "typescript",
  ".cts": "typescript",
  ".mts": "typescript",
  ".jsx": "babel",
  ".js": "babel",
  ".cjs": "babel",
  ".mjs": "babel",
  ".md": "markdown",
  ".mdx": "mdx",
  ".html": "html",
  ".htm": "html",
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

export async function processFile(filePath: string) {
  const startTime = performance.now()

  const fileExt = extname(filePath)
  const parser = prettierParser[fileExt]

  if (!parser) {
    console.log(`${symbols.skipped} ${filePath} (unsupported)`)
    return
  }

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
