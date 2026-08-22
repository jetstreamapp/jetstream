import { fireEvent, render, screen } from '@testing-library/react';
import { atom } from 'jotai';
import { describe, expect, it, vi } from 'vitest';
import ViewOrCompareMetadataSidebar, { ViewOrCompareMetadataSidebarProps } from '../ViewOrCompareMetadataSidebar';
import { FilePropertiesWithContent } from '../viewOrCompareMetadataTypes';
import { buildTree } from '../viewOrCompareMetadataUtils';

vi.mock('@jetstream/ui-core', () => ({ OrgsCombobox: () => null }));
vi.mock('@jetstream/ui/app-state', () => ({ salesforceOrgsOmitSelectedState: atom([]) }));

function getFile(fileName: string, content: string): FilePropertiesWithContent {
  return {
    type: fileName.split('/')[0],
    createdById: '005000000000000',
    createdByName: 'Test User',
    createdDate: '2026-01-01T00:00:00.000Z',
    fileName,
    fullName: fileName.split('/').pop() as string,
    id: '01p000000000000',
    lastModifiedById: '005000000000000',
    lastModifiedByName: 'Test User',
    lastModifiedDate: '2026-01-01T00:00:00.000Z',
    content,
  };
}

const sourceFiles = [
  getFile('classes/Matching.cls', 'shared'),
  getFile('classes/Different.cls', 'from source'),
  getFile('triggers/Matching.trigger', 'shared'),
];

const targetFiles = [
  getFile('classes/Matching.cls', 'shared'),
  getFile('classes/Different.cls', 'from target'),
  getFile('triggers/Matching.trigger', 'shared'),
];

function setup(props: Partial<ViewOrCompareMetadataSidebarProps> = {}) {
  return render(
    <ViewOrCompareMetadataSidebar
      editorType="DIFF"
      files={buildTree(sourceFiles, targetFiles)}
      targetLoading={false}
      hasSourceResults
      hasTargetResults
      isSingleOrgMode={false}
      onEditorTypeChange={vi.fn()}
      onSelectedFile={vi.fn()}
      onTargetOrgChange={vi.fn()}
      {...props}
    />,
  );
}

function getHideUnchangedCheckbox() {
  return screen.getByLabelText('Hide Unchanged Files');
}

describe('ViewOrCompareMetadataSidebar', () => {
  it('does not offer the filter until a target org has been compared', () => {
    setup({ files: buildTree(sourceFiles), hasTargetResults: false });

    expect(screen.queryByLabelText('Hide Unchanged Files')).toBeNull();
    expect(screen.queryByText(/Showing .* files/)).toBeNull();
    expect(screen.getByText('Different.cls')).toBeTruthy();
  });

  it('does not offer the filter when metadata failed to load', () => {
    setup({ targetError: 'Something went wrong' });

    expect(screen.queryByLabelText('Hide Unchanged Files')).toBeNull();
  });

  it('shows every file with the filter turned off', () => {
    setup();

    expect(getHideUnchangedCheckbox()).toHaveProperty('checked', false);
    expect(screen.getByText('Showing 3 of 3 files')).toBeTruthy();
    expect(screen.getByText('Different.cls')).toBeTruthy();
    expect(screen.getByText('Matching.cls')).toBeTruthy();
    expect(screen.getByText('Matching.trigger')).toBeTruthy();
  });

  it('hides matching files and any folder left empty when enabled', () => {
    setup();

    fireEvent.click(getHideUnchangedCheckbox());

    expect(screen.getByText('Showing 1 of 3 files')).toBeTruthy();
    expect(screen.getByText('Different.cls')).toBeTruthy();
    expect(screen.queryByText('Matching.cls')).toBeNull();
    expect(screen.getByText('classes')).toBeTruthy();
    expect(screen.queryByText('triggers')).toBeNull();
  });

  it('restores the full list when turned back off', () => {
    setup();

    fireEvent.click(getHideUnchangedCheckbox());
    fireEvent.click(getHideUnchangedCheckbox());

    expect(screen.getByText('Showing 3 of 3 files')).toBeTruthy();
    expect(screen.getByText('Matching.cls')).toBeTruthy();
    expect(screen.getByText('Matching.trigger')).toBeTruthy();
  });

  it('explains the empty list when every file matches the target org', () => {
    setup({ files: buildTree(sourceFiles, sourceFiles) });

    fireEvent.click(getHideUnchangedCheckbox());

    expect(screen.getByText('Showing 0 of 3 files')).toBeTruthy();
    expect(screen.getByText('All metadata matches the target org.')).toBeTruthy();
    expect(screen.queryByText('Matching.cls')).toBeNull();
  });

  it('keeps the selected file when the filter empties the list and is then turned back off', () => {
    const onSelectedFile = vi.fn();
    setup({ files: buildTree(sourceFiles, sourceFiles), onSelectedFile });
    fireEvent.click(screen.getByText('Matching.trigger'));
    onSelectedFile.mockClear();

    fireEvent.click(getHideUnchangedCheckbox());
    fireEvent.click(getHideUnchangedCheckbox());

    // The tree stays mounted while empty, otherwise remounting would reset the selection to the first file
    expect(onSelectedFile).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'triggers/Matching.trigger' }));
  });

  it('selects the first remaining file when the active file is filtered out', () => {
    const onSelectedFile = vi.fn();
    // Files are sorted by name, so the file the tree auto-selects on init is one that matches the target org
    const files = buildTree(
      [getFile('classes/Alpha.cls', 'shared'), getFile('classes/Beta.cls', 'from source')],
      [getFile('classes/Alpha.cls', 'shared'), getFile('classes/Beta.cls', 'from target')],
    );
    setup({ files, onSelectedFile });

    expect(onSelectedFile).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'classes/Alpha.cls' }));
    onSelectedFile.mockClear();

    fireEvent.click(getHideUnchangedCheckbox());

    expect(onSelectedFile).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'classes/Beta.cls' }));
  });
});
