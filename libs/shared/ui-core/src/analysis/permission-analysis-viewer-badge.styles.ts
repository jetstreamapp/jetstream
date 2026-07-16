import { css, SerializedStyles } from '@emotion/react';

export type PermissionScopeBadgeSurface = 'default' | 'onBrand';

/**
 * Profile vs permission-set chip colors for Permission Analysis (history + scope filter).
 * Palette matches the standalone permission matrix `viewer.html` / `viewer.css` used with export output:
 * profiles use the blue column treatment; permission sets use the purple column treatment.
 *
 * If your viewer CSS uses different hex values, update them here so Jetstream stays in sync.
 */
const PROFILE_BG = '#d8edff';
const PROFILE_BORDER = '#1589ee';
const PROFILE_TEXT = '#032d60';

const PERM_SET_BG = '#eee5f7';
const PERM_SET_BORDER = '#9050e9';
const PERM_SET_TEXT = '#3e2497';

/** Teal treatment for permission set groups — distinct from profile (blue) and permission set (purple). */
const PERM_SET_GROUP_BG = '#e3f7f5';
const PERM_SET_GROUP_BORDER = '#06a59a';
const PERM_SET_GROUP_TEXT = '#032f2e';

/** Neutral chip for non-permission scopes (e.g. analyzed Salesforce objects in field usage history). */
const OBJECT_BG = '#f3f2f2';
const OBJECT_BORDER = '#c9c9c9';
const OBJECT_TEXT = '#080707';

const scopeBadgeTruncateCss = css`
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
  font-weight: 600;
  border-radius: 0.25rem;
  box-shadow: none;
`;

const objectDefaultCss = css`
  ${scopeBadgeTruncateCss}
  background-color: ${OBJECT_BG};
  color: ${OBJECT_TEXT};
  border: 1px solid ${OBJECT_BORDER};
`;

const objectOnBrandCss = css`
  ${scopeBadgeTruncateCss}
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.55);
`;

const profileDefaultCss = css`
  ${scopeBadgeTruncateCss}
  background-color: ${PROFILE_BG};
  color: ${PROFILE_TEXT};
  border: 1px solid ${PROFILE_BORDER};
`;

const permissionSetDefaultCss = css`
  ${scopeBadgeTruncateCss}
  background-color: ${PERM_SET_BG};
  color: ${PERM_SET_TEXT};
  border: 1px solid ${PERM_SET_BORDER};
`;

const permissionSetGroupDefaultCss = css`
  ${scopeBadgeTruncateCss}
  background-color: ${PERM_SET_GROUP_BG};
  color: ${PERM_SET_GROUP_TEXT};
  border: 1px solid ${PERM_SET_GROUP_BORDER};
`;

/** Selected filter row uses brand (blue) background — chips need light outline treatment. */
const profileOnBrandCss = css`
  ${scopeBadgeTruncateCss}
  background-color: rgba(255, 255, 255, 0.22);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.65);
`;

const permissionSetOnBrandCss = css`
  ${scopeBadgeTruncateCss}
  background-color: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.55);
`;

const permissionSetGroupOnBrandCss = css`
  ${scopeBadgeTruncateCss}
  background-color: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.5);
`;

/** Container kinds that use the permission-matrix palette (analysis history, assignment rows, etc.). */
export type PermissionAnalysisContainerKind = 'profile' | 'permission_set' | 'permission_set_group';

const assignmentTypeLabelShellCss = css`
  display: inline-block;
  vertical-align: middle;
  font-weight: 600;
  border-radius: 0.25rem;
  box-shadow: none;
  padding: 0.0625rem 0.4rem;
  line-height: 1.35;
  max-width: 100%;
`;

const profileAssignmentTypeLabelCss = css`
  ${assignmentTypeLabelShellCss}
  background-color: ${PROFILE_BG};
  color: ${PROFILE_TEXT};
  border: 1px solid ${PROFILE_BORDER};
`;

const permissionSetAssignmentTypeLabelCss = css`
  ${assignmentTypeLabelShellCss}
  background-color: ${PERM_SET_BG};
  color: ${PERM_SET_TEXT};
  border: 1px solid ${PERM_SET_BORDER};
`;

const permissionSetGroupAssignmentTypeLabelCss = css`
  ${assignmentTypeLabelShellCss}
  background-color: ${PERM_SET_GROUP_BG};
  color: ${PERM_SET_GROUP_TEXT};
  border: 1px solid ${PERM_SET_GROUP_BORDER};
`;

/**
 * Compact type label (e.g. “Profile”) for assignment rows — same palette as {@link permissionScopeBadgeCss}.
 */
export function permissionAnalysisAssignmentTypeLabelCss(kind: PermissionAnalysisContainerKind): SerializedStyles {
  if (kind === 'profile') {
    return profileAssignmentTypeLabelCss;
  }
  if (kind === 'permission_set_group') {
    return permissionSetGroupAssignmentTypeLabelCss;
  }
  return permissionSetAssignmentTypeLabelCss;
}

/**
 * @param kind Profile vs permission set vs analyzed object (field usage history).
 * @param surface Use `onBrand` when the badge sits on `slds-button_brand` (selected filter row).
 */
export function permissionScopeBadgeCss(
  kind: 'profile' | 'permission_set' | 'object',
  surface: PermissionScopeBadgeSurface = 'default',
): SerializedStyles {
  if (kind === 'object') {
    return surface === 'onBrand' ? objectOnBrandCss : objectDefaultCss;
  }
  if (surface === 'onBrand') {
    return kind === 'profile' ? profileOnBrandCss : permissionSetOnBrandCss;
  }
  return kind === 'profile' ? profileDefaultCss : permissionSetDefaultCss;
}

/**
 * Scope / filter chips when the list can include permission set groups (e.g. future history filters).
 */
export function permissionAnalysisContainerBadgeCss(
  kind: PermissionAnalysisContainerKind,
  surface: PermissionScopeBadgeSurface = 'default',
): SerializedStyles {
  if (surface === 'onBrand') {
    if (kind === 'profile') {
      return profileOnBrandCss;
    }
    if (kind === 'permission_set_group') {
      return permissionSetGroupOnBrandCss;
    }
    return permissionSetOnBrandCss;
  }
  if (kind === 'profile') {
    return profileDefaultCss;
  }
  if (kind === 'permission_set_group') {
    return permissionSetGroupDefaultCss;
  }
  return permissionSetDefaultCss;
}
