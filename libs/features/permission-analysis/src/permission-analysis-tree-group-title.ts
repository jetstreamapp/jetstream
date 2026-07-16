/**
 * Strip the redundant `Profile: ` prefix when showing a profile pill + title on two lines
 * (tab visibility, field permissions, object permissions trees).
 */
export function permissionAnalysisPermissionContainerGroupTitleLine(exportLabel: string, isProfileOwned: boolean): string {
  if (isProfileOwned && exportLabel.startsWith('Profile: ')) {
    const rest = exportLabel.slice('Profile: '.length).trim();
    if (rest.length > 0) {
      return rest;
    }
  }
  return exportLabel;
}
