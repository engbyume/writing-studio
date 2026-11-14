// Only the Office.js types used by the pane, so the shared web toolchain needs no extra package.
type SelectionHandler = () => void
type OfficeResult = { status: string }
type WordDocumentEvents = {
  addHandlerAsync(event: string, handler: SelectionHandler, callback: (result: OfficeResult) => void): void
  removeHandlerAsync(event: string, options: { handler: SelectionHandler }): void
}
type OfficeRuntime = {
  onReady(): Promise<{ host: string | null }>
  HostType: { Word: string }
  EventType: { DocumentSelectionChanged: string }
  AsyncResultStatus: { Succeeded: string }
  context: {
    document: WordDocumentEvents
    requirements: { isSetSupported(name: string, version?: string): boolean }
  }
}
type Range = {
  start: number
  end: number
  storyType: string
  text: string
  paragraphs: { getFirst(): { getRange(location: "Content"): Range } }
  load(properties: string): void
  insertText(text: string, location: "End" | "Replace"): Range
}
type WordContext = {
  document: { getSelection(): Range }
  sync(): Promise<void>
}
type WordRuntime = { run<T>(batch: (context: WordContext) => Promise<T>): Promise<T> }

function runtimes() {
  return window as Window & { Office?: OfficeRuntime; Word?: WordRuntime }
}

export type Snapshot = {
  story: "MainText"
  start: number
  end: number
  paragraphStart: number
  paragraphEnd: number
  paragraph: string
  selected: string
}

type SelectionRead =
  | { status: "ready"; snapshot: Snapshot; range: Range }
  | { status: "outside" | "complex" }

export type SelectionResult =
  | { status: "ready"; snapshot: Snapshot }
  | { status: "outside" | "complex" }

export async function connectWord() {
  const { Office } = runtimes()
  if (!Office) return { status: "missing" } as const
  const { host } = await Office.onReady()
  if (host !== Office.HostType.Word) return { status: "outside" } as const
  const { requirements } = Office.context
  if (!runtimes().Word ||
      !requirements.isSetSupported("WordApi", "1.1") ||
      !requirements.isSetSupported("WordApiDesktop", "1.4")) {
    return { status: "unsupported" } as const
  }
  return { status: "ready" } as const
}

export function watchSelection(handler: SelectionHandler, onUnavailable: () => void) {
  const { Office } = runtimes()
  if (!Office || !Office.context.requirements.isSetSupported("DocumentEvents")) {
    onUnavailable()
    return () => {}
  }
  const document = Office.context.document
  const event = Office.EventType.DocumentSelectionChanged
  let subscribed = false
  let disposed = false
  const removeHandler = () => document.removeHandlerAsync(event, { handler })
  document.addHandlerAsync(event, handler, result => {
    subscribed = result.status === Office.AsyncResultStatus.Succeeded
    if (subscribed && disposed) removeHandler()
    else if (!subscribed && !disposed) onUnavailable()
  })
  return () => {
    disposed = true
    if (subscribed) removeHandler()
  }
}

async function loadSelection(context: WordContext): Promise<SelectionRead> {
  const range = context.document.getSelection()
  range.load("start,end,storyType")
  await context.sync()
  if (range.storyType !== "MainText") return { status: "outside" }

  // Load only the first paragraph's bounds. The selection must end inside those bounds.
  const paragraph = range.paragraphs.getFirst().getRange("Content")
  paragraph.load("start,end")
  await context.sync()
  if (![range.start, range.end, paragraph.start, paragraph.end].every(Number.isSafeInteger) ||
      paragraph.start < 0 || range.start < paragraph.start || range.end < range.start ||
      range.end > paragraph.end) return { status: "outside" }
  const paragraphLength = paragraph.end - paragraph.start
  if (paragraphLength > 65_536) return { status: "complex" }

  paragraph.load("text")
  range.load("text")
  await context.sync()
  const offset = range.start - paragraph.start
  // Some Word elements may count in the range offsets without appearing in plain text.
  // Only use offsets whose mapping to the returned text can be verified.
  if (paragraph.text.length !== paragraphLength ||
      paragraph.text.slice(offset, offset + range.end - range.start) !== range.text) {
    return { status: "complex" }
  }
  return {
    status: "ready", range,
    snapshot: {
      story: range.storyType,
      start: range.start,
      end: range.end,
      paragraphStart: paragraph.start,
      paragraphEnd: paragraph.end,
      paragraph: paragraph.text,
      selected: range.text,
    },
  }
}

export async function readSelection(): Promise<SelectionResult> {
  const { Word } = runtimes()
  if (!Word) throw new Error("Word is unavailable.")
  return Word.run(async context => {
    const result = await loadSelection(context)
    if (result.status !== "ready") return result
    return { status: "ready", snapshot: result.snapshot }
  })
}

function sameSelection(first: Snapshot, second: Snapshot) {
  return first.story === second.story &&
    first.start === second.start && first.end === second.end &&
    first.paragraphStart === second.paragraphStart && first.paragraphEnd === second.paragraphEnd &&
    first.paragraph === second.paragraph && first.selected === second.selected
}

export async function writeSuggestion(
  expected: Snapshot, text: string, action: "insert" | "replace", isCurrent: () => boolean,
) {
  const { Word } = runtimes()
  if (!Word) throw new Error("Word is unavailable.")
  return Word.run(async context => {
    const current = await loadSelection(context)
    if (current.status !== "ready" || !sameSelection(expected, current.snapshot) || !isCurrent()) {
      return false
    }
    const collapsed = current.snapshot.start === current.snapshot.end
    if (collapsed !== (action === "insert") || !text.trim()) return false

    // Recheck the active selection after the paragraph reads. These can span several host round trips.
    const latest = context.document.getSelection()
    latest.load("start,end,storyType,text")
    await context.sync()
    if (!isCurrent() || latest.storyType !== expected.story || latest.start !== expected.start ||
        latest.end !== expected.end || latest.text !== expected.selected) return false

    // Write to the same range that was validated, never to a newly fetched selection.
    current.range.insertText(text, action === "insert" ? "End" : "Replace")
    await context.sync()
    return true
  })
}
