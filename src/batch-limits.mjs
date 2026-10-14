export class CongruentLimitError extends Error {
 constructor(limit,unit='accepted-solutions') {
  super(`congruent tiling limit ${limit} exceeded (${unit})`);
  this.name='CongruentLimitError';this.limit=limit;this.unit=unit;this.exhausted=true;
 }
}
export function validateCongruentLimit(limit) {
 if(!Number.isInteger(limit)||limit<1||limit>=0xffffffff)throw new RangeError('maxSolutions must be an integer in 1..4294967294');
 return limit;
}
