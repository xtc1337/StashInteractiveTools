import React from 'react';
import { SceneDataFragment } from '../generated-graphql';

export const DEFAULT_NAMESPACE = 'StashInteractiveTools';
export function createDebugConsole(namespace = '') {
  const isBrowser = typeof window !== 'undefined';

  namespace = [DEFAULT_NAMESPACE, namespace].filter(Boolean).join(':');
  const isDebug =
    (isBrowser &&
      new URLSearchParams(window.location.search).get('debug') === 'true') ||
    (typeof process !== 'undefined' && process.env?.DEBUG === 'true');

  const prefix = namespace ? `[${namespace}]` : '';

  const noop = () => {};

  return {
    debug: isDebug ? console.debug.bind(console, prefix) : noop,
    log: isDebug ? console.log.bind(console, prefix) : noop,
    info: isDebug ? console.info.bind(console, prefix) : noop,
    warn: isDebug ? console.warn.bind(console, prefix) : noop,
    error: isDebug ? console.error.bind(console, prefix) : noop,
  };
}
export function asyncReduce<T, U>(
  array: T[],

  reducer: (acc: U, curr: T, index: number, arr: T[]) => Promise<U> | U,
  initialValue: U,
): Promise<U> {
  const recurse = async (index: number, acc: U): Promise<U> => {
    if (index >= array.length) return acc;
    const next = await reducer(acc, array[index], index, array);
    return recurse(index + 1, next);
  };

  return recurse(0, initialValue);
}

/**
 * Recursively finds a React element in a component tree by slash-delimited component name path.
 * @param element The root React element to start from.
 * @param path The component path, e.g., "App/Layout/Header".
 * @returns The last matched React element or null if not found.
 */
export function findComponentByPath(
  element: React.ReactElement,
  path: string,
): React.ReactElement | null {
  const names = path.split('/');

  let current: React.ReactElement | null = element;

  for (const name of names) {
    if (!current || !current.props || !current.props.children) {
      return null;
    }

    const children = React.Children.toArray(
      current.props.children,
    ) as React.ReactElement[];

    const next = children.find((child) => {
      if (!React.isValidElement(child)) return false;

      const type = child.type;

      // For function or class components, type should be a function with a name
      if (typeof type === 'function') {
        return type.name === name;
      }

      // Handle string type (HTML tags like 'div')
      return type === name;
    });

    if (!next) return null;
    current = next;
  }

  return current;
}

export function isIvdbScene(scene: SceneDataFragment) {
  return scene.urls.some((u) => u.includes('ivdb.io/#/videos/'));
}
export function enableInteractiveTools(scene: SceneDataFragment) {
  return scene.interactive || isIvdbScene(scene);
}
