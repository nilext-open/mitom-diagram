export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  // randomUUID is unavailable outside secure contexts (e.g. plain http on a LAN IP).
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}
