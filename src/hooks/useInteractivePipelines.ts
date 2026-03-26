import { useCallback, useState } from 'react';

import { Funscript } from 'ive-connect';
import { ScriptPipe, ScriptPipeline } from './types';
import { ModificationPipeline } from '../components/modifiers/pipeline';

export async function resolveScriptPipeline(
  initialValue: ScriptPipe,
  pipelines: ScriptPipeline[],
) {
  return pipelines.reduce(
    (promiseAcc, current) => promiseAcc.then((acc) => current.apply(acc)),
    Promise.resolve(initialValue),
  );
}

type UseUserInteractivePipelinesProps = {
  onPipelineChanged: () => Promise<void> | void;
};
export const useInteractivePipelines = ({
  onPipelineChanged,
}: UseUserInteractivePipelinesProps) => {
  const [pipelines, setPipelines] = useState<ScriptPipeline[]>(() => [
    new ModificationPipeline(),
  ]);

  const getPipeline = useCallback(
    <T extends ScriptPipeline = ScriptPipeline>(name: string) => {
      return pipelines.find((p) => p.name === name) as T | undefined;
    },
    [pipelines],
  );
  const addPipeline = useCallback(
    async (pipeline: ScriptPipeline, update?: boolean) => {
      setPipelines((p) => [...p, pipeline]);
      if (update) {
        await onPipelineChanged();
      }
      return;
    },
    [setPipelines, onPipelineChanged],
  );
  const removePipeline = useCallback(
    async <T extends ScriptPipeline = ScriptPipeline>(name: string) => {
      const pipeline = pipelines.find((p) => p.name === name);
      setPipelines((p) => p.filter((p) => p.name !== name));
      await onPipelineChanged();
      return pipeline as T | undefined;
    },
    [pipelines, onPipelineChanged],
  );
  const runPipeline = useCallback(
    async (script: Funscript, url: string) => {
      return resolveScriptPipeline({ url, script }, pipelines);
    },
    [pipelines],
  );

  return {
    addPipeline,
    removePipeline,
    pipelines,
    setPipelines,
    getPipeline,
    runPipeline,
  };
};
