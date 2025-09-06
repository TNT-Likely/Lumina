export type SimpleField = { identifier: string; name?: string }

export type ComponentFieldInfo = {
  dimensions: SimpleField[]
  metrics: SimpleField[]
  filters?: Array<{ field: SimpleField }>
}

// Merge dimensions + metrics + configured filter fields, de-duplicated by identifier
export function buildFilterableFields (info?: ComponentFieldInfo): SimpleField[] {
  if (!info) return []
  const uniq = new Map<string, SimpleField>()
  ;(info.dimensions || []).forEach(f => { if (f?.identifier) uniq.set(f.identifier, f) })
  ;(info.metrics || []).forEach(f => { if (f?.identifier && !uniq.has(f.identifier)) uniq.set(f.identifier, f) })
  ;(info.filters || []).forEach(ff => { const f = ff?.field; if (f?.identifier && !uniq.has(f.identifier)) uniq.set(f.identifier, f) })
  return Array.from(uniq.values())
}
