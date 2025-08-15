import { GQL, hooks } from '../api';
import {
  SceneDataFragment,
  useRunPluginOperationMutation,
} from '../generated-graphql';
import { useApolloClient } from '@apollo/client';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Script } from '../components';
import { FunMapper } from 'funscript-utils';
import { deepMerge, isIvdbScene } from '../utils';
import { Funscript } from 'funscript-utils/lib/types';
import { AnyModifierDef, ModifierPreset } from '../components/modifiers';
import {
  MODIFICATION_PIPELINE_ID,
  ModificationPipeline,
} from '../components/modifiers/pipeline';
import { DB, DBSchema, IndexedDBWrapper } from '../utils/db';

const canvas = document.createElement('canvas');
canvas.width = 1280;
canvas.height = 60;
const rootVars = document.documentElement;

function replaceHeatMap(url: string) {
  rootVars.style.setProperty(
    '--stash-interactive-tools-heatmap',
    `url(${url})`,
    'important',
  );
}

async function getScript(url: string) {
  return (await fetch(url).then((response) => response.json())) as Funscript;
}

async function generateHeatmap(url: string) {
  const script = await getScript(url);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  FunMapper.renderHeatmap(canvas, script, {
    background: 'rgba(255,255, 255, 0)',
  });
  return canvas.toDataURL('image/png');
}

async function applyScriptChanges(
  url: string,
  script: Funscript & { range?: number },
) {
  //const { range: _, ...rest } = script;
  return {
    blobUrl: (window.webkitURL || window.URL).createObjectURL(
      new Blob([JSON.stringify(script)], { type: 'text/plain' }),
    ),
    src: url,
  };
}
export type ScriptPipe = {
  url: string;
  script: Funscript;
};
export interface ScriptPipeline {
  apply(pipe: ScriptPipe): Promise<ScriptPipe> | ScriptPipe;
  readonly name: string;
}
export type InteractiveContext = {
  scene: SceneDataFragment;
  currentPaths: ScenePaths;
  defaultPaths: ScenePaths;
  entries: Script[];
  onChange: (script: string) => Promise<void>;
  db: IndexedDBWrapper<DBSchema>;
  preset: ModifierPreset | null;
  presets: ModifierPreset[];
  setPreset: (preset: ModifierPreset | null, toDelete?: boolean) => void;
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
  readonly pipelines: ScriptPipeline[];
};
const InteractiveToolsContext = React.createContext<InteractiveContext>(
  {} as InteractiveContext,
);

type Props = React.PropsWithChildren<{
  scene: SceneDataFragment;
}>;
type ScenePaths = {
  blobUrl?: string | null;
  src?: string | null;
  heatMap?: string | null;
};
export async function resolveScriptPipeline(
  initialValue: ScriptPipe,
  pipelines: ScriptPipeline[],
) {
  return pipelines.reduce(
    (promiseAcc, current) => promiseAcc.then((acc) => current.apply(acc)),
    Promise.resolve(initialValue),
  );
}

