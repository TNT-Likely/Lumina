// ===========================================
// DropZone 拖放区域组件
// ===========================================

// DashboardEditor/components/DropZone.tsx
import React, { useState, useCallback } from 'react'
import { message } from 'antd'
import { PlusOutlined, DragOutlined } from '@ant-design/icons'
import { ComponentType } from '@lumina/types'

interface DropZoneProps {
  onDrop?: (componentType: ComponentType, position: { x: number, y: number }) => void
  gridSize?: number
  margin?: number
  padding?: number
  isDrag?: boolean // 外部传入，控制 pointerEvents
}

export const DropZone: React.FC<DropZoneProps> = ({
  onDrop,
  gridSize = 40,
  margin = 8,
  padding = 16,
  isDrag = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragPosition, setDragPosition] = useState<{ x: number, y: number } | null>(null)
  const [previewSize, setPreviewSize] = useState<{ w: number, h: number }>({ w: 6, h: 4 })

  // 计算网格位置
  const calculateGridPosition = useCallback((clientX: number, clientY: number) => {
    // 获取画布容器的位置
    const canvas = document.querySelector('.dashboard-canvas')
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const relativeX = clientX - rect.left - padding
    const relativeY = clientY - rect.top - padding

    // 转换为网格坐标
    const gridX = Math.max(0, Math.round(relativeX / (gridSize + margin)))
    const gridY = Math.max(0, Math.round(relativeY / (gridSize + margin)))

    return { x: gridX, y: gridY }
  }, [gridSize, margin, padding])

  // 计算像素位置
  const calculatePixelPosition = useCallback((gridX: number, gridY: number) => {
    return {
      x: padding + gridX * (gridSize + margin),
      y: padding + gridY * (gridSize + margin)
    }
  }, [gridSize, margin, padding])

  // 处理拖拽进入
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  // 处理拖拽离开
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()

    // 检查是否真正离开了拖放区域
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { clientX, clientY } = e

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setIsDragOver(false)
      setDragPosition(null)
    }
  }, [])

  // 处理拖拽悬停
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()

    const gridPos = calculateGridPosition(e.clientX, e.clientY)
    setDragPosition(gridPos)

    // 从拖拽数据中获取组件大小信息
    try {
      const dragData = e.dataTransfer.getData('application/json')
      if (dragData) {
        const data = JSON.parse(dragData)
        if (data.defaultLayout) {
          setPreviewSize({
            w: data.defaultLayout.w || 6,
            h: data.defaultLayout.h || 4
          })
        }
      }
    } catch (error) {
      // 忽略解析错误
    }
  }, [calculateGridPosition])

  // 处理拖拽放下
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setDragPosition(null)

    try {
      const dragData = e.dataTransfer.getData('application/json')
      if (dragData) {
        const data = JSON.parse(dragData)
        const gridPos = calculateGridPosition(e.clientX, e.clientY)
        if (onDrop) {
          onDrop(data.type, gridPos)
        } else {
          message.success(`在位置 (${gridPos.x}, ${gridPos.y}) 放置了 ${data.name} 组件`)
        }
      }
    } catch (error) {
      console.error('[DropZone] 处理拖放数据失败:', error)
      message.error('拖放失败')
    }
  }, [calculateGridPosition, onDrop])

  // 渲染网格背景
  const renderGridBackground = () => {
    if (!isDragOver) return null

    const cols = 24 // 假设最大24列
    const rows = 20 // 假设最大20行
    const gridLines = []

    // 垂直线
    for (let i = 0; i <= cols; i++) {
      gridLines.push(
        <line
          key={`v-${i}`}
          x1={padding + i * (gridSize + margin)}
          y1={padding}
          x2={padding + i * (gridSize + margin)}
          y2={padding + rows * (gridSize + margin)}
          stroke="rgba(24, 144, 255, 0.3)"
          strokeWidth={1}
        />
      )
    }

    // 水平线
    for (let i = 0; i <= rows; i++) {
      gridLines.push(
        <line
          key={`h-${i}`}
          x1={padding}
          y1={padding + i * (gridSize + margin)}
          x2={padding + cols * (gridSize + margin)}
          y2={padding + i * (gridSize + margin)}
          stroke="rgba(24, 144, 255, 0.3)"
          strokeWidth={1}
        />
      )
    }

    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 500
        }}
      >
        {gridLines}
      </svg>
    )
  }

  // 渲染拖拽预览
  const renderDragPreview = () => {
    if (!isDragOver || !dragPosition) return null

    const pixelPos = calculatePixelPosition(dragPosition.x, dragPosition.y)

    return (
      <div
        style={{
          position: 'absolute',
          left: pixelPos.x,
          top: pixelPos.y,
          width: previewSize.w * (gridSize + margin) - margin,
          height: previewSize.h * (gridSize + margin) - margin,
          border: '2px dashed #1890ff',
          borderRadius: 4,
          background: 'rgba(24, 144, 255, 0.1)',
          pointerEvents: 'none',
          zIndex: 501,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: '#1890ff'
        }}
      >
        <PlusOutlined style={{ fontSize: 24, marginBottom: 8 }} />
        <div style={{ fontSize: 12 }}>
          放置组件到此处
        </div>
        <div style={{ fontSize: 10, opacity: 0.7 }}>
          {dragPosition.x}, {dragPosition.y} ({previewSize.w}×{previewSize.h})
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        pointerEvents: isDrag ? 'auto' : 'none',
        background: isDragOver ? 'rgba(24, 144, 255, 0.05)' : 'transparent',
        transition: 'background 0.2s ease'
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 网格背景 */}
      {renderGridBackground()}

      {/* 拖拽预览 */}
      {renderDragPreview()}

      {/* 拖拽提示（当没有组件拖拽时显示） */}
      {isDragOver && !dragPosition && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '2px dashed #1890ff',
            borderRadius: 8,
            padding: 32,
            textAlign: 'center',
            color: '#1890ff',
            zIndex: 502
          }}
        >
          <DragOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            拖拽组件到此处
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            从左侧组件库拖拽组件到画布上
          </div>
        </div>
      )}
    </div>
  )
}
