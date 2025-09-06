import type { EChartsOption } from 'echarts'
import { ChartRendererBase } from './base'

export class ScatterRenderer extends ChartRendererBase {
  buildOptions (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length === 0 || metrics.length < 2) return {}
    const dimensionKey = this.getDimKey(dimensions[0])
    const xMetricKey = this.getMetricKey(metrics[0])
    const yMetricKey = this.getMetricKey(metrics[1])

    return {
      title: { text: this.config.title || '散点图', left: 'center' },
      tooltip: {
        trigger: 'item'
      },
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      grid: { show: this.config.settings?.showGridLines !== false, left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'value', name: this.getMetricLabel(metrics[0]), splitLine: { show: this.config.settings?.showGridLines !== false } },
      yAxis: { type: 'value', name: this.getMetricLabel(metrics[1]), splitLine: { show: this.config.settings?.showGridLines !== false } },
      series: [{
        name: this.getMetricLabel(metrics[0]),
        type: 'scatter',
        data: this.data.map(item => [
          this.toNumber(item[xMetricKey]),
          this.toNumber(item[yMetricKey]),
          this.toCategory(item[dimensionKey])
        ]) as Array<Array<number | string>>,
        itemStyle: { color: '#5470c6' },
        symbolSize: 10
      }]
    }
  }

  mapClickToDimensionValues (params: { name?: unknown, axisValue?: unknown, seriesIndex?: number }): Record<string, string | number> {
    const out: Record<string, string | number> = {}
    const dims = this.config.dimensions
    const data = (params as unknown as { data?: unknown })?.data
    if (dims.length > 0 && Array.isArray(data)) {
      const v = data[2]
      if (typeof v === 'string' || typeof v === 'number') out[dims[0].field.identifier] = v
    }
    return out
  }
}
