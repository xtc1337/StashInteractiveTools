import { InteractiveAPI } from '../../api';
import { MutableRefObject } from 'react';

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
} & InteractivePatchContext;
export type PatchedMethod<M extends PatchableMethodName> = InteractiveAPI[M] & {
  _patched: true;
};
export type MethodPatcher<M extends PatchableMethodName> = {
  name: M;
  bind: (ctx: PatchContext<M>) => InteractiveAPI[M];
};

export type PatchableMethodName = keyof InteractiveAPI;
