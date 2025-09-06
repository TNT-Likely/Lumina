// src/components/ChartBuilder/components/DataSourcePanel.tsx
import React from 'react'
import { Card, Select, Spin, Typography, Divider, Tooltip } from 'antd'
import DraggableField from './draggableField'
import type { DatasetField, Dataset } from '@lumina/types'

const { Title, Text } = Typography
const { Option } = Select

interface DataSourcePanelProps {
  datasets: Dataset[]
  selectedDataset: number | null
  fields: DatasetField[]
  loading: boolean
  onDatasetChange: (datasetId: number) => void
}

const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  datasets,
  selectedDataset,
  fields,
  loading,
  onDatasetChange
}) => {
  const dimensionFields = fields.filter(f => f.isDimension)
  const metricFields = fields.filter(f => f.isMetric)

  return (
    <div className="data-source-panel">
      <Card title="数据源选择" size="small" className="data-source-card" extra={selectedDataset ? <a href={`/dataset/edit?id=${selectedDataset}`} target="_blank" rel="noreferrer">前往数据集</a> : null}>
        <Select
          placeholder="选择数据集"
          style={{ width: '100%' }}
          value={selectedDataset}
          onChange={onDatasetChange}
          loading={loading}
        >
          {datasets.map(dataset => (
            <Option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </Option>
          ))}
        </Select>
      </Card>

      {selectedDataset && (
        <Spin spinning={loading}>
          <Card title="字段列表" size="small" className="fields-panel">
            <div className="fields-halves">
              {/* 维度半区 */}
              <div className="fields-half">
                {dimensionFields.length > 0 && (
                  <>
                    <Text>维度字段</Text>
                    <div className="fields-list-scroll">
                      {dimensionFields.map(field => (
                        <Tooltip
                          key={field.identifier}
                          title={
                            <div>
                              <div><strong>名称:</strong> {field.name}</div>
                              <div><strong>标识符:</strong> {field.identifier}</div>
                              <div><strong>类型:</strong> {field.type}</div>
                              {field.description && <div><strong>描述:</strong> {field.description}</div>}
                              <div><strong>表达式:</strong> {field.expression}</div>
                            </div>
                          }
                          placement="right"
                        >
                          <div className="compact-field-item">
                            <DraggableField field={field} />
                          </div>
                        </Tooltip>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <Divider />

              {/* 指标半区 */}
              <div className="fields-half">
                {metricFields.length > 0 && (
                  <>
                    <Text>指标字段</Text>
                    <div className="fields-list-scroll">
                      {metricFields.map(field => (
                        <Tooltip
                          key={field.identifier}
                          title={
                            <div>
                              <div><strong>名称:</strong> {field.name}</div>
                              <div><strong>标识符:</strong> {field.identifier}</div>
                              <div><strong>类型:</strong> {field.type}</div>
                              {field.description && <div><strong>描述:</strong> {field.description}</div>}
                              <div><strong>表达式:</strong> {field.expression}</div>
                            </div>
                          }
                          placement="right"
                        >
                          <div className="compact-field-item">
                            <DraggableField field={field} />
                          </div>
                        </Tooltip>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </Spin>
      )}
    </div>
  )
}

export default DataSourcePanel
