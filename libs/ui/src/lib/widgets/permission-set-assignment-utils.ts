/**
 * Pure SOQL builders and input guards shared by {@link ProfileOrPermSetPopover} and
 * {@link ManagePermissionSetAssignmentsModal}. Kept in their own module because the popover renders the
 * modal — putting these on either component would create an import cycle.
 */

/** Salesforce ids are exactly 15 or 18 alphanumeric characters. Anything else must never reach a SOQL string. */
export const ID_ALLOWED = /^(?:[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/;

/** Cap the assignment list so a permission set assigned to an entire org can't lock up the modal. */
export const MAX_ASSIGNMENTS = 2000;

/** Max users returned by a single type-ahead search. */
const MAX_USER_SEARCH_RESULTS = 50;

// Escape backslash, single quote, percent, and underscore in one pass so SOQL LIKE treats user input literally.
export function escapeSoqlLike(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(/['\\%_]/g, (char) => '\\' + char);
}

/**
 * Every assignment for a permission set, including the assignment `Id` — deletes operate on the assignment
 * record, not the user.
 *
 * Unlike the popover's read-only query this does NOT filter on `Assignee.IsActive`: an inactive user still
 * holds an assignment, and hiding those rows would make "remove" silently incomplete. `IsRevoked` is
 * deliberately not selected — it only exists on API v51.0+, and referencing it against an older org's api
 * version fails the whole query with INVALID_FIELD.
 */
export function getPermissionSetAssignmentsQuery(permissionSetId: string): string | null {
  if (!ID_ALLOWED.test(permissionSetId)) {
    return null;
  }
  return (
    `SELECT Id, PermissionSetId, AssigneeId, Assignee.Id, Assignee.Name, Assignee.Username, Assignee.IsActive ` +
    `FROM PermissionSetAssignment WHERE PermissionSetId = '${permissionSetId}' ` +
    `ORDER BY Assignee.Name LIMIT ${MAX_ASSIGNMENTS + 1}`
  );
}

/**
 * Type-ahead search over active users. An empty term returns the first page of users rather than nothing, so
 * opening the dropdown shows something to pick from — the `LIMIT` keeps that from pulling the whole org.
 */
export function getUserSearchQuery(searchTerm: string): string {
  const trimmed = searchTerm.trim();
  const escaped = escapeSoqlLike(trimmed);
  let searchClause = '';
  if (ID_ALLOWED.test(trimmed)) {
    searchClause = ` AND (Id = '${trimmed}' OR Name LIKE '%${escaped}%')`;
  } else if (trimmed) {
    searchClause = ` AND (Name LIKE '%${escaped}%' OR Username LIKE '%${escaped}%' OR Email LIKE '%${escaped}%')`;
  }

  return (
    `SELECT Id, Name, Username, Profile.Name FROM User ` +
    `WHERE IsActive = true${searchClause} ORDER BY Name LIMIT ${MAX_USER_SEARCH_RESULTS}`
  );
}
