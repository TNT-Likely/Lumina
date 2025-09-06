// DatasourceManagement.tsx
import React from 'react'
import { Tag, Button, message } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import type { ProColumns, ProFormColumnsType, ActionType } from '@ant-design/pro-components'
import { datasourceApi } from '@lumina/api'
import type { Datasource } from '@lumina/types'
import { CrudTable } from '@lumina/components'
import { canCreate, isOwner } from '../../utils/perm'
import PermissionDrawer from '../../components/permission/PermissionDrawer'
import QuickCreateDatasourceModal from '../../components/datasource/QuickCreateDatasourceModal'
import DataSourcePicker from '../../components/dataset/DataSourcePicker'
import { useAppContext } from '../../context/AppContext'
// (merged ActionType import)

// 数据源 config 类型定义
type MysqlConfig = { mysql: { user: string; host: string; port: number; database: string; password?: string } }
type PostgresqlConfig = { postgresql: { user: string; host: string; port: number; database: string; password?: string } }
type ClickhouseConfig = { clickhouse: { user: string; host: string; port: number; database: string; password?: string } }
type SqliteConfig = { sqlite: { filename: string } }
type MongodbConfig = { mongodb: { uri: string } }
type OracleConfig = { oracle: { user: string; connectString: string; password?: string } }
type MssqlConfig = { mssql: { user: string; server: string; port: number; database: string; password?: string } }
type EssearchConfig = { essearch: { node: string; index: string; username?: string; password?: string } }

type DatasourceConfig = MysqlConfig | PostgresqlConfig | ClickhouseConfig | SqliteConfig | MongodbConfig | OracleConfig | MssqlConfig | EssearchConfig

