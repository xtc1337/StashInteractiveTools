import { FunTweaker } from 'funscript-utils';
import { createModifierDef, createOptions } from './utils';

const options = createOptions([
  {
    name: 'min',
    defaultValue: 0,
    title: 'Min Position',
    type: 'input',
  },

  {
    name: 'max',
    defaultValue: 100,
    title: 'Max Position',
    type: 'input',
  },
]);
export const remapperModifierDef = createModifierDef({
  id: 'remapper',
  name: 'Remapper',
  description:
    'Changes the minimum and maximum position values of a script to new values.',
  options,
  info: ({ min, max }) => {
    return [`Min: ${min}`, `Max: ${max}`].join(' | ');
  },
  apply: (script, { min, max }) => {
    return FunTweaker.getRemappedScript(script, min, max);
  },
});
