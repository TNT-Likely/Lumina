import React from 'react'
import { CrudTable } from '@lumina/components'
import { message, Modal, Spin, Result, Tag, Typography, Space, Button } from 'antd'
import { notificationApi } from '@lumina/api'
import type { Notification, NotificationConfig } from '@lumina/types'
import { type ProColumns, type ProFormColumnsType, type ActionType } from '@ant-design/pro-components'
import PermissionDrawer from '../../components/permission/PermissionDrawer'
import { canCreate } from '../../utils/perm'

const NotifyList: React.FC = () => {
  const actionRef = React.useRef<ActionType>(null)
  // 行级 loading 状态，key 为通知 id
  const [rowLoading, setRowLoading] = React.useState<Record<number, boolean>>({})
  const [testing, setTesting] = React.useState<{
    open: boolean
    title?: string
    status?: 'running' | 'success' | 'error'
    targetName?: string
    method?: 'text' | 'image'
    durationMs?: number
    errorMsg?: string
  }>({ open: false })
  const [permOpen, setPermOpen] = React.useState(false)
  const [permTarget, setPermTarget] = React.useState<Notification | null>(null)
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null)
  const [currentOrgRole, setCurrentOrgRole] = React.useState<'ADMIN'|'EDITOR'|'VIEWER'|null>(null)
  const bridgeUserId = typeof window !== 'undefined' ? localStorage.getItem('lumina.userId') : null
  const bridgeOrgRole = typeof window !== 'undefined' ? (localStorage.getItem('lumina.currentOrgRole') as 'ADMIN'|'EDITOR'|'VIEWER'|null) : null
  React.useEffect(() => {
    setCurrentUserId(bridgeUserId ? Number(bridgeUserId) : null)
    setCurrentOrgRole(bridgeOrgRole || null)
  }, [bridgeUserId, bridgeOrgRole])
  // 使用 CrudTable 内置表单，不再维护本地 formOpen/editing

  // 不再重复拉取 profile/orgs

  // 通知类型选项
  const typeOptions = [
    { label: 'Slack', value: 'slack' },
    { label: 'Telegram', value: 'telegram' },
    { label: 'Discord', value: 'discord' },
    { label: 'Email', value: 'email' },
    { label: '钉钉', value: 'ding' },
    { label: '飞书', value: 'lark' }
  ]

  const typeColor: Record<string, string> = { slack: 'blue', telegram: 'cyan', discord: 'purple', email: 'gold', ding: 'orange', lark: 'geekblue' }

  const columns: ProColumns[] = [
    { title: 'ID', dataIndex: 'id', search: true },
    { title: '名称', dataIndex: 'name', search: true, render: (_, r) => <Typography.Link>{r.name}</Typography.Link> },
    { title: '类型', dataIndex: 'type', valueType: 'select', search: true, fieldProps: { options: typeOptions }, render: (_, r) => <Tag color={typeColor[r.type] || 'default'}>{typeOptions.find(o => o.value === r.type)?.label || r.type}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime', search: false }
  ]

  const getFormColumns = (record?: Notification): ProFormColumnsType[] => {
    // 各类型的配置项定义
    const configFields: Record<string, Array<{ name: string, label: string, required?: boolean, placeholder?: string }>> = {
      ding: [
        { name: 'accessToken', label: 'AccessToken', required: true },
        { name: 'secret', label: 'Secret', required: true }
      ],
      email: [
        { name: 'to', label: '收件人', required: true }
      ],
      telegram: [
        { name: 'botToken', label: 'Bot Token', required: true },
        { name: 'chatId', label: 'Chat ID', required: true }
      ],
      slack: [
        { name: 'botToken', label: 'Bot Token', required: false, placeholder: '可选，优先使用此 token' },
        { name: 'channel', label: 'Channel', required: true, placeholder: '请输入频道ID（如Cxxxxxx）' },
        { name: 'clientId', label: 'Client ID', required: true, placeholder: '用于自动刷新 token' },
        { name: 'clientSecret', label: 'Client Secret', required: true, placeholder: '用于自动刷新 token' },
        { name: 'refreshToken', label: 'Refresh Token', required: true, placeholder: '用于自动刷新 token' }
      ],
      lark: [
        { name: 'webhook', label: 'Webhook', required: true },
        { name: 'secret', label: 'Secret', required: false }
      ],
      discord: [
        { name: 'botToken', label: 'Bot Token', required: true, placeholder: '在 Discord 开发者后台获取 Bot Token' },
        { name: 'channelId', label: 'Channel ID', required: true, placeholder: '右键频道-复制ID，形如1234567890' }
      ]
    }

    // 通用表单项
    const baseFields = [
      { title: '名称', dataIndex: 'name', formItemProps: { rules: [{ required: true, message: '请输入名称' }] } },
      {
        title: '类型',
        dataIndex: 'type',
        valueType: 'select' as const,
        fieldProps: { options: typeOptions, disabled: !!record?.id },
        formItemProps: { rules: [{ required: true, message: '请选择类型' }] }
      }
    ]

    // 配置项表单
    const configFormFields = Object.entries(configFields).flatMap(([notifyType, fields]) =>
      fields.map(field => ({
        title: field.label,
        // 保证 dataIndex 唯一，避免 key 冲突
        dataIndex: ['config', notifyType, field.name],
        valueType: 'text' as const,
        fieldProps: { placeholder: field.placeholder || `请输入${field.label}` },
        formItemProps: ({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => {
          const type = getFieldValue('type')
          return {
            hidden: type !== notifyType,
            rules: field.required && type === notifyType ? [{ required: true, message: `请输入${field.label}` }] : []
          }
        },
        dependencies: ['type']
      }))
    )

    return [
      ...baseFields,
      ...configFormFields
    ]
  }

  const operations = {
    list: async (params: Record<string, unknown>) => {
      const { current, pageSize, ...rest } = params
      const res = await notificationApi.list({ ...rest, page: current, pageSize })
      return {
        data: res.list,
        total: res.total || 0,
        success: true
      }
    },
    create: async (data: Notification) => {
      return await notificationApi.create(data)
    },
    update: async (id: number, data: Partial<Notification>) => {
      // 仅传递可更新字段
      const { name, type, config } = (data as Partial<Notification>) as { name?: string, type?: string, config?: NotificationConfig }
      return await notificationApi.update(id, { name, type, config })
    },
    delete: async (id: number) => {
      await notificationApi.delete(id)
    }
  }

  return (
    <>
      <CrudTable<Notification>
        title="通知方式列表"
        columns={columns}
        formColumns={getFormColumns}
        operations={operations}
        rowKey="id"
        ref={actionRef}
        searchMode="simple"
        actionsVariant="menu"
        actionMenuItemsExtra={(record) => {
          const items: Array<{ key: string; label: React.ReactNode; onClick?: () => void }> = []
          items.push({
            key: 'test-text',
            label: '测试文本',
            onClick: async () => {
              const start = Date.now()
              setTesting({ open: true, title: '正在测试文本通知连通性…', status: 'running', targetName: record.name, method: 'text' })
              try {
                await notificationApi.testConnection(record.id, 'text')
                const durationMs = Date.now() - start
                setTesting({ open: true, status: 'success', title: '测试完成', targetName: record.name, method: 'text', durationMs })
              } catch (e) {
                const durationMs = Date.now() - start
                const err = e as unknown as { message?: string; response?: { data?: { message?: string } } }
                const msg = err?.message || err?.response?.data?.message || '测试失败'
                setTesting({ open: true, status: 'error', title: '测试失败', targetName: record.name, method: 'text', durationMs, errorMsg: msg })
              } finally {
                // 保持结果展示，由用户关闭
              }
            }
          })
          items.push({
            key: 'test-image',
            label: '测试图片',
            onClick: async () => {
              const start = Date.now()
              setTesting({ open: true, title: '正在测试图片通知连通性…', status: 'running', targetName: record.name, method: 'image' })
              try {
                await notificationApi.testConnection(record.id, 'image')
                const durationMs = Date.now() - start
                setTesting({ open: true, status: 'success', title: '测试完成', targetName: record.name, method: 'image', durationMs })
              } catch (e) {
                const durationMs = Date.now() - start
                const err = e as unknown as { message?: string; response?: { data?: { message?: string } } }
                const msg = err?.message || err?.response?.data?.message || '测试失败'
                setTesting({ open: true, status: 'error', title: '测试失败', targetName: record.name, method: 'image', durationMs, errorMsg: msg })
              } finally {
                // 保持结果展示，由用户关闭
              }
            }
          })
          const canEdit = !!(record as unknown as Partial<Notification>).canWrite
          if (canEdit) items.push({ key: 'perm', label: '权限', onClick: () => { setPermTarget(record); setPermOpen(true) } })
          return items
        }}
        actionsVisibility={{
          create: () => canCreate(currentOrgRole),
          edit: (r: Notification) => !!r?.canWrite,
          delete: (r: Notification) => !!r?.canDelete
        }}
        enableUrlQuery
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
              <div>正在测试 {testing.method === 'image' ? '图片' : '文本'} 通知…</div>
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
                <Typography.Text>类型：{testing.method === 'image' ? '图片' : '文本'}</Typography.Text>
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
          await notificationApi.update(permTarget.id, patch)
          message.success('已更新')
          actionRef.current?.reload()
        }}
      />
    </>
  )
}

export default NotifyList
