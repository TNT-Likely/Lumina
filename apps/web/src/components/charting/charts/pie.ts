import type { EChartsOption } from 'echarts'
import { ChartRendererBase, COLOR_THEMES } from './base'

export class PieRenderer extends ChartRendererBase {
  buildOptions (): EChartsOption {
    const theme = COLOR_THEMES[this.config.settings?.colorScheme as keyof typeof COLOR_THEMES] || COLOR_THEMES.default
    const { metrics } = this.config
    if (this.config.dimensions.length === 0 || metrics.length === 0) return {}
    const metric = metrics[0]
    const metricKey = this.getMetricKey(metric)

    const getGroupLabel = (item: Record<string, unknown>) =>
      this.config.dimensions
        .map(dim => {
          const key = this.getDimKey(dim)
          const raw = item[key]
          const shown = this.mapValueLabel(dim.field.identifier, raw)
          return `${this.getDimLabel(dim)}: ${shown}`
        })
        .join(' / ')

    const isDonut = this.config.settings?.donut === true
    const labelPosition = (this.config.settings?.labelPosition as 'inside' | 'outside') || 'outside'
    return {
      title: { text: String(this.config.title || '饼图') + ' - ' + this.getMetricLabel(metric), left: 'center' },
      tooltip: { trigger: 'item' },
      legend: { show: this.config.settings?.showLegend !== false, orient: 'vertical', left: 'left' },
      series: [{
        name: this.getMetricLabel(metric),
        type: 'pie',
        radius: isDonut ? ['40%', '70%'] : '50%',
        data: this.data.map((item, index) => ({
          name: getGroupLabel(item),
          value: this.toNumber(item[metricKey]),
          itemStyle: { color: theme[index % theme.length] }
        })),
        label: {
          show: this.config.settings?.showDataLabels !== false,
          position: labelPosition
        },
        labelLine: {
          show: labelPosition === 'outside'
        }
      }]
    }
  }

  // 饼图点击映射：用 dataIndex
  mapClickToDimensionValues (params: { name?: unknown, axisValue?: unknown, seriesIndex?: number }): Record<string, string | number> {
    const out: Record<string, string | number> = {}
    const idx = typeof (params as unknown as { dataIndex?: number })?.dataIndex === 'number'
      ? (params as unknown as { dataIndex: number }).dataIndex
      : -1
    if (idx < 0) return out
    const row = this.data[idx] as Record<string, unknown>
    this.config.dimensions.forEach(dim => {
      const key = this.getDimKey(dim)
      const v = row[key]
      if (typeof v === 'string' || typeof v === 'number') out[dim.field.identifier] = v
    })
    return out
  }
} // end PieRenderer
