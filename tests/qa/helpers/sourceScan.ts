/**
 * Offline source scanners — no network, no Firebase writes, no user-visible artifacts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC_ROOT = join(process.cwd(), 'src')

export function listSourceFiles(
  dir: string = SRC_ROOT,
  acc: string[] = [],
): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) listSourceFiles(full, acc)
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) {
      acc.push(full)
    }
  }
  return acc
}

export function rel(path: string): string {
  return relative(process.cwd(), path)
}

export function readSrc(path: string): string {
  return readFileSync(path, 'utf8')
}

/** Extract object-literal argument blocks after notifyX( for rough static checks. */
export function findCallBlocks(
  source: string,
  fnName: string,
): Array<{ index: number; snippet: string }> {
  const re = new RegExp(`\\b${fnName}\\s*\\(`, 'g')
  const out: Array<{ index: number; snippet: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    out.push({
      index: m.index,
      snippet: source.slice(m.index, m.index + 900),
    })
  }
  return out
}
