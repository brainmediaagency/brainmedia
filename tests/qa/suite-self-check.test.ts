/**
 * Entwickler / CI-only QA suite.
 *
 * Safe by design:
 * - No Firebase production writes
 * - No OneSignal / Sheets webhook network
 * - No Drive uploads, no test PDF/voice left for end users
 * - Nothing under `public/` — only this folder + npm scripts
 *
 * Run:
 *   npm run test:qa          # this suite only
 *   npm run test:full        # unit + this suite + firestore rules (emulator)
 *   npm test                 # unit + this suite (default vitest include)
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('QA · suite self-check', () => {
  it('README exists for developers only (not under public/)', () => {
    const readme = join(process.cwd(), 'tests/qa/README.md')
    expect(existsSync(readme)).toBe(true)
    const text = readFileSync(readme, 'utf8')
    expect(text).toMatch(/Geliştirici/)
    expect(text).not.toMatch(/kullanıcıya deploy|hosting'e kopyala/i)
  })

  it('package.json exposes test:qa without deploy hooks', () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }
    expect(pkg.scripts['test:qa']).toMatch(/tests\/qa/)
    expect(pkg.scripts['test:qa']).not.toMatch(/firebase deploy|hosting/)
  })
})
