import React from 'react'
import { Typography, Dropdown, type MenuProps, theme } from 'antd'
import { useNavigate } from 'react-router-dom'
import { DashboardOutlined, ShareAltOutlined, DatabaseOutlined, HddOutlined, BulbOutlined, HomeOutlined, DownOutlined, RightOutlined, PlusOutlined } from '@ant-design/icons'
import { canCreate, type OrgRole } from '../../utils/perm'

const { Text } = Typography

// 主导航（Metabase 风格），命名不包含品牌
const PrimaryNav: React.FC<{ collapsed?: boolean; onToggleCollapse?: () => void; currentOrgRole?: OrgRole }> = ({ currentOrgRole }) => {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [open, setOpen] = React.useState<{ guide: boolean; viz: boolean; data: boolean }>({ guide: true, viz: true, data: true })
  const Item: React.FC<{ icon: React.ReactNode, label: string, to?: string, onClick?: () => void }> = ({ icon, label, to, onClick }) => (
    <div
      onClick={() => { if (onClick) onClick(); if (to) navigate(to) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 36,
        padding: '0 10px',
        borderRadius: 8,
        cursor: 'pointer',
        color: token.colorText as string
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = token.colorPrimaryBg as string }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
    >
      <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: token.colorPrimary as string }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  )

  const Section: React.FC<React.PropsWithChildren<{ title: string, open: boolean, onToggle: () => void, extra?: React.ReactNode }>> = ({ title, open, onToggle, children, extra }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 28, padding: '0 10px' }}>
        <div onClick={onToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary as string, display: 'inline-flex', alignItems: 'center' }}>
            {open ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
          </span>
          <Text type="secondary" style={{ fontSize: 12, letterSpacing: 0.2, lineHeight: '28px' }}>{title}</Text>
        </div>
        <div>{extra}</div>
      </div>
      {open && <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>{children}</div>}
    </div>
  )

  // 新建菜单
  const newVizMenu: MenuProps['items'] = [
    { key: 'new-dashboard', label: '新建仪表盘', onClick: () => navigate('/dashboard/list?create=1') },
    { key: 'new-view', label: '新建视图', onClick: () => navigate('/view/list?create=1') }
  ]
  const newDataMenu: MenuProps['items'] = [
    {
      key: 'new-datasource',
      label: '新建数据源',
      onClick: () => {
        // 触发全局事件，在 AppLayout 中打开快速创建数据源弹窗
        window.dispatchEvent(new Event('lumina:openCreateDatasource'))
      }
    },
    {
      key: 'new-dataset',
      label: '新建数据集',
      onClick: () => {
        // 触发全局事件，在 AppLayout/Home/DatasetList 中打开 DataSourcePicker，默认选中“表”页签
        window.dispatchEvent(new CustomEvent('lumina:openDataSourcePicker', { detail: { initialTab: 'tables' } }))
      }
    }
  ]

  const allowCreate = canCreate(currentOrgRole)
  const vizExtra = allowCreate
    ? (
      <Dropdown menu={{ items: newVizMenu }} placement="bottomRight">
        <span style={{ color: token.colorPrimary as string, cursor: 'pointer' }} title="新建"><PlusOutlined /></span>
      </Dropdown>
    )
    : undefined
  const dataExtra = allowCreate
    ? (
      <Dropdown menu={{ items: newDataMenu }} placement="bottomRight">
        <span style={{ color: token.colorPrimary as string, cursor: 'pointer' }} title="新建"><PlusOutlined /></span>
      </Dropdown>
    )
    : undefined

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36, padding: '0 10px' }}>
        <span style={{ fontSize: 12, color: token.colorTextSecondary as string }}>导航</span>
      </div>

      <Item icon={<HomeOutlined />} label="首页" to="/home" />

      <Section title="入门" open={open.guide} onToggle={() => setOpen(s => ({ ...s, guide: !s.guide }))}>
        <Item icon={<BulbOutlined />} label="使用向导" to="/guide" />
      </Section>

      <Section
        title="可视化"
        open={open.viz}
        onToggle={() => setOpen(s => ({ ...s, viz: !s.viz }))}
        extra={vizExtra}
      >
        <Item icon={<DashboardOutlined />} label="仪表盘" to="/dashboard/list" />
        <Item icon={<ShareAltOutlined />} label="视图" to="/view/list" />
      </Section>

      <Section
        title="数据"
        open={open.data}
        onToggle={() => setOpen(s => ({ ...s, data: !s.data }))}
        extra={dataExtra}
      >
        <Item icon={<DatabaseOutlined />} label="数据源" to="/dataSource/list" />
        <Item icon={<HddOutlined />} label="数据集" to="/dataset/list" />
      </Section>
    </div>
  )
}

export default PrimaryNav
