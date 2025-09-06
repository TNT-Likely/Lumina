import type { EChartsOption } from 'echarts'
import type { ChartConfig } from '../types'

export type DataRow = Record<string, string | number | boolean | null | undefined>

export abstract class ChartRendererBase {
  protected data: DataRow[]
  protected config: ChartConfig
  // 可选：字段元数据（含 valueMap），用于将维度值替换为友好标签
  protected fieldMeta?: Record<string, { valueMap?: Array<{ value: string | number | boolean | null, label: string }> }>
  constructor (data: DataRow[], config: ChartConfig, fieldMeta?: Record<string, { valueMap?: Array<{ value: string | number | boolean | null, label: string }> }>) {
    this.data = data
    this.config = config
    this.fieldMeta = fieldMeta
  }

  // helpers
  protected getFieldKey (field: { identifier: string, name: string }, _alias?: string, aggregationType?: string): string {
    // 使用稳定键读取数据：维度 -> identifier；指标 -> identifier_aggregationType
    if (aggregationType) return `${field.identifier}_${aggregationType}`
    return field.identifier
  }

  protected getDimKey (dim: { field: { identifier: string, name: string }, alias?: string }): string {
    return this.getFieldKey(dim.field)
  }

  protected getDimLabel (dim: { field: { identifier: string, name: string }, alias?: string }): string {
    return dim.alias || dim.field.name
  }

  protected getMetricKey (met: { field: { identifier: string, name: string }, alias?: string, aggregationType?: string }): string {
    return this.getFieldKey(met.field, undefined, met.aggregationType)
  }

  protected getMetricLabel (met: { field: { identifier: string, name: string }, alias?: string, aggregationType?: string }): string {
    if (met.alias) return met.alias
    return met.aggregationType ? `${met.field.name}(${met.aggregationType})` : met.field.name
  }

  protected toNumber (v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
    if (typeof v === 'boolean') return v ? 1 : 0
    return 0
  }

  protected toCategory (v: unknown): string | number {
    if (typeof v === 'number' || typeof v === 'string') return v
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    return ''
  }

  protected mapValueLabel (identifier: string, value: unknown): string | number {
    const meta = this.fieldMeta?.[identifier]
    const list = meta?.valueMap
    if (!list) return (typeof value === 'string' || typeof value === 'number') ? value : (value == null ? '' : String(value))
    const hit = list.find(m => m.value === value || String(m.value) === String(value))
    return hit ? hit.label : ((typeof value === 'string' || typeof value === 'number') ? value : (value == null ? '' : String(value)))
  }

  protected reverseMapLabelValue (identifier: string, shown: unknown): string | number {
    const list = this.fieldMeta?.[identifier]?.valueMap
    if (!list) return (typeof shown === 'string' || typeof shown === 'number') ? shown : ''
    const hit = list.find(m => m.label === shown || String(m.label) === String(shown))
    return (hit?.value as string | number) ?? ((typeof shown === 'string' || typeof shown === 'number') ? shown : '')
  }

  // default click mapping for axis-based charts; subclasses override as needed
  mapClickToDimensionValues (params: { name?: unknown, axisValue?: unknown, seriesIndex?: number }): Record<string, string | number> {
    const dims = this.config.dimensions
    const out: Record<string, string | number> = {}
    if (dims.length === 0) return out
    const name = (params?.name ?? params?.axisValue)
    if (typeof name === 'string' || typeof name === 'number') {
      const id = dims[0].field.identifier
      out[id] = this.reverseMapLabelValue(id, name)
    }
    if (dims.length > 1 && typeof params?.seriesIndex === 'number') {
      const yDims = dims.slice(1)
      const seriesGroups: string[] = Array.from(new Set(
        this.data.map((item: Record<string, unknown>) => yDims
          .map(d => {
            const v = item[d.field.identifier]
            return (typeof v === 'string' || typeof v === 'number') ? String(v) : ''
          }).join(' / '))
      ))
      const metricsLen = this.config.metrics.length || 1
      const groupIdx = Math.floor(params.seriesIndex / metricsLen)
      const group = seriesGroups[groupIdx]
      if (group) {
        const parts = group.split(' / ')
        yDims.forEach((d, i) => {
          const val = parts[i]
          if (val !== undefined && val !== '') out[d.field.identifier] = val
        })
      }
    }
    return out
  }

  // subclasses must implement
  abstract buildOptions (): EChartsOption
}

export const COLOR_THEMES = {
  default: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
  business: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22'],
  fresh: ['#26deca', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#f368e0', '#3742fa'],
  elegant: ['#6c5ce7', '#fd79a8', '#fdcb6e', '#e17055', '#00b894', '#0984e3', '#a29bfe', '#fd79a8', '#fab1a0']
}