const DatasourceManagement: React.FC = () => {
  const actionRef = React.useRef<ActionType>(null)
  const [permOpen, setPermOpen] = React.useState(false)
  const [permTarget, setPermTarget] = React.useState<Datasource | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Partial<Datasource> | null>(null)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pickerInitSource, setPickerInitSource] = React.useState<number | undefined>(undefined)
  const { userId, currentOrg } = useAppContext()
  const bridgeUserId = typeof window !== 'undefined' ? localStorage.getItem('lumina.userId') : null
  const bridgeOrgRole = typeof window !== 'undefined' ? (localStorage.getItem('lumina.currentOrgRole') as 'ADMIN'|'EDITOR'|'VIEWER'|null) : null
  const currentUserId: number | null = userId ?? (bridgeUserId ? Number(bridgeUserId) : null)
  const currentOrgRole: 'ADMIN'|'EDITOR'|'VIEWER'|null = (currentOrg?.role as 'ADMIN'|'EDITOR'|'VIEWER'|undefined) ?? bridgeOrgRole ?? null
  // 数据源类型配置
  const datasourceTypeConfig: Record<string, { label: string, color: string }> = {
    MYSQL: { label: 'MySQL', color: 'blue' },
    POSTGRESQL: { label: 'PostgreSQL', color: 'geekblue' },
    CLICKHOUSE: { label: 'ClickHouse', color: 'orange' },
    SQLITE: { label: 'SQLite', color: 'purple' },
    MONGODB: { label: 'MongoDB', color: 'green' },
    ORACLE: { label: 'Oracle', color: 'red' },
    MSSQL: { label: 'SQL Server', color: 'volcano' },
    ESSEARCH: { label: 'Elasticsearch', color: 'gold' }
  }

  // 表格列定义
  const columns: Array<ProColumns<Datasource>> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 120,
      ellipsis: true
    },
    {
      title: '名称',
      dataIndex: 'name',
      ellipsis: true,
      fieldProps: { placeholder: '请输入数据源名称' },
      render: (_, record) => (
        <a onClick={() => { setPickerInitSource(Number(record.id)); setPickerOpen(true) }}>{record.name}</a>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        MYSQL: { text: 'MySQL' },
        POSTGRESQL: { text: 'PostgreSQL' },
        CLICKHOUSE: { text: 'ClickHouse' },
        SQLITE: { text: 'SQLite' },
        MONGODB: { text: 'MongoDB' },
        ORACLE: { text: 'Oracle' },
        MSSQL: { text: 'SQL Server' },
        ESSEARCH: { text: 'Elasticsearch' }
      },
      render: (_, record) => {
        const config = datasourceTypeConfig[record.type]
        return (
          <Tag color={config?.color || 'default'}>
            {config?.label || record.type}
          </Tag>
        )
      }
    },
    {
      title: '配置信息',
      dataIndex: 'config',
      search: false,
      render: (_, record) => {
        const config = record.config as DatasourceConfig
        switch (record.type) {
        case 'MYSQL':
          return `${(config as MysqlConfig).mysql.user}@${(config as MysqlConfig).mysql.host}:${(config as MysqlConfig).mysql.port}/${(config as MysqlConfig).mysql.database}`
        case 'POSTGRESQL':
          return `${(config as PostgresqlConfig).postgresql.user}@${(config as PostgresqlConfig).postgresql.host}:${(config as PostgresqlConfig).postgresql.port}/${(config as PostgresqlConfig).postgresql.database}`
        case 'CLICKHOUSE':
          return `${(config as ClickhouseConfig).clickhouse.user}@${(config as ClickhouseConfig).clickhouse.host}:${(config as ClickhouseConfig).clickhouse.port}/${(config as ClickhouseConfig).clickhouse.database}`
        case 'SQLITE':
          return `${(config as SqliteConfig).sqlite.filename}`
        case 'MONGODB':
          return `${(config as MongodbConfig).mongodb.uri}`
        case 'ORACLE':
          return `${(config as OracleConfig).oracle.user}@${(config as OracleConfig).oracle.connectString}`
        case 'MSSQL':
          return `${(config as MssqlConfig).mssql.user}@${(config as MssqlConfig).mssql.server}:${(config as MssqlConfig).mssql.port}/${(config as MssqlConfig).mssql.database}`
        case 'ESSEARCH':
          return `${(config as EssearchConfig).essearch.node}/${(config as EssearchConfig).essearch.index}`
        default:
          return '-'
        }
      }
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

  // 表单字段定义函数
  const getFormColumns = (record?: Datasource): ProFormColumnsType[] => {
    const isEdit = !!record?.id

    return [
      { title: '数据源ID', dataIndex: 'id', formItemProps: { hidden: true } },
      {
        title: '数据源名称',
        dataIndex: 'name',
        valueType: 'text',
        fieldProps: { placeholder: '请输入数据源名称' },
        formItemProps: {
          rules: [{ required: true, message: '请输入数据源名称' }]
        }
      },
      {
        title: '数据源类型',
        dataIndex: 'type',
        valueType: 'radio',
        fieldProps: {
          disabled: isEdit,
          options: [
            { label: 'MySQL', value: 'MYSQL' },
            { label: 'PostgreSQL', value: 'POSTGRESQL' },
            { label: 'ClickHouse', value: 'CLICKHOUSE' },
            { label: 'SQLite', value: 'SQLITE' },
            { label: 'MongoDB', value: 'MONGODB' },
            { label: 'Oracle', value: 'ORACLE' },
            { label: 'SQL Server', value: 'MSSQL' },
            { label: 'Elasticsearch', value: 'ESSEARCH' }
          ]
        },
        formItemProps: {
          rules: [{ required: true, message: '请选择数据源类型' }]
        }
      },
      // MySQL
      {
        title: '主机地址',
        dataIndex: ['config', 'mysql', 'host'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入主机地址' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MYSQL',
            rules: [{ required: type === 'MYSQL', message: '请输入主机地址' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '端口',
        dataIndex: ['config', 'mysql', 'port'],
        valueType: 'digit',
        initialValue: 3306,
        fieldProps: { placeholder: '请输入端口' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MYSQL',
            rules: [{ required: type === 'MYSQL', message: '请输入端口' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '数据库名',
        dataIndex: ['config', 'mysql', 'database'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入数据库名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MYSQL',
            rules: [{ required: type === 'MYSQL', message: '请输入数据库名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '用户名',
        dataIndex: ['config', 'mysql', 'user'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入用户名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MYSQL',
            rules: [{ required: type === 'MYSQL', message: '请输入用户名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '密码',
        dataIndex: ['config', 'mysql', 'password'],
        valueType: 'password',
        fieldProps: { placeholder: '请输入密码' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MYSQL',
            rules: [{ required: type === 'MYSQL', message: '请输入密码' }]
          }
        },
        dependencies: ['type']
      },
      // PostgreSQL
      {
        title: '主机地址',
        dataIndex: ['config', 'postgresql', 'host'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入主机地址' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'POSTGRESQL',
            rules: [{ required: type === 'POSTGRESQL', message: '请输入主机地址' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '端口',
        dataIndex: ['config', 'postgresql', 'port'],
        valueType: 'digit',
        initialValue: 5432,
        fieldProps: { placeholder: '请输入端口' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'POSTGRESQL',
            rules: [{ required: type === 'POSTGRESQL', message: '请输入端口' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '数据库名',
        dataIndex: ['config', 'postgresql', 'database'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入数据库名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'POSTGRESQL',
            rules: [{ required: type === 'POSTGRESQL', message: '请输入数据库名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '用户名',
        dataIndex: ['config', 'postgresql', 'user'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入用户名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'POSTGRESQL',
            rules: [{ required: type === 'POSTGRESQL', message: '请输入用户名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '密码',
        dataIndex: ['config', 'postgresql', 'password'],
        valueType: 'password',
        fieldProps: { placeholder: '请输入密码' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'POSTGRESQL',
            rules: [{ required: type === 'POSTGRESQL', message: '请输入密码' }]
          }
        },
        dependencies: ['type']
      },
      // ClickHouse
      {
        title: '主机地址',
        dataIndex: ['config', 'clickhouse', 'host'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入主机地址' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'CLICKHOUSE',
            rules: [{ required: type === 'CLICKHOUSE', message: '请输入主机地址' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '端口',
        dataIndex: ['config', 'clickhouse', 'port'],
        valueType: 'digit',
        initialValue: 8123,
        fieldProps: { placeholder: '请输入端口' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'CLICKHOUSE',
            rules: [{ required: type === 'CLICKHOUSE', message: '请输入端口' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '数据库名',
        dataIndex: ['config', 'clickhouse', 'database'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入数据库名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'CLICKHOUSE',
            rules: [{ required: type === 'CLICKHOUSE', message: '请输入数据库名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '用户名',
        dataIndex: ['config', 'clickhouse', 'user'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入用户名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'CLICKHOUSE',
            rules: [{ required: type === 'CLICKHOUSE', message: '请输入用户名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '密码',
        dataIndex: ['config', 'clickhouse', 'password'],
        valueType: 'password',
        fieldProps: { placeholder: '请输入密码' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'CLICKHOUSE',
            rules: [{ required: type === 'CLICKHOUSE', message: '请输入密码' }]
          }
        },
        dependencies: ['type']
      },
      // SQLite
      {
        title: '文件路径',
        dataIndex: ['config', 'sqlite', 'filename'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入SQLite文件路径' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'SQLITE',
            rules: [{ required: type === 'SQLITE', message: '请输入SQLite文件路径' }]
          }
        },
        dependencies: ['type']
      },
      // MongoDB
      {
        title: '连接URI',
        dataIndex: ['config', 'mongodb', 'uri'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入MongoDB连接URI' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MONGODB',
            rules: [{ required: type === 'MONGODB', message: '请输入MongoDB连接URI' }]
          }
        },
        dependencies: ['type']
      },
      // Oracle
      {
        title: '连接串',
        dataIndex: ['config', 'oracle', 'connectString'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入Oracle连接串' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'ORACLE',
            rules: [{ required: type === 'ORACLE', message: '请输入Oracle连接串' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '用户名',
        dataIndex: ['config', 'oracle', 'user'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入用户名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'ORACLE',
            rules: [{ required: type === 'ORACLE', message: '请输入用户名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '密码',
        dataIndex: ['config', 'oracle', 'password'],
        valueType: 'password',
        fieldProps: { placeholder: '请输入密码' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'ORACLE',
            rules: [{ required: type === 'ORACLE', message: '请输入密码' }]
          }
        },
        dependencies: ['type']
      },
      // MSSQL
      {
        title: '服务器',
        dataIndex: ['config', 'mssql', 'server'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入服务器地址' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MSSQL',
            rules: [{ required: type === 'MSSQL', message: '请输入服务器地址' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '端口',
        dataIndex: ['config', 'mssql', 'port'],
        valueType: 'digit',
        initialValue: 1433,
        fieldProps: { placeholder: '请输入端口' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MSSQL',
            rules: [{ required: type === 'MSSQL', message: '请输入端口' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '数据库名',
        dataIndex: ['config', 'mssql', 'database'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入数据库名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MSSQL',
            rules: [{ required: type === 'MSSQL', message: '请输入数据库名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '用户名',
        dataIndex: ['config', 'mssql', 'user'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入用户名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MSSQL',
            rules: [{ required: type === 'MSSQL', message: '请输入用户名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '密码',
        dataIndex: ['config', 'mssql', 'password'],
        valueType: 'password',
        fieldProps: { placeholder: '请输入密码' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'MSSQL',
            rules: [{ required: type === 'MSSQL', message: '请输入密码' }]
          }
        },
        dependencies: ['type']
      },
      // Elasticsearch
      {
        title: '节点地址',
        dataIndex: ['config', 'essearch', 'node'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入Elasticsearch节点地址' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'ESSEARCH',
            rules: [{ required: type === 'ESSEARCH', message: '请输入节点地址' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '索引名',
        dataIndex: ['config', 'essearch', 'index'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入索引名' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'ESSEARCH',
            rules: [{ required: type === 'ESSEARCH', message: '请输入索引名' }]
          }
        },
        dependencies: ['type']
      },
      {
        title: '用户名',
        dataIndex: ['config', 'essearch', 'username'],
        valueType: 'text',
        fieldProps: { placeholder: '请输入用户名（可选）' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'ESSEARCH',
            rules: []
          }
        },
        dependencies: ['type']
      },
      {
        title: '密码',
        dataIndex: ['config', 'essearch', 'password'],
        valueType: 'password',
        fieldProps: { placeholder: '请输入密码（可选）' },
        formItemProps: ({ getFieldValue }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== 'ESSEARCH',
            rules: []
          }
        },
        dependencies: ['type']
      }
    ]
  }

  // CRUD 操作配置
  const operations = {
    create: async (data: Pick<Datasource, 'name' | 'type' | 'config'>) => {
      const { name, type, config } = data
      return await datasourceApi.create({ name, type, config })
    },
    update: async (id: number, data: Partial<Pick<Datasource, 'name' | 'config'>>) => {
      const { name, config } = data
      return await datasourceApi.update(id, { name, config })
    },
    delete: async (id: number) => {
      await datasourceApi.delete(id)
    },
    list: async (params: Record<string, unknown>) => {
      try {
        const { current, pageSize, sorter, ...restParams } = params as { current?: number, pageSize?: number, sorter?: Record<string, 'ascend' | 'descend'> }
        const response = await datasourceApi.list({
          ...restParams,
          page: current,
          pageSize,
          sortBy: sorter ? Object.keys(sorter)[0] : 'createdAt',
          sortOrder: sorter ? (Object.values(sorter)[0] === 'ascend' ? 'asc' : 'desc') : 'desc'
        })

        return {
          data: response.list || [],
          success: true,
          total: response.total || 0
        }
      } catch (error) {
        console.error('获取数据源列表失败:', error)
        return {
          data: [],
          success: false,
          total: 0
        }
      }
    }
  }

  return (
    <>
      <CrudTable<Datasource>
        title="数据源管理"
        columns={columns}
        // 使用自定义快速创建/编辑弹窗，这里禁用 CrudTable 默认新建/编辑
        formColumns={getFormColumns}
        operations={{ list: operations.list, delete: operations.delete }}
        rowKey="id"
        defaultFormValues={{ type: 'MYSQL' }}
        enableUrlQuery={true}
        searchMode="simple"
        tableProps={{
          locale: { emptyText: '暂无数据源，点击右上角“新建”添加一个。' }
        }}
        actionsVariant="menu"
        actionColumnWidth={120}
        actionMenuItemsExtra={(record) => {
          const items: Array<{ key: string; label: React.ReactNode; onClick?: () => void }> = []
          {
            const ownerId = (record as unknown as Partial<Datasource>).ownerId as number | undefined
            const canEdit = !!(record as unknown as Partial<Datasource>).canWrite || isOwner(currentUserId, ownerId as number)
            if (canEdit) items.push({ key: 'edit', label: '编辑', onClick: () => { setEditing(record); setModalOpen(true) } })
            if (canEdit) items.push({ key: 'perm', label: '权限', onClick: () => { setPermTarget(record); setPermOpen(true) } })
          }
          return items
        }}
        actionsVisibility={{
          delete: (r: Datasource) => !!r?.canDelete || isOwner(currentUserId, (r as unknown as Partial<Datasource>).ownerId as number)
        }}
        toolBarRender={() => {
          if (!canCreate(currentOrgRole)) return []
          return [
            <Button key="add" type="primary" onClick={() => { setEditing(null); setModalOpen(true) }}>新建数据源</Button>
          ]
        }}
        ref={actionRef as unknown as React.Ref<ActionType>}
      />
      <QuickCreateDatasourceModal
        open={modalOpen}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSuccess={() => { setModalOpen(false); setEditing(null); actionRef.current?.reload() }}
      />
      <DataSourcePicker
        open={pickerOpen}
        initialSourceId={pickerInitSource}
        onCancel={() => { setPickerOpen(false); setPickerInitSource(undefined) }}
        onPicked={() => { setPickerOpen(false) }}
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
          await datasourceApi.update(permTarget.id, patch)
          message.success('已更新')
          actionRef.current?.reload()
        }}
      />
    </>
  )
}

export default DatasourceManagement
