import { Any, hooks, InteractiveAPI } from '../api';
import { useMemo, useRef } from 'react';
import { SceneDataFragment } from '../generated-graphql';
import { createDebugConsole, isIvdbScene } from './common';
import {
  InteractivePatchContext,
  MethodPatcher,
  PatchableMethodName,
  PatchContext,
  PatchedMethod,
  uploadScriptPatcher,
} from './interactive';

const patchMethod = <M extends PatchableMethodName>(
  ctx: InteractivePatchContext,

  patcher: MethodPatcher<M>,
) => {
  const methodName = patcher.name as keyof InteractiveAPI;
  const original = ctx.api[methodName] as PatchedMethod<M>;

  if (original._patched) return;

  const patchContext: PatchContext<M> = {
    ...ctx,
    name: patcher.name as M,
    original: original.bind(ctx.api),
    logger: createDebugConsole(`interactiveApi.patch.${patcher.name}`, true),
  };
  patchContext.logger.log('patching...');

  const patchedMethod = patcher.patch(patchContext) as PatchedMethod<M>;
  patchedMethod._patched = true;

  (ctx.api as Any)[methodName] = patchedMethod.bind(ctx.api);
};
export function usePatchedInteractiveApi(scene: SceneDataFragment) {
  const { interactive } = hooks.useInteractive();
  const interactiveRef = useRef(interactive);

  const state = useRef({
    id: '',
    ivdb: false,
  });

  state.current.ivdb = isIvdbScene(scene);
  useMemo(() => {
    const api = interactiveRef.current;
    const ctx: InteractivePatchContext = {
      api: api,
      state: state,
    };
    patchMethod(ctx, uploadScriptPatcher);
  }, []);

  return state;
}
