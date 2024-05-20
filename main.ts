import { RangeInfo } from "./lib.ts";

const file = await Deno.open('./assets/spanish.vim', { read: true })
const header = new BigInt64Array(4)
const u8array = new Uint8Array(header.buffer)
const bytesRead = await file.read(u8array)
if (bytesRead) {
  console.log('已读:', bytesRead, u8array.length)
}

const rangeBuffer = new Uint8Array(16 * Number(header.at(3)))
await file.read(rangeBuffer)
const rangeMeta = new BigInt64Array(rangeBuffer.buffer)
const nameRange = new Uint8Array(Number(rangeMeta.at(1)! - rangeMeta.at(0)!))
await file.read(nameRange)


const textDecoder = new TextDecoder()
const rangeName = textDecoder.decode(nameRange).split('\0').filter(Boolean)



const dataRange = rangeMeta.slice(2)

const rangeMap: Map<string, RangeInfo> = new Map()
for (let index = 0, length = dataRange.length / 2; index < length; index++) {

  const start = dataRange.at(index * 2 + 0);
  const end = dataRange.at(index * 2 + 1);
  rangeMap.set(rangeName.at(index)!, new RangeInfo(start!, end!))
}
console.log(rangeMap);
