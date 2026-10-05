import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const DISK_RESERVE_BYTES = 4 * 1024 ** 3;
export function diskAvailable(directory) {
  const stats = fs.statfsSync(directory, { bigint: true });
  return Number(stats.bavail * stats.bsize);
}
export function diskAdmission(availableBytes, neededBytes, reserveBytes = DISK_RESERVE_BYTES) {
  for (const value of [availableBytes, neededBytes, reserveBytes]) assert(Number.isSafeInteger(value) && value >= 0);
  return { availableBytes, neededBytes, reserveBytes, admitted: neededBytes + reserveBytes <= availableBytes };
}
export function requireDisk(directory, neededBytes, { available = diskAvailable, reserveBytes = DISK_RESERVE_BYTES } = {}) {
  const admission = diskAdmission(available(directory), neededBytes, reserveBytes);
  assert(admission.admitted, 'INSUFFICIENT_DISK_SPACE ' + JSON.stringify(admission));
  return admission;
}
export function materializeFixture(source, destination, { bytes, size, storage = requireDisk, link = fs.linkSync } = {}) {
  if (source) {
    try { link(source, destination); return { kind: 'HARDLINK', allocatedBytes: 0 }; }
    catch (error) { if (!['EXDEV', 'EPERM', 'ENOSYS', 'ENOTSUP', 'EACCES'].includes(error.code)) throw error; }
  }
  storage(path.dirname(destination), size);
  fs.writeFileSync(destination, bytes(), { flag: 'wx' });
  return { kind: 'CHECKED_COPY', allocatedBytes: size };
}
