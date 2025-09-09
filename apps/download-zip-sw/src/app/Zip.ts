// Based on the implementation specified in: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
import Crc32 from './Crc32';
import { logger } from './Logger';
import ZipUtils from './ZipUtils';

// Polyfill ReadableStream if not in browser
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReadableStreamLocal = ReadableStream;

class Zip {
  zip64: boolean;
  fileRecord: {
    name: string;
    sizeBig: bigint;
    crc: Crc32;
    done: boolean;
    date: Date;
    headerOffsetBig: bigint;
  }[];
  finished: boolean;
  byteCounterBig: bigint;
  outputStream: any;
  outputController: ReadableStreamController<any>;
  constructor(zip64) {
    // Enable large zip compatibility?
    this.zip64 = zip64;
    logger.log(`[SW] Started zip with zip64: ${this.zip64}`);

    // Setup file record
    this.fileRecord = [];
    this.finished = false;

    // Setup byte counter
    this.byteCounterBig = BigInt(0);

    // Setup output stream
    this.outputStream = new ReadableStreamLocal({
      start: (controller) => {
        logger.log('[SW] OutputStream has started');
        this.outputController = controller;
      },
      cancel: () => {
        logger.error('[SW] OutputStream has been canceled');
      },
      // read: () => {}, // was not on type declaration
    });
  }

  // To also work with the node version of readable stream (for testing)
  enqueue = (data) => {
    if (this.outputController) {
      this.outputController.enqueue(data);
    } else {
      this.outputStream.push(data);
    }
  };

  close = () => {
    if (this.outputController) {
      this.outputController.close();
    } else {
      this.outputStream.destroy();
    }
  };

  // Generators
  getZip64ExtraField = (fileSizeBig, localFileHeaderOffsetBig) => {
    return ZipUtils.createByteArray([
      { data: 0x0001, size: 2 },
      { data: 28, size: 2 },
      { data: fileSizeBig, size: 8 },
      { data: fileSizeBig, size: 8 },
      { data: localFileHeaderOffsetBig, size: 8 },
      { data: 0, size: 4 },
    ]);
  };

  isWritingFile = () => this.fileRecord.length > 0 && this.fileRecord[this.fileRecord.length - 1].done === false;

  // API
  startFile = (fileName) => {
    if (!this.isWritingFile() && !this.finished) {
      logger.log(`Start file: ${fileName}`);
      const date = new Date(Date.now());

      // Add file to record
      this.fileRecord = [
        ...this.fileRecord,
        {
          name: fileName,
          sizeBig: BigInt(0),
          crc: new Crc32(),
          done: false,
          date,
          headerOffsetBig: this.byteCounterBig,
        },
      ];

      // Generate Local File Header
      const nameBuffer = new TextEncoder().encode(fileName);
      const header = ZipUtils.createByteArray([
        { data: 0x04034b50, size: 4 },
        { data: 0x002d, size: 2 },
        { data: 0x0808, size: 2 },
        { data: 0x0000, size: 2 },
        { data: ZipUtils.getTimeStruct(date), size: 2 },
        { data: ZipUtils.getDateStruct(date), size: 2 },
        { data: 0x00000000, size: 4 },
        { data: this.zip64 ? 0xffffffff : 0x00000000, size: 4 },
        { data: this.zip64 ? 0xffffffff : 0x00000000, size: 4 },
        { data: nameBuffer.length, size: 2 },
        { data: this.zip64 ? 32 : 0, size: 2 },
        { data: nameBuffer },
        { data: this.zip64 ? this.getZip64ExtraField(BigInt(0), this.byteCounterBig) : [] },
      ]);

      // Write header to output stream and add to byte counter
      this.enqueue(header);
      this.byteCounterBig += BigInt(header.length);
    } else {
      logger.error('Tried adding file while adding other file or while zip has finished');
    }
  };

  appendData = (data) => {
    try {
      if (this.isWritingFile() && !this.finished) {
        // Write data to output stream, add to CRC and increment the file and global size counters
        this.enqueue(data);
        this.byteCounterBig += BigInt(data.length);
        this.fileRecord[this.fileRecord.length - 1].crc.append(data);
        this.fileRecord[this.fileRecord.length - 1].sizeBig += BigInt(data.length);
      } else {
        logger.error('Tried to append file data, but there is no open file!');
      }
    } catch (e) {
      logger.error(e);
    }
  };

