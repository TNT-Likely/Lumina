// ViewManagement.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Tag, Button, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, FilterOutlined } from '@ant-design/icons'
import type { ProColumns, ProFormColumnsType, ActionType } from '@ant-design/pro-components'
import { viewApi, datasetApi } from '@lumina/api'
import { useAppContext } from '../../context/AppContext'
import { type View, type Dataset } from '@lumina/types'
import { CrudTable } from '@lumina/components'
import PermissionDrawer from '../../components/permission/PermissionDrawer'
import { useNavigate } from 'react-router-dom'
import { canCreate, isOwner } from '../../utils/perm'

const ViewManagement: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetOptions, setDatasetOptions] = useState<Array<{ label: string, value: number }>>([])
  const [permOpen, setPermOpen] = useState(false)
  const [permTarget, setPermTarget] = useState<View | null>(null)
  const { userId: currentUserId, currentOrg } = useAppContext()
  const [memberOptions, setMemberOptions] = useState<Array<{ label: string, value: number }>>([])
  const currentOrgRole: 'ADMIN'|'EDITOR'|'VIEWER'|null = (currentOrg?.role === 'ADMIN' || currentOrg?.role === 'EDITOR' || currentOrg?.role === 'VIEWER') ? currentOrg.role : null
  const actionRef = useRef<ActionType>()

  // 视图类型配置
  const viewTypeConfig: Record<string, { label: string, color: string, icon: string }> = {
    dashboard: { label: '仪表板', color: 'purple', icon: '📊' },
    chart: { label: '图表', color: 'blue', icon: '📈' },
    table: { label: '表格', color: 'green', icon: '📋' },
    filter: { label: '筛选器', color: 'orange', icon: '🔍' },
    text: { label: '文本', color: 'default', icon: '📝' },
    container: { label: '容器', color: 'cyan', icon: '📦' },
    tab: { label: '选项卡', color: 'geekblue', icon: '📂' },
    card: { label: '卡片', color: 'volcano', icon: '🎴' },
    metric: { label: '指标', color: 'magenta', icon: '📊' },
    iframe: { label: '嵌入页', color: 'lime', icon: '🌐' }
  }

  // 加载数据集列表
  const loadDatasets = async () => {
    try {
      const response = await datasetApi.list({ page: 1, pageSize: 100 })
      const datasetList = response.list || []
      setDatasets(datasetList)

      const options = datasetList.map(ds => ({
        label: `${ds.name} (ID: ${ds.id})`,
        value: ds.id
      }))
      setDatasetOptions(options)
    } catch (error) {
      console.error('加载数据集列表失败:', error)
      message.error('加载数据集列表失败')
    }
  }

  useEffect(() => {
    loadDatasets()
    ;(async () => {
      try {
        // 权限抽屉不再依赖组织成员，这里不请求 listMembers
        setMemberOptions([])
      } catch {}
    })()
  }, [])

  // 表格列定义
  const columns: Array<ProColumns<View>> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false
    },
    {
      title: '视图名称',
      dataIndex: 'name',
      ellipsis: true,
      fieldProps: { placeholder: '请输入视图名称' },
      render: (_, record) => (
        <a onClick={() => {
          const canEdit = !!record?.canWrite || isOwner(currentUserId, record.ownerId as unknown as number)
          if (canEdit) navigate(`/chartBuilder?viewId=${record.id}`)
          else navigate(`/view/preview?id=${record.id}`)
        }}>{record.name}</a>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      search: false,
      valueEnum: Object.entries(viewTypeConfig).reduce<Record<string, { text: string }>>((acc, [key, config]) => {
        acc[key] = { text: config.label }
        return acc
      }, {}),
      render: (_, record) => {
        const config = viewTypeConfig[record.type]
        return (
          <Tag color={config.color}>
            <span style={{ marginRight: 4 }}>{config.icon}</span>
            {config.label}
          </Tag>
        )
      }
    },
    {
      title: '关联数据集',
      dataIndex: 'datasetId',
      width: 150,
      valueType: 'select',
      fieldProps: {
        options: datasetOptions,
        allowClear: true,
        placeholder: '选择数据集'
      },
      render: (_, record) => {
        if (!record.datasetId) {
          return <Tag color="default">无</Tag>
        }
        const dataset = datasets.find(ds => ds.id === Number(record.datasetId))
        return dataset
          ? (
            <Tag color="green">{dataset.name}</Tag>
          )
          : (
            <Tag color="red">数据集ID: {record.datasetId}</Tag>
          )
      }
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
    }
  ]

  // 表单字段定义（用于查看详情，不用于新增编辑）
  const getFormColumns = (): ProFormColumnsType[] => [
    {
      title: '视图ID',
      dataIndex: 'id',
      valueType: 'text',
      readonly: true
    },
    {
      title: '视图名称',
      dataIndex: 'name',
      valueType: 'text',
      readonly: true
    },
    {
      title: '视图类型',
      dataIndex: 'type',
      valueType: 'select',
      valueEnum: Object.entries(viewTypeConfig).reduce<Record<string, { text: string }>>((acc, [key, config]) => {
        acc[key] = { text: `${config.icon} ${config.label}` }
        return acc
      }, {}),
      readonly: true
    },
    {
      title: '关联数据集',
      dataIndex: 'datasetId',
      valueType: 'select',
      fieldProps: { options: datasetOptions },
      readonly: true
    },
    {
      title: '描述',
      dataIndex: 'description',
      valueType: 'textarea',
      readonly: true
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      readonly: true
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      readonly: true
    }
  ]

  // CRUD 操作配置
  const operations = {
    // 不提供 create 函数，这样新建按钮会被 toolBarRender 覆盖
    // create: undefined,

    // 不提供 update 函数，编辑按钮会被自定义操作替换
    // update: undefined,

    delete: async (id: number) => {
      try {
        await viewApi.delete(id)
      } catch (error) {
        console.error('删除视图失败:', error)
        throw error
      }
    },

    list: async (params: Record<string, unknown>) => {
      try {
        const { current, pageSize, ...restParams } = params as { current?: number, pageSize?: number } & Record<string, unknown>
        const response = await viewApi.list({
          ...restParams,
          page: current,
          pageSize
        })

        return {
          data: response.list || [],
          success: true,
          total: response.total || 0
        }
      } catch (error) {
        console.error('获取视图列表失败:', error)
        return {
          data: [],
          success: false,
          total: 0
        }
      }
    }
  }

  const navigate = useNavigate()

  return (
    <>
      <CrudTable<View>
        title="视图管理"
        columns={columns}
        formColumns={getFormColumns}
        operations={operations}
        rowKey="id"
        ref={actionRef as unknown as React.Ref<ActionType>}
        enableUrlQuery={true}
        searchMode="simple"
        simpleSearchTrigger={<Button icon={<FilterOutlined />}>筛选</Button>}
        simpleSearchForm={[
          { title: '名称', dataIndex: 'name', valueType: 'text' },
          {
            title: '类型',
            dataIndex: 'type',
            valueType: 'select',
            fieldProps: {
              options: Object.entries(viewTypeConfig).map(([value, cfg]) => ({ label: cfg.label, value }))
            }
          },
          { title: '数据集', dataIndex: 'datasetId', valueType: 'select', fieldProps: { options: datasetOptions, allowClear: true } }
        ]}
        tableProps={{ locale: { emptyText: '暂无视图，点击右上角“新建视图”开始创建。' } }}
        toolBarRender={() => {
          if (!canCreate(currentOrgRole)) return []
          return [
            <Button
              key="add"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/chartBuilder')}
            >
            新建视图
            </Button>
          ]
        }}
        // 收敛操作到“更多”
        actionsVariant="menu"
        actionColumnWidth={120}
        actionMenuItemsExtra={(record) => {
          const items: Array<{ key: string; label: React.ReactNode; onClick?: () => void }> = []
          const canEdit = !!record?.canWrite || isOwner(currentUserId, record.ownerId as unknown as number)
          if (canEdit) items.push({ key: 'edit', label: '编辑', onClick: () => navigate(`/chartBuilder?viewId=${record.id}`) })
          if (canEdit) items.push({ key: 'perm', label: '权限', onClick: () => { setPermTarget(record); setPermOpen(true) } })
          return items
        }}
        actionsVisibility={{
          delete: (r: View) => !!r?.canDelete || isOwner(currentUserId, r.ownerId as unknown as number)
        }}
      />
      <PermissionDrawer
        open={permOpen}
        title={`设置权限 - ${permTarget?.name || ''}`}
        target={permTarget}
        currentUserId={currentUserId}
        orgMembers={memberOptions}
        onClose={() => { setPermOpen(false); setPermTarget(null) }}
        onSubmit={async (patch) => {
          if (!permTarget) return
          await viewApi.update(permTarget.id, patch)
          actionRef.current?.reload()
        }}
      />
    </>
  )
}

export default ViewManagement
