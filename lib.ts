export class RangeInfo {
  constructor(
    public startOffset: bigint,
    public endOffset: bigint,
    public baseOffset: number | bigint = 0,
  ) {}

  public get length(): bigint {
    return this.endOffset - this.startOffset;
  }
}
async function reqRange(
  source: string,
  startByte: number | bigint,
  endByte: number | bigint,
  startOffset: number | bigint = 0n,
) {
  if (endByte < startByte) return;
  const start = Number(startByte),
    end = Number(endByte),
    offset = Number(startOffset);
  const resp = await globalThis.fetch(source, {
    headers: {
      range: [start + offset, end + offset].join("-"),
    },
  });
  if (!resp.ok || !resp.body) {
    return;
  }
  /**
   * todo
   */
  const result = new Uint8Array(end - start);
  let count = 0;
  for await (const u8arr of resp.body) {
    for (const iterator of u8arr) {
      result[count++] = iterator;
    }
  }
  return result;
}
export const enum BEFASTMetaStage {
  INIT = "init",
  HEADERREQING = "headerReqing",
  HEADERFEILD = "headerFeild",
  HEADERREQED = "headerReqed",
  RANGEREQING = "rangeReqing",
  RANGEREQFEILD = "rangeFeild",
  RANGEREQED = "rangereqed",
  NAMEDATABLOCKREQING = "namedatablockreqing",
  NAMEDATABLOCKREQFEILD = "namedatablockreqFeild",
  NAMEDATABLOCKREQED = "namedatablockreqed",
}
/** */
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
  public stage: string = BEFASTMetaStage.INIT;
  /**
   * vim头信息
   */
  private fileHeader?: BigInt64Array;
  /**
   * 数据区块开始位置(bit)
   */
  get dataBlockStartOffset(): bigint {
    return ((this.fileHeader?.at(1)) ?? 0n);
  }
  get globalDataBlockStartOffset(): bigint {
    return this.dataBlockStartOffset + BigInt(this.offset);
  }
  /**
   * 数据区块结束位置(bit)
   */
  get dataBlockEndOffset() {
    return (this.fileHeader?.at(2) ?? 0n);
  }
  get globalDataBlockEndOffset() {
    return this.dataBlockEndOffset + BigInt(this.offset);
  }
  /**
   * 数据区块总数量
   */
  get dataBlockCount() {
    return (this.fileHeader?.at(3)) ?? 0n;
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
  public rangeData?: BigInt64Array;
  /**
   * bfast 数据块名称位置索引
   */
  get dataBlocksNameOffset() {
    return this.rangeData?.slice(0, 2);
  }

  /**
   * 数据区块名称和其位置影射
   */
  public dataBlockNameOffsetMap: Map<string, RangeInfo> = new Map();
  /**
   * @param source vim请求路径
   * @param offset 子区块的偏移量,
   * 因为bfast格式的文件子区块有可能还是bfast格式,所以,当取用子区块时中的bfast区块时,需要加上整个区块相对于整个文件的偏移量
   */
  constructor(public source: string, public offset: number = 0) {
    super();
  }
  /**
   * 请求文件的指定区间
   * @param startByte
   * @param endByte
   * @returns
   */
  protected reqRange(start: number | bigint, end: number | bigint) {
    return reqRange(this.source, start, end, this.offset);
  }
  async initMeta() {
    if (!this.fileHeader) {
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERREQING));
      const result = await this.reqRange(0, 32).catch((e) => {
        console.error(e);
        this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERFEILD));
        return void 0;
      });
      if (!result) return;
      this.fileHeader = new BigInt64Array(result!.buffer, 0, 4);
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.HEADERREQED));
    }

    if (!this.rangeData) {
      const end = Number(this.dataBlockStartOffset);
      const start = end - Number(this.dataBlockCount) * 16;
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.RANGEREQING));
      const rangeResult = await this.reqRange(start, end).then((r) => {
        return r;
      }).catch((e) => {
        console.error(e);
        this.dispatchEvent(
          new Event(this.stage = BEFASTMetaStage.RANGEREQFEILD),
        );
        return void 0;
      });

      if (!rangeResult) return;
      this.rangeData = new BigInt64Array(
        rangeResult!.buffer!,
        0,
        Number(this.dataBlockCount) * 2,
      );
      this.dispatchEvent(new Event(this.stage = BEFASTMetaStage.RANGEREQED));
    }
    const dataRange = this.rangeData!.slice(2);
    const textDecoder = new TextDecoder();
    this.dispatchEvent(
      new Event(this.stage = BEFASTMetaStage.NAMEDATABLOCKREQING),
    );
    const nameRange = await this.reqRange(
      Number(this.dataBlocksNameOffset?.at(0)),
      Number(this.dataBlocksNameOffset?.at(1)),
    ).catch((e) => {
      console.error(e);
      this.dispatchEvent(
        new Event(this.stage = BEFASTMetaStage.NAMEDATABLOCKREQFEILD),
      );
      return void 0;
    });
    this.dispatchEvent(
      new Event(this.stage = BEFASTMetaStage.NAMEDATABLOCKREQED),
    );

    const rangeName = textDecoder.decode(nameRange).split("\0").filter(Boolean);

    for (
      let index = 0, length = dataRange.length / 2;
      index < length;
      index++
    ) {
      const start = dataRange.at(index * 2 + 0);
      const end = dataRange.at(index * 2 + 1);
      this.dataBlockNameOffsetMap.set(
        rangeName.at(index)!,
        new RangeInfo(start!, end!),
      );
    }
  }
}
type VimDataBlockFormat = "u8arr" | "string";
export class VIMFileMeta extends BFASTMeta {
  public textDecoder: TextDecoder = new TextDecoder();

