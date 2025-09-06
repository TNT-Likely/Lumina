import React, { useEffect, useMemo, useState } from 'react'
import { canCreate, isOwner } from '../../utils/perm'
import { Card, List, Typography, Space, Skeleton, Button, Empty, message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardApi, datasetApi, datasourceApi, viewApi, OrgApi } from '@lumina/api'
import type { Dashboard, Dataset, Datasource, View } from '@lumina/types'
import DataSourcePicker from '../../components/dataset/DataSourcePicker'
import QuickCreateDatasourceModal from '../../components/datasource/QuickCreateDatasourceModal'
import SampleDataModal from '../../components/dataset/SampleDataModal'
import { useAppContext } from '../../context/AppContext'

const { Title, Text } = Typography

type Item = { id: number | string, name?: string, title?: string, createdAt?: string }

function pickList<T extends { id: number | string }> (resp: unknown): T[] {
  if (resp && typeof resp === 'object') {
    const r = resp as Record<string, unknown>
    const list = r.list ?? r.data
    if (Array.isArray(list)) return list as T[]
  }
  return []
}

export default function Home () {
  const [loading, setLoading] = useState(true)
  const [dashboards, setDashboards] = useState<Item[]>([])
  const [datasets, setDatasets] = useState<Item[]>([])
  const [datasources, setDatasources] = useState<Item[]>([])
  const [views, setViews] = useState<Item[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerInitSource, setPickerInitSource] = useState<number | undefined>(undefined)
  const [createDsOpen, setCreateDsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null)
  const navigate = useNavigate()
  const { userId: currentUserId, currentOrg } = useAppContext()
  const currentOrgRole = (currentOrg?.role === 'ADMIN' || currentOrg?.role === 'EDITOR' || currentOrg?.role === 'VIEWER') ? currentOrg.role : null

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      try {
        const [dsh, dts, dss, vws] = await Promise.all([
          dashboardApi.list({ page: 1, pageSize: 5 }),
          datasetApi.list({ page: 1, pageSize: 5 }),
          datasourceApi.list({ page: 1, pageSize: 5 }),
          viewApi.list({ page: 1, pageSize: 5 })
        ])
        if (!mounted) return
        // 兼容不同返回结构：优先 list，其次 data
        setDashboards(pickList<Dashboard>(dsh).slice(0, 5))
        setDatasets(pickList<Dataset>(dts).slice(0, 5))
        setDatasources(pickList<Datasource>(dss).slice(0, 5))
        setViews(pickList<View>(vws).slice(0, 5))
      } catch (e) {
        // 忽略首页加载错误，展示空态
        console.error(e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [])

  // 角色/用户由 AppContext 提供，无需重复请求

  // global events from sidebar
  useEffect(() => {
    const onOpenCreateDs = () => setCreateDsOpen(true)
    const onOpenPicker = (e: Event) => {
      setPickerInitSource(undefined)
      setPickerOpen(true)
    }
    window.addEventListener('lumina:openCreateDatasource', onOpenCreateDs as EventListener)
    window.addEventListener('lumina:openDataSourcePicker', onOpenPicker as EventListener)
    return () => {
      window.removeEventListener('lumina:openCreateDatasource', onOpenCreateDs as EventListener)
      window.removeEventListener('lumina:openDataSourcePicker', onOpenPicker as EventListener)
    }
  }, [])

  const renderList = (title: string, items: Item[], emptyText: string, moreLink: string, onItemClick?: (id: number|string) => void) => (
    <Card title={title} extra={<Link to={moreLink}>更多</Link>} size="small" bodyStyle={{ paddingTop: 8 }}>
      {loading
        ? <Skeleton active paragraph={{ rows: 4 }} />
        : (
          <List
            locale={{ emptyText }}
            dataSource={items}
            renderItem={(item) => (
              <List.Item onClick={() => onItemClick?.(item.id)} style={{ cursor: onItemClick ? 'pointer' : 'default' }}>
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Text strong ellipsis>{(item as Item).name || (item as Item).title || `#${item.id}`}</Text>
                  {item.createdAt && <Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Text>}
                </Space>
              </List.Item>
            )}
          />
        )}
    </Card>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Card>
          <Space direction="vertical" size={6}>
            <Title level={4} style={{ margin: 0 }}>欢迎使用 Lumina</Title>
            <Text type="secondary">快速开始：创建数据源 → 数据集 → 视图/仪表盘 → 通知/订阅</Text>
            <Space wrap>
              {canCreate(currentOrgRole) && <Button type="primary" onClick={() => setCreateDsOpen(true)}>新建数据源</Button>}
              {canCreate(currentOrgRole) && <Button onClick={() => { setPickerInitSource(undefined); setPickerOpen(true) }}>新建数据集</Button>}
              {canCreate(currentOrgRole) && <Button onClick={() => navigate('/chartBuilder')}>新建视图</Button>}
              {canCreate(currentOrgRole) && <Button onClick={() => navigate('/dashboard')}>新建仪表盘</Button>}
            </Space>
          </Space>
        </Card>
      </div>

      {renderList(
        '最近仪表盘',
        dashboards as (Dashboard & { canWrite?: boolean })[],
        '暂无仪表盘',
        '/dashboard/list',
        async (id) => {
          // 直接使用列表返回的 canWrite 标记，避免额外详情请求
          const item = (dashboards as Array<Dashboard & { canWrite?: boolean }>).find(d => d.id === id)
          if (item && item.canWrite) {
            navigate(`/dashboard/edit?id=${id}`)
          } else {
            navigate(`/dashboard/preview?id=${id}`)
          }
        }
      )}
      {renderList('最近数据集', datasets as Dataset[], '暂无数据集', '/dataset/list', (id) => {
        const item = datasets.find(ds => ds.id === id)
        if (item && isOwner(currentUserId, (item as { ownerId?: number }).ownerId)) {
          navigate(`/dataset/edit?id=${id}`)
        } else {
          navigate(`/dataset/edit?id=${id}&mode=readonly`)
        }
      })}
      {renderList('最近数据源', datasources as Datasource[], '暂无数据源', '/dataSource/list', (id) => { setPickerInitSource(Number(id)); setPickerOpen(true) })}
      {renderList('最近视图', views as View[], '暂无视图', '/view/list', (id) => {
        const item = views.find(v => v.id === id) as (View & { canWrite?: boolean }) | undefined
        if (item && (item.canWrite || isOwner(currentUserId, (item as { ownerId?: number }).ownerId))) {
          navigate(`/chartBuilder?viewId=${id}`)
        } else {
          navigate(`/view/preview?id=${id}`)
        }
      })}

      {/* 空态：没有任何数据源时，引导在本页创建 */}
      {!loading && (datasources?.length ?? 0) === 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Card>
            <Empty description={<span>还没有数据源，创建一个开始你的数据之旅</span>}>
              <Button type="primary" onClick={() => setCreateDsOpen(true)}>快速创建数据源</Button>
            </Empty>
          </Card>
        </div>
      )}
      <DataSourcePicker
        open={pickerOpen}
        initialSourceId={pickerInitSource}
        initialTab="tables"
        onCancel={() => { setPickerOpen(false); setPickerInitSource(undefined) }}
        onPicked={async ({ source, schema, table }) => {
          setPickerOpen(false)
          try {
            // 自动从所选表创建数据集，并打开预览 Modal
            const columns = await datasourceApi.listColumns(Number(source.id), table, schema)
            const mapType = (t: string): import('@lumina/types').FieldType => {
              const s = t.toLowerCase()
              if (s.includes('int')) return 'INTEGER'
              if (s.includes('float') || s.includes('double') || s.includes('decimal') || s.includes('number') || s.includes('numeric')) return 'FLOAT'
              if (s.includes('bool')) return 'BOOLEAN'
              if (s.includes('timestamp')) return 'TIMESTAMP'
              if (s.includes('date') || s.includes('time')) return 'DATE'
              return 'STRING'
            }
            const fields: import('@lumina/types').DatasetField[] = (columns || []).map((c, idx) => ({
              identifier: `${c.name.replace(/\s+/g, '_').toLowerCase()}_${idx}`,
              name: c.name,
              type: mapType(c.type || 'STRING'),
              expression: c.name,
              isDimension: !['FLOAT', 'INTEGER'].includes(mapType(c.type || 'STRING')),
              isMetric: ['FLOAT', 'INTEGER'].includes(mapType(c.type || 'STRING'))
            }))
            const ds = await datasetApi.create({
              name: schema ? `${schema}.${table}` : table,
              sourceId: Number(source.id),
              fields,
              baseTable: table,
              baseSchema: schema
            })
            setPreviewDataset(ds)
            setPreviewOpen(true)
          } catch (e) {
            console.error(e)
            message.error('创建数据集失败')
          }
        }}
        onPickedDataset={async (d) => {
          try {
            // 加载字段并打开预览
            const ds = await datasetApi.get(Number(d.id))
            setPreviewDataset(ds)
            setPreviewOpen(true)
            setPickerOpen(false)
          } catch (e) {
            console.error(e)
            message.error('打开数据集预览失败')
          }
        }}
      />

      <QuickCreateDatasourceModal
        open={createDsOpen}
        onClose={() => setCreateDsOpen(false)}
        onSuccess={async () => {
          // 刷新最近列表
          try {
            const dss = await datasourceApi.list({ page: 1, pageSize: 5 })
            setDatasources(pickList<Datasource>(dss).slice(0, 5))
          } catch {}
        }}
      />

      <SampleDataModal open={previewOpen} dataset={previewDataset} onClose={() => setPreviewOpen(false)} />
    </div>
  )
}
