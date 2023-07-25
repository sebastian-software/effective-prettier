import { ESLint, Linter, Rule } from "eslint"
import { format, resolveConfig } from "prettier"
import { readFile, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import figures from "figures"
import chalk from "chalk"
import { Legacy } from "@eslint/eslintrc"

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

type PluginModule = {
  default: ESLint.Plugin
}

function getFullyQualifiedPluginName(pluginName: string) {
  // Rely on the quite internal naming helper in ESLint.
  // This is not rock solid for the distance future but feels better
  // than trying to replicate the same logic here.
  return Legacy.naming.normalizePackageName(pluginName, "eslint-plugin")
}

async function loadPlugin(pluginName: string): Promise<ESLint.Plugin> {
  const longName = getFullyQualifiedPluginName(pluginName)
  const module = (await import(longName)) as PluginModule
  return module.default
}

// ESLint TypeScript uses a non-standard flag requiresTypeChecking on their docs section
type ExtendedDocs = Rule.RuleMetaData["docs"] & {
  requiresTypeChecking?: boolean
}

type RuleSet = Record<string, Rule.RuleModule>

function getFixableRules(rules: RuleSet, prefix = "") {
  const fixable = new Set()

  for (const [name, rule] of Object.entries(rules)) {
    const meta = rule.meta
    const docs = meta?.docs as ExtendedDocs
    const requiresTypes = docs?.requiresTypeChecking as boolean
    const isFixable = meta?.fixable

    if (isFixable && !requiresTypes) {
      fixable.add(`${prefix}${name}`)
    }
  }

  return fixable
}

function convertMapToRecord<T>(map: Map<string, T>): Record<string, T> {
  const record: Record<string, T> = {}
  for (const [key, value] of map.entries()) {
    record[key] = value
  }
  return record
}

async function getFixableRulesOfPlugin(pluginName: string) {
  const plugin = await loadPlugin(pluginName)
  const rules = plugin.rules as RuleSet
  return getFixableRules(rules, `${pluginName}/`)
}

async function createESLint() {
  const inst = new ESLint({
    fix: true
  })

  // Preload the ESLint config from the current folder
  // assuming that we focus on scanning files inside CWD.
  const config = (await inst.calculateConfigForFile(
    join(process.cwd(), "index.ts")
  )) as Linter.Config

  const linter = new Linter()
  const fixableBuiltIns = getFixableRules(convertMapToRecord(linter.getRules()))

  const fixable = [...fixableBuiltIns]
  if (config.plugins) {
    for (const pluginName of config.plugins) {
      fixable.push(...(await getFixableRulesOfPlugin(pluginName)))
    }
  }

  console.log("ALL FIXABLE:", JSON.stringify(fixable))

  // const filePath = join(process.cwd(), "src/index.ts")

  // const result = await inst.lintText("const x", { filePath })
  // const meta = inst.getRulesMetaForResults(result)
  // => meta is always = {} - DAMN!

  // console.log("FILE-PATH:", filePath)
  // console.log("META:", meta)

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
