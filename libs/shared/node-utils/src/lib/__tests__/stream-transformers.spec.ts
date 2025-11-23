import { PassThrough } from 'stream';
import { StripBlobFilename } from '../stream-transformers';

describe('StripBlobFilename', () => {
  it('removes filename="blob" from the collection part', () => {
    const input = [
      '------boundary123\r\n',
      'Content-Disposition: form-data; name="collection"; filename="blob"\r\n',
      'Content-Type: application/json\r\n',
      '\r\n',
      '{"allOrNone":false,"records":[]}\r\n',
      '------boundary123\r\n',
      'Content-Disposition: form-data; name="binaryPart1"; filename="file.pdf"\r\n',
      'Content-Type: application/pdf\r\n',
      '\r\n',
      '%PDF-1.4 ...binary...\r\n',
      '------boundary123--\r\n',
    ].join('');

    const expected = input.replace('name="collection"; filename="blob"', 'name="collection"');

    const transformer = new StripBlobFilename();
    const passthrough = new PassThrough();

    let output = '';
    transformer.on('data', (chunk) => {
      output += chunk.toString('latin1');
    });

    return new Promise<void>((resolve, reject) => {
      transformer.on('end', () => {
        try {
          expect(output).toBe(expected);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      transformer.on('error', reject);

      passthrough.pipe(transformer);
      passthrough.end(Buffer.from(input, 'latin1'));
    });
  });

  it('passes through unchanged when no blob filename present', () => {
    const input = [
      '------boundary123\r\n',
      'Content-Disposition: form-data; name="collection"\r\n',
      'Content-Type: application/json\r\n',
      '\r\n',
      '{"allOrNone":false}\r\n',
      '------boundary123--\r\n',
    ].join('');

    const transformer = new StripBlobFilename();
    const passthrough = new PassThrough();

    let output = '';
    transformer.on('data', (chunk) => {
      output += chunk.toString('latin1');
    });

    return new Promise<void>((resolve, reject) => {
      transformer.on('end', () => {
        try {
          expect(output).toBe(input);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      transformer.on('error', reject);

      passthrough.pipe(transformer);
      passthrough.end(Buffer.from(input, 'latin1'));
    });
  });
});
