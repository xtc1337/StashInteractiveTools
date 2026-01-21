import { Action, Funscript } from 'funscript-utils/lib/types';
import { createModifierDef, createOptions } from './utils';

// https://github.com/defucilis/funscript-io-2/blob/a514ea741e019e599b3ba52a22537199237c9ebd/lib/funscript-utils/funTweaker.ts#L237
export const getRandomizedScript = (
  funscript: Funscript,
  options: {
    positionJitter?: number;
    timeJitter?: number;
  },
): Funscript => {
  const positionJitter = options.positionJitter || 0;
  const timeJitter = options.timeJitter || 0;

  const posJitter = (pos: number): number => {
    return Math.min(
      100,
      Math.max(0, pos + (Math.random() - 0.5) * (positionJitter * 2)),
    );
  };
  const atJitter = (time: number): number => {
    return time + (Math.random() - 0.5) * (timeJitter * 2);
  };

  const outputActions: Action[] = [];
  for (let i = 0; i < funscript.actions.length; i++) {
    if (i === 0 || i === funscript.actions.length - 1) {
      outputActions.push({
        at: funscript.actions[i].at,
        pos: posJitter(funscript.actions[i].pos),
      });
      continue;
    }
    const prevAction = outputActions[i - 1];
    const action = funscript.actions[i];
    const nextAction = funscript.actions[i + 1];

    const pJitter = posJitter(action.pos);
    const tJitter = Math.max(
      prevAction.at + 20,
      Math.min(nextAction.at - 20, atJitter(action.at)),
    );
    outputActions.push({ at: tJitter, pos: pJitter });
  }
  return { ...funscript, actions: outputActions };
};
const options = createOptions([
  {
    name: 'timeJitter',
    title: 'Time Jitter (ms)',
    defaultValue: 50,
    type: 'input',
  },
  {
    name: 'positionJitter',
    title: 'Position Jitter (%)',
    defaultValue: 5,
    type: 'input',
  },
]);
export const randomizerModifierDef = createModifierDef({
  id: 'randomizer',
  name: 'Randomizer',
  description:
    'Applies random offsets to time and position values in a script, to create variety.',
  options,
  info: ({ timeJitter, positionJitter }) => {
    return [
      `Time Jitter (ms): ${timeJitter}`,
      `Position Jitter (%): ${positionJitter}`,
    ].join(' | ');
  },
  apply: (script, ctx) => {
    return getRandomizedScript(script, ctx);
  },
});
