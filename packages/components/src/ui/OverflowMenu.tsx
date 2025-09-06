import React from 'react'
import { Dropdown, Button } from 'antd'
import { MoreOutlined } from '@ant-design/icons'

export interface OverflowItem {
  key: string
  label: React.ReactNode
  icon?: React.ReactNode
  danger?: boolean
  onClick?: () => void
}

export interface OverflowMenuProps {
  items: OverflowItem[]
}

const OverflowMenu: React.FC<OverflowMenuProps> = ( { items } ) => {
  return (
    <Dropdown
      menu={{
        items: items.map( ( it ) => ( { key: it.key, label: it.label, icon: it.icon, danger: it.danger } ) ),
        onClick: ( info ) => {
          const found = items.find( ( it ) => it.key === info.key )
          found?.onClick?.()
        }
      }}
      trigger={['click']}
    >
      <Button type="text" size="small" icon={<MoreOutlined />} />
    </Dropdown>
  )
}

export default OverflowMenu
