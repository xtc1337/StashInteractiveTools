import { Any, InteractiveAPI } from '../api';
import { createDebugConsole } from './common';
import {
  InteractivePatchContext,
  InteractiveState,
  MethodPatcher,
  PatchableMethodName,
  PatchContext,
  PatchedMethod,
  uploadScriptPatcher,
} from './interactive';

export const patchMethod = <M extends PatchableMethodName>(
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
  const patched = patchedMethod.bind(ctx.api);
  patched._patched = true;

  (ctx.api as Any)[methodName] = patched;
};

export type SITPluginConfig = {
  alwaysDefaultToStashSyncOffset: boolean;
  handleHandyFileTokens: boolean;
};
export function usePatchedInteractiveApi(
  api: InteractiveAPI,
  state: InteractiveState,
) {
  const ctx: InteractivePatchContext = {
    api: api,
    state,
  };
  patchMethod(ctx, uploadScriptPatcher);
}
