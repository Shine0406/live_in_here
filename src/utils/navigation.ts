export function wasReloadedAtPath(pathname: string): boolean {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (entry?.type !== 'reload') return false

  try {
    return new URL(entry.name).pathname === pathname
  } catch {
    return window.location.pathname === pathname
  }
}
