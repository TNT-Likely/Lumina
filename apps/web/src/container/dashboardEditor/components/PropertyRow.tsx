import React from 'react'
import { Tooltip, Divider } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'

interface PropertyRowProps {
  label?: React.ReactNode
  tooltip?: string
  children: React.ReactNode
  divider?: boolean
  style?: React.CSSProperties
}

export const PropertyRow: React.FC<PropertyRowProps> = ({
  label,
  tooltip,
  children,
  divider = true,
  style
}) => (
  <div style={{ ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0' }}>
      <div style={{
        flex: '0 0 110px',
        display: 'flex',
        alignItems: 'center',
        color: '#333',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: 0.2
      }}>
        {label && <span>{label}</span>}
        {tooltip && (
          <Tooltip title={tooltip} placement="top">
            <QuestionCircleOutlined style={{ color: '#999', marginLeft: 4, fontSize: 12, cursor: 'pointer' }} />
          </Tooltip>
        )}
      </div>
      <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>{children}</div>
    </div>
    {divider && (
      <Divider
        style={{
          margin: '0 0 0 0',
          borderColor: 'rgba(0,0,0,0.06)',
          width: '100%',
          minWidth: 0
        }}
      />
    )}
  </div>
)
