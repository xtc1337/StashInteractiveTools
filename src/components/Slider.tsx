import {
  ChangeEvent,
  ChangeEventHandler,
  EffectCallback,
  useCallback,
  useEffect,
  useState,
} from 'react';
import videojs from 'video.js';
import { useDebouncedCallback } from 'use-debounce';
import { StashToolsConfig, useStashToolsConfig } from '../hooks';
import React from 'react';
import { hooks } from '../api';
import InteractiveAPI = PluginApi.hooks.InteractiveAPI;

type PlayerElement = { player?: videojs.Player } | undefined;

async function withPlayer(callback: (player: videojs.Player) => Promise<void>) {
  const waitFor = async () => {
    const el = document.getElementsByTagName('video-js')[0] as PlayerElement;
    const player = el?.player;
    if (player) {
      return await callback(player);
    }
    setTimeout(waitFor, 100);
  };
  return waitFor();
}

export type SliderContext<T> = {
  currentValue: T;
  interactive: InteractiveAPI;
  interactiveSync: () => Promise<void>;
  withPlayer: typeof withPlayer;
  config: StashToolsConfig;
};
export type SliderOnCommit<T> = (
  ctx: SliderContext<T>,
  nextValue?: T,
) => Promise<T> | Promise<[T, boolean?]>;

export type SliderOnBeforeCommit<T> = (ctx: SliderContext<T>) => Promise<void>;
export type SliderOnAfterCommit<T> = (ctx: SliderContext<T>) => Promise<void>;
export type SliderOnSetup<T> = (
  ctx: SliderContext<T>,
  setValue: (v: T) => void,
) => Promise<ReturnType<EffectCallback>>;
export type SliderProps<T> = {
  defaultValue: T;
  configName: keyof StashToolsConfig;
  onBeforeCommit?: SliderOnBeforeCommit<T>;
  onCommit: SliderOnCommit<T>;
  onAfterCommit?: SliderOnAfterCommit<T>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => T;
  onSetup?: SliderOnSetup<T>;
  children: (
    currentValue: T,
    onSliderChanged: ChangeEventHandler<HTMLInputElement>,
    initialised: boolean,
  ) => React.JSX.Element;
};
const Slider = <T,>({
  defaultValue,
  configName,
  onCommit,
  onBeforeCommit,
  onAfterCommit,
  onChange,
  children,
  onSetup,
}: SliderProps<T>) => {
  const {
    interactive,
    initialised,
    sync: interactiveSync,
  } = hooks.useInteractive();
  const [{ data: config, loading: isConfigLoaded }, setConfig] =
    useStashToolsConfig();

  const [completed, setCompleted] = useState(false);
  const [currentValue, setCurrentValue] = useState(defaultValue);
  const [setup, setSetup] = useState(true);

  const onCommitSyncChanges = useDebouncedCallback(async (nextValue?: T) => {
    const ctx: SliderContext<T> = {
      currentValue,
      interactive,
      interactiveSync,
      withPlayer,
      config,
    };
    await onBeforeCommit?.(ctx);
    const commitReturnValue = await onCommit(ctx, nextValue);
    const [finalValue, shouldSaveToConfig] = Array.isArray(commitReturnValue)
      ? commitReturnValue
      : [commitReturnValue, true];
    if (shouldSaveToConfig) {
      setConfig((v) => ({
        ...v,
        [configName]: finalValue,
      }));
    }

    setCurrentValue(finalValue);
    await onAfterCommit?.(ctx);
  }, 100);
  const onSliderChanged: ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      const value = onChange(e);
      setCurrentValue(value);
      onCommitSyncChanges(value)?.catch(console.error);
    },
    [onCommitSyncChanges, onChange],
  );
  const onInitialize = useCallback(() => {
    onCommitSyncChanges()
      ?.catch(console.error)
      .finally(() => {
        setCompleted(true);
      });
  }, [setCompleted, onCommitSyncChanges]);

  useEffect(() => {
    if (!setup || !isConfigLoaded || !config.ready) return;
    const tryInitialize = () => {
      if (initialised && isConfigLoaded && !completed) {
        onInitialize();
      }
    };
    if (setup) {
      const ctx: SliderContext<T> = {
        currentValue,
        interactive,
        interactiveSync,
        withPlayer,
        config,
      };
      onSetup?.(ctx, setCurrentValue).then(() => {
        tryInitialize();
      });
      setSetup(false);
    } else {
      tryInitialize();
    }
  }, [
    onInitialize,
    initialised,
    completed,
    isConfigLoaded,
    setup,
    onSetup,
    setSetup,
    currentValue,
    interactive,
    config,
    setCurrentValue,
    interactiveSync,
  ]);

  return children(currentValue, onSliderChanged, initialised);
};
export default Slider;
