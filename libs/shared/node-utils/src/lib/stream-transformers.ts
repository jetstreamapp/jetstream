import { Transform, TransformCallback } from 'node:stream';

/**
 * Browsers add filename="blob" to json multipart form data parts, but Salesforce chokes on it.
 * This transform strips that out of the multipart headers.
 * only the very first part will have this, so we can stop processing after that.
 */
export class StripBlobFilename extends Transform {
  private _replaced = false;
  private readonly _replacementText = /name="collection"; filename="blob"/;
  private readonly _splitString = '\r\n\r\n';
  private _buffer: Buffer = Buffer.alloc(0);

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    if (this._replaced) {
      this.push(chunk);
      return callback();
    }

    // Append incoming chunk to our buffer
    this._buffer = Buffer.concat([this._buffer as any, chunk as any]);

    // Search for the header terminator in latin1 encoding
    const splitIndex = this._buffer.toString('latin1').indexOf(this._splitString);

    if (splitIndex !== -1) {
      // Split into headers (string) and the rest (Buffer)
      const headers = this._buffer.subarray(0, splitIndex).toString('latin1');
      const rest = this._buffer.subarray(splitIndex + this._splitString.length);

      const rewritten = headers.replace(this._replacementText, 'name="collection"');

      // Push back rewritten headers + separator + untouched rest
      this.push(Buffer.from(rewritten, 'latin1'));
      this.push(Buffer.from(this._splitString, 'latin1'));
      this.push(rest);

      this._replaced = true;
      this._buffer = Buffer.alloc(0); // release memory
    }

    callback();
  }
}
