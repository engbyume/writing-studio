const MAX_SIZE = 10 * 1024 * 1024
const MAX_TEXT = 1024 * 1024

const MAX_ZIP_ENTRIES = 200
const MAX_ZIP_OUTPUT = 20 * 1024 * 1024
const MAX_DOCUMENT_XML = 4 * 1024 * 1024
const MAX_CONTENT_TYPES_XML = 256 * 1024
const DOCUMENT_XML = "word/document.xml"
const CONTENT_TYPES_XML = "[Content_Types].xml"

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50
const DATA_DESCRIPTOR_FLAG = 0x0008
const UTF8_FLAG = 0x0800
const STORED = 0
const DEFLATE = 8
const DEFLATE_INPUT_CHUNK = 2048

type ZipEntry = {
  name: string
  method: number
  crc: number
  size: number
  compressedSize: number
  localOffset: number
  dataOffset: number
  hasDescriptor: boolean
}

function invalidDocx(): never {
  throw new Error("This file is not a valid DOCX.")
}

// PKWARE APPNOTE sections 4.3 to 4.5 define these little-endian records.
function readDocxDirectory(bytes: Uint8Array<ArrayBuffer>): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (offset: number) => view.getUint16(offset, true)
  const u32 = (offset: number) => view.getUint32(offset, true)
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })

  function checkExtraFields(start: number, end: number, flags: number) {
    for (let offset = start; offset < end;) {
      if (offset + 4 > end) invalidDocx()
      const type = u16(offset)
      // Exclude ZIP64, encryption, and Unicode overrides JSZip could use as alternate paths.
      if (type === 0x0001 || type === 0x0017 || type === 0x9901 ||
          (type === 0x7075 && !(flags & UTF8_FLAG))) invalidDocx()
      offset += 4 + u16(offset + 2)
      if (offset > end) invalidDocx()
    }
  }

  // Match the last signature that JSZip will use, and require a complete EOCD.
  let eocd = bytes.length - 4
  const earliestEocd = Math.max(0, bytes.length - 22 - 0xffff)
  while (eocd >= earliestEocd && u32(eocd) !== END_OF_CENTRAL_DIRECTORY) eocd--
  if (eocd < earliestEocd || eocd + 22 > bytes.length ||
      eocd + 22 + u16(eocd + 20) !== bytes.length) invalidDocx()

  const count = u16(eocd + 10)
  const centralSize = u32(eocd + 12)
  const centralOffset = u32(eocd + 16)
  if (u16(eocd + 4) !== 0 || u16(eocd + 6) !== 0 ||
      count === 0 || count > MAX_ZIP_ENTRIES || u16(eocd + 8) !== count ||
      centralOffset + centralSize !== eocd) invalidDocx()

  const entries: ZipEntry[] = []
  const names = new Set<string>()
  let hasDocument = false
  let hasContentTypes = false
  let declaredTotal = 0
  let offset = centralOffset
  for (let index = 0; index < count; index++) {
    if (offset + 46 > eocd || u32(offset) !== CENTRAL_HEADER) invalidDocx()
    const flags = u16(offset + 8)
    const method = u16(offset + 10)
    const crc = u32(offset + 16)
    const compressedSize = u32(offset + 20)
    const size = u32(offset + 24)
    const nameSize = u16(offset + 28)
    const nameEnd = offset + 46 + nameSize
    const extraEnd = nameEnd + u16(offset + 30)
    const next = extraEnd + u16(offset + 32)
    const localOffset = u32(offset + 42)
    // Methods 0 and 8 use bit 3 for data descriptors and bit 11 for UTF-8.
    // For deflate, bits 1 and 2 are compression level hints.
    const allowedFlags = DATA_DESCRIPTOR_FLAG | UTF8_FLAG | (method === DEFLATE ? 0x0006 : 0)
    if (next > eocd || nameSize === 0 || u16(offset + 34) !== 0 ||
        (method !== STORED && method !== DEFLATE) || (flags & ~allowedFlags) !== 0 ||
        (method === STORED && compressedSize !== size) ||
        localOffset + 30 > centralOffset || u32(localOffset) !== LOCAL_HEADER) invalidDocx()

    const nameBytes = bytes.subarray(offset + 46, nameEnd)
    const name = decoder.decode(nameBytes)
    const path = name.toLowerCase()
    if (/[\x00-\x1f\x7f\\:]/.test(name) ||
        name.replace(/\/$/, "").split("/").some(part => !part || part === "." || part === "..") ||
        names.has(path) || /(?:^|\/)vba(?:project|data)[^/]*$/i.test(name)) invalidDocx()
    names.add(path)
    const attributes = u32(offset + 38)
    const unixDirectory = (u16(offset + 4) >>> 8) === 3 && (attributes & 0x40000000) !== 0
    const directory = name.endsWith("/") || (attributes & 0x10) !== 0 || unixDirectory
    if (directory && (size !== 0 || !name.endsWith("/"))) invalidDocx()
    hasDocument ||= name === DOCUMENT_XML
    hasContentTypes ||= name === CONTENT_TYPES_XML
    declaredTotal += size
    if (declaredTotal > MAX_ZIP_OUTPUT || (name === DOCUMENT_XML && size > MAX_DOCUMENT_XML)) invalidDocx()
    checkExtraFields(nameEnd, extraEnd, flags)

    const localNameStart = localOffset + 30
    const localNameSize = u16(localOffset + 26)
    const localNameEnd = localNameStart + localNameSize
    const dataOffset = localNameEnd + u16(localOffset + 28)
    const hasDescriptor = (flags & DATA_DESCRIPTOR_FLAG) !== 0
    if (dataOffset + compressedSize > centralOffset || localNameSize !== nameSize ||
        u16(localOffset + 4) !== u16(offset + 6) ||
        u16(localOffset + 6) !== flags || u16(localOffset + 8) !== method ||
        u32(localOffset + 10) !== u32(offset + 12) ||
        u32(localOffset + 14) !== (hasDescriptor ? 0 : crc) ||
        u32(localOffset + 18) !== (hasDescriptor ? 0 : compressedSize) ||
        u32(localOffset + 22) !== (hasDescriptor ? 0 : size) ||
        nameBytes.some((byte, index) => byte !== bytes[localNameStart + index])) invalidDocx()
    checkExtraFields(localNameEnd, dataOffset, flags)

    entries.push({ name, method, crc, size, compressedSize, localOffset, dataOffset, hasDescriptor })
    offset = next
  }
  if (offset !== eocd || !hasDocument || !hasContentTypes) invalidDocx()

  // Local records must cover the archive up to the central directory. The next
  // record's offset also distinguishes signed and unsigned data descriptors.
  entries.sort((first, second) => first.localOffset - second.localOffset)
  if (entries[0].localOffset !== 0) invalidDocx()
  for (const [index, entry] of entries.entries()) {
    const next = entries[index + 1]?.localOffset ?? centralOffset
    const dataEnd = entry.dataOffset + entry.compressedSize
    if (!entry.hasDescriptor) {
      if (dataEnd !== next) invalidDocx()
      continue
    }
    let descriptor = dataEnd
    if (descriptor + 16 === next && u32(descriptor) === DATA_DESCRIPTOR_SIGNATURE) descriptor += 4
    if (descriptor + 12 !== next || u32(descriptor) !== entry.crc ||
        u32(descriptor + 4) !== entry.compressedSize || u32(descriptor + 8) !== entry.size) invalidDocx()
  }
  return entries
}

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return crc
})

