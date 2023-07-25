// Changes over the default config are marked with a double exclamation mark.

module.exports = {
  // We generally allow wider code lines, but for auto formatting this
  // is quite a good rule to produce readable code.
  // In ESLint we allow for code being 110 character long, comments 140 characters.
  // With auto formatting in place and the current heuristics of prettier it works
  // better with a default of 80 characters per line though. (default = 80)
  printWidth: 80,

  // Use two spaces for tabs (default = 2)
  tabWidth: 2,

  // Unify with convention used in JSX, HTML and CSS to use double quotes (default = false)
  singleQuote: false,

  // Quote properties as needed (default = as-needed)
  quoteProps: "as-needed",

  // Keep using double quotes in JSX like in HTML. (default: false)
  jsxSingleQuote: false,

  // Don't use semicolons where they are not required (default = true !!)
  semi: false,

  // Don't do stupid trailing commas reducing noise ratio. (default = es5 !!)
  trailingComma: "none",

  // More space is better for readability (default = true)
  bracketSpacing: true,

  // Put the > of a multi-line JSX element at the end of the last line (default = false)
  bracketSameLine: false,

  // Put parens of around arguments of arrow functions (default = always)
  arrowParens: "always",
}
