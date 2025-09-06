import React from 'react'
import { Card, Progress as AntProgress, Typography } from 'antd'
import type { ChartConfig } from '../../charting/types'
import type { DataRow } from '../charts/base'

const { Text } = Typography

interface ProgressProps {
  config: ChartConfig
  data: DataRow[]
  style?: React.CSSProperties
}

const Progress: React.FC<ProgressProps> = ({ config, data, style }) => {
  const metric = config.metrics[0]
  const key = metric ? `${metric.field.identifier}_${metric.aggregationType}` : ''
  const raw = key ? (data?.[0]?.[key] as number | string | undefined) : undefined
  const value = typeof raw === 'string' ? parseFloat(raw) : (raw as number | undefined)
  const max = (config.settings?.maxValue as number) || 100
  const percent = Math.max(0, Math.min(100, ((value || 0) / max) * 100))
  const suffix = (config.settings?.valueSuffix as string) || '%'
  const decimals = (config.settings?.decimals as number) ?? 0
  const empty = (config.settings?.emptyPlaceholder as string) || '-'
  const display = value === undefined || Number.isNaN(value)
    ? empty
    : Number(value).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const variant = (config.settings?.variant as 'line' | 'circle' | 'dashboard') || 'line'
  const percentVal = parseFloat(percent.toFixed(2))
  return (
    <Card size="small" style={style} bodyStyle={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: variant === 'line' ? 'stretch' : 'center' }}>
        <Text type="secondary">{config.title || metric?.field.name}</Text>
        {variant === 'line' && (
          <AntProgress percent={percentVal} />
        )}
        {variant === 'circle' && (
          <AntProgress type="circle" percent={percentVal} />
        )}
        {variant === 'dashboard' && (
          <AntProgress type="dashboard" percent={percentVal} />
        )}
        <div style={{ textAlign: 'right', width: '100%' }}>
          <Text>{display} {suffix}</Text>
        </div>
      </div>
    </Card>
  )
}

export default Progress
