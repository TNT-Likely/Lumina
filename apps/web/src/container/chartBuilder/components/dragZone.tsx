// src/components/ChartBuilder/components/DropZone.tsx
import React from 'react'
import { Card, Space, Typography, Tag, Empty, Button, Select, Tooltip } from 'antd'
import { useDrop } from 'react-dnd'
import { type FieldUsage } from '../types'
import { AGGREGATION_TYPES } from '../constants'
import type { DatasetField } from '@lumina/types'

const { Title, Text } = Typography
const { Option } = Select

interface DropZoneProps {
  title: string
  items: FieldUsage[]
  onDrop: (field: DatasetField) => void
  onRemove: (index: number) => void
  onUpdateAggregation: (index: number, aggregation: string) => void
  type: 'dimensions' | 'metrics' | 'filters'
}

const DropZone: React.FC<DropZoneProps> = ({
  title,
  items,
  onDrop,
  onRemove,
  onUpdateAggregation,
  type
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

  const getApplicableAggregations = (fieldType: string) => {
    return AGGREGATION_TYPES.filter(agg => agg.applicable.includes(fieldType))
  }

  return (
    <div
      ref={drop}
      className={`drop-zone ${isOver ? 'drop-zone-hover' : ''}`}
    >
      <div className="drop-zone-header">
        <Title level={5}>{title}</Title>
        <Text type="secondary">拖拽字段到此处</Text>
      </div>

      <div className="drop-zone-content">
        {items.length === 0
          ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无字段"
              style={{ margin: '20px 0' }}
            />
          )
          : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {items.map((item, index) => (
                <Card key={index} size="small" className="field-usage-card">
                  <div className="field-usage-content">
                    <div className="field-usage-info">
                      <Tooltip title={`描述: ${item.field.description || '无'} | 表达式: ${item.field.expression}`}>
                        <Text strong>{item.field.name}</Text>
                      </Tooltip>
                      <Tag color={item.field.isDimension ? 'cyan' : 'magenta'}>
                        {item.field.type}
                      </Tag>
                    </div>

                    {type === 'metrics' && (
                      <Select
                        size="small"
                        value={item.aggregationType || 'count'}
                        style={{ width: 120, marginLeft: 8 }}
                        onChange={(value) => { onUpdateAggregation(index, value) }}
                      >
                        {getApplicableAggregations(item.field.type).map(agg => (
                          <Option key={agg.key} value={agg.key}>
                            {agg.name}
                          </Option>
                        ))}
                      </Select>
                    )}

                    <Button
                      type="text"
                      size="small"
                      danger
                      onClick={() => { onRemove(index) }}
                      style={{ marginLeft: 8 }}
                    >
                    移除
                    </Button>
                  </div>
                </Card>
              ))}
            </Space>
          )}
      </div>
    </div>
  )
}

export default DropZone
