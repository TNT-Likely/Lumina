// DatasetManagement.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Tag, Popover, Button, message, Modal } from 'antd'
import PermissionDrawer from '../../components/permission/PermissionDrawer'
import { datasetApi, datasourceApi, viewApi, chartBuilderUtils } from '@lumina/api'
import { PlusOutlined, QuestionCircleOutlined, FilterOutlined } from '@ant-design/icons'
import type { ProColumns, ProFormColumnsType, ActionType } from '@ant-design/pro-components'
import { type Dataset, type DatasetField, type FieldType, type PaginatedResponse } from '@lumina/types'
import { CrudTable } from '@lumina/components'
import { v4 as uuidv4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import DataSourcePicker from '../../components/dataset/DataSourcePicker'
import { canCreate, isOwner } from '../../utils/perm'
import { useAppContext } from '../../context/AppContext'

const DatasetManagement: React.FC = () => {
  const navigate = useNavigate()
  const [datasources, setDatasources] = useState<{ id: number; name: string; type: string }[]>([])
  const [permOpen, setPermOpen] = useState(false)
  const [permTarget, setPermTarget] = useState<Dataset | null>(null)
  const { userId, currentOrg } = useAppContext()
  const bridgeUserId = typeof window !== 'undefined' ? localStorage.getItem('lumina.userId') : null
  const bridgeOrgRole = typeof window !== 'undefined' ? (localStorage.getItem('lumina.currentOrgRole') as 'ADMIN'|'EDITOR'|'VIEWER'|null) : null
  const currentUserId: number | null = userId ?? (bridgeUserId ? Number(bridgeUserId) : null)
  const currentOrgRole: 'ADMIN'|'EDITOR'|'VIEWER'|null = (currentOrg?.role as 'ADMIN'|'EDITOR'|'VIEWER'|undefined) ?? bridgeOrgRole ?? null
  const [datasourceOptions, setDatasourceOptions] = useState<Array<{ label: string, value: number }>>([])
  const actionRef = useRef<ActionType>()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerInitSource, setPickerInitSource] = useState<number | undefined>(undefined)

  // 字段类型配置
  const fieldTypeConfig: Record<FieldType, { label: string, color: string }> = {
    STRING: { label: '文本', color: 'blue' },
    INTEGER: { label: '整数', color: 'geekblue' },
    FLOAT: { label: '浮点数', color: 'cyan' },
    DATE: { label: '日期', color: 'purple' },
    BOOLEAN: { label: '布尔值', color: 'green' },
    TIMESTAMP: { label: '时间戳', color: 'volcano' }
  }

  // 加载数据源列表
  const loadDatasources = async () => {
    try {
      const response = await datasourceApi.list({ page: 1, pageSize: 1000 })
      const datasourceList = response.list || []
      setDatasources(datasourceList)

      // 设置搜索选项
      const options = datasourceList.map(ds => ({
        label: `${ds.name} (${ds.type})`,
        value: ds.id
      }))
      setDatasourceOptions(options)
    } catch (error) {
      console.error('加载数据源列表失败:', error)
      message.error('加载数据源列表失败')
    }
  }

  useEffect(() => { loadDatasources() }, [])

  // sidebar quick create
  useEffect(() => {
    const handler = () => { setPickerInitSource(undefined); setPickerOpen(true) }
    window.addEventListener('lumina:openDataSourcePicker', handler as EventListener)
    return () => { window.removeEventListener('lumina:openDataSourcePicker', handler as EventListener) }
  }, [])

  // 表格列定义
  const columns: Array<ProColumns<Dataset>> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      ellipsis: true,
      search: false
    },
    {
      title: '数据集名称',
      dataIndex: 'name',
      ellipsis: true,
      fieldProps: { placeholder: '请输入数据集名称' },
      render: (_, record) => (
        <a
          style={{ color: '#3056d3' }}
          onClick={() => {
            const canEdit = !!record?.canWrite || isOwner(currentUserId, record.ownerId as unknown as number)
            if (canEdit) navigate(`/dataset/edit?id=${record.id}`)
            else navigate(`/dataset/edit?id=${record.id}&mode=readonly`)
          }}
        >
          {record.name}
        </a>
      )
    },
    {
      title: '关联数据源',
      dataIndex: 'sourceId',
      width: 150,
      valueType: 'select',
      // 修复：使用已加载的数据源选项
      fieldProps: {
        options: datasourceOptions
      },
      render: (_, record) => {
        const datasource = datasources.find(ds => ds.id === record.sourceId)
        return datasource
          ? (
            <Tag color="blue">{datasource.name}</Tag>
          )
          : (
            <Tag color="red">数据源ID: {record.sourceId}</Tag>
          )
      }
    },
    {
      title: '字段数量',
      dataIndex: 'fields',
      width: 120,
      search: false,
      render: (_, record) => (
        <span>{record.fields?.length || 0} 个字段</span>
      )
    },
    {
      title: '参数数量',
      dataIndex: 'parameters',
      width: 100,
      search: false,
      render: (_, record) => (
        <span>{(record.parameters || []).length} 个参数</span>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      search: false,
      width: 200
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      width: 100,
      search: false
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 180,
      search: false,
      sorter: true
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      width: 180,
      search: false,
      sorter: true
    }
  ]

  // CRUD 操作配置（只保留删除和列表）
  const operations = {
    delete: async (id: number) => {
      try {
        await datasetApi.delete(id)
      } catch (error) {
        console.error('删除数据集失败:', error)
        throw error
      }
    },
    list: async (params: Record<string, unknown>) => {
      try {
        const { current, pageSize, ...restParams } = params
        const response: PaginatedResponse<Dataset> = await datasetApi.list({
          ...restParams,
          page: current as number,
          pageSize: pageSize as number,
          sortBy: params.sorter ? Object.keys(params.sorter)[0] : 'createdAt',
          sortOrder: params.sorter ? (Object.values(params.sorter)[0] === 'ascend' ? 'asc' : 'desc') : 'desc'
        })
        return {
          data: response.list || [],
          success: true,
          total: response.total || 0
        }
      } catch (error) {
        console.error('获取数据集列表失败:', error)
        return {
          data: [],
          success: false,
          total: 0
        }
      }
    }
  }

  // 顶部工具栏：自定义“新建数据集”按钮，按角色控制
  const toolBarRender = () => canCreate(currentOrgRole)
    ? [
      <Button
        key="add"
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => { setPickerInitSource(undefined); setPickerOpen(true) }}
      >
        新建数据集
      </Button>
    ]
    : []

  return (
    <>
      <CrudTable<Dataset>
        title="数据集管理"
        columns={columns}
        formColumns={[]}
        operations={operations}
        ref={actionRef as unknown as React.Ref<ActionType>}
        viewRender={record => {
          return <Button
            key="view"
            type="link"
            size="small"
            onClick={() => {
              window.location.href = `/dataset/edit?id=${record.id}&mode=readonly`
            }}
          >
            查看
          </Button>
        }}
        editRender={record => {
          const ownerId = (record as unknown as Partial<Dataset>).ownerId as number | undefined
          const canEdit = !!(record as unknown as Partial<Dataset>).canWrite || isOwner(currentUserId, ownerId as number)
          if (!canEdit) return null
          return <Button
            key="edit"
            type="link"
            size="small"
            onClick={() => { window.location.href = `/dataset/edit?id=${record.id}` }}
          >编辑</Button>
        }}
        actionsVariant="menu"
        actionColumnWidth={120}
        actionMenuItemsExtra={(record) => {
          const items: Array<{ key: string; label: React.ReactNode; onClick?: () => void }> = []
          items.push({
            key: 'quick-view',
            label: '一键生成视图',
            onClick: async () => {
              try {
                const fields = await datasetApi.getFields(record.id)
                const dimension = fields.find(f => f.isDimension) || fields[0]
                const metric = fields.find(f => f.isMetric) || fields[0]
                if (!dimension || !metric) {
                  message.warning('该数据集暂无可用字段，无法生成视图')
                  return
                }
                const chartType = 'bar'
                const minimalChartConfig: import('@lumina/types').ChartConfig = {
                  chartType,
                  title: `${record.name} - 快速视图`,
                  dimensions: [{ field: { identifier: dimension.identifier }, aggregationType: 'count' }],
                  metrics: [{ field: { identifier: metric.identifier }, aggregationType: chartBuilderUtils.getDefaultAggregation(metric) }],
                  filters: [],
                  settings: { limit: 1000, showDataLabels: true, showLegend: true, showGridLines: true, colorScheme: 'default' }
                }
                const newView = await viewApi.create({ name: `${record.name}视图`, description: '', datasetId: Number(record.id), config: { chartConfig: minimalChartConfig, queryResult: null } })
                message.success('视图已生成，正在前往编辑')
                window.location.href = `/chartBuilder?viewId=${newView.id}`
              } catch (e) {
                console.error(e)
                message.error('一键生成视图失败')
              }
            }
          })
          {
            const ownerId = (record as unknown as Partial<Dataset>).ownerId as number | undefined
            const canEdit = !!(record as unknown as Partial<Dataset>).canWrite || isOwner(currentUserId, ownerId as number)
            if (canEdit) items.push({ key: 'perm', label: '权限', onClick: () => { setPermTarget(record); setPermOpen(true) } })
          }
          return items
        }}
        actionsVisibility={{
          delete: (r: Dataset) => !!r?.canDelete || isOwner(currentUserId, (r as unknown as Partial<Dataset>).ownerId as number)
        }}
        rowKey="id"
        formWidth={1200}
        enableUrlQuery={true}
        searchMode="simple"
        simpleSearchTrigger={<Button icon={<FilterOutlined />}>筛选</Button>}
        simpleSearchForm={[
          { title: '名称', dataIndex: 'name', valueType: 'text' },
          { title: '数据源', dataIndex: 'sourceId', valueType: 'select', fieldProps: { options: datasourceOptions, allowClear: true } }
        ]}
        tableProps={{ locale: { emptyText: '暂无数据集，点击右上角“新建数据集”开始创建。' } }}
        toolBarRender={toolBarRender}
      />
      <PermissionDrawer
        open={permOpen}
        title={`设置权限 - ${permTarget?.name || ''}`}
        target={permTarget}
        currentUserId={currentUserId}
        orgMembers={[]}
        onClose={() => { setPermOpen(false); setPermTarget(null) }}
        onSubmit={async (patch) => {
          if (!permTarget) return
          await datasetApi.update(permTarget.id, patch)
          actionRef.current?.reload()
        }}
      />
      <DataSourcePicker
        open={pickerOpen}
        initialSourceId={pickerInitSource}
        initialTab="tables"
        onCancel={() => { setPickerOpen(false); setPickerInitSource(undefined) }}
        onPicked={async ({ source, schema, table }) => {
          setPickerOpen(false)
          try {
            // 跳转到新建页面并预填 sourceId/baseTable/baseSchema
            navigate(`/dataset/edit?sourceId=${Number(source.id)}&baseTable=${encodeURIComponent(table)}${schema ? `&baseSchema=${encodeURIComponent(schema)}` : ''}`)
          } catch (e) {
            console.error(e)
            message.error('打开新建数据集失败')
          }
        }}
        onPickedDataset={(d) => navigate(`/dataset/edit?id=${d.id}`)}
      />
    </>
  )
}

export default DatasetManagement