function checkContentTypes(bytes: Uint8Array) {
  const encoding = bytes[0] === 0xfe || bytes[0] === 0 ? "utf-16be" :
    bytes[0] === 0xff || bytes[1] === 0 ? "utf-16le" : "utf-8"
  // OPC manifests use UTF-8 or UTF-16. Reject DTDs and recognize ASCII
  // characters in MIME types even when XML numeric references encode them.
  const xml = new TextDecoder(encoding, { fatal: true }).decode(bytes)
  if (xml.includes("\0") || /<!DOCTYPE/i.test(xml)) invalidDocx()
  const content = xml.replace(/&#(x[\da-f]+|\d+);/gi, (reference, digits: string) => {
    const code = digits[0].toLowerCase() === "x" ? parseInt(digits.slice(1), 16) : parseInt(digits, 10)
    return code <= 0x7f ? String.fromCharCode(code) : reference
  })
  if (/application\/vnd\.ms-(?:word\.(?:document\.macroenabled|template\.macroenabledtemplate|vbadata)|office\.vbaproject)/i.test(content)) invalidDocx()
}

async function preflightDocx(bytes: Uint8Array<ArrayBuffer>) {
  const entries = readDocxDirectory(bytes)
  let actualTotal = 0
  for (const entry of entries) {
    const input = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize)
    if (entry.name === CONTENT_TYPES_XML && entry.size > MAX_CONTENT_TYPES_XML) invalidDocx()
    const manifest = entry.name === CONTENT_TYPES_XML ? new Uint8Array(entry.size) : undefined
    let actualSize = 0
    let crc = 0xffffffff
    function consume(chunk: Uint8Array) {
      const start = actualSize
      actualSize += chunk.length
      actualTotal += chunk.length
      if (actualSize > entry.size || actualTotal > MAX_ZIP_OUTPUT ||
          (entry.name === DOCUMENT_XML && actualSize > MAX_DOCUMENT_XML)) invalidDocx()
      for (const byte of chunk) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
      manifest?.set(chunk, start)
    }

    if (entry.method === STORED) {
      consume(input)
    } else {
      let offset = 0
      const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
        pull(controller) {
          // Small writes bound output queued by each native inflate call.
          const end = Math.min(input.length, offset + DEFLATE_INPUT_CHUNK)
          if (offset < end) controller.enqueue(input.subarray(offset, end))
          offset = end
          if (offset === input.length) controller.close()
        },
      })
      const reader = stream.pipeThrough(new DecompressionStream("deflate-raw")).getReader()
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          consume(value)
        }
      } finally {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }
    }
    if (actualSize !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) invalidDocx()
    if (manifest) checkContentTypes(manifest)
  }
}

