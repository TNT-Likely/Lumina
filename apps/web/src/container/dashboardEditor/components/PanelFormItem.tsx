import React from 'react'

/**
 * 标准属性面板表单项，统一label、分割线、margin、input背景等
 */
export const PanelFormItem: React.FC<{
  label: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
  divider?: boolean
}> = ({ label, children, style, divider }) => (
  <div style={{ marginBottom: 16, ...style }}>
    <div style={{ fontSize: 13, color: '#555', fontWeight: 500, marginBottom: 6 }}>{label}</div>
    {children}
    {divider && <div style={{ borderBottom: '1px solid #eee', margin: '12px 0 0 0' }} />}
  </div>
)
