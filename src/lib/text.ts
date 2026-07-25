/** Title-case each whitespace-separated word using Turkish locale (i/İ). */
export function toTitleCaseTr(value: string): string {
  return value
    .split(/(\s+)/u)
    .map((token) => {
      if (token.length === 0 || /^\s+$/u.test(token)) return token
      return (
        token.charAt(0).toLocaleUpperCase('tr-TR') +
        token.slice(1).toLocaleLowerCase('tr-TR')
      )
    })
    .join('')
}
