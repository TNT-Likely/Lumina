import type { EChartsOption } from 'echarts'
import { ChartRendererBase, COLOR_THEMES, type DataRow } from './base'

export class BarRenderer extends ChartRendererBase {
  buildOptions (): EChartsOption {
    const theme = COLOR_THEMES[this.config.settings?.colorScheme as keyof typeof COLOR_THEMES] || COLOR_THEMES.default
    const { dimensions, metrics } = this.config
    if (dimensions.length === 0 || metrics.length === 0) return {}

    const xDim = dimensions[0]
    const xKey = this.getDimKey(xDim)
    const xRawValues = Array.from(new Set(this.data.map(item => item[xKey]).filter((v): v is string | number => v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number'))))
    const xValues = xRawValues.map(v => this.mapValueLabel(xDim.field.identifier, v))

    let seriesGroups: string[] = []
    let getSeriesGroup: (item: DataRow) => string
    if (dimensions.length === 1) {
      seriesGroups = metrics.map(m => this.getMetricLabel(m))
      getSeriesGroup = () => ''
    } else {
      const yDims = dimensions.slice(1)
      seriesGroups = Array.from(new Set(this.data.map((item: DataRow) => yDims.map((d) => item[this.getDimKey(d)]).join(' / '))))
      getSeriesGroup = (item: DataRow) => yDims.map((d) => item[this.getDimKey(d)]).join(' / ')
    }

    const series: Array<Record<string, unknown>> = []
    if (dimensions.length === 1) {
      metrics.forEach((metric, mIdx) => {
        const dataKey = this.getMetricKey(metric)
        series.push({
          name: this.getMetricLabel(metric),
          type: 'bar',
          data: xValues.map(xVal => {
            const row = this.data.find(item => {
              const raw = item[xKey]
              const mapped = this.mapValueLabel(xDim.field.identifier, raw as string | number)
              return mapped === xVal
            })
            const value = row ? row[dataKey] : 0
            return this.toNumber(value)
          }),
          label: { show: this.config.settings?.showDataLabels !== false },
          itemStyle: { color: theme[mIdx % theme.length] },
          stack: this.config.settings?.stacked ? 'total' : undefined
        })
      })
    } else {
      seriesGroups.forEach((group, gIdx) => {
        metrics.forEach((metric, mIdx) => {
          const dataKey = this.getMetricKey(metric)
          const colorIdx = (Number(gIdx) * metrics.length + Number(mIdx)) % theme.length
          series.push({
            name: group + ' ' + this.getMetricLabel(metric),
            type: 'bar',
            data: xValues.map(xVal => {
              const row = this.data.find(item => {
                const raw = item[xKey]
                const mapped = this.mapValueLabel(xDim.field.identifier, raw as string | number)
                return mapped === xVal && getSeriesGroup(item) === group
              })
              const value = row ? row[dataKey] : 0
              return this.toNumber(value)
            }),
            label: { show: this.config.settings?.showDataLabels !== false },
            itemStyle: { color: theme[colorIdx] },
            stack: this.config.settings?.stacked ? 'total' : undefined
          })
        })
      })
    }

    return {
      title: { text: this.config.title || '柱状图', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      grid: { show: this.config.settings?.showGridLines !== false, left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: xValues, name: this.getDimLabel(xDim) },
      yAxis: { type: 'value', splitLine: { show: this.config.settings?.showGridLines !== false } },
      series
    }
  }
}

export class HorizontalBarRenderer extends BarRenderer {
  buildOptions (): EChartsOption {
    const base = super.buildOptions() as import('echarts').EChartsOption
    const tmp = base.xAxis as { splitLine?: unknown, data?: Array<string | number> } | undefined
    base.xAxis = { type: 'value', splitLine: tmp?.splitLine as unknown as { show?: boolean }, name: undefined }
    base.yAxis = { type: 'category', data: (tmp?.data || []), splitLine: { show: this.config.settings?.showGridLines !== false }, name: this.getDimLabel(this.config.dimensions[0]) }
    return base
  }
}
