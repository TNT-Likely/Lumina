import { CrudTable, CronPicker } from '@lumina/components'
import { message, Switch, Modal, Spin, Result, Typography, Space, Button } from 'antd'
import SubscriptionFormModal from '../../components/subscription/SubscriptionFormModal'
import { subscriptionApi, notificationApi, dashboardApi } from '@lumina/api'
import type { Subscription } from '@lumina/types'
import { type ActionType, type ProColumns, type ProFormColumnsType } from '@ant-design/pro-components'
import React from 'react'
import { canCreate, isOwner } from '../../utils/perm'
import PermissionDrawer from '../../components/permission/PermissionDrawer'
import { useAppContext } from '../../context/AppContext'

const SubscriptionList: React.FC = () => {
  // 通知方式选项
  const [notifyOptions, setNotifyOptions] = React.useState<Array<{ label: string, value: string }>>([])
  React.useEffect(() => {
    notificationApi.list({ page: 1, pageSize: 100 }).then(res => {
      setNotifyOptions((res.list || []).map((item: { id: number, name: string }) => ({ label: item.name, value: String(item.id) })))
    })
  }, [])

  // 仪表盘选项
  const [dashboardOptions, setDashboardOptions] = React.useState<Array<{ label: string, value: string }>>([])
  React.useEffect(() => {
    dashboardApi.list({ page: 1, pageSize: 100 }).then(res => {
      setDashboardOptions((res.list || []).map((item: { id: number, name: string }) => ({ label: item.name, value: String(item.id) })))
    })
  }, [])

  const actionRef = React.useRef<ActionType>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Subscription | null>(null)
  const [permOpen, setPermOpen] = React.useState(false)
  const [permTarget, setPermTarget] = React.useState<Subscription | null>(null)
  const { userId, currentOrg } = useAppContext()
  const bridgeUserId = typeof window !== 'undefined' ? localStorage.getItem('lumina.userId') : null
  const bridgeOrgRole = typeof window !== 'undefined' ? (localStorage.getItem('lumina.currentOrgRole') as 'ADMIN'|'EDITOR'|'VIEWER'|null) : null
  const currentUserId: number | null = userId ?? (bridgeUserId ? Number(bridgeUserId) : null)
  const currentOrgRole: 'ADMIN'|'EDITOR'|'VIEWER'|null = (currentOrg?.role as 'ADMIN'|'EDITOR'|'VIEWER'|undefined) ?? bridgeOrgRole ?? null
  const [testing, setTesting] = React.useState<{
    open: boolean
    title?: string
    status?: 'running' | 'success' | 'error'
    targetName?: string
    durationMs?: number
    errorMsg?: string
  }>({ open: false })

  // 不再重复拉取 profile/orgs
  const columns: ProColumns[] = [
    { title: 'ID', dataIndex: 'id', search: false },
    { title: '名称', dataIndex: 'name', search: true },
    { title: '仪表盘', dataIndex: 'dashboardId', valueType: 'select', search: true, fieldProps: { options: dashboardOptions } },
    {
      title: '通知方式',
      dataIndex: 'notifyIds',
      valueType: 'select',
      search: false,
      fieldProps: { options: notifyOptions, mode: 'multiple' },
      render: (_, record) => (record.notifyIds || []).map((id: string) => notifyOptions.find(opt => opt.value === id)?.label || id).join(', ')
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      valueType: 'switch',
      search: false,
      render: (_, record) => (
        <Switch
          checked={record.enabled}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          disabled={!isOwner(currentUserId, (record as Subscription).ownerId as unknown as number)}
          onChange={(checked) => {
            const toggleEnabled = async () => {
              await subscriptionApi.toggleEnabled(record.id, checked)
              message.success(checked ? '已启用' : '已禁用')
              actionRef.current?.reload?.()
            }
            toggleEnabled()
          }}
        />
      )
    },
    { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime', search: false }
  ]

  const getFormColumns = (record?: Subscription): ProFormColumnsType[] => [
    { title: '名称', dataIndex: 'name', valueType: 'text', formItemProps: { rules: [{ required: true, message: '请输入名称' }] } },
    { title: '仪表盘', dataIndex: 'dashboardId', valueType: 'select', fieldProps: { options: dashboardOptions, disabled: !!record?.id }, formItemProps: { rules: [{ required: true, message: '请选择仪表盘' }] } },
    { title: '通知方式', dataIndex: 'notifyIds', valueType: 'select', fieldProps: { options: notifyOptions, mode: 'multiple' }, formItemProps: { rules: [{ required: true, message: '请选择通知方式' }] } },
    {
      title: '订阅时间',
      dataIndex: ['config', 'schedule'],
      valueType: 'text',
      fieldProps: { placeholder: '如每天8点、cron表达式等' },
      formItemProps: { rules: [{ required: true, message: '请输入订阅时间' }] },
      renderFormItem: () => {
        return <CronPicker />
      }
    },
    {
      title: '订阅格式',
      dataIndex: ['config', 'format'],
      valueType: 'select',
      fieldProps: {
        options: [
          { label: '表格', value: 'table' },
          { label: '图片', value: 'image' },
          { label: 'PDF', value: 'pdf' },
          { label: 'Excel', value: 'excel' }
        ]
      },
      formItemProps: { rules: [{ required: true, message: '请选择订阅格式' }] }
    },
    { title: '过滤条件', dataIndex: ['config', 'filter'], valueType: 'text', fieldProps: { placeholder: '如仅推送异常数据、标签等' } },
    { title: '状态', dataIndex: 'enabled', valueType: 'switch', fieldProps: { checkedChildren: '启用', unCheckedChildren: '禁用' }, formItemProps: { valuePropName: 'checked' } },
    { title: '备注说明', dataIndex: ['config', 'remark'], valueType: 'textarea', fieldProps: { placeholder: '补充说明用途' } }
  ]

  const operations = {
    list: async (params: Record<string, unknown>) => {
      const { current, pageSize, ...rest } = params
      const res = await subscriptionApi.list({ ...rest, page: current, pageSize })
      return {
        data: res.list || [],
        total: res?.total || 0,
        success: true
      }
    },
    delete: async (id: number) => {
      await subscriptionApi.delete(id)
    }
  }

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (rec: Subscription) => { setEditing(rec); setFormOpen(true) }

  return (
    <>
      <CrudTable<Subscription>
        title="订阅列表"
        columns={columns}
        formColumns={getFormColumns}
        operations={operations}
        rowKey="id"
        ref={actionRef}
        searchMode="simple"
        actionsVariant="menu"
        toolBarRender={() => (
          canCreate(currentOrgRole)
            ? [
              <Button key="create" type="primary" onClick={openCreate}>
                新建订阅
              </Button>
            ]
            : []
        )}
        actionMenuItemsExtra={(record) => {
          const items: Array<{ key: string; label: React.ReactNode; onClick?: () => void }> = []
          items.push({
            key: 'test',
            label: '测试连通性',
            onClick: async () => {
              const start = Date.now()
              setTesting({ open: true, title: '正在测试订阅连通性…', status: 'running', targetName: record.name })
              try {
                await subscriptionApi.testConnection(record.id)
                const durationMs = Date.now() - start
                setTesting({ open: true, status: 'success', title: '测试完成', targetName: record.name, durationMs })
              } catch (e) {
                const durationMs = Date.now() - start
                const err = e as unknown as { message?: string; response?: { data?: { message?: string } } }
                const msg = err?.message || err?.response?.data?.message || '测试失败'
                setTesting({ open: true, status: 'error', title: '测试失败', targetName: record.name, durationMs, errorMsg: msg })
              } finally {
                // 保持结果展示，由用户关闭
              }
            }
          })
          {
            const ownerId = (record as unknown as Partial<Subscription>).ownerId as number | undefined
            const canEdit = !!(record as unknown as Partial<Subscription>).canWrite || isOwner(currentUserId, ownerId as number)
            if (canEdit) items.push({ key: 'perm', label: '权限', onClick: () => { setPermTarget(record); setPermOpen(true) } })
            if (canEdit) items.push({ key: 'edit', label: '编辑', onClick: () => openEdit(record) })
          }
          return items
        }}
        actionsVisibility={{
          delete: (r: Subscription) => !!r?.canDelete || isOwner(currentUserId, (r as unknown as Partial<Subscription>).ownerId as number)
        }}
        enableUrlQuery
      />
      <SubscriptionFormModal
        open={formOpen}
        mode={editing ? 'edit' : 'create'}
        record={editing}
        showDashboardSelect={!editing}
        dashboardOptions={dashboardOptions}
        onClose={() => setFormOpen(false)}
        onSuccess={async () => { actionRef.current?.reload?.() }}
      />
      <Modal
        open={testing.open}
        onCancel={() => setTesting({ open: false })}
        footer={
          testing.status && testing.status !== 'running'
            ? [
              <Button key="close" type="primary" onClick={() => setTesting({ open: false })}>关闭</Button>
            ]
            : null
        }
        closable={testing.status !== 'running'}
        destroyOnClose
        title={testing.title || '测试'}
      >
        {testing.status === 'running' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <Spin />
            <div>
              <div>正在测试订阅连通性…</div>
              {testing.targetName && <Typography.Text type="secondary">目标：{testing.targetName}</Typography.Text>}
            </div>
          </div>
        )}
        {testing.status && testing.status !== 'running' && (
          <Result
            status={testing.status}
            title={testing.status === 'success' ? '连通性正常' : '连通性异常'}
            subTitle={
              <Space direction="vertical" size={2}>
                {typeof testing.durationMs === 'number' && <Typography.Text type="secondary">耗时：{testing.durationMs} ms</Typography.Text>}
                {testing.errorMsg && (
                  <Typography.Paragraph
                    type="danger"
                    ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                    style={{ marginBottom: 0 }}
                  >
                    {testing.errorMsg}
                  </Typography.Paragraph>
                )}
              </Space>
            }
          />
        )}
      </Modal>
      <PermissionDrawer
        open={permOpen}
        title={`设置权限 - ${permTarget?.name || ''}`}
        target={permTarget}
        currentUserId={currentUserId}
        orgMembers={[]}
        onClose={() => { setPermOpen(false); setPermTarget(null) }}
        onSubmit={async (patch) => {
          if (!permTarget) return
          await subscriptionApi.update(permTarget.id, patch)
          message.success('已更新')
          actionRef.current?.reload()
        }}
      />
    </>
  )
}

export default SubscriptionList
