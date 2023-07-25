import { ESLint }  from "eslint"
import { format } from "prettier"
import glob from "fast-glob"
import { readFile } from 'node:fs/promises';
import { extname } from "node:path";

const prettierParser: Record<string, string> = {
  ".json": "json",
  ".css": "css",
  ".tsc": "typescript",
  ".ts": "typescript",
  ".md": "markdown",
  ".mdx": "mdx",
  ".html": "html",
  ".yaml": "yaml",
  ".yml": "yaml",
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
  ".mts": true,
}

// 1. Create an instance.
const eslint = new ESLint();

async function processFile(filePath: string) {
  const fileExt = extname(filePath)
  const parser = prettierParser[fileExt] ?? "babel"

  let content = await readFile(filePath, "utf-8")

  if (eslintSupported[fileExt]) {
    const lintResultPre = await eslint.lintText(content, {filePath})
    content = lintResultPre[0].output ?? content
  }

  content = await format(content, {parser})

  if (eslintSupported[fileExt]) {
    const lintResultPost = await eslint.lintText(content, {filePath})
    content = lintResultPost[0].output ?? content
  }

  console.log("FORMATTED:", filePath, content)

}

async function main(patterns: string[] = []) {
  const files = await glob(patterns)
  console.log("FILES:", files)

  const results = await Promise.all(files.map(processFile))

  console.log("DONE")
  console.log("Results:", results)

  // // 2. Lint files.
  // const results = await eslint.lintFiles(["src/**/*.(ts,tsx,js)"]);

  // // 3. Format the results.
  // const formatter = await eslint.loadFormatter("stylish");
  // const resultText = formatter.format(results);

  // // 4. Output it.
  // console.log(resultText);
}

try {
  main([
    "src/**/*.{ts,tsx,js,jsx,mjs,cjc,mts,cts}"
  ]);
} catch(error) {
  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
}

