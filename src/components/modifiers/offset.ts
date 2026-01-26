import { FunTweaker } from 'funscript-utils';
import { createModifierDef, createOptions } from './utils';
import { Funscript } from 'ive-connect';

const options = createOptions([
  {
    name: 'amount',
    title: 'Offset Amount (ms)',
    defaultValue: 0,
    type: 'input',
  },
]);
export const offsetModifierDef = createModifierDef({
  id: 'offset',
  name: 'Offset',
  description:
    'Add a fixed time offset to all actions in a script to ensure proper synchronization',
  options,
  info: ({ amount }) => {
    return `Amount: ${amount}`;
  },
  apply: (script, ctx) => {
    return FunTweaker.getOffsetScript(script, ctx.amount) as Funscript;
  },
});
