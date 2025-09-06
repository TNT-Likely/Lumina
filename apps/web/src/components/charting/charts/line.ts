import type { EChartsOption } from 'echarts'
import { ChartRendererBase, COLOR_THEMES, type DataRow } from './base'

export class LineRenderer extends ChartRendererBase {
  buildOptions (): EChartsOption {
    const theme = COLOR_THEMES[this.config.settings?.colorScheme as keyof typeof COLOR_THEMES] || COLOR_THEMES.default
    const { dimensions, metrics } = this.config
    if (dimensions.length === 0 || metrics.length === 0) return {}

    const xDim = dimensions[0]
    const xKey = this.getDimKey(xDim)
    const xValues = Array.from(new Set(this.data.map(item => item[xKey]).filter((v) => v !== null && v !== undefined)))

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
          type: 'line',
          data: xValues.map(xVal => {
            const row = this.data.find(item => item[xKey] === xVal)
            const value = row ? row[dataKey] : 0
            return this.toNumber(value)
          }),
          smooth: this.config.settings?.smooth !== false,
          label: { show: this.config.settings?.showDataLabels !== false },
          lineStyle: { color: theme[mIdx % theme.length] },
          itemStyle: { color: theme[mIdx % theme.length] }
        })
      })
    } else {
      seriesGroups.forEach((group, gIdx) => {
        metrics.forEach((metric, mIdx) => {
          const dataKey = this.getMetricKey(metric)
          const colorIdx = (Number(gIdx) * metrics.length + Number(mIdx)) % theme.length
          series.push({
            name: group + ' ' + this.getMetricLabel(metric),
            type: 'line',
            data: xValues.map(xVal => {
              const row = this.data.find(item => item[xKey] === xVal && getSeriesGroup(item) === group)
              const value = row ? row[dataKey] : 0
              return this.toNumber(value)
            }),
            smooth: this.config.settings?.smooth !== false,
            label: { show: this.config.settings?.showDataLabels !== false },
            lineStyle: { color: theme[colorIdx] },
            itemStyle: { color: theme[colorIdx] }
          })
        })
      })
    }
    return {
      title: { text: this.config.title || '折线图', left: 'center' },
      tooltip: { trigger: 'axis' },
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      grid: { show: this.config.settings?.showGridLines !== false, left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: xValues.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number'), boundaryGap: false, name: this.getDimLabel(xDim) },
      yAxis: { type: 'value', splitLine: { show: this.config.settings?.showGridLines !== false } },
      series
    }
  }
}
