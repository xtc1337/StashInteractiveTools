import { Any, GQL, InteractiveAPI } from '../api';
import { SceneDataFragment } from '../generated-graphql';
import { useApolloClient } from '@apollo/client';
import React, {
  Dispatch,
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScriptEntry } from '../components';
import {
  AnySITHook,
  ConnectionState,
  createDebugConsole,
  deepMerge,
  dispatchSITEvent,
  enableHandyTokens,
  generateHeatmap,
  getFunscript,
  HapticInterface,
  InteractiveState,
  isIvdbTokenUrl,
  replaceHeatMap,
  SITEvent,
  SITPluginConfig,
  usePatchedInteractiveApi,
  useResumeInteractive,
} from '../utils';

import { AnyModifierDef, ModifierPreset } from '../components/modifiers';
import {
  MODIFICATION_PIPELINE_ID,
  ModificationPipeline,
} from '../components/modifiers/pipeline';
import { DB, DBSchema, IndexedDBWrapper } from '../utils/db';
import { DefaultHandyClient } from '../utils/interactive/client';
import {
  ButtplugDevice,
  Funscript,
  HandyDevice,
  HapticDevice,
} from 'ive-connect';

import { useInteractivePipelines } from './useInteractivePipelines';
import { useInteractivePresets } from './useInteractivePresets';
import { ScenePaths, ScriptPipeline } from './types';
import { useInteractiveBackendInit } from './useInteractiveBackend';
import useInteractive = PluginApi.hooks.useInteractive;

async function applyScriptChanges(url: string, script: Funscript) {
  return {
    blobUrl: (window.webkitURL || window.URL).createObjectURL(
      new Blob([JSON.stringify(script)], { type: 'text/plain' }),
    ),
    src: url,
  };
}

const logger = createDebugConsole('useInteractiveTools');
export type InteractiveContext = {
  hasSetupError: boolean;
  scene: SceneDataFragment;
  currentPaths: ScenePaths;
  defaultPaths: ScenePaths;
  state: ConnectionState;
  entries: ScriptEntry[];
  onChange: (script?: ScriptEntry) => Promise<void>;
  db: IndexedDBWrapper<DBSchema>;
  preset: ModifierPreset | null;
  presets: ModifierPreset[];
  setPreset: (preset: ModifierPreset | null, toDelete?: boolean) => void;
  device: MutableRefObject<HapticDevice | undefined>;
  interactiveState: InteractiveState;
  addPipeline<T extends ScriptPipeline>(
    pipeline: T,
    update: true,
  ): Promise<void>;
  addPipeline<T extends ScriptPipeline>(
    pipeline: T,
    update: undefined | false,
  ): void;
  addPipeline<T extends ScriptPipeline>(
    pipeline: T,
    update?: boolean,
  ): Promise<void> | void;
  getPipeline: <T extends ScriptPipeline = ScriptPipeline>(
    name: string,
  ) => T | undefined;
  removePipeline<T extends ScriptPipeline = ScriptPipeline>(
    name: string,
    update: true,
  ): Promise<T | undefined>;

  removePipeline(name: string, update?: false | undefined): void;
  removePipeline<T extends ScriptPipeline = ScriptPipeline>(
    name: string,
    update?: boolean,
  ): Promise<T | undefined> | void;
  updateScript: (script?: Funscript | null) => Promise<ScenePaths | undefined>;
  updateModifiers: (modifiers: AnyModifierDef[]) => void;
  setHooks: Dispatch<AnySITHook[]>;
  readonly pipelines: ScriptPipeline[];
};
const InteractiveToolsContext = React.createContext<InteractiveContext>(
  {} as InteractiveContext,
);

type Props = React.PropsWithChildren<{
  scene: SceneDataFragment;
}>;

const DEFAULT_SIT_PLUGIN_CONFIG: SITPluginConfig = {
  alwaysDefaultToStashSyncOffset: false,
  handleHandyFileTokens: true,
  hapticInterface: HapticInterface.HANDY_DEFAULT,
  disableHapticInterface: false,
  hapticInterfaceUrl: 'ws://localhost:12345',
};

type HapticDeviceBuilder = (
  interactive: InteractiveAPI,
  config: SITPluginConfig,
) => HapticDevice;

const DEFAULT_CLIENT_BUILDER: HapticDeviceBuilder = (interactive) =>
  new DefaultHandyClient(
    interactive._handy,
    interactive.handyKey,
    interactive.scriptOffset,
  );
