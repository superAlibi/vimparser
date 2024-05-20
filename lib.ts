export class RangeInfo {
  constructor(public startOffset: bigint, public endOffset: bigint) { }

  get length() {
    return this.endOffset - this.startOffset
  }

}


export const enum BEFASTMetaStage {
  INIT = 'init',
  HEADERREQING = 'headerReqing',
  HEADERFEILD = 'headerFeild',
  HEADERREQED = 'headerReqed',
  RANGEREQING = 'rangeReq',
  RANGEREQFEILD = 'rangeFeild',
  RANGEREQED = 'rangereqed',

}
/**
 * 
 */
export class BFASTMeta extends EventTarget {
  /**
   * 当前阶段
   * 用于表示是否初始化,或者请求到什么阶段
   * init: 未初始化
   * headerReq:请求header中
   * headerFeild:请求header中
   * rangeReq:请求dataBlokRange数据中
   * rangeFeild:请求dataBlokRange数据中
   * rangeNameReq:请求dataBlockName中
   * rangeNameFeild:请求dataBlockName中
   */
  public stage: string = BEFASTMetaStage.INIT
  /**
   * vim头信息
   */
  private fileHeader?: BigInt64Array
  /**
   * 数据区块开始位置(bit)
   */
  get dataBlockStartByte() {
    return (this.fileHeader?.at(1))
  }

  /**
   * 数据区块结束位置(bit)
   */
  get dataBlockEndByte() {
    return (this.fileHeader?.at(2))
  }

  /**
   * 数据区块总数量
   */
  get dataBlockCount() {
    return (this.fileHeader?.at(3))
  }
  /**
   * 数据区块索引范围
   * @description 
   * [
   * bigint,bigint, // first blockData start offset, first blockData end offset
   * bigint,bigint,  // second blockData start offset, second blockData end offset
   *        .
   *        .
   *        .
   *        .
   *        .
   *        .
   * bigint,bigint, // n th blockData start offset, n th  blockData end offset
   * ]
   */
  public rangeData?: BigInt64Array
  /**
   * 
   * @param source vim请求路径
   * @param offset 子区块的偏移量,
   * 因为bfast格式的文件子区块有可能还是bfast格式,所以,当取用子区块时中的bfast区块时,需要加上整个区块相对于整个文件的偏移量
   */
  constructor(public source: string, public offset: number = 0) {
    super()
  }
  /**
   * 请求文件的指定区间
   * @param startByte 
   * @param endByte 
   * @returns 
   */
  protected async reqRange(startByte: number, endByte: number) {
    if (endByte < startByte) { return }
    const resp = await globalThis.fetch(this.source, {
      headers: {
        range: [startByte + this.offset, endByte + this.offset].join('-')
      }
    });
    if (!resp.ok || !resp.body) {
      return
    }
    const result = new Uint8Array(endByte - startByte)
    let count = 0
    for await (const u8arr of resp.body) {
      for (const iterator of u8arr) {
        result[count++] = iterator
      }

    }
    return result
  }
  async initMeta() {

    this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERREQING))
    const result = await this.reqRange(0, 32).catch(e => {
      console.error(e);
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERFEILD))
      return void 0
    })
    if (!result) { return }
    this.fileHeader = new BigInt64Array(result!.buffer, 0, 4)
    this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERREQED))



    const end = Number(this.dataBlockStartByte)
    const start = end - Number(this.dataBlockCount) * 16
    this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.RANGEREQING))
    const rangeResult = await this.reqRange(start, end).catch(e => {
      console.error(e);
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERFEILD))
      return void 0
    })
    if (!rangeResult) { return }
    this.rangeData = new BigInt64Array(rangeResult!.buffer!, 0, Number(this.dataBlockCount) * 2)
    this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERREQED))
  }
}
export const enum VIMSTAGE {

  NAMEDATABLOCKREQING = "namedatablockreqing",
  NAMEDATABLOCKREQFEILD = "namedatablockreqFeild",
  NAMEDATABLOCKREQED = "namedatablockreqed",
}
export class VIMFileMeta extends BFASTMeta {

  /**
   * 数据区块名称列表
   */
  public dataBlocksName?: string[]
  /**
   * 数据区块名称和其位置偏移
   */
  public dataBlockNameOffsetMap: Map<string, RangeInfo> = new Map()
  constructor(source: string) {
    super(source)
  }
  get NameRange() {
    return new RangeInfo(this.dataBlockStartByte!, this.dataBlockEndByte!)
  }
  /**
   * vim文件名称范围
   */
  get dataBlocksNameOffset() {
    return this.rangeData?.slice(0, 2)
  }
  /**
   * vim文件其他数据区块范围
   */
  get dataBlockRangeOffset() {
    return this.rangeData?.slice(2)
  }
  async initMeta(): Promise<void> {
    await super.initMeta()

    const dataRange = this.rangeData!.slice(2)
    const textDecoder = new TextDecoder()
    this.dispatchEvent(new Event(this.stage = VIMSTAGE.NAMEDATABLOCKREQING))
    const nameRange = await this.reqRange(
      Number(this.dataBlocksNameOffset?.at(0)),
      Number(this.dataBlocksNameOffset?.at(1)))
      .catch((e) => {
        console.error(e);
        this.dispatchEvent(new Event(this.stage = VIMSTAGE.NAMEDATABLOCKREQFEILD))
        return void 0
      })
    this.dispatchEvent(new Event(this.stage = VIMSTAGE.NAMEDATABLOCKREQED))


    const rangeName = this.dataBlocksName = textDecoder.decode(nameRange).split('\0').filter(Boolean)


    for (let index = 0, length = dataRange.length / 2; index < length; index++) {

      const start = dataRange.at(index * 2 + 0);
      const end = dataRange.at(index * 2 + 1);
      this.dataBlockNameOffsetMap.set(rangeName.at(index)!, new RangeInfo(start!, end!))

    }

  }
  /**
   * 给出子区块的bfast格式
   * @param rangeInfo 
   * @returns 
   */
  private async getSubDataBlockByBfast(rangeInfo: RangeInfo) {
    const bfast = new BFASTMeta(this.source, Number(rangeInfo.startOffset))
    await bfast.initMeta()
    return bfast
  }
  /**
   * 给出子区块的arrayBuffer格式
   * @param rangeInfo 
   * @returns 
   */
  private async getSubDataBlockByArrayBuffer(rangeInfo: RangeInfo) {
    const readResult = await this.reqRange(Number(rangeInfo.startOffset), Number(rangeInfo.endOffset))
    return readResult
  }
  /**
   * 给出指定命名区块数据
   * @param dataBlockName 区块名称
   * @param format 给出区块名称
   * @returns 
   */
  getDataBlock(dataBlockName: string, format: 'bfast' | 'u8arr' = 'bfast') {
    const rangeInfo = this.dataBlockNameOffsetMap.get(dataBlockName)
    if (!rangeInfo) return Promise.resolve(void 0)
    switch (format) {
      case 'bfast':
        return this.getSubDataBlockByBfast(rangeInfo)
      case 'u8arr':
        return this.getSubDataBlockByArrayBuffer(rangeInfo)
      default:
        this.getSubDataBlockByBfast(rangeInfo)
    }
  }
}