import fs from 'node:fs'

// Usage: tsx scripts/envToAppSettings.ts [input.env] [output.json]
const [, , inputPath = '.env', outputPath = 'azure_appsettings.json'] = process.argv

const settings = fs
  .readFileSync(inputPath, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => {
    const eqIndex = line.indexOf('=')
    const name = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    return { name, value, slotSetting: false }
  })

fs.writeFileSync(outputPath, JSON.stringify(settings, null, 2) + '\n')
console.log(`Wrote ${settings.length} settings to ${outputPath}`)
