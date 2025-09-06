import React from 'react'
import { Layout } from 'antd'

export interface AppShellProps {
  header?: React.ReactNode
  sidebar?: React.ReactNode
  actionsRight?: React.ReactNode
  children?: React.ReactNode
  sidebarCollapsed?: boolean
}

const AppShell: React.FC<AppShellProps> = ( { header, sidebar, children, sidebarCollapsed } ) => {
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {header && (
        <Layout.Header style={{ background: '#fff', padding: 0, borderBottom: '1px solid #f0f0f0', height: 52, lineHeight: '52px' }}>
          {header}
        </Layout.Header>
      )}
      <Layout style={{ flex: 1, minHeight: 0 }}>
        {sidebar && (
          <Layout.Sider
            collapsed={sidebarCollapsed}
            collapsible
            collapsedWidth={0}
            trigger={null}
            width={264}
            style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
          >
            {sidebar}
          </Layout.Sider>
        )}
        <Layout.Content style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

export default AppShell
