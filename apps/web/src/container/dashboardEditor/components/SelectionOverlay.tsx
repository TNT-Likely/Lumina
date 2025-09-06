// ===========================================
// SelectionOverlay 选择框覆盖层组件
// ===========================================

// DashboardEditor/components/SelectionOverlay.tsx
import React, { useMemo } from 'react'
import { Button, Tooltip } from 'antd'
import {
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
  DragOutlined,
  ExpandOutlined
} from '@ant-design/icons'
import type { BaseComponent } from '../types/dashboard'

interface SelectionOverlayProps {
  selectedComponentIds: string[]
  components: BaseComponent[]
  onCopy?: (componentIds: string[]) => void
  onDelete?: (componentIds: string[]) => void
  onEdit?: (componentId: string) => void
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selectedComponentIds,
  components,
  onCopy,
  onDelete,
  onEdit
}) => {
  // 计算选中组件的边界框
  const selectionBounds = useMemo(() => {
    if (selectedComponentIds.length === 0) return null

    const selectedComponents = components.filter(comp =>
      selectedComponentIds.includes(comp.id)
    )

    if (selectedComponents.length === 0) return null

    // 计算所有选中组件的边界
    let minX = Infinity; let minY = Infinity
    let maxX = -Infinity; let maxY = -Infinity

    selectedComponents.forEach(comp => {
      const { x, y, w, h } = comp.layout
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w)
      maxY = Math.max(maxY, y + h)
    })

    // 转换为像素坐标（假设网格单元为40px，间距为8px）
    const gridSize = 40
    const margin = 8
    const padding = 16

    return {
      left: padding + minX * (gridSize + margin),
      top: padding + minY * (gridSize + margin),
      width: (maxX - minX) * (gridSize + margin) - margin,
      height: (maxY - minY) * (gridSize + margin) - margin,
      componentCount: selectedComponents.length
    }
  }, [selectedComponentIds, components])

  if (!selectionBounds) return null

  const { left, top, width, height, componentCount } = selectionBounds
  const isMultiSelect = componentCount > 1

  return (
    <>
      {/* 选择框边框 */}
      <div
        style={{
          position: 'absolute',
          left: left - 2,
          top: top - 2,
          width: width + 4,
          height: height + 4,
          border: '2px solid #1890ff',
          borderRadius: 4,
          pointerEvents: 'none',
          zIndex: 1000,
          background: 'rgba(24, 144, 255, 0.1)'
        }}
      />

      {/* 拖拽手柄 */}
      {!isMultiSelect && (
        <>
          {/* 四个角的调整手柄 */}
          {[
            { position: 'top-left', cursor: 'nw-resize', top: -4, left: -4 },
            { position: 'top-right', cursor: 'ne-resize', top: -4, right: -4 },
            { position: 'bottom-left', cursor: 'sw-resize', bottom: -4, left: -4 },
            { position: 'bottom-right', cursor: 'se-resize', bottom: -4, right: -4 }
          ].map(handle => (
            <div
              key={handle.position}
              style={{
                position: 'absolute',
                left: handle.left !== undefined ? left + handle.left : undefined,
                right: handle.right !== undefined ? left + width + handle.right : undefined,
                top: handle.top !== undefined ? top + handle.top : undefined,
                bottom: handle.bottom !== undefined ? top + height + handle.bottom : undefined,
                width: 8,
                height: 8,
                background: '#1890ff',
                border: '1px solid #fff',
                borderRadius: 2,
                cursor: handle.cursor,
                zIndex: 1001
              }}
            />
          ))}

          {/* 边框中点的调整手柄 */}
          {[
            { position: 'top', cursor: 'n-resize', top: -4, left: width / 2 - 4 },
            { position: 'bottom', cursor: 's-resize', bottom: -4, left: width / 2 - 4 },
            { position: 'left', cursor: 'w-resize', left: -4, top: height / 2 - 4 },
            { position: 'right', cursor: 'e-resize', right: -4, top: height / 2 - 4 }
          ].map(handle => (
            <div
              key={handle.position}
              style={{
                position: 'absolute',
                left: handle.left !== undefined ? left + handle.left : undefined,
                right: handle.right !== undefined ? left + width + handle.right : undefined,
                top: handle.top !== undefined ? top + handle.top : undefined,
                bottom: handle.bottom !== undefined ? top + height + handle.bottom : undefined,
                width: 8,
                height: 8,
                background: '#1890ff',
                border: '1px solid #fff',
                borderRadius: 2,
                cursor: handle.cursor,
                zIndex: 1001
              }}
            />
          ))}
        </>
      )}

      {/* 操作工具栏 */}
      <div
        style={{
          position: 'absolute',
          left,
          top: top - 40,
          display: 'flex',
          gap: 4,
          background: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          padding: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1002
        }}
      >
        {/* 拖拽图标 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            color: '#666',
            fontSize: 12,
            cursor: 'move'
          }}
        >
          <DragOutlined style={{ marginRight: 4 }} />
          {isMultiSelect ? `${componentCount}个组件` : '组件'}
        </div>

        {/* 编辑按钮（仅单选时显示） */}
        {!isMultiSelect && (
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => { onEdit?.(selectedComponentIds[0]) }}
            />
          </Tooltip>
        )}

        {/* 复制按钮 */}
        <Tooltip title="复制">
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => { onCopy?.(selectedComponentIds) }}
          />
        </Tooltip>

        {/* 删除按钮 */}
        <Tooltip title="删除">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => { onDelete?.(selectedComponentIds) }}
          />
        </Tooltip>

        {/* 全屏按钮（仅单选时显示） */}
        {!isMultiSelect && (
          <Tooltip title="全屏编辑">
            <Button
              type="text"
              size="small"
              icon={<ExpandOutlined />}
            />
          </Tooltip>
        )}
      </div>

      {/* 选中组件信息提示 */}
      <div
        style={{
          position: 'absolute',
          left: left + width - 120,
          top: top + height + 8,
          background: 'rgba(0, 0, 0, 0.75)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          zIndex: 1002,
          pointerEvents: 'none'
        }}
      >
        {isMultiSelect
          ? `已选择 ${componentCount} 个组件`
          : `${width.toFixed(0)} × ${height.toFixed(0)}`
        }
      </div>
    </>
  )
}
