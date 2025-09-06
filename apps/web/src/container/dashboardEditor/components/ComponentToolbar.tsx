import React from 'react'
import { Button, Tooltip } from 'antd'
import { EditOutlined, CopyOutlined, DeleteOutlined, RetweetOutlined } from '@ant-design/icons'

interface ComponentToolbarProps {
  visible?: boolean
  onEdit?: () => void
  onReplace?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onRefresh?: () => void
  onAdvancedFilter?: () => void
}

export const ComponentToolbar: React.FC<ComponentToolbarProps> = ({ visible, onEdit, onReplace, onDuplicate, onDelete, onRefresh, onAdvancedFilter }) => {
  return (
    <div
      className="component-toolbar"
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        zIndex: 20,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .15s',
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid rgba(5,5,5,0.06)',
        boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
        borderRadius: 8,
        padding: '4px 6px'
      }}
    >
      {onAdvancedFilter && (
        <Tooltip title="高级筛选">
          <Button size="small" type="text" onClick={onAdvancedFilter} style={{ color: '#30343f' }}>筛</Button>
        </Tooltip>
      )}
      {onRefresh && (
        <Tooltip title="刷新">
          <Button size="small" type="text" onClick={onRefresh} style={{ color: '#30343f' }}>↻</Button>
        </Tooltip>
      )}
      {onEdit && (
        <Tooltip title="编辑">
          <Button size="small" type="text" icon={<EditOutlined />} onClick={onEdit} style={{ color: '#30343f' }} />
        </Tooltip>
      )}
      {onReplace && (
        <Tooltip title="替换视图">
          <Button size="small" type="text" icon={<RetweetOutlined />} onClick={onReplace} style={{ color: '#30343f' }} />
        </Tooltip>
      )}
      {onDuplicate && (
        <Tooltip title="复制">
          <Button size="small" type="text" icon={<CopyOutlined />} onClick={onDuplicate} style={{ color: '#30343f' }} />
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip title="删除">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onDelete} />
        </Tooltip>
      )}
    </div>
  )
}

export default ComponentToolbar
