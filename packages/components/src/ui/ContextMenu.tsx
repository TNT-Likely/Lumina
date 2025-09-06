import React from 'react'
import { Dropdown } from 'antd'

export interface ContextItem {
  key: string
  label: React.ReactNode
  icon?: React.ReactNode
  danger?: boolean
  onClick?: () => void
}

export interface ContextMenuProps {
  items: ContextItem[]
  children: React.ReactNode
}

const ContextMenu: React.FC<ContextMenuProps> = ( { items, children } ) => {
  return (
    <Dropdown
      menu={{ items: items.map( ( it ) => ( { key: it.key, label: <span onClick={it.onClick}>{it.label}</span>, icon: it.icon, danger: it.danger } ) ) }}
      trigger={['contextMenu']}
    >
      <div>{children}</div>
    </Dropdown>
  )
}

export default ContextMenu