  constructor(source: string) {
    super(source);
  }
  get nameRange() {
    return new RangeInfo(this.dataBlockStartOffset!, this.dataBlockEndOffset!);
  }

  /**
   * vim文件其他数据区块范围
   */
  get dataBlockRangeOffset() {
    return this.rangeData?.slice(2);
  }

  /**
   * 给出指定命名区块数据
   * @param dataBlockName 区块名称
   * @param format 数据格式
   * @returns
   */
  async getDataBlock(
    dataBlockName: string,
    format: VimDataBlockFormat = "u8arr",
  ) {
    const rangeInfo = this.dataBlockNameOffsetMap.get(dataBlockName);
    if (!rangeInfo) return Promise.resolve(void 0);

    const u8arr = await this.reqRange(
      Number(rangeInfo.startOffset),
      Number(rangeInfo.endOffset),
    );
    if (format === "u8arr") return u8arr;
    if (!u8arr) return void 0;
    return this.textDecoder.decode(u8arr);
  }
  getGeometry() {
    const rangeInfo = this.dataBlockNameOffsetMap.get("geometry");
    if (!rangeInfo) return void 0;
    return new VIMGeometry(this.source, Number(rangeInfo.startOffset));
  }
  /**
   * @param format
   * @returns
   */
  getHeader(format: VimDataBlockFormat) {
    return this.getDataBlock("header", format);
  }
  /**
   * @param format
   * @returns
   */
  getStrings(format: VimDataBlockFormat):Promise<string | Uint8Array | undefined> {
    return this.getDataBlock("strings", format);
  }
}

/**
 * vim 文件中存在的子区块:geometry区块
 */
class VIMGeometryMeta extends BFASTMeta {
  constructor(souce: string, offset: number) {
    super(souce, offset);
  }
  #meta?: Uint8Array;

  async getMetaInfo(): Promise<Uint8Array|undefined> {
    if (this.#meta) return this.#meta;


    const metaRange = this.dataBlockNameOffsetMap.get("meta");
    const metau8arr = this.#meta = await this.reqRange(
      metaRange?.startOffset ?? 0n,
      metaRange?.endOffset ?? 0n,
    )
      .catch((e) => {
        console.error(e);
        return void 0;
      });
    if (!metau8arr) {
      return;
    }
    return this.#meta = metau8arr;
  }
}

type AssociationType =
  | "vertex"
  | "corner"
  // | "face"
  // | "edge"
  | "mesh"
  | "submesh"
  // | "ffer"
  | "instance"
  | "all"
  | "shapevertex"
  | "shape"
  | "material";
type SemanticType =
  | "unknown"
  | "position"
  | "index"
  | "indexoffset"
  | "vertexoffset"
  | "fset"
  | "normal"
  | "binormal"
  | "tangent"
  | "materialid"
  | "visibility"
  | "size"
  | "uv"
  | "color"
  | "smoothing"
  | "weight"
  | "mapchannel"
  | "ces"
  | "id"
  | "joint"
  | "boxes"
  | "spheres"
  | "user";
type TargetArrayType =
  | "int8"
  | "int16"
  | "int32"
  | "int64"
  | "uint8"
  | "uint16"
  | "uint32"
  | "uint64"
  | "float32"
  | "float64";

