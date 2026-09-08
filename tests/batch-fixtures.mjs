import { Field, encoder } from 'tetris-fumen';
export const fumen = rows => encoder.encode([{ field: Field.create(rows.join('').replaceAll('.', '_')) }]);
export const modes = ['normal','tetris','tetris-end','1l','1l-or-pc','2l','2l-or-pc','3l','3l-or-pc','4l','4l-or-pc','tsm','tss','tsd','tst','b2b'];
export const smallCover = fumen(['OOIIII....','OO....TTT.','........T.']);
export const oSix = fumen(['OOOOOO....','OOOOOO....','OOOOOO....','OOOOOO....']);
export const box = fumen(['TTTT......','TTTT......','TTTT......']);
export const benchmarkCases = [
  {name:'cover-full-o6', module:'batch-cover-feature', fn:'calculateCover', input:{sourceFumen:oSix,pattern:'OOOOOO;IIIIII',clear:4}},
  {name:'cover-coverage-o6', module:'batch-cover-feature', fn:'calculateCover', input:{sourceFumen:oSix,pattern:'OOOOOO;IIIIII',clear:4,outputMode:'coverage'}},
  {name:'cover-many-targets', module:'batch-cover-feature', fn:'calculateCover', input:{sourceFumen:encoder.encode(Array.from({length:16},()=>({field:Field.create('OO________OO________')}))),pattern:'*p3',mirror:'yes',outputMode:'coverage'}},
  {name:'congruent-box3', module:'batch-congruent-feature', fn:'calculateCongruent', input:{sourceFumen:box,pattern:'*p3'}},
  {name:'congruent-box4', module:'batch-congruent-feature', fn:'calculateCongruent', input:{sourceFumen:fumen(['TTTT......','TTTT......','TTTT......','TTTT......']),pattern:'*p4'}},
  {name:'congruent-repeated', module:'batch-congruent-feature', fn:'calculateCongruent', input:{sourceFumen:fumen(['TTTT......','TTTT......','TTTT......','TTTT......']),pattern:'OOOO;IIII;TTTT;JJJJ;LLLL;SSSS;ZZZZ'}},
  {name:'congruent-tall6', module:'batch-congruent-feature', fn:'calculateCongruent', input:{sourceFumen:fumen(Array(6).fill('OOOO......')),pattern:'OOOOOOO',clear:6}},
  {name:'congruent-cover', module:'batch-congruent-feature', fn:'calculateCongruentCover', input:{sourceFumen:box,pattern:'*p3',mirror:'yes'}},
  {name:'cover-percent', module:'batch-cover-percent-feature', fn:'calculateCoverPercent', input:{sourceFumen:oSix,coverPattern:'OOOOOO;IIIIII',percentPattern:'*p4'}},
];
export function canonical(value) {
  return JSON.stringify(value, (_, x) => typeof x === 'bigint' ? `${x}n` : x);
}
