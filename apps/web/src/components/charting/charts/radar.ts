import type { EChartsOption } from 'echarts'
import { ChartRendererBase, COLOR_THEMES } from './base'

export class RadarRenderer extends ChartRendererBase {
  buildOptions (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length < 1 || metrics.length < 1) return {}
    const theme = COLOR_THEMES[this.config.settings?.colorScheme as keyof typeof COLOR_THEMES] || COLOR_THEMES.default

    const indicator = metrics.map(m => ({ name: this.getMetricLabel(m) }))
    const groupDim = dimensions[0]
    const gKey = this.getDimKey(groupDim)
    const groups = Array.from(new Set(this.data.map(item => item[gKey]).filter((v): v is string | number => v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number'))))

    const seriesData = groups.map((g, idx) => ({
      name: String(g),
      value: metrics.map(m => {
        const row = this.data.find(item => item[gKey] === g) as Record<string, unknown> | undefined
        return this.toNumber(row?.[this.getMetricKey(m)])
      }),
      itemStyle: { color: theme[idx % theme.length] }
    }))

    return {
      title: { text: this.config.title || '雷达图', left: 'center' },
      tooltip: {},
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      radar: { indicator },
      series: [{ type: 'radar', data: seriesData }]
    }
  }
}
