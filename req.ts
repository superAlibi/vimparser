import { VIMFileMeta,BFASTMeta, BEFASTMetaStage, VIMSTAGE } from "./lib.ts";

const bfastFile = new VIMFileMeta('http://localhost:8080/assets/spanish.vim')
bfastFile.addEventListener(BEFASTMetaStage.HEADERREQED, _v => {
  console.log(bfastFile.dataBlockEndOffset);
  
  console.log('查询文件元信息');
})
bfastFile.addEventListener(BEFASTMetaStage.RANGEREQING, _v => {
  console.log('查询数据区块');
})
bfastFile.addEventListener(VIMSTAGE.NAMEDATABLOCKREQING, _v => {
  console.log('查询数据区块名称');
})
await bfastFile.initMeta()
console.log(bfastFile.dataBlockNameOffsetMap);
const headerU8arr = await bfastFile.getDataBlock('header', 'u8arr') as Uint8Array

const textDecoder = new TextDecoder()
const fileMeta = textDecoder.decode(headerU8arr)
console.log('header区块解码数据:');

console.log(fileMeta.split('\n'));

const geometryBfast = await bfastFile.getDataBlock('geometry', 'bfast') as BFASTMeta
geometryBfast.addEventListener(BEFASTMetaStage.RANGEREQING,e=>{
  console.log('geometryBfast RANGEREQING',geometryBfast.globalDataBlockStartOffset);
})
geometryBfast.addEventListener(BEFASTMetaStage.RANGEREQFEILD,e=>{
  console.log('geometryBfast RANGEREQFEILD',e);
})
geometryBfast.addEventListener(BEFASTMetaStage.RANGEREQED,e=>{
  console.log('geometryBfast RANGEREQED',geometryBfast.rangeData);
})

await geometryBfast.initMeta()

