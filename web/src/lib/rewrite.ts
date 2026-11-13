export const rules: [RegExp, string][] = [
  [/\bin order to\b/i, "to"], [/\bdue to the fact that\b/i, "because"],
  [/\bat this point in time\b/i, "now"], [/\ba large number of\b/i, "many"],
  [/\bfor the purpose of\b/i, "for"], [/\bhas the ability to\b/i, "can"],
  [/\butilize\b/i, "use"], [/\bapproximately\b/i, "about"],
  [/\bin addition\b/i, "also"], [/\bas a result\b/i, "consequently"],
  [/\bimportant\b/i, "significant"], [/\bdemonstrates\b/i, "shows"],
  [/\bhowever\b/i, "nevertheless"], [/\bfor example\b/i, "for instance"],
]
export function applyRule(text: string, pattern: RegExp, replacement: string): string {
  return text.replace(pattern, match => {
    const first = match[0]
    const startsUppercase = first === first.toUpperCase() && first !== first.toLowerCase()
    const allUppercase = match === match.toUpperCase() && match !== match.toLowerCase()
    if (allUppercase) return replacement.toUpperCase()
    if (startsUppercase) return replacement[0].toUpperCase() + replacement.slice(1)
    return replacement
  })
}
