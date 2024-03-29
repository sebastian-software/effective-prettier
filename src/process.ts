import { readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import figures from "figures"
import chalk from "chalk"
import { measureExecutionTime } from "./measureExecutionTime.js"
import { createESLint } from "./createESLint.js"
import type { ESLint } from "eslint"
import { prettierParser, eslintSupported } from "./config.js"
import importFrom from "import-from"

let sharedESLint: ESLint | undefined

export async function initSharedESLintInstance() {
  try {
    sharedESLint = await createESLint()
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message)
    }

    process.exit(1)
  }
}

async function formatWithESLintImpl(text: string, filePath: string) {
  if (!sharedESLint) {
    throw new Error("ESLint instance not initialized")
  }

  const result = await sharedESLint.lintText(text, {
    filePath
  })

  return result[0]
}

async function formatWithESLint(text: string, filePath: string) {
  const returnValue = await measureExecutionTime(async () =>
    formatWithESLintImpl(text, filePath)
  )
  const output = returnValue.result.output ?? text
  const isModified = output !== text

  return {
    output,
    runtime: returnValue.runtime,
    isModified
  }
}

type PrettierModule = typeof import("prettier")

const PRETTIER_DEFAULT_OPTIONS = {
  ignorePath: [".prettierignore", ".gitignore"]
}

async function formatWithPrettier(text: string, filePath: string) {
  const prettierModule = importFrom(process.cwd(), "prettier") as PrettierModule
  const prettierInfo = await prettierModule.getFileInfo(
    filePath,
    PRETTIER_DEFAULT_OPTIONS
  )

  // Respect .prettierignore
  if (prettierInfo.ignored) {
    return {
      output: text,
      runtime: 0,
      isModified: null
    }
  }

  const prettierOptions = await prettierModule.resolveConfig(filePath)

  const returnValue = await measureExecutionTime(
    async () =>
      await prettierModule.format(text, {
        ...prettierOptions,
        filepath: filePath
      })
  )

  return {
    output: returnValue.result,
    runtime: returnValue.runtime,
    isModified: returnValue.result !== text
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

const symbols: Record<string, string> = {
  skipped: chalk.dim(figures.bullet),
  modified: chalk.bold(chalk.green(figures.tick)),
  error: chalk.red(figures.cross)
}

export function getSymbol(isModified: boolean | null) {
  return isModified == null
    ? symbols.error
    : isModified
    ? symbols.modified
    : symbols.skipped
}

export async function processFile(filePath: string) {
  const fileExt = extname(filePath)
  const parser = prettierParser[fileExt]

  if (!parser) {
    console.log(`${symbols.skipped} ${filePath} (unsupported)`)
    return
  }

  const content = await readFile(filePath, "utf-8")
  let modified = content

  const durations = []
  const feedback = []

  if (eslintSupported.has(fileExt)) {
    const result = await formatWithESLint(modified, filePath)
    durations.push(result.runtime)
    feedback.push(getSymbol(result.isModified))
    if (result.isModified) {
      modified = result.output
    }
  }

  const result = await formatWithPrettier(modified, filePath)
  durations.push(result.runtime)
  feedback.push(getSymbol(result.isModified))
  if (result.isModified) {
    modified = result.output
  }

  // Post ESLint is thought for post-processing previously made changes by Prettier
  if (eslintSupported.has(fileExt) && result.isModified) {
    const result = await formatWithESLint(modified, filePath)
    durations.push(result.runtime)
    feedback.push(getSymbol(result.isModified))
    if (result.isModified) {
      modified = result.output
    }
  }

  const hasChanges = modified !== content
  if (hasChanges) {
    await writeFile(filePath, modified, "utf-8")
  }

  const formattedFeedback = feedback.join(" ")

  const formattedDurations = durations
    .map((duration) => `${Math.round(duration)}ms`)
    .join(", ")

  console.log(`  ${formattedFeedback} ${filePath} (${formattedDurations})`)
}
