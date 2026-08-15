import { useCallback, useMemo, useState } from 'react';

/**
 * Expand/collapse state for a grouped grid where every group starts expanded.
 *
 * Collapsed ids are tracked rather than expanded ones so that groups arriving later (rows stream in
 * while a load runs) show up expanded, matching what the user chose for everything else.
 */
export function useExpandedGroups(allGroupIds: string[]) {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<unknown>>(() => new Set());

  const expandedGroupIds = useMemo(
    () => new Set<unknown>(allGroupIds.filter((groupId) => !collapsedGroupIds.has(groupId))),
    [allGroupIds, collapsedGroupIds],
  );

  const setExpandedGroupIds = useCallback(
    (expanded: Set<unknown>) => setCollapsedGroupIds(new Set<unknown>(allGroupIds.filter((groupId) => !expanded.has(groupId)))),
    [allGroupIds],
  );

  const toggleAllGroups = useCallback(
    (expand: boolean) => setCollapsedGroupIds(expand ? new Set() : new Set<unknown>(allGroupIds)),
    [allGroupIds],
  );

  return { expandedGroupIds, setExpandedGroupIds, toggleAllGroups, hasExpandedGroups: expandedGroupIds.size > 0 };
}

export default useExpandedGroups;
