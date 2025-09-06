import React from 'react'
import { Card, Statistic } from 'antd'
import type { ChartConfig } from '../../charting/types'
import type { DataRow } from '../charts/base'

interface KPIProps {
  config: ChartConfig
  data: DataRow[]
  style?: React.CSSProperties
}

const KPI: React.FC<KPIProps> = ({ config, data, style }) => {
  const metric = config.metrics[0]
  const key = metric ? `${metric.field.identifier}_${metric.aggregationType}` : ''
  const raw = key ? (data?.[0]?.[key] as number | string | undefined) : undefined
  const prefix = (config.settings?.valuePrefix as string) || ''
  const suffix = (config.settings?.valueSuffix as string) || ''
  const decimals = (config.settings?.decimals as number) ?? 0
  const empty = (config.settings?.emptyPlaceholder as string) || '-'
  const num = typeof raw === 'string' ? Number(raw) : (raw as number | undefined)
  const formatted = num === undefined || Number.isNaN(num)
    ? empty
    : Number(num).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (
    <Card size="small" style={style} bodyStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Statistic title={config.title || metric?.field.name} value={formatted} prefix={prefix} suffix={suffix} />
    </Card>
  )
}

export default KPI
