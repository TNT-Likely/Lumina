import type { EChartsOption } from 'echarts'
import { ChartRendererBase, COLOR_THEMES, type DataRow } from './base'

export class HeatmapRenderer extends ChartRendererBase {
  buildOptions (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length < 2 || metrics.length < 1) return {}
    const theme = COLOR_THEMES[this.config.settings?.colorScheme as keyof typeof COLOR_THEMES] || COLOR_THEMES.default

    const xDim = dimensions[0]
    const yDim = dimensions[1]
    const xKey = this.getDimKey(xDim)
    const yKey = this.getDimKey(yDim)
    const metric = metrics[0]
    const mKey = this.getMetricKey(metric)

    const xCats = Array.from(new Set(this.data.map(item => item[xKey]).filter((v): v is string | number => v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number'))))
    const yCats = Array.from(new Set(this.data.map(item => item[yKey]).filter((v): v is string | number => v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number'))))

    const seriesData: Array<[number, number, number]> = []
    yCats.forEach((y, yi) => {
      xCats.forEach((x, xi) => {
        const row = this.data.find((r: DataRow) => r[xKey] === x && r[yKey] === y) as Record<string, unknown> | undefined
        seriesData.push([xi, yi, this.toNumber(row?.[mKey])])
      })
    })

    return {
      title: { text: this.config.title || '热力图', left: 'center' },
      tooltip: { position: 'top' },
      grid: { show: false, left: '10%', right: '10%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: xCats, splitArea: { show: true } },
      yAxis: { type: 'category', data: yCats, splitArea: { show: true } },
      visualMap: { min: 0, max: Math.max(...seriesData.map(s => s[2] || 0)), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 },
      series: [{
        name: this.getMetricLabel(metric),
        type: 'heatmap',
        data: seriesData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    }
  }
}
