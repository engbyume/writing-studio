import { useRef, useState, useMemo } from "react"
import { BookOpen, FileText, Plus, Download, X, ArrowRight, PanelLeft, ShieldCheck, PanelBottom } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { continuation, type Source } from "@/lib/completion"
import { readSource } from "@/lib/parse-source"
import { applyRule, rules } from "@/lib/rewrite"
const MAX_SOURCES = 10
const MAX_INPUT_TOTAL = 50 * 1024 * 1024
const MAX_TEXT_TOTAL = 5 * 1024 * 1024
function App() {
  const [sources, setSources] = useState<Source[]>([])
  const [draft, setDraft] = useState("")
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [length, setLength] = useState(6)
  const [dismissed, setDismissed] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [sheet, setSheet] = useState(false)
  const mirror = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<string | null>("next")
  const editor = useRef<HTMLTextAreaElement>(null)
  const upload = useRef<HTMLInputElement>(null)
  const sheetToggle = useRef<HTMLButtonElement>(null)
  const suggestion = useMemo(() => selection.start === selection.end && !dismissed ? continuation(draft.slice(0, selection.start), sources, length) : null, [draft, sources, length, selection, dismissed])
  const selected = draft.slice(selection.start, selection.end)
  const alternatives = useMemo(() => {
    if (!selected.trim()) return []
    return [...new Set(rules.filter(([pattern]) => pattern.test(selected)).map(([pattern, replacement]) => applyRule(selected, pattern, replacement)))].slice(0, 4)
  }, [selected])
  function trackSelection() {
    const el = editor.current
    if (el) setSelection({ start: el.selectionStart, end: el.selectionEnd })
  }
  function insert(text: string, start = selection.start, end = selection.end) {
    const spacing = start > 0 && !/\s/.test(draft[start - 1]) ? " " : ""
    const value = draft.slice(0, start) + spacing + text + draft.slice(end)
    const pos = start + spacing.length + text.length
    setDraft(value); setSelection({ start: pos, end: pos }); setDismissed(true)
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(pos, pos) })
  }
  function replaceSelection(text: string) {
    const pos = selection.start + text.length
    setDraft(draft.slice(0, selection.start) + text + draft.slice(selection.end))
    setSelection({ start: pos, end: pos }); setDismissed(true)
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(pos, pos) })
  }
  async function addFiles(files: FileList | null) {
    if (!files) return
    setLoading(true); setErrors([])
    const chosen = Array.from(files)
    const problems: string[] = []
    const added: Source[] = []
    for (const file of chosen) {
      if (sources.length + added.length >= MAX_SOURCES) { problems.push(file.name + ": Maximum 10 sources."); continue }
      if (file.size === 0 || file.size > 10 * 1024 * 1024) { problems.push(file.name + ": Choose a non-empty file up to 10 MiB."); continue }
      if ([...sources, ...added].reduce((sum, source) => sum + source.size, 0) + file.size > MAX_INPUT_TOTAL) { problems.push(file.name + ": Total source files cannot exceed 50 MiB."); continue }
      try {
        const text = await readSource(file)
        if (!text.trim()) throw new Error("No readable text found.")
        const textBytes = new TextEncoder().encode(text).byteLength
        if ([...sources, ...added].reduce((sum, source) => sum + source.textBytes, 0) + textBytes > MAX_TEXT_TOTAL) throw new Error("Total extracted text cannot exceed 5 MiB.")
        added.push({ id: crypto.randomUUID(), name: file.name, text, size: file.size, textBytes })
      } catch (error) { problems.push(file.name + ": " + (error instanceof Error ? error.message : "Could not read this file.")) }
    }
    setSources(previous => [...previous, ...added]); setErrors(problems); setLoading(false)
    if (upload.current) upload.current.value = ""
  }
  function keepOriginal() {
    const position = selection.end
    setSelection({ start: position, end: position })
    setDismissed(false)
    setTab("next")
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(position, position) })
  }
  function exportDraft() {
    const url = URL.createObjectURL(new Blob([draft], { type: "text/plain;charset=utf-8" }))
    const link = document.createElement("a"); link.href = url; link.download = "untitled-essay.txt"; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0
  return <div className="app">
    <aside className={drawer ? "rail rail-open" : "rail"} aria-label="Source library">
      <div className="brand"><div className="brand-mark"><BookOpen size={19}/></div><div><strong>Writing Studio</strong><span>YOUR WRITING SPACE</span></div><button className="close-drawer" onClick={() => setDrawer(false)} aria-label="Close sources"><X size={19}/></button></div>
      <div className="rail-heading"><span>LIBRARY</span><span>{String(sources.length).padStart(2, "0")}</span></div>
      <h2>My sources</h2>
      <p className="rail-copy">Your words, close at hand. Add documents to find familiar phrases as you write.</p>
      <input ref={upload} type="file" multiple accept=".txt,.md,.markdown,.docx,.pdf" hidden onChange={e => void addFiles(e.target.files)}/>
      <button className="upload" onClick={() => upload.current?.click()} disabled={loading}><Plus size={17}/>{loading ? "Reading files..." : "Add a source"}</button>
      <p className="file-hint">TXT, MD, DOCX, PDF · up to 10 MB each</p>
      <div className="source-list">{sources.length === 0 ? <div className="source-empty"><FileText size={23}/><strong>Your library is empty</strong><span>Add a document to get started.</span></div> : sources.map(source => <div className="source" key={source.id}><FileText size={17}/><span title={source.name}>{source.name}</span><button onClick={() => setSources(sources.filter(s => s.id !== source.id))} aria-label={"Remove " + source.name}><X size={15}/></button></div>)}</div>
      {errors.length > 0 && <div className="errors" role="alert">{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
      <div className="rail-footer"><ShieldCheck size={17}/><span>Files stay in this browser.<br/>Nothing is saved automatically.</span></div>
    </aside>
    {drawer && <button className="scrim" aria-label="Close source drawer" onClick={() => setDrawer(false)}/>}
    <main className="workspace">
      <header className="topbar"><div className="top-left"><button className="mobile-menu" onClick={() => setDrawer(true)} aria-label="Open sources"><PanelLeft size={20}/></button><span className="crumb">WORKSPACE</span><span className="slash">/</span><span>Untitled essay</span></div><button ref={sheetToggle} className="sheet-toggle" aria-expanded={sheet} aria-controls="suggestion-sheet" onClick={() => setSheet(!sheet)}><PanelBottom size={17}/> {sheet ? "Close suggestions" : "Suggestions"}</button><Button variant="outline" onClick={exportDraft}><Download data-icon="inline-start"/> Export TXT</Button></header>
      <div className="canvas-wrap"><div className="document-meta"><span>YOUR DOCUMENT</span><span>LOCAL DRAFT</span></div><h1>Untitled essay</h1><p className="document-subtitle">A little space for your next good idea.</p><div className="editor-rule"/>
        <label className="sr-only" htmlFor="draft">Your draft</label>
        <div className={suggestion && tab === "next" ? "editor-area has-ghost" : "editor-area"}><div className="editor-mirror" ref={mirror} aria-hidden="true"><span className="mirror-before">{draft.slice(0, selection.start)}</span>{suggestion && tab === "next" && <span className="ghost">{selection.start > 0 && !/\s/.test(draft[selection.start - 1]) ? " " : ""}{suggestion.text}</span>}<span>{draft.slice(selection.start)}</span></div><textarea id="draft" ref={editor} value={draft} placeholder="Start writing here..." spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" onChange={e => { setDraft(e.target.value); setSelection({start:e.target.selectionStart,end:e.target.selectionEnd}); setDismissed(false) }} onScroll={e => { if (mirror.current) { mirror.current.scrollTop = e.currentTarget.scrollTop; mirror.current.scrollLeft = e.currentTarget.scrollLeft } }} onSelect={trackSelection} onClick={trackSelection} onKeyUp={trackSelection} onKeyDown={e => { if (e.key === "Tab" && suggestion && tab === "next") { e.preventDefault(); insert(suggestion.text) } else if (e.key === "Escape") setDismissed(true) }}/></div>
        <div className="canvas-footer"><span>{words} {words === 1 ? "word" : "words"}</span><span>Draft stays in memory</span></div>
      </div>
    </main>
    <aside id="suggestion-sheet" className={sheet ? "inspector sheet-open" : "inspector"} aria-label="Writing suggestions">
      <div className="inspector-top"><span>WRITING TOOLS</span><button className="sheet-close" onClick={() => { setSheet(false); sheetToggle.current?.focus() }} aria-label="Close suggestions"><X size={19}/></button></div><h2>A little help,<br/><em>when you need it.</em></h2><p className="inspector-intro">Suggestions drawn from your own words.</p>
      <Tabs value={tab} onValueChange={setTab}><TabsList variant="line" className="tabs-list"><TabsTrigger value="next">Next words</TabsTrigger><TabsTrigger value="rewrite">Rewrite selection</TabsTrigger></TabsList>
        <TabsContent value="next"><div className="panel-label">SOURCE-BASED COMPLETION</div>
          {suggestion ? <div className="suggestion"><div className="suggestion-kicker"><span className="dot"/> SUGGESTED CONTINUATION</div><p>{suggestion.text}</p><div className="source-tag"><FileText size={14}/> {suggestion.source}</div><Button className="insert" onClick={() => insert(suggestion.text)}>Insert suggestion <ArrowRight data-icon="inline-end"/></Button><div className="keyboard"><span><kbd>Tab</kbd> insert</span><span><kbd>Esc</kbd> dismiss</span></div></div> : <div className="empty-panel"><div className="empty-icon"><BookOpen size={22}/></div><h3>Find your next words</h3><p>Add a source and begin typing. Matching phrases from your documents will appear here.</p></div>}
          <div className="length-control"><div><label htmlFor="length">Suggestion length</label><strong>{length} words</strong></div><input id="length" type="range" min="3" max="10" value={length} onChange={e => {setLength(Number(e.target.value)); setDismissed(false)}}/><div className="range-labels"><span>3 words</span><span>10 words</span></div></div>
          <p className="fine-print">Works best when your sources contain related wording. Suggestions repeat source text; they do not create new ideas.</p>
        </TabsContent>
        <TabsContent value="rewrite"><div className="panel-label">RULE-BASED REWRITE</div><p className="rewrite-intro">Select text in your draft to see simple wording alternatives. Review each option in context before replacing the selection.</p>{!selected.trim() ? <div className="empty-panel"><div className="empty-icon"><FileText size={22}/></div><h3>Select a passage</h3><p>Highlight the words you would like to revisit.</p></div> : alternatives.length ? <><div className="selected-text"><span>YOUR SELECTION</span><p>{selected}</p></div><div className="alternatives">{alternatives.map(alt => <div key={alt}><p>{alt}</p><Button variant="outline" onClick={() => replaceSelection(alt)}>Use this wording</Button></div>)}</div><Button className="keep-original" variant="outline" onClick={keepOriginal}>Keep original</Button></> : <div className="empty-panel"><h3>No local rule matched</h3><p>Your draft is unchanged. Try selecting a different passage.</p></div>}</TabsContent>
      </Tabs>
      <div className="inspector-footer"><ShieldCheck size={16}/> Local-only suggestions <span>·</span> No account needed</div>
    </aside>
  </div>
}
export default App
