export class RangeInfo {
  constructor(public bitStart: bigint, public bitEnd: bigint) { }
  get byteLength() {
    return Number(this.bitEnd - this.bitStart) / 8
  }
  get bitLength() {
    return this.bitEnd - this.bitStart
  }
  get byteStart() {
    return Number(this.bitStart) / 8
  }
  get byteEnd() {
    return Number(this.bitEnd) / 8
  }
}