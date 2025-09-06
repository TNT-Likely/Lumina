import React, { useEffect, useState } from 'react'
import { Modal, Space, Typography, message, Card, Tabs, Empty, Tooltip, List } from 'antd'
import { DatabaseOutlined, TableOutlined } from '@ant-design/icons'
import { datasourceApi, datasetApi } from '@lumina/api'
import type { Datasource } from '@lumina/types'
// 注意：此弹窗不再需要路由

const { Text } = Typography

// 左侧改为简单列表

export interface DataSourcePickerProps {
  open: boolean
  onCancel: () => void
  onPicked: (picked: { source: Datasource, schema?: string, table: string }) => void
  initialSourceId?: number
  onPickedDataset?: (dataset: { id: number; name: string; sourceId?: number }) => void
  initialTab?: 'datasets' | 'tables'
}

const DataSourcePicker: React.FC<DataSourcePickerProps> = ({ open, onCancel, onPicked, initialSourceId, onPickedDataset, initialTab }) => {
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [activeDs, setActiveDs] = useState<Datasource | null>(null)
  const [dsDatasets, setDsDatasets] = useState<Record<number, Array<{ id: number, name: string }>>>({})
  const [dsTables, setDsTables] = useState<Record<number, Array<{ schema?: string, name: string }>>>({})
  const [activeTab, setActiveTab] = useState<'datasets' | 'tables'>(initialTab || 'datasets')

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const res = await datasourceApi.list({ page: 1, pageSize: 200 })
        const list = res.list || []
        setDatasources(list)
        const ds = initialSourceId ? list.find((d: { id: number|string }) => Number(d.id) === Number(initialSourceId)) : list[0]
        if (ds) {
          setActiveDs(ds as Datasource)
          await loadDs(ds as Datasource)
        }
      } catch (e) {
        console.error(e)
        message.error('加载数据源失败')
      }
    })()
    setActiveTab(initialTab || 'datasets')
  }, [open, initialSourceId, initialTab])

  const loadDs = async (ds: Datasource) => {
    try {
      const schemas = await datasourceApi.listSchemas(Number(ds.id))
      const datasetList = await datasetApi.list({ page: 1, pageSize: 100, sourceId: Number(ds.id) })
      setDsDatasets(prev => ({ ...prev, [Number(ds.id)]: (datasetList.list || []).map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })) }))
      let tablesChildren: Array<{ schema?: string; name: string }> = []
      if ((schemas || []).length > 0) {
        const allTables = await Promise.all(schemas.map((sc: string) => datasourceApi.listTables(Number(ds.id), sc)))
        const flattened = allTables.flat()
        setDsTables(prev => ({ ...prev, [Number(ds.id)]: flattened as Array<{ schema?: string; name: string }> }))
        tablesChildren = (flattened as Array<{ schema?: string; name: string }>).map((t) => ({ schema: t.schema, name: t.name }))
      } else {
        const tables = await datasourceApi.listTables(Number(ds.id))
        setDsTables(prev => ({ ...prev, [Number(ds.id)]: (tables || []) as Array<{ schema?: string; name: string }> }))
        tablesChildren = (tables || []).map((t: { schema?: string; name: string }) => ({ schema: t.schema, name: t.name }))
      }
    } catch (e) {
      console.error(e)
      message.error('加载库/表失败')
    }
  }

  // 选择在右侧卡片点击回调中触发

  const activeDsIdNum = activeDs ? Number(activeDs.id) : undefined
  const dsCount = activeDsIdNum ? (dsDatasets[activeDsIdNum]?.length || 0) : 0
  const tblCount = activeDsIdNum ? (dsTables[activeDsIdNum]?.length || 0) : 0
  return (
    <Modal open={open} onCancel={onCancel} onOk={onCancel} width={1200} title="选择数据源/数据集/表" destroyOnClose>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
        <div style={{ maxHeight: '70vh', overflow: 'auto', paddingRight: 4 }}>
          <List
            size="small"
            dataSource={datasources}
            renderItem={(ds) => (
              <List.Item
                key={String(ds.id)}
                onClick={async () => { setActiveDs(ds); await loadDs(ds) }}
                style={{
                  cursor: 'pointer',
                  background: activeDs && Number(activeDs.id) === Number(ds.id) ? 'rgba(22,119,255,0.08)' : 'transparent',
                  borderRadius: 8,
                  margin: '2px 4px',
                  padding: '6px 8px'
                }}
              >
                <Space size={6}>
                  <DatabaseOutlined />
                  <span>{ds.name}</span>
                </Space>
              </List.Item>
            )}
          />
        </div>
        <div>
          <Tabs
            activeKey={activeTab}
            onChange={k => setActiveTab(k as 'datasets' | 'tables')}
            items={[
              { key: 'datasets', label: `数据集${activeDs ? `（${dsCount}）` : ''}` },
              { key: 'tables', label: `数据表${activeDs ? `（${tblCount}）` : ''}` }
            ]}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
              maxHeight: '66vh',
              overflow: 'auto',
              paddingRight: 4
            }}
          >
            {activeTab === 'datasets' && (
              (activeDs && (dsDatasets[Number(activeDs.id)] || []).length > 0)
                ? (dsDatasets[Number(activeDs.id)] || []).map((d: { id: number; name: string }) => (
                  <Card
                    key={d.id}
                    hoverable
                    onClick={() => { onPickedDataset?.({ id: d.id, name: d.name, sourceId: Number(activeDs?.id) }) }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <Card.Meta
                      title={(
                        <Tooltip title={d.name} placement="top">
                          <Text ellipsis style={{ width: '100%', display: 'inline-block' }}>{d.name}</Text>
                        </Tooltip>
                      )}
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>#{d.id}</Text>
                      }
                    />
                  </Card>
                ))
                : <Empty description={activeDs ? '该数据源下暂无数据集' : '请选择左侧数据源以浏览数据集'} />
            )}
            {activeTab === 'tables' && (
              (activeDs && (dsTables[Number(activeDs.id)] || []).length > 0)
                ? (dsTables[Number(activeDs.id)] || []).map((t: { schema?: string; name: string }) => (
                  <Card
                    key={`${t.schema || 'default'}.${t.name}`}
                    hoverable
                    onClick={() => { if (activeDs) { onPicked({ source: activeDs, schema: t.schema, table: t.name }) } }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <Card.Meta
                      title={(
                        <Tooltip title={t.name} placement="top">
                          <Text ellipsis style={{ width: '100%', display: 'inline-block' }}>{t.name}</Text>
                        </Tooltip>
                      )}
                      description={(
                        <Tooltip title={t.schema ? `${t.schema}.${t.name}` : t.name} placement="top">
                          <Text type="secondary" ellipsis style={{ width: '100%', display: 'inline-block' }}>{t.schema ? `${t.schema}.${t.name}` : t.name}</Text>
                        </Tooltip>
                      )}
                    />
                  </Card>
                ))
                : <Empty description={activeDs ? '该数据源下暂无表' : '请选择左侧数据源以浏览其下的表'} />
            )}
          </div>
          <Text type="secondary">点击表将自动创建默认数据集。</Text>
        </div>
      </div>
    </Modal>
  )
}

export default DataSourcePicker
