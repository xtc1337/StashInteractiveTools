import React, { useCallback } from 'react';
import { SceneDataFragment } from '../generated-graphql';
import {
  InteractiveBackendManageAction,
  InteractiveBackendOperation,
  InteractiveToolsProvider,
  useInteractiveBackend,
  useInteractiveBackendManage,
  useInteractiveTools,
} from '../hooks';
import StrokeSlider from './StrokeSlider';
import SyncSlider from './SyncSlider';
import ScriptChooser, { ScriptEntry } from './ScriptChooser';
import { ModifyScript } from './ModifyScript';
import { DebugConsoleModal, useDebugConsole } from './DebugConsoleModal';
import { Button } from 'react-bootstrap';
import { ConnectionState } from '../utils';

type Props = {
  scene: SceneDataFragment;
};

const DEFAULT_ERROR_MESSAGE = 'Setup failed. Please check your configuration.';
const InteractiveToolsContent = () => {
  const { onChange, entries, interactiveState, hasSetupError, state } =
    useInteractiveTools();
  const debugHandle = useDebugConsole();
  const [verifyingInstall, setVerifyingInstall] = React.useState(false);
  const [runInstallBackendTask, installBackendTaskResults] =
    useInteractiveBackend<{ installed?: boolean; error?: string }>(
      InteractiveBackendOperation.INSTALL,
    );
  const [runManageSetDefaultAction] = useInteractiveBackendManage(
    InteractiveBackendManageAction.SET_AS_DEFAULT,
    interactiveState.current.id,
  );
  const [errorMessage] = React.useState<string>(DEFAULT_ERROR_MESSAGE);
  const onVerifyInstall = useCallback(async () => {
    setVerifyingInstall(true);
    runInstallBackendTask()
      .then(() => {
        setVerifyingInstall(false);
      })
      .catch(() => {
        setVerifyingInstall(false);
      });
  }, [setVerifyingInstall, runInstallBackendTask]);

  const onDefaultChanged = useCallback(
    async (entry: ScriptEntry) => {
      await runManageSetDefaultAction({
        payload: {
          scriptId: entry.id,
        },
      });
    },
    [runManageSetDefaultAction],
  );

  return (
    <>
      {hasSetupError ? (
        <div className="setup-error">
          {errorMessage}
          <br />
          <Button onClick={onVerifyInstall} disabled={verifyingInstall}>
            Verify Install
          </Button>
          {installBackendTaskResults?.data?.error && (
            <div className="error-message">
              {installBackendTaskResults.data?.error}
            </div>
          )}
        </div>
      ) : (
        <div className="stash-interactive-tools">
          {/* <InteractiveToolsControls debugHandle={debugHandle} />*/}
          <dl className="container  details-list">
            <ScriptChooser
              onDefaultChanged={onDefaultChanged}
              disabled={state !== ConnectionState.Ready}
              value={interactiveState.current.entry?.id}
              onChange={onChange}
              options={entries}
            />
            <StrokeSlider />
            <SyncSlider />
          </dl>
          <ModifyScript />
        </div>
      )}
      <DebugConsoleModal handle={debugHandle} />
    </>
  );
};
export const InteractiveToolsTab = (props: Props) => {
  return (
    <InteractiveToolsProvider scene={props.scene}>
      <InteractiveToolsContent />
    </InteractiveToolsProvider>
  );
};
