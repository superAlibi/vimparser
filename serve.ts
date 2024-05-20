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
      console.log(range);
      
      const resut = new Uint8Array(byteLength)
      await file.read(resut)
      controller.enqueue(resut)
      controller.close()
      file.close()
      /*let count = 0 
        for await (const iterator of file.readable) {
        count += iterator.byteLength
        console.log(iterator.byteLength);
        
        controller.enqueue(iterator)
        if (count >= byteLength) {
          controller.close()
          break;
        }
      } */
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