import type { EChartsOption } from 'echarts'
import { ChartRendererBase, COLOR_THEMES } from './base'

export class CandlestickRenderer extends ChartRendererBase {
  buildOptions (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length < 1 || metrics.length < 4) return {}

    const xDim = dimensions[0]
    const xKey = this.getDimKey(xDim)
    const [openM, closeM, lowM, highM] = metrics
    const openK = this.getMetricKey(openM)
    const closeK = this.getMetricKey(closeM)
    const lowK = this.getMetricKey(lowM)
    const highK = this.getMetricKey(highM)

    const categories = Array.from(new Set(this.data.map(item => item[xKey]).filter((v): v is string | number => v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number'))))
    const seriesData = categories.map(cat => {
      const row = this.data.find(item => item[xKey] === cat) as Record<string, unknown> | undefined
      return [
        this.toNumber(row?.[openK]),
        this.toNumber(row?.[closeK]),
        this.toNumber(row?.[lowK]),
        this.toNumber(row?.[highK])
      ]
    })

    return {
      title: { text: this.config.title || 'K 线图', left: 'center' },
      tooltip: { trigger: 'axis' },
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      xAxis: { type: 'category', data: categories, name: this.getDimLabel(xDim) },
      yAxis: { scale: true },
      series: [{
        type: 'candlestick',
        name: `${this.getMetricLabel(openM)}/${this.getMetricLabel(closeM)}`,
        data: seriesData
      }]
    }
  }
}
