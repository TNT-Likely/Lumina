// src/components/ChartBuilder/components/FilterDropZone.tsx
import React from 'react'
import { Card, Typography, Empty, Button, Select, Input, Tooltip, Dropdown, Popover, Space, Spin } from 'antd'
import { CloseOutlined, DownOutlined } from '@ant-design/icons'
import { useDrop } from 'react-dnd'
import { type FilterConfig } from '../types'
import { DatasetField } from '@lumina/types'
import { datasetApi } from '@lumina/api'
import { getFieldTextColor } from '../../../constants/fieldColors'

const { Title, Text } = Typography
const { Option } = Select

interface FilterDropZoneProps {
  filters: FilterConfig[]
  onDrop: (field: DatasetField) => void
  onRemove: (index: number) => void
  onUpdateFilter: (index: number, config: Partial<FilterConfig>) => void
  datasetId?: number | null
}

const FilterDropZone: React.FC<FilterDropZoneProps> = ({
  filters,
  onDrop,
  onRemove,
  onUpdateFilter,
  datasetId
}) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'field',
    drop: (item: { field: DatasetField }) => {
      onDrop(item.field)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  })

  // 去重值缓存与加载状态
  const [optionsMap, setOptionsMap] = React.useState<Record<string, Array<{ label: string, value: string }>>>({})
  const [loadingMap, setLoadingMap] = React.useState<Record<string, boolean>>({})

  const loadDistinctValues = async (filter: FilterConfig, search?: string) => {
    const fieldId = filter.field.identifier
    if (!filter.field || !fieldId) return
    try {
      setLoadingMap(prev => ({ ...prev, [fieldId]: true }))
      if (!datasetId) {
        // 无法获取 datasetId 时跳过请求
        setLoadingMap(prev => ({ ...prev, [fieldId]: false }))
        return
      }
      // 将当前其他筛选作为上下文传递（排除自身）
      const contextFilters = filters
        .filter(f => f.field.identifier !== fieldId)
        .map(f => ({
          field: { identifier: f.field.identifier, name: f.field.name, type: f.field.type },
          operator: f.operator,
          values: f.values
        }))
      const { values } = await datasetApi.getDistinctValues(Number(datasetId), {
        field: { identifier: fieldId, name: filter.field.name, type: filter.field.type },
        filters: contextFilters as unknown as import('@lumina/api').ChartQueryRequest['filters'],
        limit: 10,
        search
      })
      const opts = (values || []).map(v => ({ label: String(v.label ?? v.value ?? ''), value: String(v.value ?? v.label ?? '') }))
      setOptionsMap(prev => ({ ...prev, [fieldId]: opts }))
    } catch (e) {
      setOptionsMap(prev => ({ ...prev, [fieldId]: [] }))
    } finally {
      setLoadingMap(prev => ({ ...prev, [fieldId]: false }))
    }
  }

  const getFilterOperators = (fieldType: string) => {
    switch (fieldType) {
    case 'STRING':
      return [
        { key: 'equals', name: '等于' },
        { key: 'in', name: '多选包含' },
        { key: 'like', name: '模糊匹配' }
      ]
    case 'INTEGER':
    case 'FLOAT':
      return [
        { key: 'equals', name: '等于' },
        { key: 'gt', name: '大于' },
        { key: 'lt', name: '小于' },
        { key: 'between', name: '区间' }
      ]
    case 'DATE':
      return [
        { key: 'equals', name: '等于' },
        { key: 'between', name: '日期区间' },
        { key: 'gt', name: '晚于' },
        { key: 'lt', name: '早于' }
      ]
    default:
      return [{ key: 'equals', name: '等于' }]
    }
  }

  const renderFilterValueEditor = (filter: FilterConfig, index: number) => {
    const { field, operator } = filter

    if (operator === 'between') {
      return (
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="最小值"
            value={String(filter.values[0] ?? '')}
            onChange={(e) => {
              onUpdateFilter(index, {
                values: [e.target.value, filter.values[1] || '']
              })
            }}
            style={{ width: '50%' }}
          />
          <Input
            placeholder="最大值"
            value={String(filter.values[1] ?? '')}
            onChange={(e) => {
              onUpdateFilter(index, {
                values: [filter.values[0] || '', e.target.value]
              })
            }}
            style={{ width: '50%' }}
          />
        </Space.Compact>
      )
    }

    if (operator === 'in' || operator === 'equals' || operator === 'like') {
      const fieldId = filter.field.identifier
      const opts = optionsMap[fieldId] || []
      const loading = !!loadingMap[fieldId]
      return (
        <Select
          mode={operator === 'in' ? 'multiple' : undefined}
          showSearch
          placeholder={operator === 'in' ? '选择或搜索值（默认显示10个）' : '搜索或输入值'}
          value={operator === 'in'
            ? (Array.isArray(filter.values) ? filter.values.map(v => String(v)) : [])
            : (filter.values?.[0] !== undefined && filter.values?.[0] !== null ? String(filter.values?.[0]) : undefined)
          }
          onSearch={(q) => { loadDistinctValues(filter, q) }}
          onDropdownVisibleChange={(open) => { if (open) loadDistinctValues(filter) }}
          onChange={(v: string | string[]) => {
            if (operator === 'in') onUpdateFilter(index, { values: Array.isArray(v) ? v.map(s => String(s)) : [String(v)] })
            else onUpdateFilter(index, { values: [String(v)] })
          }}
          notFoundContent={loading ? <Spin size="small" /> : null}
          filterOption={false}
          options={opts}
          style={{ width: '100%' }}
        />
      )
    }

    return (
      <Input
        placeholder="输入筛选值"
        value={String(filter.values[0] ?? '')}
        onChange={(e) => { onUpdateFilter(index, { values: [e.target.value] }) }}
      />
    )
  }

  const renderFilterPreview = (filter: FilterConfig) => {
    const { operator, values } = filter
    const opNameMap: Record<string, string> = { equals: '等于', in: '包含', like: '模糊', gt: '>', lt: '<', between: '区间' }
    const valText = Array.isArray(values) ? values.map(v => String(v)).join(operator === 'between' ? ' .. ' : ', ') : ''
    const text = `${opNameMap[operator] || operator} ${valText}`.trim()
    return (
      <span style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text || '未设置'}</span>
    )
  }

  return (
    <div
      ref={drop}
      className={`drop-zone filter-drop-zone ${isOver ? 'drop-zone-hover' : ''}`}
    >
      <div className="drop-zone-header">
        <Title level={5} style={{ marginBottom: 0 }}>筛选器</Title>
        {filters.length === 0 && (
          <Text type="secondary">拖拽字段到此处添加筛选条件</Text>
        )}
      </div>

      <div className="drop-zone-content wrap-chips">
        {filters.length === 0
          ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无筛选器"
              style={{ margin: '20px auto' }}
            />
          )
          : (
            <>
              {filters.map((filter, index) => (
                <Card key={index} size="small" className="filter-config-card compact chip">
                  <div className="filter-config-content">
                    <div className="filter-field-info">
                      <Tooltip title={`类型: ${filter.field.type} | 描述: ${filter.field.description || '无'} | 表达式: ${filter.field.expression}`}>
                        <Text strong className={`field-name-text clickable type-${filter.field.type}`} style={{ color: getFieldTextColor(filter.field.type) }}>{filter.field.name}</Text>
                      </Tooltip>
                    </div>

                    <div className="filter-operator" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Popover
                        trigger="click"
                        content={(
                          <div style={{ width: 260 }}>
                            <div style={{ marginBottom: 8 }}>
                              <Select
                                value={filter.operator}
                                onChange={(k) => { onUpdateFilter(index, { operator: k as FilterConfig['operator'], values: [] }) }}
                                options={getFilterOperators(filter.field.type).map(op => ({ label: op.name, value: op.key }))}
                                style={{ width: '100%' }}
                              />
                            </div>
                            {renderFilterValueEditor(filter, index)}
                          </div>
                        )}
                      >
                        <span className="field-name-trigger" role="button">
                          <DownOutlined className="caret" />
                          <span className="paren">（{renderFilterPreview(filter)}）</span>
                        </span>
                      </Popover>
                    </div>

                    <Tooltip title="移除">
                      <Button
                        type="text"
                        size="small"
                        danger
                        onClick={() => { onRemove(index) }}
                        icon={<CloseOutlined />}
                        className="chip-action"
                      />
                    </Tooltip>
                  </div>
                </Card>
              ))}
            </>
          )}
      </div>
    </div>
  )
}

export default FilterDropZone
