// Reuse only the small stage-8/9/10 portion of an existing legal asset in tall
// solvers. The returned pack follows the original LGB format and validation.
export function tailLegalPack(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 5) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0,4)) !== 'LGB2') return bytes;
  let offset=5;const stages=[],oracles=[];
  for(let i=0;i<bytes[4];i++) {
    if(offset+5>bytes.length)return bytes;
    const start=offset,stage=bytes[offset],length=view.getUint32(offset+1,true);offset+=5+length;
    if(offset>bytes.length)return bytes;
    if(stage>=8)stages.push(bytes.subarray(start,offset));
  }
  if(offset>=bytes.length)return bytes;
  const count=bytes[offset++];
  for(let i=0;i<count;i++) {
    if(offset+6>bytes.length)return bytes;
    const start=offset,length=view.getUint32(offset+2,true);offset+=6+length;
    if(offset>bytes.length)return bytes;
    oracles.push(bytes.subarray(start,offset));
  }
  if(offset!==bytes.length)return bytes;
  const result=new Uint8Array(6+stages.concat(oracles).reduce((n,b)=>n+b.length,0));
  result.set(bytes.subarray(0,4));result[4]=stages.length;offset=5;
  for(const part of stages){result.set(part,offset);offset+=part.length}
  result[offset++]=oracles.length;
  for(const part of oracles){result.set(part,offset);offset+=part.length}
  return result;
}
