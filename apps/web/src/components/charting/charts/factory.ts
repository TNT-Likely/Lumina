import type { ChartConfig } from '../types'
import type { EChartsOption } from 'echarts'
import { ChartRendererBase, type DataRow } from './base'
import { BarRenderer, HorizontalBarRenderer } from './bar'
import { LineRenderer } from './line'
import { AreaRenderer } from './area'
import { PieRenderer } from './pie'
import { ScatterRenderer } from './scatter'
import { CandlestickRenderer } from './candlestick'
import { RadarRenderer } from './radar'
import { HeatmapRenderer } from './heatmap'

export function createRenderer (data: DataRow[], config: ChartConfig): ChartRendererBase {
  const fieldMeta: Record<string, { valueMap?: Array<{ value: string | number | boolean | null, label: string }> }> = {}
  // 从配置收集字段元数据（如果存在）
  ;[...(config.dimensions || []), ...(config.metrics || [])].forEach((item) => {
    const f = (item as unknown as { field?: { identifier?: string, valueMap?: Array<{ value: string | number | boolean | null, label: string }> } }).field
    if (f?.identifier) {
      const anyField = (item as unknown as { field: { identifier: string, valueMap?: Array<{ value: string | number | boolean | null, label: string }> } }).field
      if (anyField?.valueMap) fieldMeta[f.identifier] = { valueMap: anyField.valueMap }
    }
  })
  switch (config.chartType) {
  case 'bar':
    return new BarRenderer(data, config, fieldMeta)
  case 'horizontal_bar':
    return new HorizontalBarRenderer(data, config, fieldMeta)
  case 'line':
    return new LineRenderer(data, config, fieldMeta)
  case 'area':
    return new AreaRenderer(data, config, fieldMeta)
  case 'pie':
    return new PieRenderer(data, config, fieldMeta)
  case 'scatter':
    return new ScatterRenderer(data, config, fieldMeta)
  case 'candlestick':
    return new CandlestickRenderer(data, config, fieldMeta)
  case 'radar':
    return new RadarRenderer(data, config, fieldMeta)
  case 'heatmap':
    return new HeatmapRenderer(data, config, fieldMeta)
  default:
    return new BarRenderer(data, config, fieldMeta)
  }
}

export type { DataRow }
export type { EChartsOption }
