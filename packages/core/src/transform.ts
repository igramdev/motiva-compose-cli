export function map<T, U>(arr: T[], fn: (v: T, idx: number, src: T[]) => U): U[] {
  return arr.map(fn);
}

export function filter<T>(arr: T[], fn: (v: T, idx: number, src: T[]) => boolean): T[] {
  return arr.filter(fn);
}

export function reduce<T, U>(arr: T[], fn: (acc: U, v: T, idx: number, src: T[]) => U, init: U): U {
  return arr.reduce(fn, init);
}

export function switchCase<T, R>(value: T, cases: Record<string, () => R>, defaultCase: () => R): R {
  const key = String(value);
  return key in cases ? cases[key]() : defaultCase();
}

export function pipe<T>(value: T): {
  through: <U>(f: (v: T) => U) => ReturnType<typeof pipe<U>>;
  get: () => T;
} {
  return {
    through<U>(f: (v: T) => U) {
      return pipe(f(value));
    },
    get() {
      return value;
    }
  };
} 