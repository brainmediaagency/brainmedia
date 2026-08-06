/**
 * Static guards on production source — catch missing pushRoles / wrong audiences
 * without running the app or writing live data.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  findCallBlocks,
  listSourceFiles,
  readSrc,
  rel,
} from './helpers/sourceScan'
import { NOTIFY_CONTRACTS } from './contracts/notifyContracts'

describe('QA · notify call-site static guards', () => {
  const srcFiles = listSourceFiles().filter(
    (f) =>
      !f.includes(`${join('src', 'features', 'notifications', 'services')}`),
  )

  it('every production notifyManagement call passes pushRoles (no silent audience=all)', () => {
    const offenders: string[] = []
    for (const file of srcFiles) {
      const source = readSrc(file)
      if (!source.includes('notifyManagement')) continue
      for (const block of findCallBlocks(source, 'notifyManagement')) {
        if (block.snippet.includes('NotifyManagementInput')) continue
        if (!block.snippet.includes('pushRoles')) {
          offenders.push(`${rel(file)}@${block.index}`)
        }
        if (
          /audience\s*:\s*['"]all['"]/.test(block.snippet) &&
          /pushRoles\s*:/.test(block.snippet)
        ) {
          offenders.push(`${rel(file)}@${block.index}:audience+all`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('notifyBroadcast for region excludes reporter and kameraman in pushRoles', () => {
    const file = join(
      process.cwd(),
      'src/features/media-planning/services/dailyRegionService.ts',
    )
    const source = readSrc(file)
    const blocks = findCallBlocks(source, 'notifyBroadcast')
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      expect(block.snippet).toContain('pushRoles')
      expect(block.snippet).not.toMatch(/'reporter'/)
      expect(block.snippet).not.toMatch(/'kameraman'/)
    }
  })

  it('shooting calendar evening push targets kameraman + reporter only', () => {
    const file = join(
      process.cwd(),
      'src/features/jobs/services/shootingCalendarNotifyService.ts',
    )
    const source = readSrc(file)
    expect(source).toMatch(/roles:\s*\[\s*'kameraman'\s*,\s*'reporter'\s*\]/)
  })

  it('HR / hiring notify management-only pushRoles', () => {
    for (const path of [
      'src/features/hr/services/hrReportService.ts',
      'src/features/hr/services/hiringNoteService.ts',
    ]) {
      const source = readSrc(join(process.cwd(), path))
      for (const block of findCallBlocks(source, 'notifyManagement')) {
        expect(block.snippet).toMatch(/pushRoles:\s*\[\s*'management'\s*\]/)
      }
    }
  })

  it('calendar job-edit roles include cameraman+reporter and exclude mpu/hr', () => {
    const source = readSrc(
      join(process.cwd(), 'src/features/jobs/services/jobService.ts'),
    )
    expect(source).toMatch(/CALENDAR_JOB_EDIT_PUSH_ROLES/)
    expect(source).toMatch(/'kameraman'/)
    const contract = NOTIFY_CONTRACTS.find((c) => c.id === 'calendar_job_edit')
    expect(contract?.pushRoles).toEqual([
      'management',
      'coordinator',
      'reporter',
      'kameraman',
    ])
  })

  it('job approve push does not include media_planning / reporter / kameraman', () => {
    const source = readSrc(
      join(process.cwd(), 'src/features/jobs/services/jobService.ts'),
    )
    expect(source).toMatch(
      /pushRoles:\s*\[\s*'management',\s*'coordinator',\s*'human_resources'\s*\]/,
    )
  })
})

describe('QA · no user-visible test artifacts in shippable trees', () => {
  it('public/ has no test or qa fixture dumps', () => {
    const publicDir = join(process.cwd(), 'public')
    if (!existsSync(publicDir)) return
    // Filename hints only — do not flag production OneSignal worker as "test".
    const banned = /(?:^|[._-])(fixture|e2e-spec|qa-dump|coverage-report)(?:[._-]|$)/i
    const walk = (dir: string, hits: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full, hits)
        else if (banned.test(name)) hits.push(full)
      }
      return hits
    }
    expect(walk(publicDir)).toEqual([])
  })

  it('does not ship tests/qa into TypeScript build entry (app only src/)', () => {
    const tsconfig = readFileSync(join(process.cwd(), 'tsconfig.app.json'), 'utf8')
    // Ensure app compilation is rooted at src, not tests
    expect(tsconfig).toMatch(/"include"\s*:\s*\[[^\]]*"src"/s)
  })
})
