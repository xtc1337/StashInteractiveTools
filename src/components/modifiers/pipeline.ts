import { ScriptPipe, ScriptPipeline } from '../../hooks';
import { AnyModifierDef } from './types';
import { asyncReduce } from '../../utils';
import { toValues } from './utils';

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
      pipe,
    );
  }
}
