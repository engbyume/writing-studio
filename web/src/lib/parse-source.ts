export function readSource(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parse-worker.ts", import.meta.url), { type: "module" })
    const finish = () => { clearTimeout(timer); worker.terminate() }
    const timer = setTimeout(() => { finish(); reject(new Error("Reading timed out after 15 seconds.")) }, 15_000)
    worker.onmessage = (event: MessageEvent<{ ok: boolean; text?: string }>) => {
      finish()
      if (event.data.ok && typeof event.data.text === "string") resolve(event.data.text)
      else reject(new Error("Could not read this file, or its extracted text exceeds 1 MiB."))
    }
    worker.onerror = event => { event.preventDefault(); finish(); reject(new Error("Could not read this file.")) }
    worker.postMessage(file)
  })
}
