import { EMPTY_VALUE } from '../utils/format';
import { Badge } from './Badge';

export function OverrideBadge({ value }: { value: boolean | null }) {
  if (value === null) {
    return <span className="text-slate-400">{EMPTY_VALUE}</span>;
  }
  // Overrides are grant-only, so a stored `false` never turns anything off
  return value ? (
    <Badge tone="green">On</Badge>
  ) : (
    <Badge title="A disabled override has no effect; remove it instead">Off (no effect)</Badge>
  );
}
