export const prettierParser: Record<string, string> = {
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

export const eslintSupported = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".cjs",
  ".cts"
])

export const PARALLEL_TASKS = 4
