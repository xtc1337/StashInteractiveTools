import { Funscript } from 'ive-connect';

export type ScriptPipe = {
  url: string;
  script: Funscript;
};
export interface ScriptPipeline {
  apply(pipe: ScriptPipe): Promise<ScriptPipe> | ScriptPipe;
  readonly name: string;
}