const clientBuilders: Record<HapticInterface, HapticDeviceBuilder> = {
  [HapticInterface.HANDY_DEFAULT]: DEFAULT_CLIENT_BUILDER,
  [HapticInterface.HANDY_FW4]: (i) =>
    new HandyDevice({
      applicationId: process.env.HANDY_APPLICATION_ID,
      connectionKey: i.handyKey,
    }),
  [HapticInterface.HANDY_FW4_BLUETOOTH]: (_, config) =>
    new ButtplugDevice({
      serverUrl: config.hapticInterfaceUrl,
    }),
};

function getInteractiveDevice(
  interactive: InteractiveAPI,
  config: SITPluginConfig,
  device: MutableRefObject<HapticDevice | undefined>,
): HapticDevice {
  const hapticInterface =
    config.hapticInterface || HapticInterface.HANDY_DEFAULT;
  const builder = clientBuilders[hapticInterface];
  if (device.current?.id !== hapticInterface) {
    device.current?.disconnect();
    console.log('Connecting to', hapticInterface, config);
    return builder(interactive, config);
  }
  return device.current;
}

export const InteractiveToolsProvider = ({ scene, children }: Props) => {
  const [entries, setEntries] = useState<ScriptEntry[]>([]);

  const unmodifiedScript = useRef<Funscript>();

  const { data: stashConfig } = GQL.useConfigurationQuery();

  const [currentHooks, setHooks] = useState([enableHandyTokens]);

  const sitPluginConfig: SITPluginConfig =
    stashConfig?.configuration?.plugins?.['StashInteractiveTools'] ||
    DEFAULT_SIT_PLUGIN_CONFIG;
  const { interactive, state } = useInteractive();

  const device = useRef<HapticDevice>();
  device.current = getInteractiveDevice(interactive, sitPluginConfig, device);

  const interactiveState = useRef({
    id: '',
    ivdb: false,
    entry: null as ScriptEntry | null,
    script: null as Funscript | null,
    blobUrl: null as string | null,
    config: sitPluginConfig,
    device: device.current,
    hooks: currentHooks,
    cache: {} as Record<string, Any>,
  });
  if (interactiveState.current.id != scene.id) {
    interactiveState.current.id = scene.id;
    interactiveState.current.ivdb = false;
    interactiveState.current.script = null;
    interactiveState.current.blobUrl = null;
    interactiveState.current.entry = null;
  }

  interactiveState.current.hooks = currentHooks;

  interactiveState.current.config = sitPluginConfig;

  usePatchedInteractiveApi(interactive, interactiveState);

  const [currentPaths, setCurrentPaths] = useState<ScenePaths>({
    blobUrl: scene.paths.funscript || '',
    src: scene.paths.funscript || '',
    heatMap: scene.paths.interactive_heatmap,
  });

  //useSubscribeToSceneUpdates(currentPaths);

  const currentPathsRef = useRef(currentPaths);
  currentPathsRef.current = currentPaths;
  const updateScriptRef = useRef<
    ((script?: Funscript | null) => Promise<ScenePaths | undefined>) | null
  >(null);
  const client = useApolloClient();

  const hasInitialized = useRef(false);

  const [hasSetupError, setHasSetupError] = useState(false);
  const onPipelineChanged = useCallback(async () => {
    await updateScriptRef.current?.();
  }, []);

  const { pipelines, getPipeline, addPipeline, removePipeline, runPipeline } =
    useInteractivePipelines({
      onPipelineChanged,
    });
  const { preset, presets, updatePresets, setPreset } = useInteractivePresets();

  const [defaultPaths] = useState<ScenePaths>({
    blobUrl: scene.paths.funscript,
    src: scene.paths.funscript,
    heatMap: scene.paths.interactive_heatmap,
  });

  const [initializeScene, initializeResults] = useInteractiveBackendInit(
    scene.id,
  );

  const runScriptPipeline = useCallback(
    async (script: Funscript | null, updatedUrl?: string) => {
      const url = updatedUrl || currentPathsRef.current.src || '';

      if (!script) {
        return;
      }

      let changes: { blobUrl: string; src: string };

      if (interactiveState.current.ivdb) {
        changes = {
          blobUrl: url,
          src: url,
        };
      } else {
        const pipe = await runPipeline(script, url);
        changes = await applyScriptChanges(url, pipe.script);
        interactiveState.current.script = pipe.script;
      }

      const heatMap = await generateHeatmap(changes.blobUrl);
      const newPaths = {
        ...changes,
        heatMap,
      };

      if (newPaths.heatMap) {
        replaceHeatMap(newPaths.heatMap);
      }

      interactiveState.current.blobUrl = newPaths.blobUrl;

      client.writeQuery({
        query: GQL.FindSceneDocument,
        data: {
          findScene: deepMerge({}, scene, {
            interactive: true,
            paths: {
              funscript: newPaths.blobUrl,
              interactive_heatmap: newPaths.heatMap,
            },
          }),
        },
        variables: {
          id: scene.id,
        },
      });

      setCurrentPaths(newPaths);
      return newPaths;
    },
    [client, runPipeline, scene],
  );

  const updateScript = useCallback(
    async (script?: Funscript | null) => {
      script = script || unmodifiedScript.current;
      if (script) {
        return await runScriptPipeline(script);
      }
    },
    [runScriptPipeline],
  );
  updateScriptRef.current = updateScript;

  const updateModifiers = useCallback(
    (modifiers: AnyModifierDef[]) => {
      getPipeline<ModificationPipeline>(MODIFICATION_PIPELINE_ID)!.modifiers =
        modifiers;
      updateScript().catch(console.error);
    },
    [getPipeline, updateScript],
  );
  const onChange = useCallback(
    async (scriptEntry?: ScriptEntry) => {
      const scriptUrl = String(scriptEntry?.path ?? currentPaths.src);

      const script = await getFunscript(scriptUrl);

      unmodifiedScript.current = script;

      interactiveState.current.blobUrl = null;
      interactiveState.current.ivdb = isIvdbTokenUrl(scriptUrl);
      interactiveState.current.script = script;

      setEntries((items) => {
        const entry = items.find((e) => e.path === scriptUrl) || null;
        if (!entry) return items;
        const isDefault = scriptEntry?.isDefault ?? entry.isDefault;
        interactiveState.current.entry = {
          ...entry,
          isDefault,
        };
        return items.map((e, index) => ({
          ...e,
          isDefault:
            e.id === entry.id ? isDefault : isDefault ? false : index == 0,
        }));
      });
      await runScriptPipeline(script, scriptUrl);
    },
    [currentPaths, runScriptPipeline, setEntries],
  );

  useEffect(() => {
    const ivdb = interactiveState.current.ivdb;
    if (!ivdb && scene.paths.interactive_heatmap) {
      replaceHeatMap(scene.paths.interactive_heatmap);
    }
  }, [scene, updateScript]);

  const id = scene.id;
  useEffect(() => {
    unmodifiedScript.current = undefined;
    initializeScene().catch(console.error);
  }, [initializeScene, id]);

  useEffect(() => {
    const {
      data: { scripts } = { scripts: undefined },
      loading,
      called,
    } = initializeResults || {};

    function setup() {
      DB.getAll('presets').then((records) => {
        updatePresets(records);
      });
    }
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      setup();
    }

    if (!scripts) {
      if (called && !loading) {
        dispatchSITEvent(SITEvent.INCORRECT_SETUP);
        setHasSetupError(true);
      }
      return;
    }

    if (scripts.length && !interactiveState.current.script) {
      logger.debug('Interactive tools initialized', { scripts });
      setEntries(scripts);
      interactiveState.current.id = id;
      interactiveState.current.ivdb = false;
      interactiveState.current.script = null;
      interactiveState.current.blobUrl = null;
      onChange(scripts[0]).catch(console.error);
    }
    // if (scripts.length && entries != scripts) {

    //}
  }, [initializeResults, runScriptPipeline, id, onChange, updatePresets]);

  useResumeInteractive(interactive, interactiveState);
  useEffect(() => {
    logger.debug('Connection status updated', { state });
    dispatchSITEvent(SITEvent.CONNECTION_STATUS_UPDATED, {
      state,
    });
  }, [state]);

  const isDefault = interactiveState.current.entry?.isDefault ?? true;
  const contextValue = useMemo(
    () => ({
      state,
      entries,
      onChange,
      currentPaths,
      defaultPaths,
      scene,
      db: DB,
      addPipeline,
      pipelines,
      removePipeline,
      preset,
      presets,
      setPreset,
      device: device,
      getPipeline,
      updateScript,
      updateModifiers,
      interactiveState,
      setHooks,
      hasSetupError,
      isDefault,
    }),
    [
      state,
      entries,
      onChange,
      currentPaths,
      defaultPaths,
      scene,
      pipelines,
      addPipeline,
      removePipeline,
      getPipeline,
      updateScript,
      preset,
      updateModifiers,
      setPreset,
      presets,
      setHooks,
      hasSetupError,
      isDefault,
    ],
  );
  return (
    <InteractiveToolsContext.Provider value={contextValue}>
      {children}
    </InteractiveToolsContext.Provider>
  );
};

export const useInteractiveTools = () => {
  return React.useContext(InteractiveToolsContext);
};
