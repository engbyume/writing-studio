import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { ArrowRight, BookOpen, FileText, Plus, RefreshCw, ShieldCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { continuation, type Source } from "@/lib/completion"
import { readSource } from "@/lib/parse-source"
import { applyRule, rules } from "@/lib/rewrite"
import {
  connectWord, readSelection, watchSelection, writeSuggestion,
  type SelectionResult,
} from "./office"
import "./pane.css"

const MIB = 1024 * 1024
const MAX_SOURCES = 10
const MAX_FILE_BYTES = 10 * MIB
const MAX_INPUT_BYTES = 50 * MIB
const MAX_EXTRACTED_BYTES = 5 * MIB

type Host = Awaited<ReturnType<typeof connectWord>>["status"] | "loading"
type PaneSelection = { selection: SelectionResult; revision: number }
type Action = "insert" | "replace"

function App() {
  const [host, setHost] = useState<Host>("loading")
  const [current, setCurrent] = useState<PaneSelection | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [length, setLength] = useState(6)
  const [reading, setReading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [automatic, setAutomatic] = useState(true)
  const [message, setMessage] = useState("")
  const [importErrors, setImportErrors] = useState<string[]>([])
  const revision = useRef(0)
  const writeInProgress = useRef(false)
  const importInProgress = useRef(false)
  const refreshQueued = useRef(false)
  const readInProgress = useRef(false)
  const picker = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    revision.current++
    refreshQueued.current = true
    if (readInProgress.current || writeInProgress.current) return
    readInProgress.current = true
    while (refreshQueued.current && !writeInProgress.current) {
      refreshQueued.current = false
      const requested = revision.current
      try {
        const selection = await readSelection()
        if (requested === revision.current) setCurrent({ selection, revision: requested })
      } catch {
        if (requested === revision.current) {
          setCurrent(null)
          setMessage("Word could not read the selection. Select text or place the cursor, then choose Refresh.")
        }
      }
    }
    readInProgress.current = false
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    void connectWord().then(connection => {
      if (!active) return
      setHost(connection.status)
      if (connection.status === "ready") {
        unsubscribe = watchSelection(() => void refresh(), () => setAutomatic(false))
        void refresh()
      }
    }).catch(() => {
      if (active) setHost("missing")
    })
    return () => {
      active = false
      revision.current++
      refreshQueued.current = false
      unsubscribe?.()
    }
  }, [refresh])

  const snapshot = current?.selection.status === "ready" ? current.selection.snapshot : null
  const collapsed = snapshot !== null && snapshot.start === snapshot.end
  const caret = snapshot ? snapshot.start - snapshot.paragraphStart : 0
  const paragraph = snapshot?.paragraph ?? ""
  const prefix = collapsed ? paragraph.slice(0, caret) : ""
  const suffix = collapsed ? paragraph.slice(caret) : ""
  const insideWord = /[\p{L}\p{M}\p{N}’']$/u.test(prefix) && /^[\p{L}\p{M}\p{N}’']/u.test(suffix)
  const suggestion = useMemo(
    () => insideWord || !sources.length ? null : continuation(prefix, sources, length),
    [insideWord, prefix, sources, length],
  )
  const selected = snapshot?.selected ?? ""
  const alternatives = useMemo(() => {
    if (!selected.trim()) return []
    const matches = rules.filter(([pattern]) => pattern.test(selected))
    return [...new Set(matches.map(([pattern, replacement]) => applyRule(selected, pattern, replacement)))].slice(0, 4)
  }, [selected])

  async function apply(text: string, action: Action) {
    if (!current || !snapshot || writeInProgress.current) return
    if (readInProgress.current || revision.current !== current.revision) {
      setMessage("Word is refreshing the selection. Review the updated suggestion before applying it.")
      return
    }
    writeInProgress.current = true
    setApplying(true)
    setMessage("")
    try {
      const applied = await writeSuggestion(snapshot, text, action, () => revision.current === current.revision)
      setMessage(applied
        ? action === "insert" ? "Suggestion inserted." : "Selection replaced."
        : "The Word selection changed. Review the refreshed suggestion before applying it.")
    } catch {
      setMessage("Word could not confirm the edit. Check the document before trying again.")
    } finally {
      writeInProgress.current = false
      setApplying(false)
      void refresh()
    }
  }

  async function importFiles(files: File[]) {
    if (!files.length || importInProgress.current) return
    importInProgress.current = true
    setReading(true)
    setImportErrors([])
    const added: Source[] = []
    const errors: string[] = []
    let inputBytes = sources.reduce((total, source) => total + source.size, 0)
    let textBytes = sources.reduce((total, source) => total + source.textBytes, 0)
    try {
      for (const file of files) {
        if (sources.length + added.length >= MAX_SOURCES) {
          errors.push("The library holds up to 10 sources.")
          break
        }
        try {
          if (!file.size || file.size > MAX_FILE_BYTES) throw new Error("Choose a non-empty file up to 10 MiB.")
          if (inputBytes + file.size > MAX_INPUT_BYTES) throw new Error("The source library cannot exceed 50 MiB of files.")
          const text = await readSource(file)
          if (!text.trim()) throw new Error("No readable text found.")
          const extracted = new TextEncoder().encode(text).byteLength
          if (textBytes + extracted > MAX_EXTRACTED_BYTES) throw new Error("The source library cannot exceed 5 MiB of extracted text.")
          added.push({ id: crypto.randomUUID(), name: file.name, text, size: file.size, textBytes: extracted })
          inputBytes += file.size
          textBytes += extracted
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : "Could not read the file."}`)
        }
      }
      setSources(previous => [...previous, ...added])
      setImportErrors(errors)
    } finally {
      importInProgress.current = false
      setReading(false)
    }
  }

  const hostMessage = {
    loading: "Connecting to Word…",
    missing: "Word’s add-in runtime could not load. Check the connection and reopen the pane.",
    outside: "Open Writing Studio in the Word desktop app to use the writing tools.",
    unsupported: "These writing tools require Word desktop with WordApiDesktop 1.4.",
    ready: "",
  }[host]

  let selectionHint = "Place the cursor or select text in the document, then choose Refresh."
  if (current?.selection.status === "outside") selectionHint = "Place the cursor or select text within one paragraph in the main document."
  if (current?.selection.status === "complex") selectionHint = "Word could not map this paragraph to plain text. Try another paragraph."
  if (snapshot && collapsed && !sources.length) selectionHint = "Add a source to get next-word suggestions."
  if (snapshot && collapsed && sources.length) {
    selectionHint = insideWord ? "Place the cursor between words." : "No matching continuation for this cursor position."
  }
  if (snapshot && !collapsed) selectionHint = "No local rewrite rule matched the selected text."

  return (
    <>
      <header className="masthead">
        <BookOpen size={20} aria-hidden="true" />
        <h1>Writing Studio</h1>
      </header>
      <main>
        <section aria-labelledby="suggestions-heading">
          <div className="section-heading">
            <h2 id="suggestions-heading">{snapshot && !collapsed ? "Rewrite selection" : "Next words"}</h2>
            {host === "ready" && (
              <Button variant="outline" disabled={applying} onClick={() => {
                setMessage("")
                void refresh()
              }}>
                <RefreshCw aria-hidden="true" /> Refresh
              </Button>
            )}
          </div>
          <p role="status" className="muted">{message || hostMessage}</p>
          {host === "ready" && (
            <>
              {!automatic && <p className="muted">Use Refresh to read the current Word selection.</p>}
              {suggestion && snapshot && (
                <article className="card">
                  <p className="suggested">{suggestion.text}</p>
                  <p className="attribution"><FileText aria-hidden="true" size={14} /> {suggestion.source}</p>
                  <Button disabled={applying} onClick={() => {
                    const leading = prefix && !/\s$/u.test(prefix) && !/^[.,!?;:)]/u.test(suggestion.text) ? " " : ""
                    const trailing = /^[\p{L}\p{M}\p{N}]/u.test(suffix) ? " " : ""
                    void apply(leading + suggestion.text + trailing, "insert")
                  }}>
                    Insert suggestion <ArrowRight aria-hidden="true" />
                  </Button>
                </article>
              )}
              {alternatives.length > 0 && (
                <>
                  <div className="original"><h3>Selected text</h3><p>{selected}</p></div>
                  <ul className="alternatives">
                    {alternatives.map((alternative, index) => (
                      <li className="card" key={alternative}>
                        <p id={`rewrite-${index}`} className="suggested">{alternative}</p>
                        <Button
                          variant="outline"
                          aria-describedby={`rewrite-${index}`}
                          disabled={applying}
                          onClick={() => void apply(alternative, "replace")}
                        >Replace selection</Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!suggestion && !alternatives.length && <p className="empty">{selectionHint}</p>}
              {(!snapshot || collapsed) && (
                <div className="length">
                  <label htmlFor="suggestion-length">Suggestion length</label>
                  <output htmlFor="suggestion-length">{length} words</output>
                  <input id="suggestion-length" type="range" min={3} max={10} value={length}
                    onChange={event => setLength(event.currentTarget.valueAsNumber)} />
                </div>
              )}
            </>
          )}
        </section>
        <section className="library" aria-labelledby="sources-heading">
          <div className="section-heading">
            <h2 id="sources-heading">My sources</h2>
            <Button variant="outline" disabled={reading || sources.length >= MAX_SOURCES}
              onClick={() => picker.current?.click()}><Plus aria-hidden="true" /> Add sources</Button>
          </div>
          <input ref={picker} type="file" multiple accept=".txt,.md,.markdown,.docx,.pdf" hidden
            onChange={event => {
              const files = Array.from(event.currentTarget.files ?? [])
              event.currentTarget.value = ""
              void importFiles(files)
            }} />
          <p className="muted">TXT, Markdown, DOCX, PDF · Up to 10 MiB each</p>
          <p role="status" className="muted">{reading ? "Reading sources…" : ""}</p>
          {sources.length > 0 && (
            <ul className="sources">
              {sources.map(source => (
                <li key={source.id}>
                  <FileText size={16} aria-hidden="true" />
                  <span>{source.name}</span>
                  <Button variant="ghost" size="icon" disabled={reading}
                    onClick={() => {
                      if (!importInProgress.current) setSources(previous => previous.filter(item => item.id !== source.id))
                    }}
                    aria-label={`Remove ${source.name}`}><X aria-hidden="true" /></Button>
                </li>
              ))}
            </ul>
          )}
          {importErrors.length > 0 && (
            <ul className="errors" role="alert">{importErrors.map((error, index) => <li key={index}>{error}</li>)}</ul>
          )}
        </section>
        <footer><ShieldCheck size={16} aria-hidden="true" /> Sources and suggestions stay in this pane’s memory.</footer>
      </main>
    </>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
