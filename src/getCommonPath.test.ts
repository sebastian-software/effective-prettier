import { getCommonPath } from "./getCommonPath.js"

test("should parse directories only", () => {
  expect(getCommonPath([])).toBe("")
  expect(getCommonPath(["apps/test.yaml"])).toBe("apps/")
  expect(getCommonPath(["apps/nested/test.yaml"])).toBe("apps/nested/")
  expect(getCommonPath(["test.yaml"])).toBe(".")
  expect(
    getCommonPath(["", "apps/test.yaml", "apps/nested/test.yaml", "test.yaml"])
  ).toBe(".")
})
