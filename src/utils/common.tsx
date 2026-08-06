import React, { ReactNode } from 'react';
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

// @see https://codeberg.org/HeMan/role-tagger/src/commit/57af02630e180731ba61c6e48bd4e7a8b4fe27e1/role-tagger.js#L7656
// Same problem as patchedChildren above, but for "after" hooks: wrapping
// a native render result in a brand-new outer Fragment alongside our own
// sibling elements (`<>{result}{ourStuff}</>`) is the obvious way to
// combine them, but it means `component.props.children` for whatever
// patches the same target *after* us is a fresh array with our own
// elements at low indices (e.g. [1], [2]) - not the native result's own
// internal structure. A plugin that (fragile as it is) indexes into that
// by fixed position expecting native content ends up reaching into our
// own injected element instead. Confirmed necessary in practice: skExtra's
// Multiple-Performer-Images plugin does exactly that on PerformerPage
// (`component.props.children[1].props.children[1]...`), and got role-
// tagger's own tab-injector element at children[1] instead of whatever
// native content it expected there, since role-tagger loads first
// alphabetically. Appending our elements as *additional* children of the
// native result itself (when it's a single cloneable element, which
// covers every current call site) leaves every native index exactly
// where it already was - our own additions only ever land past the end
// of whatever was already there. Only safe to use where the native
// result is meant to render *before* our own additions - reorder would
// be a visible behavior change, not just an internal shape change.
export function appendToNativeResult(
  result: ReactNode | ReactNode[],
  ...extraChildren: ReactNode[]
) {
  const normalizedExtraChildren = React.Children.toArray(extraChildren);

  if (Array.isArray(result) && result.length > 1) {
    return [...result, ...normalizedExtraChildren];
  }

  if (React.isValidElement<{ children?: ReactNode }>(result)) {
    return React.cloneElement(
      result,
      {},
      ...React.Children.toArray(result.props.children),
      ...normalizedExtraChildren,
    );
  }

  // Not a cloneable element (e.g. null while something's still loading,
  // or a bare string/number) - nothing to append onto, so fall back to
  // the simple wrap.
  return React.createElement(
    React.Fragment,
    null,
    result,
    ...normalizedExtraChildren,
  );
}

// @see https://codeberg.org/HeMan/role-tagger/src/commit/57af02630e180731ba61c6e48bd4e7a8b4fe27e1/role-tagger.js#L7618
// SettingsToolsSection is Stash's own "Tools" group on the Settings page
// (Backup, Import/Export, etc.) - there's no patch point inside role-
// tagger's own auto-rendered settings list, so this is the nearest
// supported extension point for a "manage roles" entry point.
// A "before" hook's return value replaces the *entire* arguments array
// patch.tsx calls the target with (`args = beforeFn.apply(ctx, args)`),
// not just the first (props) argument - so returning a bare one-element
// array here silently drops any extra argument React (or another
// plugin's chained "after" hook expecting a specific argument position,
// like the rendered result) was passed. Every patch.before below
// preserves whatever came after props via `extraArgs` rather than
// assuming props is the only argument - confirmed necessary in practice:
// this exact truncation broke another installed plugin's ScenePage.Tabs/
// ScenePage.TabContent "after" hook, which located the rendered result
// by fixed argument position and got `undefined` once this plugin's own
// "before" hook had already shortened the array ahead of it in the chain.
//
// Separately: every patched target below is a PatchContainerComponent
// (base implementation `(props) => <>{props.children}</>` per Stash's own
// patch.tsx), so `original.props.children` downstream is exactly whatever
// this plugin's own `children` value here resolves to. Wrapping the
// existing children plus this plugin's own addition in a *nested*
// React.Fragment (the seemingly-obvious way to combine "existing children
// + one more") makes that a single Fragment element, not an array - fine
// for React's own rendering, but breaks any other plugin's "after" hook
// that (not unreasonably, since multi-child JSX normally produces one)
// expects to find a real array there and call .push() on it, same as
// Stash's native multi-tab pages would have handed them without a
// wrapping plugin's before-hook in between. Returning an actual array
// instead costs nothing and renders identically, so every patch below
// does that via this helper rather than nesting another Fragment.
export function patchedChildren(
  existingChildren: ReactNode,
  existingKey: React.Key,
  ...newChildren: ReactNode[]
) {
  return [
    React.createElement(React.Fragment, { key: existingKey }, existingChildren),
    ...newChildren,
  ];
}
