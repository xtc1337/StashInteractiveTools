import useInteractive = PluginApi.hooks.useInteractive;
import { useRunPluginOperationMutation } from '../generated-graphql';
import { Script } from '../components';
import { useCallback, useMemo } from 'react';

export enum InteractiveBackendOperation {
  INIT = 'init',
  INSTALL = 'install',
}

export const useInteractiveBackend = <T>(
  operation: InteractiveBackendOperation,
  args?: Record<string, unknown>,
) => {
  const [mutation, { data, loading, called }] =
    useRunPluginOperationMutation<T>();

  const invokeBackend = useCallback(async () => {
    await mutation({
      variables: {
        plugin_id: 'StashInteractiveTools',
        args: {
          mode: operation,
          ...args,
        },
      },
    });
  }, [mutation, operation, args]);

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

  return useInteractiveBackend<{ scripts?: Script[] }>(
    InteractiveBackendOperation.INIT,
    args,
  );
};
