// src/components/ChartBuilder/components/DropZone.tsx
import React from 'react'
import { Card, Typography, Empty, Button, Tooltip, Dropdown } from 'antd'
import { CloseOutlined, DownOutlined } from '@ant-design/icons'
import { useDrop } from 'react-dnd'
import { type FieldUsage } from '../types'
import { AGGREGATION_TYPES } from '../constants'
import { DatasetField } from '@lumina/types'
import { getFieldTextColor } from '../../../constants/fieldColors'

const { Title, Text } = Typography

interface DropZoneProps {
  title: string
  items: FieldUsage[]
  onDrop: (field: DatasetField) => void
  onRemove: (index: number) => void
  onUpdateAggregation?: (index: number, aggregation: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct') => void
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
        <Title level={5} style={{ marginBottom: 0 }}>{title}</Title>
        {items.length === 0 && (
          <Text type="secondary">拖拽字段到此处</Text>
        )}
      </div>

      <div className="drop-zone-content wrap-chips">
        {items.length === 0
          ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无字段"
              style={{ margin: '20px auto' }}
            />
          )
          : (
            <>
              {items.map((item, index) => (
                <Card key={index} size="small" className="field-usage-card compact chip">
                  <div className="field-usage-content">
                    {type === 'metrics'
                      ? (
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: getApplicableAggregations(item.field.type).map(agg => ({ key: agg.key, label: agg.name })),
                            onClick: ({ key }) => {
                              const k = key as 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct'
                              onUpdateAggregation?.(index, k)
                            }
                          }}
                        >
                          <span className="field-name-trigger" role="button">
                            <Tooltip title={`类型: ${item.field.type} | 描述: ${item.field.description || '无'} | 表达式: ${item.field.expression}`}>
                              <Text
                                strong
                                className={`field-name-text clickable type-${item.field.type}`}
                                style={{ color: getFieldTextColor(item.field.type) }}
                              >
                                {item.field.name}
                              </Text>
                            </Tooltip>
                            <DownOutlined className="caret" />
                            {(() => {
                              const sel = getApplicableAggregations(item.field.type).find(a => a.key === (item.aggregationType || 'count'))?.name || '计数'
                              return <span className="paren">（{sel}）</span>
                            })()}
                          </span>
                        </Dropdown>
                      )
                      : (
                        <div className="field-usage-info">
                          <Tooltip title={`类型: ${item.field.type} | 描述: ${item.field.description || '无'} | 表达式: ${item.field.expression}`}>
                            <Text strong className={`field-name-text type-${item.field.type}`} style={{ color: getFieldTextColor(item.field.type) }}>{item.field.name}</Text>
                          </Tooltip>
                        </div>
                      )}

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

export default DropZone
