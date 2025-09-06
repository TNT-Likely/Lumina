import React from 'react'
import { Button, Space, Tooltip } from 'antd'

export interface ToolbarItem {
  key: string
  icon?: React.ReactNode
  label?: React.ReactNode
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
}

export interface ToolbarGroup {
  key: string
  items: ToolbarItem[]
}

export interface ToolbarProps {
  groups: ToolbarGroup[]
  size?: 'small' | 'middle' | 'large'
}

const Toolbar: React.FC<ToolbarProps> = ( { groups, size = 'middle' } ) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {groups.map( ( g ) => (
        <Space key={g.key} size={4}>
          {g.items.map( ( it ) => (
            <Tooltip key={it.key} title={it.shortcut ? `${it.label} (${it.shortcut})` : it.label}>
              <Button size={size} type={it.active ? 'primary' : 'default'} icon={it.icon} onClick={it.onClick} disabled={it.disabled}>
                {it.label}
              </Button>
            </Tooltip>
          ) )}
        </Space>
      ) )}
    </div>
  )
}

export default Toolbar
