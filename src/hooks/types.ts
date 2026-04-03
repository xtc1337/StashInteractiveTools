import { Funscript } from 'ive-connect';

export type ScriptPipe = {
  url: string;
  script: Funscript;
};

export type ScenePaths = {
  blobUrl?: string | null;
  src?: string | null;
  heatMap?: string | null;
};
export interface ScriptPipeline {
  apply(pipe: ScriptPipe): Promise<ScriptPipe> | ScriptPipe;
  readonly name: string;
}
