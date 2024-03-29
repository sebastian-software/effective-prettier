## Effective Prettier

A modern combined tool for using both Prettier and ESLint but only using one tool. Ideally suited for integration in editors and CI phases.

## Usage

`effective-prettier <pattern>`

Effective Prettier uses you locally installed tools. It does not include any versions of `prettier` or `eslint` on its own. In our experience this most often leads to more issues than it actually helps. We define these two tools as peer dependencies therefor:

- "eslint": "8.x",
- "prettier": "3.x"

Note: Effective Prettier will never use its own `eslint` or `prettier`. The import is modified so that it loads these dependencies (as well as the plugins) relative to the current working directory.

## Tech Stack

- `eslint` for linting JavaScript and TypeScript files
- `prettier` for formatting text content (JSON, Markdown, ...)

## License

[Apache License; Version 2.0, January 2004](http://www.apache.org/licenses/LICENSE-2.0)

## Copyright

<img src="https://cdn.rawgit.com/sebastian-software/sebastian-software-brand/0d4ec9d6/sebastiansoftware-en.svg" alt="Logo of Sebastian Software GmbH, Mainz, Germany" width="460" height="160"/>

Copyright 2023<br/>[Sebastian Software GmbH](https://www.sebastian-software.de)
