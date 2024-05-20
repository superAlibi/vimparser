Deno.serve({ port: 8080 }, async (req) => {
  const range = req.headers.get('range')?.split('-').map(Number)

  if (!range?.length || range.length < 2) return new Response('bad requ', {
    status: 400
  })
  const path = new URL(req.url).pathname
  const file = await Deno.open('.' + path)
  const length = (range?.at(1)! - range?.at(0)!)
  const byteLength = length
  await file.seek(range?.at(0) ?? 0, Deno.SeekMode.Start)

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {

      const resut = new Uint8Array(byteLength)
      /**
       * TODO:
       * 中文提示:
       * 如果区间超过文件大小,或者区间大的离谱可以考虑将区块切割为更小的数据块,一次一次的传送回客户端
       * en tip:
       * If the interval exceeds the file size, or if the interval is too large, it can be considered to divide the block into smaller data blocks and transmit them back to the client one at a time
       */
      await file.read(resut)
      controller.enqueue(resut)
      controller.close()
      file.close()

    },

    cancel() {
      file.close()
    },

  })

  return new Response(readable, {
    headers: {
      'content-range': 'byte ' + req.headers.get('range') + '/' + length
    }
  })
})