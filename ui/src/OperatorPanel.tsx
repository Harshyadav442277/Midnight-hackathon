import type { BuildView, RegistryState } from './types.ts';

type Props = {
  state: RegistryState;
  busy: string | null;
  onRevoke: (build: BuildView) => void;
};

export const OperatorPanel = ({ state, busy, onRevoke }: Props): React.ReactElement => (
  <section className="operator">
    <div className="operator-head">
      <h2>Registry operator</h2>
      <p>
        Approved firmware builds are published as opaque commitments. Revoking one removes its
        leaf, which changes the root — and every proof built against the old baseline stops
        verifying.
      </p>
    </div>

    <ul className="builds">
      {state.builds.map((build) => {
        const affected = state.fleet.filter((d) => d.buildId === build.id);
        const label = `Revoke ${build.version}`;
        return (
          <li key={build.id}>
            <div>
              <h4>{build.version}</h4>
              <p className="note">{build.note}</p>
              <p className="affects">
                leaf {build.index} · {affected.length} device{affected.length === 1 ? '' : 's'}:{' '}
                {affected.map((d) => d.label).join(', ')}
              </p>
            </div>
            <button
              type="button"
              className="danger"
              onClick={() => onRevoke(build)}
              disabled={busy === label}
            >
              {busy === label ? 'Publishing…' : 'Revoke (CVE)'}
            </button>
          </li>
        );
      })}
    </ul>
  </section>
);
