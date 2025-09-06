import React from 'react'
import { Button, Typography } from 'antd'

export interface EmptyStateProps {
  title: React.ReactNode
  description?: React.ReactNode
  primaryAction?: { label: React.ReactNode; onClick: () => void }
  secondaryAction?: { label: React.ReactNode; onClick: () => void }
}

const EmptyState: React.FC<EmptyStateProps> = ( { title, description, primaryAction, secondaryAction } ) => {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: 'rgba(0,0,0,0.45)' }}>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>{title}</Typography.Title>
      {description && <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>}
      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
        {primaryAction && <Button type="primary" onClick={primaryAction.onClick}>{primaryAction.label}</Button>}
        {secondaryAction && <Button onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
      </div>
    </div>
  )
}

export default EmptyState
