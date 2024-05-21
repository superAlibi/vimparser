import { VIMFileMeta, BEFASTMetaStage } from "./lib.ts";

const bfastFile = new VIMFileMeta('http://localhost:8080/assets/spanish.vim')
bfastFile.addEventListener(BEFASTMetaStage.HEADERREQED, _v => {
  console.table({
    数据块位置: {
      开始位置: bfastFile.dataBlockEndOffset,
      结束位置: bfastFile.dataBlockEndOffset
    }
  })
})
bfastFile.addEventListener(BEFASTMetaStage.RANGEREQING, _v => {
  console.log('查询数据区块');
})
bfastFile.addEventListener(BEFASTMetaStage.NAMEDATABLOCKREQING, _v => {
  console.log('查询数据区块名称');
})
await bfastFile.initMeta()
console.log('vim文件区块信息', bfastFile.dataBlockNameOffsetMap);


const geometryBfast = bfastFile.getGeometry()


await geometryBfast?.initMeta()
console.log('g3d区块信息: ', geometryBfast?.dataBlockNameOffsetMap);


console.log('meta信息\n', await geometryBfast?.getMetaInfo());
