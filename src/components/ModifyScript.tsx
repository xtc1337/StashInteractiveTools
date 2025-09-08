import React from 'react';
import { ScriptModificationPanel } from './ScriptModificationPanel';

export const ModifyScript = () => {
  return <ScriptModificationPanel />;
  /*const [activeTabKey, setActiveTabKey] = useState('modifications-panel');
  return (
    <Tab.Container
      activeKey={activeTabKey}
      onSelect={(k) => k && setActiveTabKey(k)}
    >
      <div>
        <Nav variant="tabs" className="mr-auto">
          <Nav.Item>
            <Nav.Link eventKey="modifications-panel">Modifications</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="manual-control-panel">Control</Nav.Link>
          </Nav.Item>
        </Nav>
      </div>
      <Tab.Content>
        <Tab.Pane eventKey="modifications-panel">
          <ScriptModificationPanel />
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  );      */
};