export const InteractiveToolsProvider = ({ scene, children }: Props) => {
  const [entries, setEntries] = useState<Script[]>([]);
  const { interactive } = hooks.useInteractive();
  const interactiveRef = useRef(interactive);

  const unmodifiedScript = useRef<Funscript>();
  const [presets, updatePresets] = useState<ModifierPreset[]>([]);
  const [preset, setPreset] = useState<ModifierPreset | null>(null);
  const { data: stashConfig } = GQL.useConfigurationQuery();

  const ivdbConfig = useRef({ ivdb: false, id: '' });
  ivdbConfig.current.ivdb = isIvdbScene(scene);

  const handyKey = stashConfig?.configuration?.interface?.handyKey;

  const [currentPaths, setCurrentPaths] = useState<ScenePaths>({
    blobUrl: scene.paths.funscript || '',
    src: scene.paths.funscript || '',
    heatMap: scene.paths.interactive_heatmap,
  });
  const client = useApolloClient();

  const hasInitialized = useRef(false);
  const [pipelines, setPipelines] = useState<ScriptPipeline[]>(() => [
    new ModificationPipeline(),
  ]);

  const getPipeline = useCallback(
    <T extends ScriptPipeline = ScriptPipeline>(name: string) => {
      return pipelines.find((p) => p.name === name) as T | undefined;
    },
    [pipelines],
  );

  const [defaultPaths] = useState<ScenePaths>({
    blobUrl: scene.paths.funscript,
    src: scene.paths.funscript,
    heatMap: scene.paths.interactive_heatmap,
  });

  const [findScripts, { data }] = useRunPluginOperationMutation<{
    scripts: Script[];
  }>();

  const runScriptPipeline = useCallback(
    async (script: Funscript | null, updatedUrl?: string) => {
      let changes: { blobUrl: string; src: string };
      let heatMap: string | undefined;
      const url = updatedUrl || currentPaths.src || '';
      if (ivdbConfig.current.ivdb) {
        changes = {
          blobUrl: url,
          src: url,
        };
      } else if (script) {
        const pipe = await resolveScriptPipeline(
          {
            url,
            script,
          },
          pipelines,
        );

        changes = await applyScriptChanges(url, pipe.script);
        heatMap = await generateHeatmap(changes.blobUrl);
      } else {
        return;
      }
      const newPaths = {
        ...changes,
        heatMap,
      };
      console.log('newPaths', newPaths);
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
    [currentPaths, pipelines, client, scene],
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
  const addPipeline = useCallback(
    async (pipeline: ScriptPipeline, update?: boolean) => {
      setPipelines((p) => [...p, pipeline]);
      if (update) {
        await updateScript();
      }
      return;
    },
    [setPipelines, updateScript],
  );
  const removePipeline = useCallback(
    async <T extends ScriptPipeline = ScriptPipeline>(name: string) => {
      const pipeline = pipelines.find((p) => p.name === name);
      setPipelines((p) => p.filter((p) => p.name !== name));
      await updateScript();
      return pipeline as T | undefined;
    },
    [pipelines, updateScript],
  );

  const updateModifiers = useCallback(
    (modifiers: AnyModifierDef[]) => {
      getPipeline<ModificationPipeline>(MODIFICATION_PIPELINE_ID)!.modifiers =
        modifiers;
      updateScript().catch(console.error);
    },
    [getPipeline, updateScript],
  );
  const onChange = useCallback(
    async (url: string) => {
      const scriptUrl = currentPaths.src !== url ? url : currentPaths.src;
      const script = await getScript(scriptUrl);
      unmodifiedScript.current = script;
      await runScriptPipeline(script, scriptUrl);
    },
    [currentPaths, runScriptPipeline],
  );

  useEffect(() => {
    if (!isIvdbScene(scene) && scene.paths.interactive_heatmap) {
      replaceHeatMap(scene.paths.interactive_heatmap);
    }
    if (
      scene.paths.funscript &&
      !unmodifiedScript.current &&
      !isIvdbScene(scene)
    ) {
      const script = getScript(scene.paths.funscript);
      script.then((s) => {
        unmodifiedScript.current = s;
        return updateScript(s);
      });
    }
  }, [scene, updateScript]);

  const id = scene.id;
  useEffect(() => {
    unmodifiedScript.current = undefined;
    findScripts({
      variables: {
        plugin_id: 'StashInteractiveTools',
        args: {
          mode: 'init',
          scene_id: id,
          origin: window.location.origin,
          handy_token: handyKey,
        },
      },
    }).catch(console.error);
  }, [findScripts, id, handyKey]);

  useEffect(() => {
    const scripts = data?.runPluginOperation?.scripts ?? [];

    const shouldUseIVDB =
      ivdbConfig.current.ivdb && ivdbConfig.current.id !== id;
    function patchAndSetup() {
      DB.getAll('presets').then((records) => {
        updatePresets(records);
      });

      const interactiveApi = interactiveRef.current;
      const defaultUploadScript =
        interactiveApi.uploadScript.bind(interactiveApi);

      const uploadScript = async (funscriptPath: string, apiKey?: string) => {
        if (!ivdbConfig.current.ivdb)
          return defaultUploadScript(funscriptPath, apiKey);
        try {
          const handy = interactiveApi._handy;

          if (handy.currentMode !== 1) {
            await handy.setMode(1); // hssp
          }

          const json: { result: number } = await handy.putJson('hssp/setup', {
            url: funscriptPath,
          });
          // can't call handy.setHsspSetup because it does an un-needed encodeURI call which breaks the token url
          handy.hsspPreparedUrl = funscriptPath;

          handy.hsspState = 3; // stopped
          interactiveApi._connected = handy.connected = json.result === 1;
          /*interactiveApi._connected = await handy
            .setHsspSetup(funscriptPath)
            .then((result: number) => result === 1); // HsspSetupResult.downloaded*/
        } catch (e) {
          console.error(e);
        }
      };
      interactiveApi.uploadScript = uploadScript.bind(interactiveApi);
    }
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      patchAndSetup();
    }

    console.log('scripts', {
      scripts,
      shouldUseIVDB,
    });
    if (shouldUseIVDB && scripts.length == 1) {
      ivdbConfig.current.id = id;

      runScriptPipeline(null, scripts[0].path).catch(console.error);
    } else {
      setEntries(scripts);
    }
  }, [data, runScriptPipeline, id]);

  const savePresetInternal = useCallback(
    (updatedPreset: ModifierPreset | null, toDelete = false) => {
      setPreset(toDelete ? null : updatedPreset);
      if (updatedPreset) {
        const commitChanges = () => {
          updatePresets((savedPresets) => {
            const presetIndex = savedPresets.findIndex(
              (p) => p.id === updatedPreset.id,
            );
            console.log(
              'savePresetInternal',
              updatedPreset,
              presetIndex,
              savedPresets,
            );
            if (toDelete) {
              if (presetIndex !== -1) {
                savedPresets.splice(presetIndex, 1);
              }
              return [...savedPresets];
            } else if (presetIndex !== -1) {
              savedPresets[presetIndex] = updatedPreset;
            } else {
              savedPresets.push(updatedPreset);
            }

            return [...savedPresets];
          });
        };
        if (toDelete && updatedPreset.id) {
          DB.delete('presets', updatedPreset.id).then(commitChanges);
        } else {
          commitChanges();
        }
      }
    },
    [setPreset, updatePresets],
  );

  const contextValue = useMemo(
    () => ({
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
      setPreset: savePresetInternal,

      getPipeline,
      updateScript,
      updateModifiers,
    }),
    [
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
      savePresetInternal,
      presets,
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
