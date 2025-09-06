import React from 'react'
import * as echarts from 'echarts'
import type { ChartConfig } from './types'
import { createRenderer, type DataRow } from './charts/factory'
import type { EChartsOption } from 'echarts'

export type { DataRow }

interface ChartViewProps {
  chartConfig: ChartConfig
  queryResult: { data: DataRow[], totalCount: number, executionTime: number }
  style?: React.CSSProperties
  className?: string
  onPointClick?: (payload: { dimensionValues: Record<string, string | number>, event?: MouseEvent }) => void
}

export const ChartView: React.FC<ChartViewProps> = ({ chartConfig, queryResult, style = { width: '100%', height: '500px' }, className = '', onPointClick }) => {
  const chartOption: EChartsOption | null = React.useMemo(() => {
    if (!queryResult?.data?.length) return null
    const renderer = createRenderer(queryResult.data, chartConfig)
    return renderer.buildOptions()
  }, [queryResult, chartConfig])

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
        inst.on('click', (p: unknown) => {
          try {
            const renderer = createRenderer(queryResult.data, chartConfig)
            const dimValues = renderer.mapClickToDimensionValues(p as { name?: unknown, axisValue?: unknown, seriesIndex?: number, dataIndex?: number, data?: unknown, event?: { event?: unknown } })
            onPointClick({
              dimensionValues: dimValues,
              event: ((p as { event?: { event?: unknown } })?.event?.event) as MouseEvent | undefined
            })
          } catch { /* noop */ }
        })
      }
    } else {
      inst.clear()
      inst.off('click')
    }
  }, [chartOption, onPointClick, queryResult.data, chartConfig])

  return (
    <div className={className} style={style}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
