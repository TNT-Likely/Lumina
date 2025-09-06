import React, { useEffect, useMemo, useState } from 'react'
import { canCreate } from '../utils/perm'
import { Layout, Menu, Avatar, Dropdown, Typography, Select, Tooltip } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { UserOutlined, DashboardOutlined, DatabaseOutlined, HddOutlined, ShareAltOutlined, BookOutlined, AlertOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons'
import { useAppContext } from '../context/AppContext'

const { Header, Sider, Content } = Layout
const { Text } = Typography

export default function SiderLayout () {
  const location = useLocation()
  const { userId, profile, currentOrg, orgs, switchOrg } = useAppContext()
  const selectedKey = useMemo(() => {
    const p = location.pathname
    if (p === '/' || p.startsWith('/home')) return 'home'
    if (p.startsWith('/dashboard')) return 'dashboard'
    if (p.startsWith('/dataset')) return 'dataset'
    if (p.startsWith('/dataSource')) return 'datasource'
    if (p.startsWith('/view')) return 'view'
    if (p.startsWith('/subscription')) return 'subscription'
    if (p.startsWith('/notification')) return 'notification'
    if (p.startsWith('/admin')) return 'admin'
    if (p.startsWith('/settings')) return 'settings'
    return 'home'
  }, [location.pathname])

  const [collapsed, setCollapsed] = useState(false)
  const [orgId, setOrgId] = useState<string>(() => localStorage.getItem('lumina.orgId') || '1')
  const [orgOptions, setOrgOptions] = useState<Array<{ label: string, value: string }>>([{ label: '默认组织（1）', value: '1' }])
  const [isRoot, setIsRoot] = useState(false)
  const [avatar, setAvatar] = useState<string | undefined>(undefined)
  const [displayName, setDisplayName] = useState<string>('')
  const [currentOrgRole, setCurrentOrgRole] = useState<'ADMIN'|'EDITOR'|'VIEWER'|null>(null)

  // 从 AppContext 同步当前角色/头像/昵称/是否 root
  useEffect(() => {
    setCurrentOrgRole((currentOrg?.role as 'ADMIN'|'EDITOR'|'VIEWER') || null)
    setIsRoot((userId ?? -1) === 1)
    setAvatar(profile?.avatar)
    setDisplayName(profile?.displayName || profile?.username || profile?.email || '')
  }, [currentOrg, userId, profile])

  const openQuickCreateDatasource = () => window.dispatchEvent(new CustomEvent('lumina:openCreateDatasource'))
  const openDataSourcePicker = () => window.dispatchEvent(new CustomEvent('lumina:openDataSourcePicker', { detail: { initialTab: 'tables' } }))

  // 从 AppContext 同步组织列表与当前 orgId
  useEffect(() => {
    const opts = (orgs || []).map(o => ({ label: `${o.name}（${o.id}）`, value: String(o.id) }))
    setOrgOptions(opts)
    const curId = String(currentOrg?.id || opts?.[0]?.value || '1')
    setOrgId(curId)
  }, [orgs, currentOrg])

  const userMenu = {
    items: [
      { key: 'settings', icon: <SettingOutlined />, label: <Link to="/settings">个人设置</Link> },
      { type: 'divider' as const },
      { key: 'logout', icon: <UserOutlined />, label: <span onClick={async () => { const { AuthApi } = await import('@lumina/api'); await AuthApi.logout(); window.location.replace('/login') }}>退出登录</span> }
    ]
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg">
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            paddingInline: collapsed ? 0 : 26,
            width: '100%',
            gap: collapsed ? 0 : 8,
            color: '#fff',
            fontWeight: 600
          }}
        >
          <img src="/lumina.svg" alt="logo" style={{ width: 22, height: 22, display: 'block' }} />
          {!collapsed && <span style={{ lineHeight: 1 }}>Lumina</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={(info) => {
            if (info.key === 'quick-new-datasource') {
              openQuickCreateDatasource()
            }
            if (info.key === 'quick-new-dataset') {
              openDataSourcePicker()
            }
          }}
          items={[
            { key: 'home', label: <Link to="/">首页</Link>, icon: <DashboardOutlined /> },
            { key: 'dashboard', label: <Link to="/dashboard/list">仪表盘</Link>, icon: <DashboardOutlined /> },
            { key: 'dataset', label: <Link to="/dataset/list">数据集</Link>, icon: <HddOutlined /> },
            { key: 'datasource', label: <Link to="/dataSource/list">数据源</Link>, icon: <DatabaseOutlined /> },
            { key: 'view', label: <Link to="/view/list">视图</Link>, icon: <ShareAltOutlined /> },
            { key: 'subscription', label: <Link to="/subscription/list">订阅</Link>, icon: <BookOutlined /> },
            { key: 'notification', label: <Link to="/notification/list">通知方式</Link>, icon: <AlertOutlined /> },
            { type: 'divider' as const },
            ...(
              canCreate(currentOrgRole)
                ? [
                  { key: 'quick-new-datasource', label: '新建数据源…', icon: <DatabaseOutlined /> },
                  { key: 'quick-new-dataset', label: '新建数据集…', icon: <HddOutlined /> }
                ]
                : []
            ),
            { type: 'divider' as const },
            ...((isRoot || currentOrgRole === 'ADMIN') ? [{ key: 'admin', label: <Link to="/admin/orgs">组织与成员</Link>, icon: <TeamOutlined /> }] : [])
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <div>
            {isRoot && (
              <Tooltip title="选择组织（X-Org-Id）">
                <Select
                  size="small"
                  style={{ width: 160 }}
                  value={orgId}
                  onChange={(val) => { setOrgId(val); switchOrg(Number(val)) }}
                  options={orgOptions}
                />
              </Tooltip>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Avatar size="small" {...(avatar ? { src: avatar } : { icon: <UserOutlined /> })} />
            </Dropdown>
            <Text type="secondary" style={{ fontSize: 12 }}>{displayName || '未命名用户'}</Text>
          </div>
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
