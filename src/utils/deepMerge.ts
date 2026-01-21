/* eslint-disable @typescript-eslint/no-explicit-any */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function deepMerge<T extends object>(
  target: T,
  ...sources: DeepPartial<T>[]
): T {
  if (!sources.length) {
    return target;
  }

  const source = sources.shift();
  if (!source) {
    return target;
  }

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const targetValue = target[key as keyof T];
      const sourceValue = source[key as keyof DeepPartial<T>];

      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        // Dedupe array values based on JSON string representation
        const combined = [...targetValue, ...sourceValue];
        const deduped = dedupeArray(combined);
        (target as any)[key] = deduped;
      } else if (isObject(targetValue) && isObject(sourceValue)) {
        (target as any)[key] = deepMerge(
          Object.assign({}, targetValue),
          sourceValue as any,
        );
      } else if (sourceValue !== undefined) {
        (target as any)[key] = sourceValue;
      }
    });
  }

  return deepMerge(target, ...sources);
}

function isObject(item: unknown): item is object {
  return Boolean(
    item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      !(item instanceof Date) &&
      !(item instanceof RegExp),
  );
}

function dedupeArray<T>(array: T[]): T[] {
  const seen = new Map<string, T>();

  array.forEach((item) => {
    const key = getObjectKey(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  });

  return Array.from(seen.values());
}

function getObjectKey(item: unknown): string {
  if (typeof item === 'object' && item !== null) {
    return JSON.stringify(sortObjectKeys(item));
  }
  return String(item);
}

function sortObjectKeys<T extends object>(obj: T): T {
  if (!isObject(obj)) {
    return obj;
  }

  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      const value = obj[key as keyof T];
      (acc as any)[key] = isObject(value) ? sortObjectKeys(value) : value;
      return acc;
    }, {} as T);
}
