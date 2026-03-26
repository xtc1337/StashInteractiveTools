import { Funscript } from 'ive-connect';
import { ScriptPipe, ScriptPipeline } from '../../hooks/types';
import { AnyModifierDef } from './types';
import { toValues } from './utils';
import { asyncReduce } from '../../utils';

export const MODIFICATION_PIPELINE_ID = 'modification-pipeline';
export class ModificationPipeline implements ScriptPipeline {
  readonly name = MODIFICATION_PIPELINE_ID;
  constructor(public modifiers: AnyModifierDef[] = []) {}
  apply(pipe: ScriptPipe) {
    return asyncReduce(
      this.modifiers,
      async (acc, modifier) => {
        return {
          ...acc,
          script: await modifier.apply(acc.script, toValues(modifier)),
        };
      },
      {
        ...pipe,
        script: {
          ...pipe.script,
          range: undefined, // remove the `range` as stash convertRange doesn't function correctly in all cases
        } as Funscript,
      },
    );
  }
}
