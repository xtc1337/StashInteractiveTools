import { FunUtils } from 'funscript-utils';
import { Action } from 'funscript-utils/src/types';
import { Funscript } from 'funscript-utils/lib/types';
import { createModifierDef, createOptions, withOrWithout } from './utils';

const { getActionGroups, roundAction } = FunUtils;

const sign = (val: number) => {
  if (val === 0) return 0;
  return val > 0 ? 1 : -1;
};
// from https://github.com/defucilis/funscript-io-2/blob/main/lib/funscript-utils/funDoubler.ts
export interface FunDoublerOptions {
  matchGroupEnd?: boolean;
  shortPauseDuration?: number;
}

/**
 * Takes in a group of actions and creates a double-speed version of that group, without losing cadence
 * @param  {Action[]} actionGroup - The group to double the speed of
 * @param  {FunDoublerOptions} options - Options to change the behaviour of the speed-doubling
 */
export const getDoubleSpeedGroup = (
  actionGroup: Action[],
  options: FunDoublerOptions,
): Action[] => {
  //to begin with, we remove short pauses
  const noShortPauses = actionGroup.filter((action, i) => {
    if (i === 0) return true;
    if (action.pos !== actionGroup[i - 1].pos) return true;

    const diff = Math.abs(action.at - actionGroup[i - 1].at);
    return diff > (options.shortPauseDuration || 100);
  });

  //first, we need to simplify the group into straight up and down lines - no curves
  const simplifiedGroup: Action[] = [];
  for (let i = 0; i < noShortPauses.length; i++) {
    if (i === 0 || i === noShortPauses.length - 1) {
      simplifiedGroup.push(noShortPauses[i]);
      continue;
    }
    const dirPrev = sign(noShortPauses[i].pos - noShortPauses[i - 1].pos);
    const dirNext = sign(noShortPauses[i + 1].pos - noShortPauses[i].pos);
    if (dirPrev !== dirNext) simplifiedGroup.push(noShortPauses[i]);
  }

  //now we can just go through and double each action
  let currentPos = simplifiedGroup[0].pos;
  const finalGroup: Action[] = [];
  for (let i = 0; i < simplifiedGroup.length; i++) {
    const curAction = simplifiedGroup[i];

    if (i === simplifiedGroup.length - 1) {
      if (!options.matchGroupEnd) simplifiedGroup.push(curAction);
      continue;
    }
    const nextAction = simplifiedGroup[i + 1];

    const min = Math.min(curAction.pos, nextAction.pos);
    const max = Math.max(curAction.pos, nextAction.pos);
    const halfTime = curAction.at + (nextAction.at - curAction.at) / 2;
    const endTime = nextAction.at;
    const minFurther = Math.abs(currentPos - min) > Math.abs(currentPos - max);

    if (i === 0) {
      //always add the first action
      finalGroup.push(curAction);
      finalGroup.push({ at: halfTime, pos: minFurther ? min : max });
      finalGroup.push({ at: endTime, pos: minFurther ? max : min });
      currentPos = minFurther ? max : min;
      continue;
    }

    const dir = nextAction.pos - curAction.pos;
    if (dir === 0) {
      //hold current position during pauses
      finalGroup.push({ ...nextAction, pos: currentPos });
      continue;
    }

    //if this is the second-last group
    if (i === simplifiedGroup.length - 2 && options.matchGroupEnd) {
      finalGroup.push(simplifiedGroup[simplifiedGroup.length - 1]);
      continue;
    }

    finalGroup.push({ at: halfTime, pos: minFurther ? min : max });
    finalGroup.push({ at: endTime, pos: minFurther ? max : min });
    currentPos = minFurther ? max : min;
    finalGroup.push({ at: endTime + 10, pos: currentPos });
  }

  return finalGroup;
};
/**
 * Creates a double-speed version of a script without sacrificing cadence by turning every up or downstroke into a full up+down stroke
 * @param  {Funscript} script - The script to double the speed of
 * @param  {FunDoublerOptions} options - Options to configure how the doubling is done
 * @returns The half-speed funscript
 */
export const getDoubleSpeedScript = (
  script: Funscript,
  options: FunDoublerOptions,
): Funscript => {
  //onProgress("Loaded script with " + script.actions.length + " actions");
  const output: Funscript = { ...script };
  output.actions = [];

  //Split the source actions up into groups, separating two groups if 5x the last interval passes without any actions
  const orderedActions = script.actions.sort((a, b) => a.at - b.at);
  //Note that IF the first two actions are separated by more than five seconds, we manually add the first one and use the algorithm on the second onwards
  const longFirstWait = orderedActions[1].at - orderedActions[0].at > 5000;
  if (longFirstWait) output.actions.push(orderedActions[0]);
  const actionGroups = longFirstWait
    ? getActionGroups(orderedActions.slice(1))
    : getActionGroups(orderedActions);
  const fasterGroups = actionGroups.map((group) =>
    getDoubleSpeedGroup(group, options),
  );

  //finally, we combine these slower groups into the final actions array
  fasterGroups.forEach((group) => {
    group.forEach((action) => {
      output.actions.push(action);
    });
  });

  //ensure that the durations match up by adding a pause at the end
  if (output.actions.slice(-1)[0].at !== script.actions.slice(-1)[0].at) {
    output.actions.push({
      at: script.actions.slice(-1)[0].at,
      pos: output.actions.slice(-1)[0].pos,
    });
  }
  //onProgress("Slowed down action groups, new action count is " + output.actions.length);
  output.actions = output.actions.map(roundAction);
  return output;
};
const options = createOptions([
  {
    name: 'shortPauseDuration',
    defaultValue: 100,
    title: 'Short Pause Duration',
    type: 'input',
  },

  {
    name: 'matchGroupEnd',
    defaultValue: true,
    title: 'Match Group End Position',
    type: 'toggle',
  },
]);
export const doublerModifierDef = createModifierDef({
  id: 'doubler',
  name: 'Doubler',
  description:
    'Doubles the speed of a script without sacrificing sync by changing each up or down stroke into an up+down stroke.',
  options,
  info: (ctx) => {
    return [
      `Pause Duration: ${ctx.shortPauseDuration}`,
      withOrWithout(ctx.matchGroupEnd, 'Match Group End Position'),
    ].join(' | ');
  },
  apply: (script, ctx) => {
    return getDoubleSpeedScript(script, ctx);
  },
});
