import { Any, InteractiveAPI } from '../../api';
import { MutableRefObject } from 'react';
import { createDebugConsole } from '../common';

import { Funscript, HapticDevice } from 'ive-connect';

export enum ConnectionState {
  Missing,
  Disconnected,
  Error,
  Connecting,
  Syncing,
  Uploading,
  Ready,
}

export enum SITHookEvent {
  RESOLVE_FUNSCRIPT_PATH = 'resolve.funscript.path',
}

export type Logger = ReturnType<typeof createDebugConsole>;
export type SITHookPayloadMapping = {
  [SITHookEvent.RESOLVE_FUNSCRIPT_PATH]: {
    funscriptPath: string;
    apiKey?: string;
  };
};
export type SITHookPayload<T extends SITHookEvent> = SITHookPayloadMapping[T];
export type SITHookPayloadReturn<T extends SITHookEvent> =
  | Partial<SITHookPayload<T>>
  | Promise<Partial<SITHookPayload<T>>>;

export type SITHookContext = InteractiveContext & {
  logger: Logger;
};
export type SITHookEventCallback<T extends SITHookEvent> = (
  ctx: SITHookContext,
  payload: SITHookPayload<T>,
) => SITHookPayloadReturn<T>;

export type SITHookEventDispatcher<T extends SITHookEvent> = (
  event: T,
  payload: SITHookPayload<T>,
) => SITHookPayloadReturn<T>;
export type SITHook<T extends SITHookEvent> = {
  event: T;
  name: string;
  apply: SITHookEventCallback<T>;
};
export type AnySITHook = SITHook<SITHookEvent>;

export enum HapticInterface {
  HANDY_DEFAULT = 'default',
  HANDY_FW4 = 'handy',
  HANDY_FW4_BLUETOOTH = 'buttplug',
}
export type SITPluginConfig = {
  alwaysDefaultToStashSyncOffset: boolean;
  handleHandyFileTokens: boolean;
  hapticInterface: HapticInterface;
};
export type InteractiveState = MutableRefObject<{
  id: string;
  ivdb: boolean;
  script: Funscript | null;
  blobUrl: string | null;
  hooks: AnySITHook[];
  device: HapticDevice;

  config: SITPluginConfig;
}>;
export type InteractiveContext = {
  api: InteractiveAPI;
  state: InteractiveState;
};
export type Method<M extends PatchableMethodName> = InteractiveAPI[M];
export type SetMethod<M extends PatchableMethodName> = (
  value: Parameters<InteractiveAPI[M]>[0],
) => void;
export type GetMethod<M extends PatchableMethodName> = () => () => Parameters<
  InteractiveAPI[M]
>[0];

export type PatchContext<M extends PatchableMethodName> = {
  original: InteractiveAPI[M];

  name: M;
  logger: Logger;
  set: (method: SetMethod<M>) => void;
  get: (method: GetMethod<M>) => void;
  value: (method: Method<M>) => void;
} & InteractiveContext;
export type PatchedMethod<M extends PatchableMethodName> = InteractiveAPI[M] & {
  _patched: true;
};
export type MethodPatch<M extends PatchableMethodName> = (
  ctx: PatchContext<M>,
  dispatcher: SITHookEventDispatcher<SITHookEvent>,
) => void;
export type MethodPatcher<M extends PatchableMethodName> = {
  name: M;
  patch: MethodPatch<M>;
};

export type InteractiveAPIDeferredMethod<M extends PatchableMethodName> = {
  _resolve: () => Promise<void>;
  _reject: () => void;
  args: Parameters<InteractiveAPI[M]>;
};
export type DeferredInteractiveAPI<M extends PatchableMethodName> =
  InteractiveAPI & {
    [K in `__${M}`]: InteractiveAPIDeferredMethod<M>;
  };

export const withPatcher = <M extends PatchableMethodName>(
  name: M,
  patch: MethodPatch<M>,
): MethodPatcher<M> => ({
  name,
  patch,
});

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: Any[]) => Any
    ? K
    : { get: () => Any } extends T[K]
      ? K
      : { set: (value: Any) => void } extends T[K]
        ? K
        : never;
}[keyof T];

type NonPrefixedKeys<T> = {
  [K in keyof T]: K extends `_${string}` ? never : K;
}[keyof T];

export type PatchableMethodName =
  | FunctionPropertyNames<InteractiveAPI>
  | NonPrefixedKeys<InteractiveAPI>;
