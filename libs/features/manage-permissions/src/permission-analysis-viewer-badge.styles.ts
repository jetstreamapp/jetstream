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

/**
 * @param kind Profile vs permission set scope.
 * @param surface Use `onBrand` when the badge sits on `slds-button_brand` (selected filter row).
 */
export function permissionScopeBadgeCss(
  kind: 'profile' | 'permission_set',
  surface: PermissionScopeBadgeSurface = 'default',
): SerializedStyles {
  if (surface === 'onBrand') {
    return kind === 'profile' ? profileOnBrandCss : permissionSetOnBrandCss;
  }
  return kind === 'profile' ? profileDefaultCss : permissionSetDefaultCss;
}
