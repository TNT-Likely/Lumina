import React, { useMemo, useState, useEffect } from 'react'
import { Dropdown, Avatar, Typography, Button, Space, Tooltip, Modal } from 'antd'
import { UserOutlined, SettingOutlined, MenuFoldOutlined, MenuUnfoldOutlined, AlertOutlined, BookOutlined, BellOutlined, TeamOutlined, ShareAltOutlined, LogoutOutlined } from '@ant-design/icons'
import { AppShell, PageHeader, Toolbar } from '@lumina/components'
// import OrgSwitcher from '../components/org/OrgSwitcher'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import PrimaryNav from '../components/navigation/PrimaryNav'
import type { OrgRole } from '../utils/perm'
import { UserApi, OrgApi, getSelectedOrgId, setSelectedOrgId } from '@lumina/api'
import { AppContext, type AppOrg, type AppProfile } from '../context/AppContext'
import QuickCreateDatasourceModal from '../components/datasource/QuickCreateDatasourceModal'
import DataSourcePicker from '../components/dataset/DataSourcePicker'

const { Text } = Typography

const AppLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [avatar, setAvatar] = useState<string | undefined>(undefined)
  const [displayName, setDisplayName] = useState<string>('')
  const [userId, setUserId] = useState<number | undefined>(undefined)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true)
  const [createDsOpen, setCreateDsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerInitSource, setPickerInitSource] = useState<number | undefined>(undefined)
  const [orgs, setOrgs] = useState<Array<{ id: number, name: string, role: string }>>([])
  const [currentOrg, setCurrentOrg] = useState<{ id: number, name: string, role: string } | null>(null)
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [orgModalOpen, setOrgModalOpen] = useState(false)

  const refreshProfile = React.useCallback(async () => {
    const p = await UserApi.profile().catch(() => null)
    if (p?.avatar) setAvatar(p.avatar)
    if (p) setDisplayName(p.displayName || p.username || p.email || '')
    if (p?.id) setUserId(p.id)
    setProfile(p as AppProfile)
  }, [])
  useEffect(() => {
    let mounted = true
    ;(async () => { if (mounted) await refreshProfile() })()
    return () => { mounted = false }
  }, [refreshProfile])

  // 加载组织列表与当前组织
  const refreshOrgs = React.useCallback(async () => {
    const list = await OrgApi.listMyOrgs().catch(() => [])
    setOrgs(list.map(o => ({ id: o.id, name: o.name, role: o.role })))
    const saved = Number(getSelectedOrgId() || list?.[0]?.id || 1)
    const cur = list.find(o => o.id === saved) || list[0]
    if (cur) setCurrentOrg({ id: cur.id, name: cur.name, role: cur.role })
  }, [])
  useEffect(() => {
    let mounted = true
    ;(async () => { if (mounted) await refreshOrgs() })()
    return () => { mounted = false }
  }, [refreshOrgs])

  // 过渡期桥接：把 userId 与当前组织角色写入 localStorage，便于旧页面读取
  useEffect(() => {
    if (userId != null) localStorage.setItem('lumina.userId', String(userId))
    else localStorage.removeItem('lumina.userId')
  }, [userId])
  useEffect(() => {
    const role = currentOrg?.role
    if (role === 'ADMIN' || role === 'EDITOR' || role === 'VIEWER') {
      localStorage.setItem('lumina.currentOrgRole', role)
    } else {
      localStorage.removeItem('lumina.currentOrgRole')
    }
  }, [currentOrg])

  // 组织切换：软刷新 Outlet 子树
  useEffect(() => {
    const handler = () => {
      window.location.reload()
    }
    window.addEventListener('lumina:orgChanged', handler as EventListener)
    return () => window.removeEventListener('lumina:orgChanged', handler as EventListener)
  }, [])

  // global quick-create events
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

  // 需求：PageHeader 去掉多余的面包屑，这里直接禁用
  const breadcrumb: Array<{ title: string; href?: string }> = []

  const userMenu = {
    items: [
      {
        key: 'org-indicator',
        icon: <TeamOutlined />,
        label: (
          <span style={{ fontSize: 12 }}>{currentOrg ? `${currentOrg.name}（${currentOrg.role}）` : '组织'}</span>
        )
      },
      { type: 'divider' as const },
      { key: 'notification', icon: <BellOutlined />, label: <Link to="/notification/list">通知</Link> },
      { key: 'subscription', icon: <AlertOutlined />, label: <Link to="/subscription/list">订阅</Link> },
      ...((userId === 1 || (currentOrg?.role === 'ADMIN'))
        ? [{ key: 'org', icon: <TeamOutlined />, label: <Link to="/admin/orgs">组织管理</Link> }]
        : []),
      { type: 'divider' as const },
      { key: 'settings', icon: <SettingOutlined />, label: <Link to="/settings">个人设置</Link> },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: <span onClick={async () => { const { AuthApi } = await import('@lumina/api'); await AuthApi.logout(); window.location.replace('/login') }}>退出登录</span> }
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'org-indicator') setOrgModalOpen(true)
    }
  }

  const header = (
    <PageHeader
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="text"
            size="small"
            aria-label="切换侧栏"
            onClick={() => setSidebarCollapsed(v => !v)}
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          />
          <Link to="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'inherit' }}>
            <img src="/lumina.svg" alt="logo" width={18} height={18} style={{ display: 'block' }} />
            <span>Lumina</span>
          </Link>
        </span>
      )}
      breadcrumb={breadcrumb}
      extra={(
        <Space size={12} align="center">
          <Text type="secondary" style={{ fontSize: 12 }}>{displayName || '未命名用户'}</Text>
          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <Avatar size="small" {...(avatar ? { src: avatar } : { icon: <UserOutlined /> })} />
          </Dropdown>
        </Space>
      )}
    />
  )

  const ctxValue = useMemo(() => ({
    userId: userId ?? null,
    profile,
    orgs: orgs as unknown as AppOrg[],
    currentOrg: currentOrg as unknown as AppOrg | null,
    switchOrg: (orgId: number) => {
      setSelectedOrgId(String(orgId))
      const cur = orgs.find(o => o.id === orgId) || null
      if (cur) setCurrentOrg({ id: cur.id, name: cur.name, role: cur.role })
      window.dispatchEvent(new CustomEvent('lumina:orgChanged', { detail: { orgId } }))
    },
    refresh: async () => {
      await Promise.allSettled([refreshProfile(), refreshOrgs()])
    }
  }), [userId, profile, orgs, currentOrg, refreshProfile, refreshOrgs])

  return (
    <AppContext.Provider value={ctxValue}
    >
      <AppShell
        header={header}
        sidebar={<PrimaryNav collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} currentOrgRole={currentOrg?.role as unknown as OrgRole} />}
        sidebarCollapsed={sidebarCollapsed}
      >
        <Outlet />
        <Modal
          title="切换组织"
          open={orgModalOpen}
          onCancel={() => setOrgModalOpen(false)}
          footer={null}
        >
          <div role="list" style={{ display: 'grid', gap: 4 }}>
            {orgs.map(o => (
              <div
                role="listitem"
                key={o.id}
                onClick={() => {
                  setSelectedOrgId(String(o.id))
                  setCurrentOrg({ id: o.id, name: o.name, role: o.role })
                  setOrgModalOpen(false)
                  window.dispatchEvent(new CustomEvent('lumina:orgChanged', { detail: { orgId: o.id } }))
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: currentOrg?.id === o.id ? 'var(--ant-color-fill-tertiary, #f5f5f5)' : 'transparent'
                }}
              >
                {o.name}（{o.role}）
              </div>
            ))}
          </div>
        </Modal>
        <QuickCreateDatasourceModal
          open={createDsOpen}
          onClose={() => setCreateDsOpen(false)}
          onSuccess={() => setCreateDsOpen(false)}
        />
        <DataSourcePicker
          open={pickerOpen}
          initialSourceId={pickerInitSource}
          initialTab="tables"
          onCancel={() => { setPickerOpen(false); setPickerInitSource(undefined) }}
          onPicked={({ source, schema, table }) => {
            setPickerOpen(false)
            navigate(`/dataset/edit?sourceId=${Number(source.id)}&baseTable=${encodeURIComponent(table)}${schema ? `&baseSchema=${encodeURIComponent(schema)}` : ''}`)
          }}
          onPickedDataset={(d) => { setPickerOpen(false); navigate(`/dataset/edit?id=${d.id}`) }}
        />
      </AppShell>
    </AppContext.Provider>
  )
}

export default AppLayout