interface GeometryAttrbuteMetaOption {
  rangeInfo: RangeInfo;
  transframTarget: TargetArrayType;
  itemSize?: number;
  index?: number;
  source: string;
}
class GeometryAttributeMeta {
  public rangeInfo: RangeInfo;
  public transframTarget: TargetArrayType;
  public itemSize: number;
  public source: string;
  index: number = 0;
  #u8arr?: Uint8Array;
  constructor(options: GeometryAttrbuteMetaOption) {
    const { rangeInfo, transframTarget, itemSize, index, source } = options;
    this.rangeInfo = rangeInfo;
    this.transframTarget = transframTarget;
    this.itemSize = itemSize || 1;
    this.index = index || 0;
    this.source = source;
  }

  async getTypedArray() {
    if (!this.#u8arr) {
      this.#u8arr = await reqRange(
        this.source,
        this.rangeInfo.startOffset,
        this.rangeInfo.endOffset,
        this.rangeInfo.baseOffset,
      );
    }
    const u8arr = this.#u8arr;
    if (!u8arr) {
      console.error(
        "异常数据：在元信息中存在数据区间，但实际请求却无法拿到数据",
      );
      return;
    }

    switch (this.transframTarget) {
      case "int8":
        return new Int8Array(u8arr?.buffer, 0, u8arr.length);
      case "int16":
        return new Int16Array(u8arr?.buffer, 0, u8arr.length / 2);
      case "int32":
        return new Int32Array(u8arr?.buffer, 0, u8arr.length / 4);
      case "int64":
        return new BigInt64Array(u8arr?.buffer, 0, u8arr.length / 8);
      case "uint8":
        return new Uint8Array(u8arr?.buffer, 0, u8arr.length);
      case "uint16":
        return new Uint16Array(u8arr?.buffer, 0, u8arr.length / 2);
      case "uint32":
        return new Uint32Array(u8arr?.buffer, 0, u8arr.length / 4);
      case "uint64":
        return new BigUint64Array(u8arr?.buffer, 0, u8arr.length / 8);
      case "float32":
        return new Float32Array(u8arr?.buffer, 0, u8arr.length / 4);
      case "float64":
        return new Float32Array(u8arr?.buffer, 0, u8arr.length / 8);
    }
  }
}
type GeoMetaEntrie = {
  association: AssociationType;
  semantic: SemanticType;
  index: string;
  dataType: TargetArrayType;
  dataArity: string;
  rangeinfo: RangeInfo;
};
export class VIMGeometry extends VIMGeometryMeta {
  get geoMetaEntries(): GeoMetaEntrie[] {
    return Array.from(this.dataBlockNameOffsetMap.entries()).filter(([k]) =>
      k !== "meta"
    ).map(
      ([keys, rangeinfo]) => {
        const [_, association, semantic, index, dataType, dataArity] = keys
          .split(":") as [
            "g3d",
            AssociationType,
            SemanticType,
            string,
            TargetArrayType,
            string,
          ];
        return {
          association,
          semantic,
          index,
          dataType,
          dataArity,
          rangeinfo,
        };
      },
    );
  }
  /**
   * 给出某元属性的子信息映射，逻辑上来讲，信息映射的值应该只有一个元素
   * @param associationType
   * @returns
   */
  public getAssociation(
    associationType: AssociationType,
  ): Partial<Record<SemanticType, GeometryAttributeMeta>> {
    const result = this.geoMetaEntries.filter((i) =>
      i.association === associationType
    );
    const associationMetaMap: Partial<
      Record<SemanticType, GeometryAttributeMeta>
    > = {};
    for (const iterator of result) {
      const { semantic, index, dataType, dataArity, rangeinfo } = iterator;
      if (associationMetaMap[semantic]) {
        throw TypeError("存在重复的分类子信息");
      }
      const attr = new GeometryAttributeMeta({
        rangeInfo: new RangeInfo(
          rangeinfo.startOffset,
          rangeinfo.endOffset,
          this.offset,
        ),
        transframTarget: dataType,
        itemSize: Number(dataArity),
        index: Number(index),
        source: this.source,
      });
      associationMetaMap[semantic] = attr;
    }

    return associationMetaMap;
  }
}

export class VIMGeometryAssetsMeta extends BFASTMeta {
  constructor(souce: string, offset: number) {
    super(souce, offset);
  }
}
