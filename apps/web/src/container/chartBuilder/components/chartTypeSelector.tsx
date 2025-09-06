// src/components/ChartBuilder/components/ChartTypeSelector.tsx
import React from 'react'
import { Card, Typography, Tooltip } from 'antd'
import { type FieldUsage } from '../types'
import { CHART_TYPES } from '../../../components/charting/constants'

const { Title, Text } = Typography

interface ChartTypeSelectorProps {
  selectedType: string
  onSelect: (type: string) => void
  dimensions: FieldUsage[]
  metrics: FieldUsage[]
  iconOnly?: boolean
  columns?: number
}

const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({
  selectedType,
  onSelect,
  dimensions,
  metrics,
  iconOnly = false,
  columns
}) => {
  const isChartTypeValid = (chartType: typeof CHART_TYPES[number]) => {
  // 饼图只允许一个指标
    if (chartType.key === 'pie' && metrics.length > 1) return false
    return (
      dimensions.length >= chartType.minDimensions &&
      metrics.length >= chartType.minMetrics
    )
  }

  return (
    <div className={`chart-type-selector ${iconOnly ? 'icon-only' : ''}`}>
      <div className="chart-types-grid" style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}>
        {CHART_TYPES.map(chartType => {
          let tip = `需要至少 ${chartType.minDimensions} 个维度，${chartType.minMetrics} 个指标`
          if (chartType.key === 'pie' && metrics.length > 1) {
            tip = `${chartType.name}仅支持单一指标`
          }
          return (
            <Tooltip
              key={chartType.key}
              title={<div style={{ display: 'flex', flexDirection: 'column' }}><span>{tip}</span><span style={{ color: '#999' }}>类型: {chartType.name}（{chartType.key}）</span></div>}
            >
              <Card
                size="small"
                className={`chart-type-card ${selectedType === chartType.key ? 'selected' : ''
                } ${isChartTypeValid(chartType) ? '' : 'disabled'}`}
                onClick={() => { isChartTypeValid(chartType) && onSelect(chartType.key) }}
              >
                <div className="chart-type-content">
                  {chartType.icon}
                  {!iconOnly && <Text>{chartType.name}</Text>}
                </div>
              </Card>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

export default ChartTypeSelector
