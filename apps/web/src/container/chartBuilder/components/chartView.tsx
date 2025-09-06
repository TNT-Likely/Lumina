import React from 'react'
import * as echarts from 'echarts'
import type { ChartConfig } from '../types'
import type { EChartsOption } from 'echarts'

// 定义数据行类型
export type DataRow = Record<string, string | number | boolean | null | undefined>

const COLOR_THEMES = {
  default: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
  business: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22'],
  fresh: ['#26deca', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#f368e0', '#3742fa'],
  elegant: ['#6c5ce7', '#fd79a8', '#fdcb6e', '#e17055', '#00b894', '#0984e3', '#a29bfe', '#fd79a8', '#fab1a0']
}

class ChartConfigBuilder {
  private data: DataRow[]
  private config: ChartConfig
  private colorTheme: string[]

  constructor (data: DataRow[], config: ChartConfig) {
    this.data = data
    this.config = config
    this.colorTheme = COLOR_THEMES[config.settings?.colorScheme as keyof typeof COLOR_THEMES] || COLOR_THEMES.default
  }

  private getFieldKey (field: { identifier: string, name: string }, _alias?: string, aggregationType?: string): string {
    if (aggregationType) return `${field.identifier}_${aggregationType}`
    return field.identifier
  }

  // 维度键名与显示名：键名用于从数据行读取值，显示名用于坐标轴/提示框文本
  private getDimKey (dim: { field: { identifier: string, name: string }, alias?: string }): string {
    return this.getFieldKey(dim.field)
  }

  private getDimLabel (dim: { field: { identifier: string, name: string }, alias?: string }): string {
    return dim.alias || dim.field.name
  }

  // 指标键名与显示名：键名用于从数据行读取值，显示名用于图例/坐标轴名/提示框文本
  private getMetricKey (met: { field: { identifier: string, name: string }, alias?: string, aggregationType?: string }): string {
    return this.getFieldKey(met.field, undefined, met.aggregationType)
  }

  private getMetricLabel (met: { field: { identifier: string, name: string }, alias?: string, aggregationType?: string }): string {
    if (met.alias) return met.alias
    return met.aggregationType ? `${met.field.name}(${met.aggregationType})` : met.field.name
  }

  private getGroupKey (item: DataRow): string {
    return this.config.dimensions.map(dim => {
      const key = this.getDimKey(dim)
      return item[key]
    }).join(' / ')
  }

  private getGroupLabel (item: DataRow): string {
    return this.config.dimensions.map(dim => {
      const key = this.getDimKey(dim)
      return `${this.getDimLabel(dim)}: ${item[key]}`
    }).join(' / ')
  }

  // 将任意值转换为数值，用于度量轴
  private toNumber (v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = parseFloat(v)
      return Number.isFinite(n) ? n : 0
    }
    if (typeof v === 'boolean') return v ? 1 : 0
    return 0
  }

  // 将任意值转换为分类显示（字符串或数字）
  private toCategory (v: unknown): string | number {
    if (typeof v === 'number' || typeof v === 'string') return v
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    return ''
  }

  public buildBarChart (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length === 0 || metrics.length === 0) return {}
    const xDim = dimensions[0]
    const xKey = this.getDimKey(xDim)
    const xValues = Array.from(new Set(this.data.map(item => item[xKey]).filter((v): v is string | number => v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number'))))
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
            const row = this.data.find(item => item[xKey] === xVal)
            const value = row ? row[dataKey] : 0
            return this.toNumber(value)
          }),
          itemStyle: { color: this.colorTheme[mIdx % this.colorTheme.length] }
        })
      })
    } else {
      seriesGroups.forEach((group, gIdx) => {
        metrics.forEach((metric, mIdx) => {
          const dataKey = this.getMetricKey(metric)
          const colorIdx = (Number(gIdx) * metrics.length + Number(mIdx)) % this.colorTheme.length
          series.push({
            name: group + ' ' + this.getMetricLabel(metric),
            type: 'bar',
            data: xValues.map(xVal => {
              const row = this.data.find(item => {
                return item[xKey] === xVal && getSeriesGroup(item) === group
              })
              const value = row ? row[dataKey] : 0
              return this.toNumber(value)
            }),
            itemStyle: { color: this.colorTheme[colorIdx] }
          })
        })
      })
    }
    return {
      title: { text: this.config.title || '柱状图', left: 'center' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          if (Array.isArray(params)) {
            const p0 = params[0] as { dataIndex?: number; axisValue?: string }
            const idx = p0?.dataIndex
            const row = typeof idx === 'number' ? this.data[idx] : undefined
            const groupLabel = row ? this.getGroupLabel(row) : (p0?.axisValue ?? '')
            let result = `${groupLabel}<br/>`
            for (const p of params as Array<{ marker?: string; seriesName?: string; value?: unknown }>) {
              const val = p?.value
              const value = typeof val === 'number' ? val.toLocaleString() : val
              result += `${p?.marker ?? ''}${p?.seriesName ?? ''}: ${value ?? ''}<br/>`
            }
            return result
          }
          return ''
        }
      },
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      grid: { show: this.config.settings?.showGridLines !== false, left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: xValues, axisLine: { show: true }, axisTick: { show: true }, name: this.getDimLabel(xDim) },
      yAxis: { type: 'value', axisLine: { show: true }, splitLine: { show: this.config.settings?.showGridLines !== false }, axisLabel: { formatter: (value: number) => { if (value >= 1000000) { return (value / 1000000).toFixed(1) + 'M' } else if (value >= 1000) { return (value / 1000).toFixed(1) + 'K' } return value.toString() } } },
      series
    }
  }

  // ...已清理多余顶层语句...
  buildLineChart (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length === 0 || metrics.length === 0) return {}
    const xDim = dimensions[0]
    const xKey = this.getDimKey(xDim)
    const xValues = Array.from(new Set(this.data.map(item => item[xKey])))
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
          smooth: true,
          lineStyle: { color: this.colorTheme[mIdx % this.colorTheme.length] },
          itemStyle: { color: this.colorTheme[mIdx % this.colorTheme.length] }
        })
      })
    } else {
      seriesGroups.forEach((group, gIdx) => {
        metrics.forEach((metric, mIdx) => {
          const dataKey = this.getMetricKey(metric)
          const colorIdx = (Number(gIdx) * metrics.length + Number(mIdx)) % this.colorTheme.length
          series.push({
            name: group + ' ' + this.getMetricLabel(metric),
            type: 'line',
            data: xValues.map(xVal => {
              const row = this.data.find(item => item[xKey] === xVal && getSeriesGroup(item) === group)
              const value = row ? row[dataKey] : 0
              return this.toNumber(value)
            }),
            smooth: true,
            lineStyle: { color: this.colorTheme[colorIdx] },
            itemStyle: { color: this.colorTheme[colorIdx] }
          })
        })
      })
    }
    return {
      title: { text: this.config.title || '折线图', left: 'center' },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          if (Array.isArray(params)) {
            const p0 = params[0] as { dataIndex?: number; axisValue?: string }
            const idx = p0?.dataIndex
            const row = typeof idx === 'number' ? this.data[idx] : undefined
            const groupLabel = row ? this.getGroupLabel(row) : (p0?.axisValue ?? '')
            let result = `${groupLabel}<br/>`
            for (const p of params as Array<{ marker?: string; seriesName?: string; value?: unknown }>) {
              const val = p?.value
              const value = typeof val === 'number' ? val.toLocaleString() : val
              result += `${p?.marker ?? ''}${p?.seriesName ?? ''}: ${value ?? ''}<br/>`
            }
            return result
          }
          return ''
        }
      },
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      grid: { show: this.config.settings?.showGridLines !== false, left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: xValues.filter((v): v is string | number => v !== null && v !== undefined), boundaryGap: false, name: this.getDimLabel(xDim) },
      yAxis: { type: 'value', splitLine: { show: this.config.settings?.showGridLines !== false }, axisLabel: { formatter: (value: number) => { if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'; if (value >= 1000) return (value / 1000).toFixed(1) + 'K'; return value.toString() } } },
      series
    }
  }

  buildAreaChart (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length === 0 || metrics.length === 0) return {}
    const xDim = dimensions[0]
    const xKey = this.getDimKey(xDim)
    const xValues = Array.from(new Set(this.data.map(item => item[xKey])))
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
          smooth: true,
          areaStyle: { opacity: 0.8, color: this.colorTheme[mIdx % this.colorTheme.length] },
          lineStyle: { color: this.colorTheme[mIdx % this.colorTheme.length] },
          itemStyle: { color: this.colorTheme[mIdx % this.colorTheme.length] },
          stack: this.config.settings?.stacked ? 'total' : undefined
        })
      })
    } else {
      seriesGroups.forEach((group, gIdx) => {
        metrics.forEach((metric, mIdx) => {
          const dataKey = this.getMetricKey(metric)
          const colorIdx = (Number(gIdx) * metrics.length + Number(mIdx)) % this.colorTheme.length
          series.push({
            name: group + ' ' + this.getMetricLabel(metric),
            type: 'line',
            data: xValues.map(xVal => {
              const row = this.data.find(item => item[xKey] === xVal && getSeriesGroup(item) === group)
              const value = row ? row[dataKey] : 0
              return this.toNumber(value)
            }),
            smooth: true,
            areaStyle: { opacity: 0.8, color: this.colorTheme[colorIdx] },
            lineStyle: { color: this.colorTheme[colorIdx] },
            itemStyle: { color: this.colorTheme[colorIdx] },
            stack: this.config.settings?.stacked ? 'total' : undefined
          })
        })
      })
    }
    return {
      title: { text: this.config.title || '面积图', left: 'center' },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          if (Array.isArray(params)) {
            const p0 = params[0] as { dataIndex?: number; axisValue?: string }
            const idx = p0?.dataIndex
            const row = typeof idx === 'number' ? this.data[idx] : undefined
            const groupLabel = row ? this.getGroupLabel(row) : (p0?.axisValue ?? '')
            let result = `${groupLabel}<br/>`
            for (const p of params as Array<{ marker?: string; seriesName?: string; value?: unknown }>) {
              const val = p?.value
              const value = typeof val === 'number' ? val.toLocaleString() : val
              result += `${p?.marker ?? ''}${p?.seriesName ?? ''}: ${value ?? ''}<br/>`
            }
            return result
          }
          return ''
        }
      },
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      grid: { show: this.config.settings?.showGridLines !== false, left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: xValues.filter((v): v is string | number => v !== null && v !== undefined), boundaryGap: false, name: this.getDimLabel(xDim) },
      yAxis: { type: 'value', splitLine: { show: this.config.settings?.showGridLines !== false }, axisLabel: { formatter: (value: number) => { if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'; if (value >= 1000) return (value / 1000).toFixed(1) + 'K'; return value.toString() } } },
      series
    }
  }

  buildPieChart (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length === 0 || metrics.length === 0) return {}
    const metric = metrics[0]
    const getGroupLabel = (item: DataRow) => this.getGroupLabel(item)
    const metricKey = this.getMetricKey(metric)
    return {
      title: { text: String(this.config.title || '饼图') + ' - ' + this.getMetricLabel(metric), left: 'center' },
      tooltip: {
        trigger: 'item',
        formatter: (param: unknown) => {
          const p = param as { value?: unknown; seriesName?: string; name?: string; percent?: number }
          const v = p?.value
          const value = typeof v === 'number'
            ? v.toLocaleString()
            : (typeof v === 'string'
              ? v
              : (v !== undefined && v !== null
                ? String(v)
                : ''))
          return `${p?.seriesName ?? ''} <br/>${p?.name ?? ''}: ${value} (${p?.percent ?? ''}%)`
        }
      },
      legend: { show: this.config.settings?.showLegend !== false, orient: 'vertical', left: 'left' },
      series: [{
        name: this.getMetricLabel(metric),
        type: 'pie',
        radius: this.config.settings?.donut ? ['40%', '70%'] : '50%',
        data: this.data.map((item, index) => ({
          name: getGroupLabel(item),
          value: this.toNumber(item[metricKey]),
          itemStyle: { color: this.colorTheme[index % this.colorTheme.length] }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: { show: this.config.settings?.showDataLabels !== false }
      }]
    }
  }

  buildScatterChart (): EChartsOption {
    const { dimensions, metrics } = this.config
    if (dimensions.length === 0 || metrics.length < 2) {
      return {}
    }
    const dimensionKey = this.getDimKey(dimensions[0])
    const xMetricKey = this.getMetricKey(metrics[0])
    const yMetricKey = this.getMetricKey(metrics[1])
    return {
      title: {
        text: this.config.title || '散点图',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: (param: unknown) => {
          const p = param as { data?: unknown }
          const data = Array.isArray(p?.data) ? (p?.data as [unknown, unknown, unknown]) : [undefined, undefined, undefined]
          const xRaw = data[0]
          const yRaw = data[1]
          const label = data[2]
          const xValue = typeof xRaw === 'number' ? xRaw.toLocaleString() : xRaw
          const yValue = typeof yRaw === 'number' ? yRaw.toLocaleString() : yRaw
          return `${String(label ?? '')}<br/>${this.getMetricLabel(metrics[0])}: ${String(xValue ?? '')}<br/>${this.getMetricLabel(metrics[1])}: ${String(yValue ?? '')}`
        }
      },
      legend: { show: this.config.settings?.showLegend !== false, top: 'bottom' },
      grid: {
        show: this.config.settings?.showGridLines !== false,
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: this.getMetricLabel(metrics[0]),
        splitLine: { show: this.config.settings?.showGridLines !== false }
      },
      yAxis: {
        type: 'value',
        name: this.getMetricLabel(metrics[1]),
        splitLine: { show: this.config.settings?.showGridLines !== false }
      },
      series: [{
        name: this.getMetricLabel(metrics[0]),
        type: 'scatter',
        data: this.data.map(item => [
          this.toNumber(item[xMetricKey]),
          this.toNumber(item[yMetricKey]),
          this.toCategory(item[dimensionKey])
        ]) as Array<Array<number | string>>, // 限定为 ECharts 支持的值类型
        itemStyle: {
          color: this.colorTheme[0]
        },
        symbolSize: 10
      }]
    }
  }

  build (): EChartsOption {
    switch (this.config.chartType) {
    case 'bar': return this.buildBarChart()
    case 'line': return this.buildLineChart()
    case 'area': return this.buildAreaChart()
    case 'pie': return this.buildPieChart()
    case 'scatter': return this.buildScatterChart()
    default: return this.buildBarChart()
    }
  }
}

interface ChartViewProps {
  chartConfig: ChartConfig
  queryResult: { data: DataRow[], totalCount: number, executionTime: number }
  style?: React.CSSProperties
  className?: string
}

export const ChartView: React.FC<ChartViewProps & { onPointClick?: (payload: { dimensionValues: Record<string, string | number>, event?: MouseEvent }) => void }> = ({
  chartConfig,
  queryResult,
  style = { width: '100%', height: '500px' },
  className = '',
  onPointClick
}) => {
  const chartOption: EChartsOption | null = React.useMemo(() => {
    if (!queryResult?.data?.length) return null
    const builder = new ChartConfigBuilder(queryResult.data, chartConfig)
    return builder.build()
  }, [queryResult, chartConfig])

  // 基于当前数据与配置，尝试构造一个从 echarts 事件到维度值的映射
  const handleClick = React.useCallback((params: unknown) => {
    if (!onPointClick) return
    const p = params as {
      componentType?: string
      seriesIndex?: number
      dataIndex?: number
      name?: string | number
      axisValue?: string | number
      data?: unknown
      event?: { event?: unknown }
      seriesName?: string
    }

    // 小工具：读取行中的某个维度值（仅使用稳定键 identifier；alias 仅用于展示）
    const readDimValue = (row: Record<string, unknown>, dim: { field: { identifier: string }, alias?: string }) => {
      const readKey = dim.field.identifier
      const v = row[readKey]
      return (typeof v === 'string' || typeof v === 'number') ? (v as string | number) : undefined
    }

    const dims = chartConfig.dimensions
    const chartType = chartConfig.chartType
    const dimValues: Record<string, string | number> = {}

    // 1) 针对不同图表类型分别处理事件到维度的映射
    if (chartType === 'pie') {
      // pie 的 dataIndex 与原始数据一一对应
      const idx = typeof p?.dataIndex === 'number' ? p.dataIndex : -1
      if (idx < 0) return
      const row = queryResult.data[idx]
      if (!row) return
      dims.forEach(dim => {
        const val = readDimValue(row, dim)
        if (val !== undefined) dimValues[dim.field.identifier] = val
      })
    } else if (chartType === 'scatter') {
      // scatter 的第三个维度值作为分类（在 series.data 的第三项）
      const d = Array.isArray(p?.data) ? (p?.data as Array<unknown>) : []
      if (dims.length > 0) {
        const v = d[2]
        if (typeof v === 'string' || typeof v === 'number') {
          dimValues[dims[0].field.identifier] = v
        }
      }
    } else {
      // bar/line/area 等基于类目轴的图表
      if (dims.length === 0) return
      const xVal = (p?.name ?? p?.axisValue) as string | number | undefined
      if (xVal !== undefined && (typeof xVal === 'string' || typeof xVal === 'number')) {
        dimValues[dims[0].field.identifier] = xVal
      }
      // 多维度：从 seriesIndex 推导出所属的 group（由第二、三...维度拼接而成）
      if (dims.length > 1 && typeof p?.seriesIndex === 'number') {
        const yDims = dims.slice(1)
        // 复用构造逻辑：根据当前数据计算 seriesGroups 顺序，需与构图时一致
        const seriesGroups: string[] = Array.from(new Set(
          queryResult.data.map((item: Record<string, unknown>) => yDims
            .map(d => {
              const v = item[d.field.identifier]
              return (typeof v === 'string' || typeof v === 'number') ? String(v) : ''
            })
            .join(' / ')
          )
        ))
        const metricsLen = chartConfig.metrics.length || 1
        const groupIdx = Math.floor(p.seriesIndex / metricsLen)
        const group = seriesGroups[groupIdx]
        if (group) {
          const parts = group.split(' / ')
          yDims.forEach((d, i) => {
            const val = parts[i]
            if (val !== undefined && val !== '') dimValues[d.field.identifier] = val
          })
        }
      }
    }

    const domEvt = (p?.event && (p.event as { event?: unknown }).event) as MouseEvent | undefined
    onPointClick({ dimensionValues: dimValues, event: domEvt })
  }, [onPointClick, queryResult.data, chartConfig])

  // 合并 ChartRenderer：自管理 echarts 实例（初始化、更新、销毁、响应尺寸变化）
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const instanceRef = React.useRef<echarts.ECharts | null>(null)

  React.useEffect(() => {
    if (containerRef.current && !instanceRef.current) {
      instanceRef.current = echarts.init(containerRef.current)
    }

    const handleResize = () => { instanceRef.current?.resize() }
    window.addEventListener('resize', handleResize)
    const ro = new ResizeObserver(() => handleResize())
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      window.removeEventListener('resize', handleResize)
      try { ro.disconnect() } catch {}
      if (instanceRef.current) {
        instanceRef.current.dispose()
        instanceRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    const inst = instanceRef.current
    if (!inst) return
    if (chartOption) {
      inst.setOption(chartOption, true)
      if (onPointClick) {
        inst.off('click')
        inst.on('click', (p) => handleClick(p))
      }
    } else {
      inst.clear()
      inst.off('click')
    }
  }, [chartOption, onPointClick, handleClick])

  return (
    <div className={className} style={style}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
