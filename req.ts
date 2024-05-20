import { RangeInfo } from "./lib.ts";


async function reqRange(start: number, end: number) {
  const resp = await fetch('http://localhost:8080/assets/spanish.vim', {
    headers: {
      range: [start, end].join('-')
    }
  });
  return resp.body?.getReader().read();
}
const headerReadble = await reqRange(0, 32)
const result = headerReadble!.value
const header = new BigInt64Array(result!.buffer, 0, 4)
const end = Number(header.at(1))
const start = end - Number(header.at(3)) * 16
console.log(start, end);
const rangeResult = await reqRange(start, end)

const rangeMeta = new BigInt64Array(rangeResult!.value!.buffer!, 0, Number(header.at(3)) * 2)

const dataRange = rangeMeta.slice(2)
const textDecoder = new TextDecoder()
const nameRange = await reqRange(Number(rangeMeta.at(0)), Number(rangeMeta.at(1)))


const rangeName = textDecoder.decode(nameRange?.value).split('\0').filter(Boolean)


const rangeMap: Map<string, RangeInfo> = new Map()
for (let index = 0, length = dataRange.length / 2; index < length; index++) {

  const start = dataRange.at(index * 2 + 0);
  const end = dataRange.at(index * 2 + 1);
  rangeMap.set(rangeName.at(index)!, new RangeInfo(start!, end!))
}
console.log(rangeMap);
