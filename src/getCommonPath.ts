import { normalize, sep } from "node:path"

export function getCommonPath(paths: string[]): string {
  if (paths.length === 0) {
    return ""
  }

  const splitPaths = paths.map((singlePath) => singlePath.split(sep))
  let commonPath = ""

  for (let i = 0; i < splitPaths[0].length - 1; i++) {
    const thisFolder = splitPaths[0][i]
    const isCommon = splitPaths.every(
      (singlePath) => singlePath[i] === thisFolder
    )

    if (!isCommon) {
      break
    } else {
      commonPath += thisFolder + sep
    }
  }

  return normalize(commonPath)
}
