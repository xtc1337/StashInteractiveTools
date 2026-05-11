import useInteractive = PluginApi.hooks.useInteractive;
import { useRunPluginOperationMutation } from '../generated-graphql';
import { ScriptEntry } from '../components';
import { useCallback, useMemo } from 'react';
import { merge } from 'lodash-es';
import { A } from 'ts-toolbelt';
import { deepSnakeCase } from '../utils';

export enum InteractiveBackendOperation {
  INIT = 'init',
  INSTALL = 'install',
  MANAGE = 'manage',
}

type MaybeArg<A> = [A] extends [never] ? [] : [extraArgs: A];
export const useInteractiveBackend = <T, A = never>(
  operation: InteractiveBackendOperation,
  args?: Record<string, unknown>,
) => {
  const [mutation, { data, loading, called }] =
    useRunPluginOperationMutation<T>();

  const invokeBackend = useCallback(
    async (...extraArgs: MaybeArg<A>) => {
      await mutation({
        variables: {
          plugin_id: 'StashInteractiveTools',
          args: {
            mode: operation,
            ...deepSnakeCase(merge(args, extraArgs[0] || {})),
          },
        },
      });
    },
    [mutation, operation, args],
  );

  return [
    invokeBackend,
    { data: data?.runPluginOperation as T | undefined, loading, called },
  ] as const;
};

export const useInteractiveBackendInit = (sceneId: string) => {
  const { interactive } = useInteractive();

  const args = useMemo(
    () => ({
      scene_id: sceneId,
      origin: window.location.origin,
      handy_token: interactive.handyKey,
    }),
    [sceneId, interactive.handyKey],
  );

  return useInteractiveBackend<{ scripts?: ScriptEntry[] }>(
    InteractiveBackendOperation.INIT,
    args,
  );
};

export enum InteractiveBackendManageAction {
  SET_AS_DEFAULT = 'SET_AS_DEFAULT',
  // DELETE = 'DELETE',
  // ADD = 'ADD',
  // UPDATE_NAME = 'UPDATE_NAME',
  // MOVE_UP = 'MOVE_UP',
  // MOVE_DOWN = 'MOVE_DOWN',
  // RENAME = 'RENAME',
  //
  // CLEAR = 'CLEAR',
}

export type InteractiveBackendManagePayload = {
  [InteractiveBackendManageAction.SET_AS_DEFAULT]: {
    scriptId: number;
    sceneId: string;
  };
};

type PayloadHasRequiredSceneId<T> = T extends { sceneId: string }
  ? true
  : false;

type WithPayload<Payload, SceneIdAlreadyProvided extends boolean> = A.Compute<
  PayloadHasRequiredSceneId<Payload> extends true
    ? SceneIdAlreadyProvided extends true
      ? Omit<Payload, 'sceneId'> & { sceneId?: string }
      : Payload
    : Payload,
  'deep'
>;
export const useInteractiveBackendManage = <
  T extends InteractiveBackendManageAction,
  S extends string | undefined = undefined,
>(
  action: T,
  sceneId?: S,
) => {
  const args = useMemo(
    () => ({
      action,
      payload: {
        sceneId,
      },
    }),
    [action, sceneId],
  );
  return useInteractiveBackend<
    { scripts?: ScriptEntry[] },
    {
      payload: WithPayload<
        InteractiveBackendManagePayload[T],
        S extends string ? true : false
      >;
    }
  >(InteractiveBackendOperation.MANAGE, args);
};
