import { describe, expect, it } from 'vitest';
import { ORG_GROUP_DRAG_ANNOUNCEMENTS } from '../org-group-drag-announcements';
import { DraggableSfdcCard, SfdcCardDropTarget } from '../organization-group.types';

const orgCard: DraggableSfdcCard = { uniqueId: '00D1-0051', organizationId: null, label: 'Acme Sandbox' };
const productionGroup: SfdcCardDropTarget = { action: 'add', orgGroupId: '3f2a9c1e', label: 'Production Orgs' };
const unassigned: SfdcCardDropTarget = { action: 'remove', label: 'Orgs without a group' };

// The plugin hands the announcement functions the live drag operation; only `data` (and `canceled`) is read
function buildEvent({ source, target, canceled = false }: { source?: DraggableSfdcCard; target?: SfdcCardDropTarget; canceled?: boolean }) {
  return {
    canceled,
    operation: {
      source: source ? { id: source.uniqueId, data: source } : null,
      target: target ? { id: 'droppable-id', data: target } : null,
    },
  } as never;
}

const manager = {} as never;

describe('ORG_GROUP_DRAG_ANNOUNCEMENTS', () => {
  it('announces the org label instead of its id when picked up', () => {
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragstart(buildEvent({ source: orgCard }), manager)).toBe('Picked up Acme Sandbox.');
  });

  it('announces the group name instead of its id while hovering', () => {
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragover?.(buildEvent({ source: orgCard, target: productionGroup }), manager)).toBe(
      'Acme Sandbox is over Production Orgs.',
    );
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragover?.(buildEvent({ source: orgCard, target: unassigned }), manager)).toBe(
      'Acme Sandbox is over Orgs without a group.',
    );
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragover?.(buildEvent({ source: orgCard }), manager)).toBe('Acme Sandbox is not over a group.');
  });

  it('announces the outcome of the drop', () => {
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragend(buildEvent({ source: orgCard, target: productionGroup }), manager)).toBe(
      'Acme Sandbox was moved to Production Orgs.',
    );
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragend(buildEvent({ source: orgCard }), manager)).toBe(
      'Acme Sandbox was dropped outside a group and was not moved.',
    );
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragend(buildEvent({ source: orgCard, target: productionGroup, canceled: true }), manager)).toBe(
      'Move cancelled. Acme Sandbox was not moved.',
    );
  });

  it('never falls back to the ids when a label is missing', () => {
    const unlabeledSource = { ...orgCard, label: '' };
    const unlabeledTarget = { ...productionGroup, label: '' };
    const announcement = ORG_GROUP_DRAG_ANNOUNCEMENTS.dragend(buildEvent({ source: unlabeledSource, target: unlabeledTarget }), manager);
    expect(announcement).toBe('Salesforce org was moved to group.');
    expect(announcement).not.toContain(orgCard.uniqueId);
    expect(announcement).not.toContain(productionGroup.orgGroupId);
  });

  it('stays silent without a drag source', () => {
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragstart(buildEvent({}), manager)).toBeUndefined();
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragover?.(buildEvent({}), manager)).toBeUndefined();
    expect(ORG_GROUP_DRAG_ANNOUNCEMENTS.dragend(buildEvent({}), manager)).toBeUndefined();
  });
});
