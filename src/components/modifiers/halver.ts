import { FunHalver } from 'funscript-utils';
import { createModifierDef, createOptions, withOrWithout } from './utils';

const options = createOptions([
  {
    name: 'resetAfterPause',
    defaultValue: false,
    title: 'Reset After Pause',
    type: 'toggle',
  },
  {
    name: 'removeShortPauses',
    defaultValue: true,
    title: 'Remove Short Pauses',
    type: 'toggle',
  },
  {
    name: 'shortPauseDuration',
    defaultValue: 2000,
    title: 'Short Pause Duration',
    type: 'input',
  },
  {
    name: 'matchFirstDownstroke',
    defaultValue: false,
    title: 'Match First Downstroke',
    type: 'toggle',
  },
  {
    name: 'matchGroupEndPosition',
    defaultValue: true,
    title: 'Match Group End Position',
    type: 'toggle',
  },
]);
export const halverModifierDef = createModifierDef({
  id: 'halver',
  name: 'Halver',
  description: 'Halve the speed of the script',
  options,
  info: (ctx) => {
    return [
      withOrWithout(ctx.removeShortPauses, 'Reset after Pause'),
      withOrWithout(ctx.removeShortPauses, 'Remove Short Pauses'),
      `Pause Duration: ${ctx.shortPauseDuration}`,
      withOrWithout(ctx.matchFirstDownstroke, 'Match Downstroke'),
      withOrWithout(ctx.matchGroupEndPosition, 'Match Group'),
    ].join(' | ');
  },
  apply: (script, ctx) => {
    return FunHalver.getHalfSpeedScript(script, ctx);
  },
});
