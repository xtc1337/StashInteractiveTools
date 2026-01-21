import { FunTweaker } from 'funscript-utils';

import { createModifierDef, createOptions, dropdown, input } from './utils';

const options = createOptions([
  dropdown('devicePreset', 'handy', 'Device Mode', [
    { label: 'Handy', value: 'handy' },
    { label: 'Launch', value: 'launch' },
    { label: 'Custom', value: 'custom' },
  ] as const),
  input('maxSpeed', 0, 'Offset Amount (ms)', {
    enabled: (ctx) => ctx.devicePreset === 'custom',
  }),
]);
export const limiterModifierDef = createModifierDef({
  id: 'limiter',
  name: 'Offset',
  description:
    'Changes position values to ensure that all actions within a script are below a speed threshold. Useful to ensure a script will function on a particular device.',
  options,
  info: ({ devicePreset, maxSpeed }) => {
    const lines = [`Preset: ${devicePreset}`];
    if (devicePreset === 'custom') {
      lines.push(`Max Speed: ${maxSpeed}`);
    }
    return lines.join(' | ');
  },
  apply: (script, ctx) => {
    const value =
      ctx.devicePreset === 'custom' ? ctx.maxSpeed : ctx.devicePreset;
    return FunTweaker.getLimitedScript(script, value);
  },
});
