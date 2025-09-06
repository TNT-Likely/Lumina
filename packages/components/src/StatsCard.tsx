import React from 'react'
import { Card, Typography, Space } from 'antd'

export interface StatsCardProps {
  icon?: React.ReactNode
  title: string
  value: React.ReactNode
  subtitle?: string
  extra?: React.ReactNode
  className?: string
}

const StatsCard: React.FC<StatsCardProps> = ( { icon, title, value, subtitle, extra, className } ) => (
  <Card className={className} bordered bodyStyle={{ padding: 16 }}>
    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
      <Space align="start">
        {icon && <div style={{ fontSize: 18, lineHeight: '24px' }}>{icon}</div>}
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{title}</Typography.Text>
          <div style={{ fontSize: 22, fontWeight: 600, lineHeight: '28px' }}>{value}</div>
          {subtitle && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Typography.Text>}
        </div>
      </Space>
      {extra}
    </Space>
  </Card>
)

export default StatsCard
