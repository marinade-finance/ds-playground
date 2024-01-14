export const lamportsToSol = (lamports: string) => lamports.padStart(10, '0').replace(/(.{9})$/, '.$1')

export function zip<T1, T2, T3> (...iterables: [Iterable<T1>, Iterable<T2>, Iterable<T3>]): Generator<[T1, T2, T3]>
export function zip<T1, T2> (...iterables: [Iterable<T1>, Iterable<T2>]): Generator<[T1, T2]>
export function* zip<T1, T2> (...iterables: Iterable<T1 | T2>[]): Generator<(T1 | T2)[]> {
  const iterators = iterables.map((iterable) => iterable[Symbol.iterator]())
  while (true) {
    const results = iterators.map((iter) => iter.next())
    if (results.some((result) => result.done)) {
      return
    }
    yield results.map((result) => result.value)
  }
}
