export type Source = { id: string; name: string; text: string; size: number; textBytes: number }
export type Match = { text: string; source: string }
export function continuation(before: string, sources: Source[], length: number): Match | null {
  const context = before.match(/[\p{L}\p{N}\u2019']+/gu)?.slice(-5).map(w => w.toLowerCase()) || []
  if (!context.length) return null
  for (let n = context.length; n >= 1; n--) {
    const key = context.slice(-n).join(" ")
    const candidates = new Map<string, { count: number; text: string; source: string }>()
    for (const source of sources) {
      const words = source.text.match(/[\p{L}\p{N}\u2019']+|[^\s\p{L}\p{N}\u2019']+/gu) || []
      const lower = words.map(w => w.toLowerCase())
      for (let i = 0; i < words.length - n; i++) {
        if (lower.slice(i, i + n).join(" ") !== key) continue
        const next: string[] = []
        let count = 0
        for (let j = i + n; j < words.length && count < length; j++) {
          next.push(words[j])
          if (/[\p{L}\p{N}]/u.test(words[j])) count++
        }
        if (count < 3) continue
        const phrase = next.join(" ").replace(/\s+([.,!?;:])/g, "$1")
        const existing = candidates.get(phrase.toLowerCase())
        if (existing) existing.count++
        else candidates.set(phrase.toLowerCase(), { count: 1, text: phrase, source: source.name })
      }
    }
    const best = [...candidates.values()].sort((a, b) => b.count - a.count)[0]
    if (best) return best
  }
  return null
}
