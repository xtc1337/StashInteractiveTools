import React from 'react';
import { SceneDataFragment } from '../generated-graphql';
import { logStore } from './log-store';

export const DEFAULT_NAMESPACE = 'StashInteractiveTools';

export function createDebugConsole(namespace = '', isDebug?: boolean) {
  const isBrowser = typeof window !== 'undefined';
  if (process.env.DEBUG) {
    isDebug = true;
  }

  namespace = [DEFAULT_NAMESPACE, namespace].filter(Boolean).join(':');
  if (typeof isDebug === 'undefined') {
    isDebug =
      (isBrowser &&
        new URLSearchParams(window.location.search).get('debug') === 'true') ||
      process.env.DEBUG === 'true';
  }

  const prefix = namespace ? `[${namespace}]` : '';
  const ns = namespace;

  return {
    namespace,
    debug: (...args: unknown[]) => {
      logStore.push('debug', ns, args);
      if (isDebug) console.debug(prefix, ...args);
    },
    log: (...args: unknown[]) => {
      logStore.push('log', ns, args);
      if (isDebug) console.log(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      logStore.push('info', ns, args);
      if (isDebug) console.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      logStore.push('warn', ns, args);
      if (isDebug) console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      logStore.push('error', ns, args);
      if (isDebug) console.error(prefix, ...args);
    },
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

export function isIvdbTokenUrl(url: string) {
  return url.includes('/token/download');
}
export function isIvdbScene(scene: SceneDataFragment) {
  return scene.urls.some((u) => u.includes('ivdb.io/#/videos/'));
}
export function enableInteractiveTools(scene: SceneDataFragment) {
  return scene.interactive || isIvdbScene(scene);
}
