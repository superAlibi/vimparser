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
  RANGEREQING = 'rangeReqing',
  RANGEREQFEILD = 'rangeFeild',
  RANGEREQED = 'rangereqed',
  NAMEDATABLOCKREQING = "namedatablockreqing",
  NAMEDATABLOCKREQFEILD = "namedatablockreqFeild",
  NAMEDATABLOCKREQED = "namedatablockreqed",
}
/**
 * 
 */
export abstract class BFASTMeta extends EventTarget {
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
  get dataBlockStartOffset() {
    return ((this.fileHeader?.at(1)) ?? 0n)
  }
  get globalDataBlockStartOffset() {
    return this.dataBlockStartOffset + BigInt(this.offset)
  }
  /**
   * 数据区块结束位置(bit)
   */
  get dataBlockEndOffset() {
    return (this.fileHeader?.at(2) ?? 0n)
  }
  get globalDataBlockEndOffset() {
    return this.dataBlockEndOffset + BigInt(this.offset)
  }
  /**
   * 数据区块总数量
   */
  get dataBlockCount() {
    return (this.fileHeader?.at(3)) ?? 0n
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
  * bfast 数据块名称位置索引
  */
  get dataBlocksNameOffset() {
    return this.rangeData?.slice(0, 2)
  }


  /**
   * 数据区块名称和其位置影射
   */
  public dataBlockNameOffsetMap: Map<string, RangeInfo> = new Map()
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
  protected async reqRange(startByte: number | bigint, endByte: number | bigint) {
    if (endByte < startByte) { return }
    const start = Number(startByte),
      end = Number(endByte)
    const resp = await globalThis.fetch(this.source, {
      headers: {
        range: [start + this.offset, end + this.offset].join('-')
      }
    });
    if (!resp.ok || !resp.body) {
      return
    }
    /**
     * todo
     */
    const result = new Uint8Array(end - start)
    let count = 0
    for await (const u8arr of resp.body) {

      for (const iterator of u8arr) {
        result[count++] = iterator
      }

    }
    return result
  }
  async initMeta() {
    if (!this.fileHeader) {


      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERREQING))
      const result = await this.reqRange(0, 32).catch(e => {
        console.error(e);
        this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERFEILD))
        return void 0
      })
      if (!result) { return }
      this.fileHeader = new BigInt64Array(result!.buffer, 0, 4)
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERREQED))
    }

    if (!this.rangeData) {

      const end = Number(this.dataBlockStartOffset)
      const start = end - Number(this.dataBlockCount) * 16
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.RANGEREQING))
      const rangeResult = await this.reqRange(start, end).then((r) => { return r }).catch(e => {
        console.error(e);
        this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.RANGEREQFEILD))
        return void 0
      })

      if (!rangeResult) { return }
      this.rangeData = new BigInt64Array(rangeResult!.buffer!, 0, Number(this.dataBlockCount) * 2)
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.RANGEREQED))
    }
    const dataRange = this.rangeData!.slice(2)
    const textDecoder = new TextDecoder()
    this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.NAMEDATABLOCKREQING))
    const nameRange = await this.reqRange(
      Number(this.dataBlocksNameOffset?.at(0)),
      Number(this.dataBlocksNameOffset?.at(1)))
      .catch((e) => {
        console.error(e);
        this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.NAMEDATABLOCKREQFEILD))
        return void 0
      })
    this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.NAMEDATABLOCKREQED))


    const rangeName = textDecoder.decode(nameRange).split('\0').filter(Boolean)


    for (let index = 0, length = dataRange.length / 2; index < length; index++) {

      const start = dataRange.at(index * 2 + 0);
      const end = dataRange.at(index * 2 + 1);
      this.dataBlockNameOffsetMap.set(rangeName.at(index)!, new RangeInfo(start!, end!))

    }
  }
}

export class VIMFileMeta extends BFASTMeta {
  public textDecoder = new TextDecoder()

  constructor(source: string) {
    super(source)
  }
  get nameRange() {
    return new RangeInfo(this.dataBlockStartOffset!, this.dataBlockEndOffset!)
  }

  /**
   * vim文件其他数据区块范围
   */
  get dataBlockRangeOffset() {
    return this.rangeData?.slice(2)
  }
  async initMeta(): Promise<void> {
    await super.initMeta()



  }


  /**
   * 给出指定命名区块数据
   * @param dataBlockName 区块名称
   * @param format 数据格式
   * @returns 
   */
  async getDataBlock(dataBlockName: string, format: 'string' | 'u8arr' = 'u8arr') {
    const rangeInfo = this.dataBlockNameOffsetMap.get(dataBlockName)
    if (!rangeInfo) return Promise.resolve(void 0)

    const u8arr = await this.reqRange(Number(rangeInfo.startOffset), Number(rangeInfo.endOffset))
    if (format === 'u8arr') return u8arr
    if (!u8arr) return void 0
    return this.textDecoder.decode(u8arr)
  }
  getGeometry() {
    const rangeInfo = this.dataBlockNameOffsetMap.get('geometry')
    if (!rangeInfo) return void 0
    return new GeometryWithG3D(this.source, Number(rangeInfo.startOffset))
  }
  getHeader(format: 'u8arr' | 'string') {
    return this.getDataBlock('header', format)
  }
  async getStrings(format: 'u8arr' | 'string') {
    const rangeInfo = this.dataBlockNameOffsetMap.get('strings')
    if (!rangeInfo) return void 0
    const u8arr = await this.reqRange((rangeInfo.startOffset), rangeInfo.endOffset)
    if (format === 'u8arr') {
      return u8arr
    }
    return this.textDecoder.decode(u8arr)
  }
}


/**
 * vim 文件中存在的子区块:geometry区块
 */
export class GeometryWithG3D extends BFASTMeta {
  constructor(souce: string, offset: number) {
    super(souce, offset)
  }
  #meta?: Uint8Array
  async getMetaInfo() {
    if (this.#meta) return this.#meta
    const metaRange = this.dataBlockNameOffsetMap.get('meta')
    
    const metau8arr = this.#meta = await this.reqRange(metaRange?.startOffset ?? 0n, metaRange?.endOffset ?? 0n)
      .catch(e => {
        console.error(e);
        return void 0
      })
    if (!metau8arr) {

      return
    }
    return this.#meta = metau8arr
  }
  async initMeta(): Promise<void> {
    await super.initMeta()
  }

}

export class AssetWithBFAST extends BFASTMeta {
  constructor(souce: string, offset: number) {
    super(souce, offset)
  }
  async initMeta(): Promise<void> {
    await super.initMeta()

  }

}