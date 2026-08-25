import type { ComponentView, RegistryState } from './types.ts';

type Props = {
  state: RegistryState;
  busy: string | null;
  onRevokeComponent: (component: ComponentView) => void;
  onReplay: (component: ComponentView, deviceId: string) => void;
};

export const OperatorPanel = ({
  state,
  busy,
  onRevokeComponent,
  onReplay,
}: Props): React.ReactElement => (
  <section className="operator">
    <div className="operator-head">
      <h2>Private dependency policy</h2>
      <p>
        Each firmware capability privately commits to three component capabilities. Revoke one
        component and every dependent firmware image loses the ability to prove compliance —
        without publishing which builds depended on it. This dependency view exists only in the
        operator's local service; the public chain sees opaque commitments and two roots.
      </p>
    </div>

    <ul className="builds">
      {state.components.map((component) => {
        const affectedBuilds = state.builds.filter((b) =>
          b.componentIds.includes(component.id),
        );
        const affectedDevices = state.fleet.filter((device) =>
          affectedBuilds.some((build) => build.id === device.buildId),
        );
        const label = `Revoke hidden component ${component.label}`;
        const victim = affectedDevices[0];
        const replayLabel = victim ? `Replay stale proof for ${victim.label}` : '';
        return (
          <li key={component.id}>
            <div>
              <h4>{component.label}</h4>
              <p className="note">{component.note}</p>
              <p className="affects">
                private operator view · component leaf {component.index} · affects{' '}
                {affectedDevices.length} device{affectedDevices.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="component-actions">
              <button
                type="button"
                className="danger"
                onClick={() => onRevokeComponent(component)}
                disabled={busy === label}
              >
                {busy === label ? 'Moving root…' : 'Revoke component (CVE)'}
              </button>
              {victim && (
                <button
                  type="button"
                  className="ghost"
                  title="Prove an attestation now, revoke this component, then submit the stale proof. The Midnight ledger rejects it — no application logic involved."
                  onClick={() => onReplay(component, victim.id)}
                  disabled={busy === replayLabel}
                >
                  {busy === replayLabel ? 'Submitting stale proof…' : 'Revoke + replay stale proof'}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  </section>
);
