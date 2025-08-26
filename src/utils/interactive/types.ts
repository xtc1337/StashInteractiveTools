import { Any, InteractiveAPI } from '../../api';
import { MutableRefObject } from 'react';
import { createDebugConsole } from '../common';

export type InteractiveState = MutableRefObject<{
  id: string;
  ivdb: boolean;
}>;
export type InteractivePatchContext = {
  api: InteractiveAPI;
  state: InteractiveState;
};
export type PatchContext<M extends PatchableMethodName> = {
  original: InteractiveAPI[M];

  name: M;
  logger: ReturnType<typeof createDebugConsole>;
} & InteractivePatchContext;
export type PatchedMethod<M extends PatchableMethodName> = InteractiveAPI[M] & {
  _patched: true;
};
export type MethodPatcher<M extends PatchableMethodName> = {
  name: M;
  patch: (ctx: PatchContext<M>) => InteractiveAPI[M];
};

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: Any[]) => Any ? K : never;
}[keyof T];

export type PatchableMethodName = FunctionPropertyNames<InteractiveAPI>;