const byteLength = (text: string) => new TextEncoder().encode(text).byteLength
async function readSource(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop()
  if (!["txt", "md", "markdown", "docx", "pdf"].includes(ext || "")) throw new Error("Unsupported file type.")
  if (!file.size || file.size > MAX_SIZE) throw new Error("Choose a non-empty file under 10 MB.")
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist")
    const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("This file is not a valid PDF.")
    const task = pdfjs.getDocument({ data: bytes, verbosity: 0 })
    const doc = await task.promise
    if (doc.numPages > 500) { await task.destroy(); throw new Error("PDFs are limited to 500 pages.") }
    let text = ""
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map(item => "str" in item ? item.str : "").join(" ") + "\n"
        if (byteLength(text) > MAX_TEXT) throw new Error("Extracted text exceeds the limit.")
      }
    } finally { await task.destroy() }
    return text
  }
  if (ext === "docx") {
    await preflightDocx(bytes)
    const mammoth = await import("mammoth")
    const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer })
    if (byteLength(result.value) > MAX_TEXT) throw new Error("Extracted text exceeds the limit.")
    return result.value
  }
  if (bytes.includes(0)) throw new Error("This text file contains binary data.")
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  if (byteLength(text) > MAX_TEXT) throw new Error("Text exceeds the limit.")
  return text
}

self.onmessage = async (event: MessageEvent<File>) => {
  try { const text = await readSource(event.data); self.postMessage({ ok: true, text }) }
  catch { self.postMessage({ ok: false }) }
}
