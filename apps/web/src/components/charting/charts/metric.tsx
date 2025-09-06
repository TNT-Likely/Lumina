import React from 'react'
import type { EChartsOption } from 'echarts'
import { ChartRendererBase } from './base'

// Metric/KPI 用纯文本渲染，返回空 ECharts 配置，由上层容器特殊处理（此处提供数据提取辅助）
export class MetricRenderer extends ChartRendererBase {
  buildOptions (): EChartsOption {
    return {}
  }

  getDisplayValue (): string {
    const m = this.config.metrics[0]
    const key = this.getMetricKey(m)
    const v = this.data[0]?.[key]
    return typeof v === 'number' ? String(v) : (typeof v === 'string' ? v : '0')
  }
}