  endFile = () => {
    try {
      if (this.isWritingFile() && !this.finished) {
        const file = this.fileRecord[this.fileRecord.length - 1];
        logger.log(`End file: ${file.name}`);
        const dataDescriptor = ZipUtils.createByteArray([
          { data: file.crc.get(), size: 4 },
          { data: file.sizeBig, size: this.zip64 ? 8 : 4 },
          { data: file.sizeBig, size: this.zip64 ? 8 : 4 },
        ]);
        this.enqueue(dataDescriptor);
        this.byteCounterBig += BigInt(dataDescriptor.length);
        this.fileRecord[this.fileRecord.length - 1].done = true;
      } else {
        logger.error('Tried to end file, but there is no open file!');
      }
    } catch (e) {
      logger.error(e);
    }
  };

  finish = () => {
    if (!this.isWritingFile() && !this.finished) {
      logger.log(`Finishing zip`);
      // Write central directory headers
      let centralDirectorySizeBig = BigInt(0);
      const centralDirectoryStartBig = this.byteCounterBig;
      this.fileRecord.forEach((file) => {
        const { date, crc, sizeBig, name, headerOffsetBig } = file;
        const nameBuffer = new TextEncoder().encode(name);
        const header = ZipUtils.createByteArray([
          { data: 0x02014b50, size: 4 },
          { data: 0x002d, size: 2 },
          { data: 0x002d, size: 2 },
          { data: 0x0808, size: 2 },
          { data: 0x0000, size: 2 },
          { data: ZipUtils.getTimeStruct(date), size: 2 },
          { data: ZipUtils.getDateStruct(date), size: 2 },
          { data: crc.get(), size: 4 },
          { data: this.zip64 ? 0xffffffff : sizeBig, size: 4 },
          { data: this.zip64 ? 0xffffffff : sizeBig, size: 4 },
          { data: nameBuffer.length, size: 2 },
          { data: this.zip64 ? 32 : 0, size: 2 },
          { data: 0x0000, size: 2 },
          { data: 0x0000, size: 2 },
          { data: 0x0000, size: 2 },
          { data: 0x00000000, size: 4 },
          { data: this.zip64 ? 0xffffffff : headerOffsetBig, size: 4 },
          { data: nameBuffer },
          { data: this.zip64 ? this.getZip64ExtraField(sizeBig, headerOffsetBig) : [] },
        ]);
        this.enqueue(header);
        this.byteCounterBig += BigInt(header.length);
        centralDirectorySizeBig += BigInt(header.length);
      });

      if (this.zip64) {
        // Write zip64 end of central directory record
        const zip64EndOfCentralDirectoryRecordStartBig = this.byteCounterBig;
        const zip64EndOfCentralDirectoryRecord = ZipUtils.createByteArray([
          { data: 0x06064b50, size: 4 },
          { data: 44, size: 8 },
          { data: 0x002d, size: 2 },
          { data: 0x002d, size: 2 },
          { data: 0, size: 4 },
          { data: 0, size: 4 },
          { data: this.fileRecord.length, size: 8 },
          { data: this.fileRecord.length, size: 8 },
          { data: centralDirectorySizeBig, size: 8 },
          { data: centralDirectoryStartBig, size: 8 },
        ]);
        this.enqueue(zip64EndOfCentralDirectoryRecord);
        this.byteCounterBig += BigInt(zip64EndOfCentralDirectoryRecord.length);

        // Write zip64 end of central directory locator
        const zip64EndOfCentralDirectoryLocator = ZipUtils.createByteArray([
          { data: 0x07064b50, size: 4 },
          { data: 0, size: 4 },
          { data: zip64EndOfCentralDirectoryRecordStartBig, size: 8 },
          { data: 1, size: 4 },
        ]);
        this.enqueue(zip64EndOfCentralDirectoryLocator);
        this.byteCounterBig += BigInt(zip64EndOfCentralDirectoryLocator.length);
      }

      const endOfCentralDirectoryRecord = ZipUtils.createByteArray([
        { data: 0x06054b50, size: 4 },
        { data: 0, size: 2 },
        { data: 0, size: 2 },
        { data: this.zip64 ? 0xffff : this.fileRecord.length, size: 2 },
        { data: this.zip64 ? 0xffff : this.fileRecord.length, size: 2 },
        { data: this.zip64 ? 0xffffffff : centralDirectorySizeBig, size: 4 },
        { data: this.zip64 ? 0xffffffff : centralDirectoryStartBig, size: 4 },
        { data: 0, size: 2 },
      ]);
      this.enqueue(endOfCentralDirectoryRecord);
      this.close();
      this.byteCounterBig += BigInt(endOfCentralDirectoryRecord.length);

      this.finished = true;
      logger.log(`Done writing zip file. Wrote ${this.fileRecord.length} files and a total of ${this.byteCounterBig} bytes.`);
    } else {
      logger.error('Empty zip, or there is still a file open');
    }
  };
}

export default Zip;
