import React from 'react'
import { Card, Table } from 'antd'
import type { ChartConfig } from '../../charting/types'
import type { DataRow } from '../charts/base'

interface DataTableProps {
  config: ChartConfig
  data: DataRow[]
  totalCount?: number
  style?: React.CSSProperties
  // 可选：下钻回调。点击一行时回调该行原始数据
  onDrillDown?: (row: DataRow) => void
}

const DataTable: React.FC<DataTableProps> = ({ config, data, totalCount, style, onDrillDown }) => {
  const columns = React.useMemo(() => {
    const cols = Object.keys(data?.[0] || {})
    return cols.map((key) => {
      // 友好列名映射：优先展示 alias，但数据键使用稳定键
      let title: string = key
      const dim = config.dimensions.find((d) => d.field.identifier === key)
      if (dim) {
        title = dim.alias || dim.field.name
      } else {
        const met = config.metrics.find((m) => `${m.field.identifier}_${m.aggregationType}` === key)
        if (met) title = met.alias || `${met.field.name}(${met.aggregationType})`
      }
      // 尝试获取该维度的映射表
      const valueMap = dim?.field?.valueMap as Array<{ value: string | number | boolean | null, label: string }> | undefined
      const mapVal = (v: unknown) => {
        if (!valueMap) return v
        const hit = valueMap.find(m => m.value === v || String(m.value) === String(v))
        return hit ? hit.label : v
      }
      return {
        title,
        dataIndex: key,
        key,
        sorter: (a: DataRow, b: DataRow) => {
          const aVal = a[key]
          const bVal = b[key]
          if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            const aNum = parseFloat(aVal)
            const bNum = parseFloat(bVal)
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
          }
          return String(aVal).localeCompare(String(bVal))
        },
        render: (value: unknown) => {
          // 字段值映射（仅维度列）
          if (dim) {
            const mapped = mapVal(value)
            if (typeof mapped === 'string' || typeof mapped === 'number') return mapped
          }
          if (typeof value === 'number') return value.toLocaleString()
          if (typeof value === 'string' && !isNaN(parseFloat(value))) return parseFloat(value).toLocaleString()
          return value as React.ReactNode
        }
      }
    })
  }, [data, config.dimensions, config.metrics])
  const pageSize = (config.settings?.pageSize as number) || 50
  // 使表格在容器内自适应高度：Card 填满容器，Table 使用 scroll.y
  const mergedStyle: React.CSSProperties = { height: '100%', display: 'flex', flexDirection: 'column', ...style }
  return (
    <Card size="small" style={mergedStyle} bodyStyle={{ padding: 0, flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={data.map((row, i) => ({ ...row, key: i }))}
          size="small"
          pagination={{ pageSize, total: totalCount }}
          scroll={{ x: true }}
          onRow={(record) => ({
            onClick: () => {
              if (onDrillDown) {
                const { key, ...raw } = record as DataRow & { key?: React.Key }
                onDrillDown(raw as DataRow)
              }
            }
          })}
        />
      </div>
    </Card>
  )
}

export default DataTable
