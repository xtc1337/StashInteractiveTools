import React, { Dispatch, SetStateAction } from 'react';
import localForage from 'localforage';
import isEqual from 'lodash-es/isEqual';
import { SlideInfo } from 'thehandy/src/types';

import { GQL, hooks, utils } from '../api';

interface ILocalForage<T> {
  data: T;
  error: Error | null;
  loading: boolean;
}

const Loading: Record<string, boolean> = {};
const Cache: Record<string, object> = {};

export function useLocalForage<T extends object>(
  key: string,
  defaultValue: T = {} as T,
): [ILocalForage<T>, Dispatch<SetStateAction<T>>] {
  const [error, setError] = React.useState<Error | null>(null);
  const [data, setData] = React.useState<T>(Cache[key] as T);
  const [loading, setLoading] = React.useState(Loading[key]);

  React.useEffect(() => {
    async function runAsync() {
      try {
        let parsed = await localForage.getItem<T>(key);
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed ?? 'null');
        }
        if (parsed !== null) {
          setData(parsed);
          Cache[key] = parsed;
        } else {
          setData(defaultValue);
          Cache[key] = defaultValue;
        }
        setError(null);
      } catch (err) {
        if (err instanceof Error) setError(err);
        Cache[key] = defaultValue;
      } finally {
        Loading[key] = false;
        setLoading(false);
      }
    }

    if (!loading && !Cache[key]) {
      Loading[key] = true;
      setLoading(true);
      runAsync();
    }
  }, [loading, key, defaultValue]);

  React.useEffect(() => {
    if (!isEqual(Cache[key], data)) {
      Cache[key] = {
        ...Cache[key],
        ...data,
      };
      localForage.setItem(key, Cache[key]);
    }
  }, [data, key]);

  const isLoading = loading || loading === undefined;

  return [{ data: data ?? defaultValue, error, loading: isLoading }, setData];
}

export interface StashToolsConfig {
  syncOffset: number;
  useSavedOffset: boolean;
  ready: boolean;
  slideInfo: SlideInfo;
  alwaysDefaultToStashSyncOffset: boolean;
  stashSyncOffset: number;
}

const LOCAL_FORAGE_KEY = 'StashInteractiveTools';
export const useStashToolsConfig = (): [
  ILocalForage<StashToolsConfig>,
  Dispatch<SetStateAction<StashToolsConfig>>,
] => {
  const { interactive, initialised } = hooks.useInteractive();
  const { data: stashConfig } = GQL.useConfigurationQuery();

  const [completed, setCompleted] = React.useState(false);
  const [configurInterfaceMutation] =
    utils.StashService.useConfigureInterface();

  const [{ data, error }, setConfig] = useLocalForage<StashToolsConfig>(
    LOCAL_FORAGE_KEY,
    {
      syncOffset: stashConfig?.configuration?.interface?.funscriptOffset ?? NaN,
      useSavedOffset: false,
      alwaysDefaultToStashSyncOffset: false,
      ready: false,
      stashSyncOffset:
        stashConfig?.configuration?.interface?.funscriptOffset ?? NaN,
      slideInfo: {
        min: 0,
        max: 100,
      },
    },
  );
  const querySlideSettings = React.useCallback(async () => {
    const slideInfo =
      (await interactive._handy.getSlideSettings()) as SlideInfo;
    setConfig((current) => ({ ...current, slideInfo }));
  }, [interactive, setConfig]);
  React.useEffect(() => {
    if (!initialised) return;
    const shouldApply = !completed && stashConfig && data;
    if (shouldApply) {
      const pluginConfig =
        stashConfig?.configuration.plugins['StashInteractiveTools'];
      const alwaysDefaultToStashSyncOffset =
        (pluginConfig?.alwaysDefaultToStashSyncOffset as boolean) ?? false;
      setConfig({
        ...data,
        ready: true,
        alwaysDefaultToStashSyncOffset,
      });

      setCompleted(true);

      querySlideSettings().catch(console.error);
    }
  }, [
    setConfig,
    initialised,
    data,
    stashConfig,
    completed,
    configurInterfaceMutation,
    querySlideSettings,
  ]);

  return [{ data, error, loading: !completed }, setConfig];
};
