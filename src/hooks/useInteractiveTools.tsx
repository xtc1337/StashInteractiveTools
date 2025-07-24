import { GQL } from '../api';
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
import { deepMerge } from '../utils';
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

async function applyScriptChanges(url: string, script: Funscript) {
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

  const unmodifiedScript = useRef<Funscript>();
  const [presets, updatePresets] = useState<ModifierPreset[]>([]);
  const [preset, setPreset] = useState<ModifierPreset | null>(null);

  const [currentPaths, setCurrentPaths] = useState<ScenePaths>({
    blobUrl: scene.paths.funscript || '',
    src: scene.paths.funscript || '',
    heatMap: scene.paths.interactive_heatmap,
  });
  const client = useApolloClient();
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
    async (script: Funscript, updatedUrl?: string) => {
      const url = updatedUrl || currentPaths.src || '';
      const pipe = await resolveScriptPipeline(
        {
          url,
          script,
        },
        pipelines,
      );

      const changes = await applyScriptChanges(url, pipe.script);
      const heatMap = await generateHeatmap(changes.blobUrl);
      const newPaths = {
        ...changes,
        heatMap,
      };
      client.writeQuery({
        query: GQL.FindSceneDocument,
        data: {
          findScene: deepMerge({}, scene, {
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
    if (scene.paths.interactive_heatmap) {
      replaceHeatMap(scene.paths.interactive_heatmap);
    }
    if (scene.paths.funscript && !unmodifiedScript.current) {
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
        },
      },
    }).catch(console.error);
  }, [findScripts, id]);
  useEffect(() => {
    setEntries(data?.runPluginOperation?.scripts ?? []);
    DB.getAll('presets').then((records) => {
      updatePresets(records);
    });
  }, [data]);
  const savePresetInternal = useCallback(
    (p: ModifierPreset | null, toDelete = false) => {
      setPreset(toDelete ? null : p);
      if (p) {
        updatePresets((v) => {
          const presetIndex = v.findIndex((p) => p.id === p.id);
          if (toDelete) {
            if (presetIndex !== -1) {
              v.splice(presetIndex, 1);
            }
            return [...v];
          } else if (presetIndex !== -1) {
            v[presetIndex] = p;
          } else {
            v.push(p);
          }

          return [...v];
        });
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
