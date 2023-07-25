import { ESLint, Linter } from "eslint"
import { format, resolveConfig } from "prettier"
import { readFile, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
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

function prepareESLint() {
  const linter = new Linter();
  const rules = linter.getRules();

  const relevantRules: Record<string, "off"> = {};

  rules.forEach((rule, name) => {

    // console.log(rule)
    const fixable = rule.meta?.fixable;


    if (!fixable) {
      console.log('turning off rule:', name);
      relevantRules[name] = "off";
    }
  })

}

prepareESLint()
process.exit(0)

async function createESLint() {
  const inst = new ESLint({
    fix: true
  })

  // Preload the ESLint config from the current folder
  // assuming that we focus on scanning files inside CWD.
  await inst.calculateConfigForFile(join(process.cwd(), "index.ts"))

  return inst
}

const sharedESLint = await createESLint()

async function formatWithESLintImpl(text: string, filePath: string) {
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

async function formatWithPrettier(text: string, filePath: string) {
  const fileExt = extname(filePath)
  const parser = prettierParser[fileExt]

  const prettierOptions = await resolveConfig(filePath)

  const returnValue = await measureExecutionTime(
    async () =>
      await format(text, {
        ...prettierOptions,
        parser
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

const symbols: Record<string, string> = {
  skipped: chalk.dim(figures.bullet),
  modified: chalk.green(figures.tick),
  error: chalk.red(figures.cross)
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
    feedback.push(result.isModified ? symbols.modified : symbols.skipped)
    if (result.isModified) {
      modified = result.output
    }
  }

  const result = await formatWithPrettier(modified, filePath)
  durations.push(result.runtime)
  feedback.push(result.isModified ? symbols.modified : symbols.skipped)
  if (result.isModified) {
    modified = result.output
  }

  // Post ESLint is thought for post-processing previously made changes by Prettier
  if (eslintSupported.has(fileExt) && result.isModified) {
    const result = await formatWithESLint(modified, filePath)
    durations.push(result.runtime)
    feedback.push(result.isModified ? symbols.modified : symbols.skipped)
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

  console.log(`${formattedFeedback} ${filePath} (${formattedDurations})`)
}
