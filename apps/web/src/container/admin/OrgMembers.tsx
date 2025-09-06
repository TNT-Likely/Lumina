import React, { useRef } from 'react'
import { useParams } from 'react-router-dom'
import { CrudTable } from '@lumina/components'
import type { ProColumns, ProFormColumnsType, ActionType } from '@ant-design/pro-components'
import { OrgApi, UserApi } from '@lumina/api'
import { Avatar, Space, Tag, Typography, Tooltip, Select, message } from 'antd'
import { useAppContext } from '../../context/AppContext'

type Role = 'ADMIN' | 'EDITOR' | 'VIEWER'
interface Member { orgId: number, userId: number, role: Role, user?: { id: number, email: string, username: string, displayName?: string | null, avatarUrl?: string | null } }
interface Invite { id: number, email: string, role: Role, status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED', expiresAt?: string }

export default function OrgMembersPage () {
  const params = useParams()
  const orgId = React.useMemo(() => Number(params.orgId), [params.orgId])
  const { userId, orgs } = useAppContext()
  const meId = userId ?? null
  const isRoot = userId === 1
  const [orgName, setOrgName] = React.useState<string>('')
  const [orgRole, setOrgRole] = React.useState<Role | null>(null)
  const canManage = isRoot || orgRole === 'ADMIN'
  const memberActionRef = useRef<ActionType | null>(null)
  const inviteActionRef = useRef<ActionType | null>(null)

  // 获取组织名称用于标题展示
  React.useEffect(() => {
    if (!Number.isFinite(orgId)) return
    (async () => {
      try {
        const list = await OrgApi.adminListOrgs()
        const item = (list as unknown as Array<{ id: number, name: string }>).find(i => i.id === orgId)
        if (item?.name) setOrgName(item.name)
      } catch { }
    })()
  }, [orgId])

  // 获取我在该组织的角色，判断是否可新增成员/邀请
  React.useEffect(() => {
    if (!Number.isFinite(orgId)) return
    try {
      const mine = (orgs || []).find(o => o.id === orgId)
      if (mine && (mine.role === 'ADMIN' || mine.role === 'EDITOR' || mine.role === 'VIEWER')) setOrgRole(mine.role as Role)
    } catch {}
  }, [orgId, orgs])

  const roleTag = (r: Role) => (
    <Tag color={r === 'ADMIN' ? 'red' : r === 'EDITOR' ? 'blue' : 'default'}>{r}</Tag>
  )

  // 成员列表（使用 CrudTable）
  const memberColumns: ProColumns<Member>[] = [
    {
      title: '成员',
      dataIndex: 'user',
      render: (_: unknown, r: Member) => {
        const name = r.user?.displayName || r.user?.username || `用户#${r.userId}`
        const email = r.user?.email
        return (
          <Space>
            <Avatar size={28} src={r.user?.avatarUrl}>{name?.slice(0, 1).toUpperCase()}</Avatar>
            <div>
              <div>{name}</div>
              {email ? <div style={{ color: '#999', fontSize: 12 }}>{email}</div> : null}
            </div>
          </Space>
        )
      }
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 180,
      fieldProps: {
        options: [
          { label: 'ADMIN', value: 'ADMIN' },
          { label: 'EDITOR', value: 'EDITOR' },
          { label: 'VIEWER', value: 'VIEWER' }
        ]
      },
      render: (_: unknown, r: Member) => {
        const protectAdmin = r.role === 'ADMIN' && !isRoot && r.userId !== meId
        const selfProtect = r.userId === meId && orgRole === 'ADMIN' && !isRoot
        const disabled = protectAdmin || selfProtect
        const selector = (
          <Select
            size="small"
            value={r.role}
            style={{ width: 120 }}
            disabled={disabled}
            onChange={async (val: Role) => {
              await OrgApi.updateMemberRole(orgId, r.userId, val)
              message.success('角色已更新')
              try { memberActionRef.current?.reload?.() } catch {}
            }}
            options={[
              { label: 'ADMIN', value: 'ADMIN' },
              { label: 'EDITOR', value: 'EDITOR' },
              { label: 'VIEWER', value: 'VIEWER' }
            ]}
          />
        )
        return (
          <Space>
            {roleTag(r.role)}
            {disabled
              ? (
                <Tooltip title={protectAdmin ? '仅 root 可修改其他管理员' : '管理员不能修改自己的角色'}>
                  {selector}
                </Tooltip>
              )
              : selector}
          </Space>
        )
      }
    }
  ]

  const memberFormColumns: ((record?: Member) => ProFormColumnsType[]) = (record) => {
    const isEdit = !!record && typeof (record as Member).userId !== 'undefined'
    const cols: ProFormColumnsType[] = []
    if (!isEdit) {
      cols.push({
        dataIndex: 'userId',
        title: '用户',
        valueType: 'select',
        formItemProps: { rules: [{ required: true, message: '请选择用户' }] },
        fieldProps: { showSearch: true, filterOption: false, style: { width: 360 } },
        request: async ({ keyWords }: { keyWords?: string }) => {
          const list = await UserApi.search(keyWords || '') as Array<{ id: number, email: string, username: string, displayName?: string | null }>
          return (list || []).map((u) => ({
            label: `${u.email} (${u.username}${u.displayName ? ' / ' + u.displayName : ''})`,
            value: u.id
          }))
        }
      })
    }
    cols.push({
      dataIndex: 'role',
      title: '角色',
      valueType: 'select',
      initialValue: 'VIEWER',
      formItemProps: { rules: [{ required: true }] },
      fieldProps: { options: [{ label: 'ADMIN', value: 'ADMIN' }, { label: 'EDITOR', value: 'EDITOR' }, { label: 'VIEWER', value: 'VIEWER' }], style: { width: 140 } }
    })
    return cols
  }

  // 邀请列表（使用 CrudTable）
  const inviteColumns: ProColumns<Invite>[] = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '邮箱', dataIndex: 'email' },
    { title: '角色', dataIndex: 'role', width: 120, render: (_: unknown, r: Invite) => roleTag(r.role) },
    { title: '状态', dataIndex: 'status', width: 120 },
    { title: '过期时间', dataIndex: 'expiresAt', width: 200 }
  ]

  const inviteFormColumns: ProFormColumnsType[] = [
    { dataIndex: 'email', title: '邮箱', valueType: 'text', formItemProps: { rules: [{ required: true, type: 'email' as const }] } },
    { dataIndex: 'role', title: '角色', valueType: 'select', initialValue: 'VIEWER', fieldProps: { options: [{ label: 'ADMIN', value: 'ADMIN' }, { label: 'EDITOR', value: 'EDITOR' }, { label: 'VIEWER', value: 'VIEWER' }], style: { width: 140 } } },
    { dataIndex: 'ttlHours', title: '有效期(小时)', valueType: 'digit', fieldProps: { min: 1, max: 720 }, initialValue: 72 }
  ]

  return (
    <div>
      <Typography.Title level={3}>{orgName ? `${orgName} 组织管理` : `组织 ${orgId} 成员管理`}</Typography.Title>

      <CrudTable<Member>
        title="成员"
        rowKey="userId"
        ref={(r) => { memberActionRef.current = r }}
        columns={memberColumns}
        formColumns={memberFormColumns}
        searchMode="simple"
        actionsVariant="menu"
        actionsVisibility={{
          create: () => canManage,
          edit: (r) => true,
          delete: (r) => {
            const m = r as Member
            // 禁止：非 root 删除其他 ADMIN；禁止删除自己
            if (m.userId === meId) return false
            return !(m.role === 'ADMIN' && !isRoot && m.userId !== meId)
          }
        }}
        onFormSubmit={async (values) => {
          try {
            await OrgApi.addMember(orgId, Number(values.userId), values.role)
            return true
          } catch { return false }
        }}
        operations={{
          // 提供 create 以启用“新建”按钮（实际提交仍由 onFormSubmit 处理）
          create: async () => { /* no-op: 由 onFormSubmit 执行 */ },
          list: async () => {
            const res = await OrgApi.listMembers(orgId)
            const data = (res as unknown as Member[]) || []
            return { data, total: data.length, success: true }
          },
          delete: async (id: number) => { await OrgApi.removeMember(orgId, id) }
        }}
      />

      <div style={{ height: 12 }} />

      <CrudTable<Invite>
        title="邀请"
        rowKey="id"
        ref={(r) => { inviteActionRef.current = r }}
        columns={inviteColumns}
        formColumns={inviteFormColumns}
        searchMode="none"
        actionsVariant="menu"
        actionsVisibility={{
          create: () => canManage,
          edit: () => false,
          delete: (r) => (r as Invite).status === 'PENDING'
        }}
        onFormSubmit={async (values, isEdit) => {
          if (isEdit) return false
          try {
            const v = values as unknown as { email: string, role: Role, ttlHours?: number }
            await OrgApi.createInvite(orgId, v.email, v.role, v.ttlHours)
            return true
          } catch { return false }
        }}
        operations={{
          // 提供 create 以启用“新建”按钮（实际提交仍由 onFormSubmit 处理）
          create: async () => { /* no-op: 由 onFormSubmit 执行 */ },
          list: async () => {
            const res = await OrgApi.listInvites(orgId)
            const data = (res as unknown as Invite[]) || []
            return { data, total: data.length, success: true }
          },
          delete: async (id: number) => { await OrgApi.revokeInvite(id) }
        }}
      />
    </div>
  )
}
