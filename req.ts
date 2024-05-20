import { VIMFileMeta, BEFASTMetaStage, VIMSTAGE } from "./lib.ts";

const bfastFile = new VIMFileMeta('http://localhost:8080/assets/spanish.vim')
bfastFile.addEventListener(BEFASTMetaStage.HEADERREQING, _v => {

  console.log('发送请求');
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
console.log(fileMeta.split('\n'));

