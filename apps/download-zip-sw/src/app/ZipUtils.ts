import { logger } from './Logger';

const LITTLE_ENDIAN = true;

class ZipUtils {
  // Data is an array in the format: [{data: 0x0000, size: 2} or {data: Buffer()}, ...]
  createByteArray = (data) => {
    const size = data.reduce((acc, value) => {
      return acc + (value.size ? value.size : value.data.length);
    }, 0);
    const array = new Uint8Array(size);
    const dataView = new DataView(array.buffer);

    let i = 0;
    data.forEach((entry) => {
      if (entry.data.length !== undefined) {
        // Entry data is some kind of buffer / array
        array.set(entry.data, i);
        i += entry.data.length;
      } else {
        // Entry data is some kind of integer
        switch (entry.size) {
          case 1:
            dataView.setInt8(i, parseInt(entry.data));
            break;
          case 2:
            dataView.setInt16(i, parseInt(entry.data), LITTLE_ENDIAN);
            break;
          case 4:
            dataView.setInt32(i, parseInt(entry.data), LITTLE_ENDIAN);
            break;
          case 8:
            dataView.setBigInt64(i, BigInt(entry.data), LITTLE_ENDIAN);
            break;
          default: {
            const error = `createByteArray: No handler defined for data size ${entry.size} of entry data ${JSON.stringify(entry.data)}`;
            logger.error(error);
            throw error;
          }
        }
        i += entry.size;
      }
    });
    return array;
  };

  calculateSize = (files) => {
    const localHeaderSizeBig = (file) => BigInt(30 + file.name.length);
    const dataDescriptorSizeBig = BigInt(12);
    const centralDirectoryHeaderSizeBig = (file) => BigInt(46 + file.name.length);
    const endOfCentralDirectorySizeBig = BigInt(22);
    const zip64ExtraFieldSizeBig = BigInt(32);
    const zip64DataDescriptorSizeBig = BigInt(20);
    const zip64EndOfCentralDirectoryRecordSizeBig = BigInt(56);
    const zip64EndOfCentralDirectoryLocatorSizeBig = BigInt(20);

    let totalSizeBig = files.reduce((acc, val) => {
      return acc + localHeaderSizeBig(val) + BigInt(val.size) + dataDescriptorSizeBig + centralDirectoryHeaderSizeBig(val);
    }, BigInt(0));
    totalSizeBig += endOfCentralDirectorySizeBig;

    if (totalSizeBig >= BigInt('0xFFFFFFFF')) {
      // We have a ZIP64! Add all the data we missed before
      totalSizeBig = files.reduce((acc, val) => {
        return acc + zip64ExtraFieldSizeBig + (zip64DataDescriptorSizeBig - dataDescriptorSizeBig) + zip64ExtraFieldSizeBig;
      }, totalSizeBig);
      totalSizeBig += zip64EndOfCentralDirectoryRecordSizeBig;
      totalSizeBig += zip64EndOfCentralDirectoryLocatorSizeBig;
    }

    return totalSizeBig;
  };

  getTimeStruct = (date) => {
    return (((date.getHours() << 6) | date.getMinutes()) << 5) | (date.getSeconds() / 2);
  };

  getDateStruct = (date) => {
    return ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) | date.getDate();
  };
}

const staticZipUtils = new ZipUtils();
export default staticZipUtils;
