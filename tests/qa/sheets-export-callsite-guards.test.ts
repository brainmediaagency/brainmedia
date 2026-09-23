import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(process.cwd(), 'src')

const FORBIDDEN_IMPORT =
  /from\s+['"]@\/features\/jobs\/services\/sheetsExport['"]|from\s+['"][^'"]*sheetsExport['"]/

const ALLOWED_PATH_FRAGMENTS = [
  '/features/jobs/services/sheetsExport.ts',
  '/features/jobs/services/sheetsExport.test.ts',
  '/features/reporter/utils/dailyReportSheetSync.ts',
  '/features/reporter/utils/dailyReportSheetSync.test.ts',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

describe('sheetsExport call-site guard', () => {
  it('UI/feature modules no longer import sheetsExport for dual-writes', () => {
    const offenders: string[] = []
    for (const file of walk(ROOT)) {
      if (ALLOWED_PATH_FRAGMENTS.some((frag) => file.endsWith(frag))) continue
      const text = readFileSync(file, 'utf8')
      if (FORBIDDEN_IMPORT.test(text)) offenders.push(file.replace(process.cwd(), ''))
    }
    expect(offenders).toEqual([])
  })
})
