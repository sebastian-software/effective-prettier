import type { ESLint, Linter, Rule } from "eslint"
import { join } from "node:path"
import { Legacy } from "@eslint/eslintrc"
import importFrom from "import-from"

function getFullyQualifiedPluginName(pluginName: string) {
  // Rely on the quite internal naming helper in ESLint.
  // This is not rock solid for the distance future but feels better
  // than trying to replicate the same logic here.
  return Legacy.naming.normalizePackageName(pluginName, "eslint-plugin")
}

function loadPlugin(pluginName: string): ESLint.Plugin {
  const longName = getFullyQualifiedPluginName(pluginName)
  return importFrom(process.cwd(), longName) as ESLint.Plugin
}

// ESLint TypeScript uses a non-standard flag requiresTypeChecking on their docs section
type ExtendedDocs = Rule.RuleMetaData["docs"] & {
  requiresTypeChecking?: boolean
}

type RuleSet = Record<string, Rule.RuleModule>

function classifyRules(
  rules: RuleSet,
  pluginName = "",
  fixTypeChecked = false
) {
  const fixable = new Set<string>()
  const reportable = new Set<string>()

  for (const [name, rule] of Object.entries(rules)) {
    const meta = rule.meta
    const docs = meta?.docs as ExtendedDocs
    const requiresTypes = docs?.requiresTypeChecking
    const isFixable = meta?.fixable
    const prefix = pluginName ? `${pluginName}/` : ""

    if (isFixable && requiresTypes && !fixTypeChecked) {
      console.log(`  - Ignoring rule ${prefix}${name} (requires type checking)`)
    }

    if (isFixable && (fixTypeChecked || !requiresTypes)) {
      fixable.add(`${prefix}${name}`)
    } else {
      reportable.add(`${prefix}${name}`)
    }
  }

  return { fixable, reportable }
}

function convertMapToRecord<T>(map: Map<string, T>): Record<string, T> {
  const record: Record<string, T> = {}
  for (const [key, value] of map.entries()) {
    record[key] = value
  }
  return record
}

function getFixableRulesOfPlugin(pluginName: string, fixTypeChecked: boolean) {
  const plugin = loadPlugin(pluginName)
  const rules = plugin.rules as RuleSet
  return classifyRules(rules, pluginName, fixTypeChecked)
}

// Only listing the most relevant acutally used members of the official module
type ESLintModule = {
  ESLint: typeof ESLint
  Linter: typeof Linter
}

export async function createESLint() {
  const eslintModule = importFrom(process.cwd(), "eslint") as ESLintModule

  console.log(`- Initializing ESLint v${eslintModule.Linter.version}...`)

  const preInstance = new eslintModule.ESLint({
    fix: true
  })

  // Preload the ESLint config from the current folder
  // assuming that we focus on scanning files inside CWD.
  const config = (await preInstance.calculateConfigForFile(
    join(process.cwd(), "index.ts")
  )) as Linter.Config

  const linter = new eslintModule.Linter()
  const builtIns = classifyRules(convertMapToRecord(linter.getRules()))

  console.log(`- Loading rules from ${config.plugins?.length ?? 0} plugins...`)

  const fixable = [...builtIns.fixable]
  const reportable = [...builtIns.reportable]

  if (config.plugins) {
    for (const pluginName of config.plugins) {
      const classified = await getFixableRulesOfPlugin(pluginName)
      fixable.push(...classified.fixable)
      reportable.push(...classified.reportable)
    }
  }

  console.log(`- Found ${fixable.length} fixable rules.`)
  console.log(`- Found ${reportable.length} reportable rules.`)

  console.log("- Creating ESLint instance for formatting...")

  const reportableRulesOff: Record<string, "off"> = {}
  for (const rule of reportable) {
    reportableRulesOff[rule] = "off"
  }

  const fixInstance = new eslintModule.ESLint({
    fix: true,
    overrideConfig: {
      rules: reportableRulesOff
    }
  })

  return fixInstance
}
