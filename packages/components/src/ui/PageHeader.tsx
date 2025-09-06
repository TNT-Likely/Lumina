import React from 'react'
import { Breadcrumb, Space, Typography } from 'antd'

export interface PageHeaderProps {
  title: React.ReactNode
  breadcrumb?: { title: string; href?: string }[]
  extra?: React.ReactNode
  subtitle?: React.ReactNode
}

const PageHeader: React.FC<PageHeaderProps> = ( { title, breadcrumb, extra, subtitle } ) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
      <Space direction="vertical" size={0}>
        {breadcrumb && breadcrumb.length > 0 && (
          <Breadcrumb items={breadcrumb.map( b => ( { title: b.title, href: b.href } ) )} />
        )}
        <Space size="small" align="baseline">
          <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
          {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
        </Space>
      </Space>
      <div>{extra}</div>
    </div>
  )
}

export default PageHeader
