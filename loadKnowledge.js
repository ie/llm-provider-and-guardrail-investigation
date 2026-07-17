import fs from 'node:fs'
import path from 'node:path'

const STOPWORDS = new Set([
  'the', 'and', 'that', 'with', 'from', 'this', 'have', 'are', 'was', 'for',
  'you', 'your', 'our', 'into', 'about', 'will', 'can', 'not', 'but', 'has',
  'had', 'were', 'they', 'them', 'what', 'when', 'where', 'which', 'who', 'how',
])

function extractKeywords(text) {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? []
  return [...new Set(words.filter((w) => w.length > 3 && !STOPWORDS.has(w)))]
}

// Each blank-line-separated paragraph in a file becomes its own matchable fact.
export function loadFolderKnowledge(folder = path.join(process.cwd(), 'knowledge')) {
  let files
  try {
    files = fs.readdirSync(folder)
  } catch {
    return []
  }

  const entries = []
  for (const file of files) {
    const filePath = path.join(folder, file)
    if (!fs.statSync(filePath).isFile() || !/\.(txt|md)$/i.test(file)) continue

    const content = fs.readFileSync(filePath, 'utf-8')
    const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

    for (const paragraph of paragraphs) {
      entries.push({ keywords: extractKeywords(paragraph), answer: paragraph })
    }
  }

  return entries
}
