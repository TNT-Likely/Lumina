import React from 'react'
import { Card } from 'antd'

/**
 * 标准属性面板外层卡片，统一背景、圆角、阴影、padding等
 */
export const PanelCard: React.FC<{
  children: React.ReactNode
  style?: React.CSSProperties
  bodyStyle?: React.CSSProperties
}> = ({ children, style, bodyStyle }) => (
  <Card
    bordered={false}
    style={{
      borderRadius: 12,
      background: '#f7f8fa',
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
      marginBottom: 0,
      ...style
    }}
    bodyStyle={{
      padding: 20,
      ...bodyStyle
    }}
  >
    {children}
  </Card>
)
