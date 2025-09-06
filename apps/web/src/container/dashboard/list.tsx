import React, { useMemo, useRef, useState } from 'react'
import { Button } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import ShareModal from '../../components/share/ShareModal'
import { dashboardApi } from '@lumina/api'
import { CrudTable } from '@lumina/components'
import type { ActionType } from '@ant-design/pro-components'
import PermissionDrawer from '../../components/permission/PermissionDrawer'
import type { Dashboard } from '@lumina/types'
import { useNavigate } from 'react-router-dom'

const DashboardListPage: React.FC = () => {
  const [permOpen, setPermOpen] = useState(false)
  const [permTarget, setPermTarget] = useState<Dashboard | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [memberOptions, setMemberOptions] = useState<Array<{ label: string, value: number }>>([])
  const [currentOrgRole, setCurrentOrgRole] = useState<'ADMIN'|'EDITOR'|'VIEWER'|null>(null)
  const actionRef = useRef<ActionType>()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareId, setShareId] = useState<number | null>(null)

  React.useEffect(() => {
    setCurrentUserId(Number(localStorage.getItem('lumina.userId')) || null)
    setCurrentOrgRole((localStorage.getItem('lumina.currentOrgRole') as 'ADMIN'|'EDITOR'|'VIEWER') || null)
    setMemberOptions([])
  }, [])

  const navigate = useNavigate()

  return <>
    <CrudTable<Dashboard>
      title="仪表盘列表"
      columns={[
        { title: 'ID', dataIndex: 'id' },
        {
          title: '名称',
          dataIndex: 'name',
          render: (_, record: Dashboard) => {
            const canEdit = !!record?.canWrite || (!!currentUserId && record.ownerId === currentUserId)
            const to = canEdit ? `/dashboard?id=${record.id}` : `/dashboard/preview?id=${record.id}`
            return (
              <a onClick={() => navigate(to)}>{record.name}</a>
            )
          }
        },
        { title: '描述', dataIndex: 'description', search: false },
        { title: '创建时间', dataIndex: 'createdAt', search: false }
      ]}
      formColumns={[]}
      operations={{
        list: async (params) => {
          const res = await dashboardApi.list(params)
          return {
            data: res.list,
            total: res.total,
            success: true
          }
        },
        delete: async (id) => await dashboardApi.delete(id)
      }}
      rowKey="id"
      ref={actionRef as unknown as React.Ref<ActionType>}
      viewRender={() => null}
      enableUrlQuery={true}
      searchMode="simple"
      simpleSearchTrigger={<Button icon={<FilterOutlined />}>筛选</Button>}
      simpleSearchForm={[
        { title: '名称', dataIndex: 'name', valueType: 'text' }
      ]}
      tableProps={{ locale: { emptyText: '暂无仪表盘，点击右上角“新建仪表盘”开始创建。' } }}
      actionsVariant="menu"
      actionColumnWidth={120}
      actionMenuItemsExtra={(record: Dashboard) => {
        const canEdit = !!record?.canWrite || (!!currentUserId && record.ownerId === currentUserId)
        const items = [] as Array<{ key: string; label: React.ReactNode; onClick?: () => void }>
        if (canEdit) items.push({ key: 'edit', label: '编辑', onClick: () => navigate(`/dashboard?id=${record.id}`) })
        items.push({ key: 'preview', label: '预览', onClick: () => navigate(`/dashboard/preview?id=${record.id}`) })
        if (canEdit || record?.canDelete) items.push({ key: 'share', label: '分享', onClick: () => { setShareId(record.id as number); setShareOpen(true) } })
        if (canEdit) items.push({ key: 'perm', label: '权限', onClick: () => { setPermTarget(record as unknown as Dashboard); setPermOpen(true) } })
        return items
      }}
      actionsVisibility={{
        delete: (r) => !!r?.canDelete || (!!currentUserId && (r as Dashboard).ownerId === currentUserId)
      }}
      toolBarRender={() => {
        const canCreate = currentOrgRole === 'ADMIN' || currentOrgRole === 'EDITOR'
        const arr: React.ReactNode[] = []
        if (canCreate) {
          arr.push(
            <Button
              type="primary"
              key="add"
              onClick={() => navigate('/dashboard')}
            >
            新建仪表盘
            </Button>
          )
        }
        return arr
      }}
    />
    <ShareModal open={shareOpen} dashboardId={shareId || 0} onClose={() => { setShareOpen(false); setShareId(null) }} />
    <PermissionDrawer
      open={permOpen}
      title={`设置权限 - ${permTarget?.name || ''}`}
      target={permTarget}
      currentUserId={currentUserId}
      orgMembers={memberOptions}
      onClose={() => { setPermOpen(false); setPermTarget(null) }}
      onSubmit={async (patch) => {
        if (!permTarget) return
        await dashboardApi.update(permTarget.id, patch)
        actionRef.current?.reload()
      }}
    />
  </>
}

export default DashboardListPage
