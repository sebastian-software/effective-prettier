import path from "path"

import globby from "globby"
import globParent from "glob-parent"
import isPathInside from "is-path-inside"
import meow from "meow"
import PQueue from "p-queue"
import cpuCount from "physical-cpu-count"

import prettier from "."
import { preboot } from "./eslint"

const CWD = process.cwd()

function verifyInput(paths) {
  let hasExprError = false
  paths.forEach((expr) => {
    const exprParent = path.resolve(globParent(expr))
    if (exprParent !== CWD && !isPathInside(exprParent, CWD)) {
      console.error(`Input is outside of working directory: ${expr}!`)
      hasExprError = true
    }
  })
  if (hasExprError) {
    process.exit(1)
  }
}

function processFileFactory(fileName, options) {
  return async () => {
    if (options.verbose) {
      console.log(`Processing: ${fileName}...`)
    }

    const filePath = path.resolve(fileName)
    await prettier.formatFile(filePath, options)
  }
}

// Booting up new instances is time consuming. It only makes sense
// if it consumes less time than multi threading saves. This value
// is based on some rough testing.
const MIN_FILES_PER_THREAD = 20

async function main() {
  const cli = meow(
    `
  Usage
    $ effective-prettier <input|glob>

  Options
    --verbose, -v  Increase log level
    --auto-root, -a  Detecting project root folder automatically
    --skip-ignore, -s  Skip checking any ignore files
    --enable-typed, -t  Enable ESLint rules which require types (slower)
    --concurrency  Setting the number of instances to be executed in parallel

  Examples
    $ effective-prettier filename.js --verbose
`,
    {
      flags: {
        verbose: {
          type: "boolean",
          alias: "v"
        },

        autoRoot: {
          type: "boolean",
          alias: "a"
        },

        skipIgnore: {
          type: "boolean",
          alias: "s"
        },

        enableTyped: {
          type: "boolean",
          alias: "t"
        },

        concurrency: {
          type: "number"
        }
      }
    }
  )

  if (cli.flags.verbose) {
    console.log("Files: ", cli.input)
    console.log("Flags: ", cli.flags)
  }

  if (cli.input.length === 0) {
    cli.showHelp()
  }

  verifyInput(cli.input)

  const fileNames = await globby(cli.input, { gitignore: true })
  const fileTasks = fileNames.map((fileName) => processFileFactory(fileName, cli.flags))

  const concurrency =
    cli.flags.concurrency ||
    Math.min(Math.max(1, Math.round(fileNames.length / MIN_FILES_PER_THREAD)), cpuCount)

  const queue = new PQueue({ concurrency })
  // if (cli.flags.verbose) {
  //   queue.on("active", () => {
  //     console.log(`Queue Size: ${queue.size}`)
  //   })
  // }

  if (fileTasks.length > 0) {
    preboot(cli.flags)

    try {
      await queue.addAll(fileTasks)
    } catch (except) {
      if (except.name) {
        console.warn(`${except.name}: ${except.message}`)
      }

      process.exit(1)
    }
  }
}

main()
