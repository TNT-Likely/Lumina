import React, { useEffect, useMemo, useState } from 'react'
import { Input, Table, Dropdown, Button, Space, Typography, message, Tree, Empty } from 'antd'
import type { TreeProps } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { EllipsisOutlined, SearchOutlined, DatabaseOutlined, FolderOpenOutlined, PlusOutlined, TableOutlined, StarOutlined, StarFilled } from '@ant-design/icons'
import { datasetApi, viewApi, chartBuilderUtils, datasourceApi } from '@lumina/api'
import type { Dataset, DatasetField, Datasource } from '@lumina/types'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import SampleDataModal from './SampleDataModal'
import DataSourcePicker from './DataSourcePicker'

type Row = Record<string, unknown>

const { Text } = Typography

type TreeNode = {
  key: string
  title: React.ReactNode
  icon?: React.ReactNode
  isLeaf?: boolean
  children?: TreeNode[]
  data?: {
    type:
      | 'group'
      | 'datasource'
      | 'dataset'
      | 'create'
      | 'table'
      | 'onboarding'
      | 'recent-dataset'
      | 'favorite-dataset'
    payload?: unknown
  }
}

const DatasetBrowser: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [selected, setSelected] = useState<Dataset | null>(null)
  const [fields, setFields] = useState<DatasetField[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [expandingKeys, setExpandingKeys] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSource, setPickerSource] = useState<Datasource | null>(null)
  const [allDatasets, setAllDatasets] = useState<Array<{ id: number; name: string; sourceId?: number }>>([])
  const [recentDatasets, setRecentDatasets] = useState<Array<{ id: number; name: string; sourceId?: number }>>([])
  const [favoriteDatasets, setFavoriteDatasets] = useState<Array<{ id: number; name: string; sourceId?: number }>>([])

  const RECENT_KEY = 'lumina_recent_datasets'
  const FAVORITE_KEY = 'lumina_favorite_datasets'

  const loadLocal = () => {
    try {
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as Array<{ id: number; name: string; sourceId?: number }>
      setRecentDatasets(Array.isArray(r) ? r : [])
    } catch { setRecentDatasets([]) }
    try {
      const f = JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]') as Array<{ id: number; name: string; sourceId?: number }>
      setFavoriteDatasets(Array.isArray(f) ? f : [])
    } catch { setFavoriteDatasets([]) }
  }

  const pushRecent = (ds: { id: number; name: string; sourceId?: number }) => {
    try {
      const list = [ds, ...recentDatasets.filter(d => d.id !== ds.id)].slice(0, 10)
      localStorage.setItem(RECENT_KEY, JSON.stringify(list))
      setRecentDatasets(list)
    } catch {}
  }

  const isFavorite = (id: number): boolean => favoriteDatasets.some(d => d.id === id)
  const toggleFavorite = (ds: { id: number; name: string; sourceId?: number }) => {
    try {
      let list: Array<{ id: number; name: string; sourceId?: number }>
      if (isFavorite(ds.id)) {
        list = favoriteDatasets.filter(d => d.id !== ds.id)
      } else {
        list = [ds, ...favoriteDatasets.filter(d => d.id !== ds.id)].slice(0, 100)
      }
      localStorage.setItem(FAVORITE_KEY, JSON.stringify(list))
      setFavoriteDatasets(list)
    } catch {}
  }

  const DatasetTitle: React.FC<{ d: { id: number; name: string; sourceId?: number } }> = ({ d }) => (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <FolderOpenOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
        <Text ellipsis style={{ display: 'inline-block', maxWidth: '100%' }}>{d.name}</Text>
      </span>
      <Button
        type="text"
        size="small"
        aria-label={isFavorite(d.id) ? '取消收藏' : '收藏'}
        onClick={(e) => { e.stopPropagation(); toggleFavorite(d) }}
        icon={isFavorite(d.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
      />
    </span>
  )

  useEffect(() => {
    // 加载数据源 + 全量数据集 + 本地最近/收藏，并构建 IA 根节点
    (async () => {
      try {
        const [dsRes, allDsRes] = await Promise.all([
          datasourceApi.list({ page: 1, pageSize: 100, name: keyword || undefined }),
          datasetApi.list({ page: 1, pageSize: 100 })
        ])
        const list = dsRes.list || []
        setDatasources(list)
        const datasets = (allDsRes.list || []).map((d: { id: number; name: string; sourceId?: number }) => ({ id: d.id, name: d.name, sourceId: Number(d.sourceId) || undefined }))
        setAllDatasets(datasets)
        loadLocal()

        const onboarding: TreeNode = {
          key: 'group-onboarding',
          title: (
            <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>入门</Text>
          ),
          isLeaf: false,
          data: { type: 'group' },
          children: [
            {
              key: 'onboarding-home',
              title: <span>快速入门</span>,
              isLeaf: true,
              data: { type: 'onboarding', payload: { to: '/home' } }
            },
            {
              key: 'onboarding-datasource',
              title: <span>创建数据源</span>,
              isLeaf: true,
              data: { type: 'onboarding', payload: { to: '/dataSource/list' } }
            }
          ]
        }

        const collections: TreeNode = {
          key: 'group-collections',
          title: (
            <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>集合</Text>
          ),
          isLeaf: false,
          data: { type: 'group' },
          children: datasets.length > 0
            ? datasets.map(d => ({
              key: `collection-dataset-${d.id}`,
              title: (<DatasetTitle d={d} />),
              isLeaf: true,
              data: { type: 'dataset', payload: d }
            }))
            : []
        }

        const recent: TreeNode = {
          key: 'group-recent',
          title: (
            <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>最近</Text>
          ),
          isLeaf: false,
          data: { type: 'group' },
          children: []
        }

        const favorites: TreeNode = {
          key: 'group-favorites',
          title: (
            <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>收藏</Text>
          ),
          isLeaf: false,
          data: { type: 'group' },
          children: []
        }

        const dataRoot: TreeNode = {
          key: 'group-data',
          title: (
            <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>数据</Text>
          ),
          isLeaf: false,
          data: { type: 'group' },
          children: list.map(ds => ({
            key: `ds-${ds.id}`,
            title: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <DatabaseOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                <span>{ds.name}</span>
              </span>
            ),
            isLeaf: false,
            data: { type: 'datasource', payload: ds }
          }))
        }

        setTreeData([onboarding, collections, dataRoot, recent, favorites])
      } catch {
        setDatasources([])
        setAllDatasets([])
        setTreeData([])
      }
    })()
  }, [keyword])

  const filtered = useMemo(() => treeData, [treeData])

  const getDefaultSchemaOrDb = (source: Datasource): string | undefined => {
    const cfg = source?.config as unknown
    if (!cfg || typeof cfg !== 'object') return undefined
    const c = cfg as { [k: string]: unknown }
    const get = (key: string) => (c[key] && typeof c[key] === 'object' ? c[key] as Record<string, unknown> : undefined)
    const mysql = get('mysql'); if (mysql?.database) return String(mysql.database)
    const postgresql = get('postgresql'); if (postgresql?.database) return String(postgresql.database)
    const clickhouse = get('clickhouse'); if (clickhouse?.database) return String(clickhouse.database)
    const mssql = get('mssql'); if (mssql?.database) return String(mssql.database)
    const oracle = get('oracle'); if (oracle?.user) return String(oracle.user) // Oracle 以用户作为 schema
    const mongodb = get('mongodb'); if (mongodb?.dbName) return String(mongodb.dbName)
    const es = get('essearch'); if (es?.index) return String(es.index)
    return undefined
  }

  const loadDatasetsUnderSource = async (source: Datasource): Promise<TreeNode[]> => {
    try {
      const res = await datasetApi.list({ page: 1, pageSize: 100, sourceId: Number(source.id) })
      const list = res.list || []
      if (list.length === 0) {
        // 空态：提供“从表创建数据集”的入口（后续补充表枚举）
        return [
          {
            key: `create-${source.id}`,
            title: (
              <Space size={6} style={{ color: '#1677ff' }}>
                <PlusOutlined />
                <span>从数据表创建数据集</span>
              </Space>
            ),
            isLeaf: true,
            data: { type: 'create', payload: { sourceId: source.id } }
          }
        ]
      }
      return list.map(d => ({
        key: `dataset-${d.id}`,
        title: (<DatasetTitle d={d} />),
        isLeaf: true,
        data: { type: 'dataset', payload: d }
      }))
    } catch (e) {
      console.error(e)
      message.error('加载数据集失败')
      return []
    }
  }

  // 若有默认库/命名空间，只展示该范围的表；否则退化为全部
  const loadTablesForSourceDefault = async (source: Datasource): Promise<TreeNode[]> => {
    try {
      const defaultSchema = getDefaultSchemaOrDb(source)
      if (defaultSchema) {
        const tables = await datasourceApi.listTables(Number(source.id), defaultSchema)
        return (tables || []).map(t => ({
          key: `table-${source.id}-${t.schema || defaultSchema}-${t.name}`,
          title: (
            <Space size={6}>
              <TableOutlined />
              <span>{t.name}</span>
            </Space>
          ),
          isLeaf: true,
          data: { type: 'table', payload: { sourceId: Number(source.id), schema: t.schema || defaultSchema, table: t.name } }
        }))
      }
      // 无默认库：尽量少拉取，按后端当前库返回
      const tables = await datasourceApi.listTables(Number(source.id))
      return (tables || []).map(t => ({
        key: `table-${source.id}-${t.schema || 'default'}-${t.name}`,
        title: (
          <Space size={6}>
            <TableOutlined />
            <span>{t.schema ? `${t.schema}.${t.name}` : t.name}</span>
          </Space>
        ),
        isLeaf: true,
        data: { type: 'table', payload: { sourceId: Number(source.id), schema: t.schema, table: t.name } }
      }))
    } catch (e) {
      console.error(e)
      message.error('加载数据表失败')
      return []
    }
  }

  const loadTablesUnderSchema = async (sourceId: number, schema?: string): Promise<TreeNode[]> => {
    try {
      const tables = await datasourceApi.listTables(Number(sourceId), schema)
      return (tables || []).map(t => ({
        key: `table-${sourceId}-${t.schema || schema || 'default'}-${t.name}`,
        title: (
          <Space size={6}>
            <TableOutlined />
            <span>{t.name}</span>
          </Space>
        ),
        isLeaf: true,
        data: { type: 'table', payload: { sourceId, schema: t.schema || schema, table: t.name } }
      }))
    } catch (e) {
      console.error(e)
      message.error('加载数据表失败')
      return []
    }
  }

  const createDatasetFromTable = async (sourceId: number, schema: string | undefined, table: string) => {
    setLoading(true)
    try {
      const columns = await datasourceApi.listColumns(Number(sourceId), table, schema)
      // 简单类型映射
      const mapType = (t: string): import('@lumina/types').FieldType => {
        const s = t.toLowerCase()
        if (s.includes('int')) return 'INTEGER'
        if (s.includes('float') || s.includes('double') || s.includes('decimal') || s.includes('number') || s.includes('numeric')) return 'FLOAT'
        if (s.includes('bool')) return 'BOOLEAN'
        if (s.includes('timestamp')) return 'TIMESTAMP'
        if (s.includes('date') || s.includes('time')) return 'DATE'
        return 'STRING'
      }
      const fields: DatasetField[] = (columns || []).map((c, idx) => ({
        identifier: `${c.name.replace(/\s+/g, '_').toLowerCase()}_${idx}`,
        name: c.name,
        type: mapType(c.type || 'STRING'),
        expression: c.name,
        isDimension: !['FLOAT', 'INTEGER'].includes(mapType(c.type || 'STRING')),
        isMetric: ['FLOAT', 'INTEGER'].includes(mapType(c.type || 'STRING'))
      }))
      const ds = await datasetApi.create({
        name: schema ? `${schema}.${table}` : table,
        sourceId: Number(sourceId),
        fields,
        baseTable: table,
        baseSchema: schema
      })
      await onPickDataset(ds)
    } catch (e) {
      console.error(e)
      message.error('创建数据集失败')
    } finally {
      setLoading(false)
    }
  }

  const loadPreview = async (ds: Dataset) => {
    setLoading(true)
    try {
      const fds = await datasetApi.getFields(ds.id)
      setFields(fds)
      if (!fds.length) {
        setRows([])
      } else {
        // 构造最小合规查询：包含全部字段作为维度，0 指标，limit=20
        const req: import('@lumina/api').ChartQueryRequest = {
          dimensions: fds.map(chartBuilderUtils.fieldToDimension),
          metrics: [],
          filters: [],
          limit: 20,
          offset: 0
        }
        const res = await datasetApi.executeChartQuery(ds.id, req)
        setRows(res.data || [])
      }
    } catch (e) {
      console.error(e)
      message.error('加载样本数据失败')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const onPickDataset = async (ds: Dataset) => {
    setSelected(ds)
    setOpen(true)
    pushRecent({ id: Number(ds.id), name: ds.name, sourceId: Number(ds.sourceId) || undefined })
    await loadPreview(ds)
  }

  const handleTreeLoad = async (node: TreeNode) => {
    if (!node) return
    if (node.data?.type === 'datasource') {
      const source = node.data.payload as Datasource
      const [datasets, tablesGroupChildren] = await Promise.all([
        loadDatasetsUnderSource(source),
        loadTablesForSourceDefault(source)
      ])
      const children: TreeNode[] = [
        {
          key: `group-datasets-${source.id}`,
          title: (
            <Space size={6}>
              <FolderOpenOutlined />
              <span>数据集</span>
            </Space>
          ),
          isLeaf: false,
          children: datasets
        },
        {
          key: `group-tables-${source.id}`,
          title: (
            <Space size={6}>
              <FolderOpenOutlined />
              <span>数据表</span>
            </Space>
          ),
          isLeaf: false,
          children: tablesGroupChildren
        }
      ]
      setTreeData(prev => prev.map(n => (n.key === node.key ? { ...n, children } : n)))
    } else if (node.key === 'group-recent') {
      // 动态填充最近
      setTreeData(prev => prev.map(n => (n.key === node.key
        ? {
          ...n,
          children: recentDatasets.length
            ? recentDatasets.map(d => ({
              key: `recent-dataset-${d.id}`,
              title: (<DatasetTitle d={d} />),
              isLeaf: true,
              data: { type: 'dataset', payload: d }
            }))
            : [
              {
                key: 'recent-empty',
                title: <Text type="secondary">暂无最近访问</Text>,
                isLeaf: true,
                data: { type: 'group' }
              }
            ]
        }
        : n)))
    } else if (node.key === 'group-favorites') {
      // 动态填充收藏
      setTreeData(prev => prev.map(n => (n.key === node.key
        ? {
          ...n,
          children: favoriteDatasets.length
            ? favoriteDatasets.map(d => ({
              key: `favorite-dataset-${d.id}`,
              title: (<DatasetTitle d={d} />),
              isLeaf: true,
              data: { type: 'dataset', payload: d }
            }))
            : [
              {
                key: 'favorite-empty',
                title: <Text type="secondary">暂无收藏</Text>,
                isLeaf: true,
                data: { type: 'group' }
              }
            ]
        }
        : n)))
    }
  }

  const handleTreeSelect: TreeProps['onSelect'] = async (_selectedKeys, info) => {
    const node = info?.node as unknown as TreeNode | undefined
    if (!node) return
    if (node.data?.type === 'dataset') {
      await onPickDataset(node.data.payload as Dataset)
    } else if (node.data?.type === 'create') {
      const { sourceId } = node.data.payload as { sourceId: number }
      navigate(`/dataset/edit?sourceId=${sourceId}`)
    } else if (node.data?.type === 'datasource') {
      const source = node.data.payload as Datasource
      setPickerSource(source)
      setPickerOpen(true)
    } else if (node.data?.type === 'table') {
      const { sourceId, schema, table } = node.data.payload as { sourceId: number, schema?: string, table: string }
      await createDatasetFromTable(sourceId, schema, table)
    } else if (node.data?.type === 'onboarding') {
      const { to } = (node.data.payload || {}) as { to?: string }
      if (to) navigate(to)
    }
  }

  const createFromField = async (mode: 'dimension' | 'metric', colName: string, agg?: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct') => {
    if (!selected) return
    try {
      const ds = selected
      const f = fields.find(x => x.name === colName) || fields[0]
      if (!f) {
        message.warning('未找到可用字段')
        return
      }
      // pick counterpart
      const dimensionField = mode === 'dimension' ? f : (fields.find(x => x.isDimension) || f)
      const metricField = mode === 'metric' ? f : (fields.find(x => x.isMetric) || f)
      const metricAgg = agg || chartBuilderUtils.getDefaultAggregation(metricField)

      const minimalChartConfig: import('@lumina/types').ChartConfig = {
        chartType: 'bar',
        title: `${ds.name} - 快速视图`,
        dimensions: [
          { field: { identifier: dimensionField.identifier }, aggregationType: 'count' }
        ],
        metrics: [
          { field: { identifier: metricField.identifier }, aggregationType: metricAgg }
        ],
        filters: [],
        settings: { limit: 1000 }
      }

      const newView = await viewApi.create({
        name: `${ds.name}视图`,
        description: '',
        // 顶层设置 datasetId，后端模型要求必填
        datasetId: Number(ds.id),
        config: { chartConfig: minimalChartConfig, queryResult: null }
      })
      message.success('视图已生成，正在前往编辑')
      navigate(`/chartBuilder?viewId=${newView.id}`)
    } catch (e) {
      console.error(e)
      message.error('生成视图失败')
    }
  }

  const buildColumns = (): ColumnsType<Row> => {
    const names = rows.length > 0 ? Object.keys(rows[0]) : []
    return names.map(name => ({
      title: (
        <Space size={4}>
          <span>{name}</span>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'as-dim', label: '设为维度生成图表', onClick: () => createFromField('dimension', name) },
                { type: 'divider' as const },
                { key: 'm-sum', label: '聚合：求和', onClick: () => createFromField('metric', name, 'sum') },
                { key: 'm-count', label: '聚合：计数', onClick: () => createFromField('metric', name, 'count') },
                { key: 'm-avg', label: '聚合：平均', onClick: () => createFromField('metric', name, 'avg') },
                { key: 'm-max', label: '聚合：最大', onClick: () => createFromField('metric', name, 'max') },
                { key: 'm-min', label: '聚合：最小', onClick: () => createFromField('metric', name, 'min') }
              ]
            }}
          >
            <Button type="text" size="small" icon={<EllipsisOutlined />} />
          </Dropdown>
        </Space>
      ),
      dataIndex: name,
      key: name
    }))
  }

  return (
    <div>
      <Input
        allowClear
        size="small"
        placeholder="搜索数据源"
        prefix={<SearchOutlined />}
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div style={{ maxHeight: 'calc(100vh - 140px)', overflow: 'auto', paddingRight: 4 }}>
        <Tree
          showIcon={false}
          blockNode
          treeData={filtered as unknown as DataNode[]}
          loadData={async (node) => { await handleTreeLoad(node as unknown as TreeNode) }}
          onSelect={handleTreeSelect}
          expandedKeys={expandingKeys}
          onExpand={(keys) => setExpandingKeys(keys as string[])}
        />
      </div>

      <SampleDataModal open={open} dataset={selected} onClose={() => setOpen(false)} />
      <DataSourcePicker
        open={pickerOpen}
        onCancel={() => { setPickerOpen(false); setPickerSource(null) }}
        onPicked={async ({ source, schema, table }) => {
          setPickerOpen(false)
          await createDatasetFromTable(Number(source.id), schema, table)
        }}
      />
    </div>
  )
}

export default DatasetBrowser
