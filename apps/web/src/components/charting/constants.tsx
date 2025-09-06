import React from 'react'
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  AreaChartOutlined,
  DotChartOutlined,
  HeatMapOutlined,
  RadarChartOutlined,
  StockOutlined,
  DashboardOutlined,
  FieldNumberOutlined,
  TableOutlined
} from '@ant-design/icons'
import type { ChartType } from './types'

export const CHART_TYPES: ChartType[] = [
  { key: 'bar', name: '柱状图', icon: <BarChartOutlined />, minDimensions: 1, minMetrics: 1 },
  { key: 'horizontal_bar', name: '条形图', icon: <BarChartOutlined rotate={90} />, minDimensions: 1, minMetrics: 1 },
  { key: 'line', name: '折线图', icon: <LineChartOutlined />, minDimensions: 1, minMetrics: 1 },
  { key: 'pie', name: '饼图', icon: <PieChartOutlined />, minDimensions: 1, minMetrics: 1 },
  { key: 'area', name: '面积图', icon: <AreaChartOutlined />, minDimensions: 1, minMetrics: 1 },
  { key: 'scatter', name: '散点图', icon: <DotChartOutlined />, minDimensions: 1, minMetrics: 2 },
  { key: 'candlestick', name: 'K 线图', icon: <StockOutlined />, minDimensions: 1, minMetrics: 4 },
  { key: 'radar', name: '雷达图', icon: <RadarChartOutlined />, minDimensions: 1, minMetrics: 1 },
  { key: 'heatmap', name: '热力图', icon: <HeatMapOutlined />, minDimensions: 2, minMetrics: 1 },
  // 非 ECharts 卡片类
  { key: 'kpi', name: '数值卡', icon: <FieldNumberOutlined />, minDimensions: 0, minMetrics: 1 },
  { key: 'progress', name: '进度卡', icon: <DashboardOutlined />, minDimensions: 0, minMetrics: 1 },
  { key: 'table', name: '表格', icon: <TableOutlined />, minDimensions: 0, minMetrics: 1 }
]

// 注意：聚合函数是查询/构建器领域，与图表渲染无关，放回构建器 constants
