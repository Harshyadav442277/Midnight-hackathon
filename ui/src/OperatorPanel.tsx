import type { ComponentView, RegistryState } from './types.ts';

type Props = {
  state: RegistryState;
  busy: string | null;
  onRevokeComponent: (component: ComponentView) => void;
};

export const OperatorPanel = ({
  state,
  busy,
  onRevokeComponent,
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
            <button
              type="button"
              className="danger"
              onClick={() => onRevokeComponent(component)}
              disabled={busy === label}
            >
              {busy === label ? 'Moving root…' : 'Revoke component (CVE)'}
            </button>
          </li>
        );
      })}
    </ul>
  </section>
);
