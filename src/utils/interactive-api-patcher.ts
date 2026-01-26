import { InteractiveAPI } from '../api';
import { asyncReduce, createDebugConsole } from './common';
import {
  InteractiveContext,
  InteractiveState,
  MethodPatcher,
  PatchableMethodName,
  PatchContext,
  PatchedMethod,
  SITHook,
  SITHookContext,
  SITHookEvent,
  SITHookEventDispatcher,
  SITHookPayload,
  SITHookPayloadReturn,
} from './interactive';
import { useCallback, useEffect, useRef } from 'react';
import { DEFAULT_PATCHES } from './interactive/patches';
import { InteractiveClient } from './interactive/client-provider';
import { DeviceSettings } from 'ive-connect';

const DEFAULT_SHOULD_PATCH_CHECKER = <M extends PatchableMethodName>(
  method: PatchedMethod<M>,
) => method._patched;

const LOGGERS: Record<string, ReturnType<typeof createDebugConsole>> = {};
export const patchMethod = <M extends PatchableMethodName>(
  ctx: InteractiveContext,

  patcher: MethodPatcher<M>,
  dispatcher: SITHookEventDispatcher<SITHookEvent>,
  shouldSkipPatching: (
    method: PatchedMethod<M>,
  ) => boolean = DEFAULT_SHOULD_PATCH_CHECKER,
) => {
  const methodName = patcher.name as keyof InteractiveAPI;

  const desc =
    Object.getOwnPropertyDescriptor(ctx.api, methodName) ||
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx.api), methodName);

  const original: PatchedMethod<M> | undefined =
    desc?.value || desc?.set || desc?.get;
  if (!original)
    throw new Error(
      `Could not find original method for ${methodName} on InteractiveAPI`,
    );
  if (shouldSkipPatching(original)) return;
  const logger = createDebugConsole(
    `interactiveApi.patch.${patcher.name}`,
    true,
  );
  const patchContext: PatchContext<M> = {
    ...ctx,
    name: patcher.name as M,
    original: original.bind(ctx.api),
    logger,
    set: (method: PatchedMethod<M>) => {
      logger.log('patching set...');
      method._patched = true;
      Object.defineProperty(ctx.api, methodName, {
        set: method,

        configurable: true,
        enumerable: true,
      });
    },
    get: (method: PatchedMethod<M>) => {
      logger.log('patching get...');
      method._patched = true;
      Object.defineProperty(ctx.api, methodName, {
        get: method,

        configurable: true,
        enumerable: true,
      });
    },
    value: (method: PatchedMethod<M>) => {
      logger.log('patching value...');
      method._patched = true;
      Object.defineProperty(ctx.api, methodName, {
        value: method,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    },
  };
  logger.log('attempting to patch...');
  patcher.patch(patchContext, dispatcher);

  /* const patchedMethod = as PatchedMethod<M>;

  const patched = patchedMethod.bind(ctx.api);
  patched._patched = true;

  (ctx.api as Any)[methodName] = patched;

  */
};

export function usePatchedInteractiveApi(
  api: InteractiveAPI,
  state: InteractiveState,
) {
  const ctx = useRef<InteractiveContext>({
    api: api,
    state,
  });
  ctx.current.api = api;
  ctx.current.state = state;
  const dispatchHooks = useCallback(
    <T extends SITHookEvent>(
      event: T,
      payload: SITHookPayload<T>,
    ): SITHookPayloadReturn<T> => {
      const logger = (LOGGERS[event] =
        LOGGERS[event] || createDebugConsole(event));
      const hooks = ctx.current.state.current.hooks.filter(
        (h) => h.event === event,
      ) as SITHook<T>[];

      const hookCtx: SITHookContext = {
        ...ctx.current,
        logger,
      };
      if (!hooks.length) {
        logger.warn(`No hooks registered for event ${event}`);
        return payload;
      }
      return asyncReduce(
        hooks,
        async (acc, hook) => {
          return {
            ...acc,
            ...(await hook.apply(hookCtx, payload)),
          };
        },
        payload,
      );
    },
    [],
  );

  DEFAULT_PATCHES.forEach((patcher) => {
    patchMethod(ctx.current, patcher, dispatchHooks);
  });
}

const logger = createDebugConsole('interactive-api-patcher');
export function useResumeInteractive(
  api: InteractiveAPI,
  state: InteractiveState,
) {
  const client = api as InteractiveClient;
  const { device } = state.current;

  useEffect(() => {
    if (client.deferred) {
      client
        .resume('configure', async (m) => {
          logger.debug('configure resuming');

          const config = m.args[0] as Partial<DeviceSettings>;
          if (config.connectionKey) {
            client.handyKey = String(config.connectionKey);
          }
          logger.debug('connecting to device for configure');
          await device.updateConfig(config);
          setTimeout(() => m._resolve(), 1000);
        })
        .finally(() => {
          logger.debug('configure resumed');
        });
    }
  }, [client, device]);
}
