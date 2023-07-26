type CallableFunction<T> = () => Promise<T>
interface TimedResult<T> {
  result: T
  runtime: number
}
export async function measureExecutionTime<T>(
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
