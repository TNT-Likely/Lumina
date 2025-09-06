import React from 'react'
import { Button, Typography } from 'antd'
import { CrudTable } from '@lumina/components'
import type { ProColumns, ProFormColumnsType } from '@ant-design/pro-components'
import { OrgApi, setSelectedOrgId } from '@lumina/api'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'

type OrgItem = { id: number; name: string; slug: string }

export default function OrgList () {
  const { userId } = useAppContext()
  const isRoot = userId === 1
  const navigate = useNavigate()

  const columns: ProColumns<OrgItem>[] = [
    { title: 'ID', dataIndex: 'id', width: 100 },
    { title: '名称', dataIndex: 'name', render: (_, record) => <Button type='link' onClick={() => { navigate(`/admin/orgs/${record.id}/members`) }}>{record.name}</Button> },
    { title: '标识', dataIndex: 'slug' }
  ]

  const formColumns: ProFormColumnsType[] = [
    { dataIndex: 'name', title: '名称', valueType: 'text', formItemProps: { rules: [{ required: true, message: '请输入名称' }] } },
    { dataIndex: 'slug', title: '标识', valueType: 'text', formItemProps: { rules: [{ required: true, message: '请输入 slug' }] } }
  ]

  return (
    <CrudTable<OrgItem>
      title="组织列表"
      rowKey="id"
      columns={columns}
      formColumns={formColumns}
      searchMode="none"
      actionsVariant="menu"
      actionMenuItemsExtra={(record) => [
        { key: 'members', label: '成员/邀请', onClick: () => { window.location.href = `/admin/orgs/${record.id}/members` } }
      ]}
      actionsVisibility={{
        create: () => isRoot,
        edit: () => isRoot,
        delete: () => isRoot
      }}
      onFormSubmit={async (values, isEdit) => {
        try {
          const v = values as unknown as { id?: number; name: string; slug: string }
          if (isEdit) {
            if (!v.id) return false
            await OrgApi.adminUpdateOrg(v.id, { name: v.name, slug: v.slug })
            return true
          }
          const res = await OrgApi.adminCreateOrg({ name: v.name, slug: v.slug })
          const resObj = res as unknown as { id?: number } | { data?: { id?: number } }
          const newOrgId: number | undefined = (resObj as { id?: number }).id ?? (resObj as { data?: { id?: number } })?.data?.id
          if (newOrgId) {
            setSelectedOrgId(String(newOrgId))
            try { localStorage.setItem('lumina.orgId', String(newOrgId)) } catch { }
            window.dispatchEvent(new Event('focus'))
          }
          return true
        } catch { return false }
      }}
      operations={{
        create: (data) => {
          return OrgApi.adminCreateOrg(data)
        },
        list: async () => {
          const res = (await OrgApi.adminListOrgs()) as unknown as OrgItem[]
          return { data: res, total: res.length, success: true }
        },
        delete: async (id: number) => { await OrgApi.adminDeleteOrg(id) }
      }}
    />
  )
}
