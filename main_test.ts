import { BEFASTMetaStage, VIMFileMeta } from "./lib.ts";

// const VIMOfBFAST = new VIMFileMeta("http://localhost:8080/assets/spanish.vim");
const VIMOfBFAST = new VIMFileMeta("http://localhost:8080/assets/residence.v1.2.75.vim");
VIMOfBFAST.addEventListener(BEFASTMetaStage.HEADERREQED, (_v) => {
  console.log("vim区块范围：");

  console.table({
    数据块位置: {
      开始位置: VIMOfBFAST.dataBlockEndOffset,
      结束位置: VIMOfBFAST.dataBlockEndOffset,
    },
  });
});
VIMOfBFAST.addEventListener(BEFASTMetaStage.RANGEREQING, (_v) => {
  console.log("查询数据区块");
});
VIMOfBFAST.addEventListener(BEFASTMetaStage.NAMEDATABLOCKREQING, (_v) => {
  console.log("查询数据区块名称");
});
await VIMOfBFAST.initMeta();
console.log("vim文件区块信息");
console.table(
  Object.fromEntries(Array.from(VIMOfBFAST.dataBlockNameOffsetMap.entries())),
);
console.log(await VIMOfBFAST.getHeader('string'));

const geometryBfast = VIMOfBFAST.getGeometry();

await geometryBfast?.initMeta();
console.log("g3d区块信息: ");

console.table(
  Object.fromEntries(
    Array.from(geometryBfast?.dataBlockNameOffsetMap.entries() || []),
  ),
);

const material = geometryBfast?.getAssociation("material");
console.log('geometry:mesh:material:color元数据');


console.log(await material?.color?.getTypedArray());
