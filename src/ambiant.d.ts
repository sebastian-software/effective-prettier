declare module "@eslint/eslintrc" {
  namespace Legacy {
    namespace naming {
      function normalizePackageName(pluginName: string, prefix: string): string
    }
  }
}
