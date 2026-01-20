import { render, waitFor } from '@testing-library/react';
import JSZip from 'jszip';
import { LoadRecordsDataZipPreview } from '../LoadRecordsDataZipPreview';

// Mock DataTable to avoid rendering issues in tests
vi.mock('@jetstream/ui', () => ({
  DataTable: () => null,
  Icon: () => null,
}));

// Helper to create a mock zip file
async function createMockZip(fileNames: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  fileNames.forEach((name) => {
    zip.file(name, 'mock content');
  });
  return await zip.generateAsync({ type: 'arraybuffer' });
}

describe('LoadRecordsDataZipPreview', () => {
  describe('onWarnings callback', () => {
    it('should call onWarnings(true) when a file has NO matching row', async () => {
      const onWarnings = vi.fn();
      const zipData = await createMockZip(['file1.csv', 'file2.csv']);
      const rows = [
        { id: '1', attachment: 'file1.csv' }, // Only file1 matches
      ];

      render(
        <LoadRecordsDataZipPreview inputZipFileData={zipData} rows={rows} binaryAttachmentBodyField="attachment" onWarnings={onWarnings} />,
      );

      await waitFor(() => {
        expect(onWarnings).toHaveBeenCalled();
      });

      // file2.csv has no matching row, so there should be a warning
      expect(onWarnings).toHaveBeenCalledWith(true);
    });

    it('should call onWarnings(true) when a file has invisible unicode characters', async () => {
      const onWarnings = vi.fn();
      // File with zero-width space character (U+200B)
      const zipData = await createMockZip(['file\u200B1.csv']);
      const rows = [
        { id: '1', attachment: 'file\u200B1.csv' }, // File matches but has invisible chars
      ];

      render(
        <LoadRecordsDataZipPreview inputZipFileData={zipData} rows={rows} binaryAttachmentBodyField="attachment" onWarnings={onWarnings} />,
      );

      await waitFor(() => {
        expect(onWarnings).toHaveBeenCalled();
      });

      // File has invisible characters, so there should be a warning
      expect(onWarnings).toHaveBeenCalledWith(true);
    });

    it('should call onWarnings(false) when all files have matching rows and no invisible characters', async () => {
      const onWarnings = vi.fn();
      const zipData = await createMockZip(['file1.csv', 'file2.csv']);
      const rows = [
        { id: '1', attachment: 'file1.csv' },
        { id: '2', attachment: 'file2.csv' },
      ];

      render(
        <LoadRecordsDataZipPreview inputZipFileData={zipData} rows={rows} binaryAttachmentBodyField="attachment" onWarnings={onWarnings} />,
      );

      await waitFor(() => {
        expect(onWarnings).toHaveBeenCalled();
      });

      // All files match and have no invisible chars, so no warnings
      expect(onWarnings).toHaveBeenCalledWith(false);
    });

    it('should call onWarnings(true) when files have both missing matches and invisible characters', async () => {
      const onWarnings = vi.fn();
      const zipData = await createMockZip(['file1.csv', 'file\u200B2.csv', 'file3.csv']);
      const rows = [
        { id: '1', attachment: 'file1.csv' }, // Only file1 matches, file2 has invisible char, file3 has no match
      ];

      render(
        <LoadRecordsDataZipPreview inputZipFileData={zipData} rows={rows} binaryAttachmentBodyField="attachment" onWarnings={onWarnings} />,
      );

      await waitFor(() => {
        expect(onWarnings).toHaveBeenCalled();
      });

      expect(onWarnings).toHaveBeenCalledWith(true);
    });

    it('should call onWarnings(false) with no files in zip', async () => {
      const onWarnings = vi.fn();
      const zipData = await createMockZip([]);
      const rows = [{ id: '1', attachment: 'file1.csv' }];

      render(
        <LoadRecordsDataZipPreview inputZipFileData={zipData} rows={rows} binaryAttachmentBodyField="attachment" onWarnings={onWarnings} />,
      );

      await waitFor(() => {
        expect(onWarnings).toHaveBeenCalled();
      });

      // Empty array, .some() returns false
      expect(onWarnings).toHaveBeenCalledWith(false);
    });

    it('should match files against any field value when binaryAttachmentBodyField is not provided', async () => {
      const onWarnings = vi.fn();
      const zipData = await createMockZip(['file1.csv', 'file2.csv']);
      const rows = [
        { id: '1', someField: 'file1.csv', otherField: 'value' },
        { id: '2', someField: 'unmatched', otherField: 'file2.csv' },
      ];

      render(<LoadRecordsDataZipPreview inputZipFileData={zipData} rows={rows} binaryAttachmentBodyField={null} onWarnings={onWarnings} />);

      await waitFor(() => {
        expect(onWarnings).toHaveBeenCalled();
      });

      // Both files match (one in someField, one in otherField)
      expect(onWarnings).toHaveBeenCalledWith(false);
    });
  });
});
