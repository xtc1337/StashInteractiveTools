import { Any, hooks, InteractiveAPI } from '../api';
import { useEffect, useRef } from 'react';
import { SceneDataFragment } from '../generated-graphql';
import { isIvdbScene } from './common';
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

  patch: MethodPatcher<M>,
) => {
  const methodName = patch.name as keyof InteractiveAPI;
  const original = ctx.api[methodName];

  if ('_patched' in original) return;
  console.log('patching', patch.name);
  const patchContext: PatchContext<M> = {
    ...ctx,
    name: patch.name as M,
    original,
  };

  const patchedMethod = patch.bind(patchContext) as PatchedMethod<M>;
  patchedMethod._patched = true;

  (ctx.api as Any)[methodName] = patchedMethod.bind(ctx.api);
};
export function usePatchInteractiveApi(scene: SceneDataFragment) {
  const { interactive } = hooks.useInteractive();
  const interactiveRef = useRef(interactive);

  const state = useRef({
    id: '',
    ivdb: false,
  });
  state.current.id = scene.id;
  state.current.ivdb = isIvdbScene(scene);

  useEffect(() => {
    const api = interactiveRef.current;
    const ctx: InteractivePatchContext = {
      api: api,
      state: state,
    };
    patchMethod(ctx, uploadScriptPatcher);
  }, []);

  return state;
}
