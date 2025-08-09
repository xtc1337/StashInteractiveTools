import { Funscript } from 'funscript-utils/lib/types';
import { createDebugConsole } from '../../utils';
import { createModifierDef, createOptions } from './utils';

const logger = createDebugConsole('modify.custom');
// https://github.com/defucilis/funscript-io-2/blob/a514ea741e019e599b3ba52a22537199237c9ebd/lib/funscript-utils/funTweaker.ts#L237

/**
 * Applies a custom function to directly modify the actions array.
 * Note that this function makes use of eval without any checking, so you MUST do your own security checking before making use of this function.
 * The function text should accept an array of actions ({at: number, pos: number}) and return an identically typed array.
 * @param funscript The funscript to modify
 * @param options The function text (as plain javascript) modifying the actions array.
 * @param onError
 * @returns The modified funscript, or the original funscript if anything goes wrong.
 */
export const getCustomFunctionScript = (
  funscript: Funscript,
  options: {
    functionText?: string;
  },
  onError?: (error: string) => void,
): Funscript => {
  const functionText = options.functionText || null;

  if (!functionText) {
    if (onError) onError('No function text provided');
    return funscript;
  }

  let transformActions;
  let newActions;
  try {
    transformActions = new Function('actions', functionText);
  } catch {
    if (onError) onError('Failed to get valid function from your script');
    return funscript;
  }
  try {
    newActions = transformActions(funscript.actions);
    if (!Array.isArray(newActions)) {
      if (onError) onError("Your function didn't return an array");
      return funscript;
    }

    let isValid = true;
    for (let i = 0; i < newActions.length; i++) {
      const action = newActions[i];

      const keys = Object.keys(action);
      if (keys.length !== 2) {
        isValid = false;
        logger.error('invalid keys length of 2', action);
        break;
      }
      if (keys[0] !== 'pos' && keys[0] !== 'at') {
        isValid = false;
        logger.error('missing `pos` and `at` properties ', action);
        break;
      }
      if (keys[1] !== 'pos' && keys[1] !== 'at') {
        isValid = false;
        logger.error('missing `pos` and `at` properties', action);
        break;
      }
      if (isNaN(action[keys[0]]) || isNaN(action[keys[1]])) {
        isValid = false;
        logger.error('invalid value at `post` or `at` ', action);
        break;
      }
    }
    if (!isValid) {
      if (onError)
        onError(
          'One or more of the Actions in your returned array was invalid',
        );
      return funscript;
    }
    return { ...funscript, actions: newActions };
  } catch {
    if (onError) onError('Failed to transform actions using your script');
    return funscript;
  }
};

const options = createOptions([
  {
    name: 'functionText',
    title: 'Custom Function',
    defaultValue: `{
        //applies a 100ms offset to all actions
        return actions.map(action => ({...action, at: action.at + 100}));
    }`,
    type: 'input',
    lines: 10,
  },
]);
export const customModifierDef = createModifierDef({
  id: 'custom',
  name: 'Custom',
  description:
    'Input your own javascript function that takes in an array of Actions and returns a transformed array to be applied to the funscript.',
  options,
  apply: (script, ctx, onError) => {
    return getCustomFunctionScript(script, ctx, (err) => {
      const message = 'Error in custom function block: ' + err;
      logger.error(message);
      if (onError) onError(message);
    });
  },
});
