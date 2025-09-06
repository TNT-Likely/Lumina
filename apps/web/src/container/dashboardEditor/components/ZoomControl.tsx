import React, { useState } from 'react'
import { Button, Tooltip, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  BorderOutlined
} from '@ant-design/icons'

interface ZoomControlProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  onFitToWindow?: () => void
  style?: React.CSSProperties
}

export const ZoomControl: React.FC<ZoomControlProps> = ({
  zoom,
  onZoomChange,
  onFitToWindow,
  style
}) => {
  const [hovered, setHovered] = useState(false)
  const zoomLevels = [0.05, 0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]

  // 放大
  const handleZoomIn = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= zoom)
    if (currentIndex < zoomLevels.length - 1) {
      onZoomChange(zoomLevels[currentIndex + 1])
    }
  }
  // 缩小
  const handleZoomOut = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= zoom)
    if (currentIndex > 0) {
      onZoomChange(zoomLevels[currentIndex - 1])
    }
  }
  // 选择缩放
  const handleSelect = (value: string) => {
    if (value === 'fit') {
      handleFit()
      return
    }
    const zoomValue = parseFloat(value)
    onZoomChange(zoomValue)
  }
  // 自适应
  const handleFit = () => {
    if (onFitToWindow) onFitToWindow()
  }

  // 平滑出现+/-，容器宽度自适应
  const transitionStyle = {
    transition: 'opacity 0.18s cubic-bezier(.4,0,.2,1), transform 0.18s cubic-bezier(.4,0,.2,1)',
    opacity: hovered ? 1 : 0,
    transform: hovered ? 'translateX(0)' : 'translateX(8px)',
    pointerEvents: (hovered ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
    marginLeft: 8,
    background: 'none',
    borderRadius: 0,
    border: 'none',
    boxShadow: 'none',
    padding: 0,
    minWidth: 24,
    height: 24
  }

  // 容器宽度平滑变化
  const containerStyle: React.CSSProperties = {
    gap: 0,
    padding: '8px 16px',
    cursor: 'pointer',
    minWidth: hovered ? 120 : 64,
    width: hovered ? 140 : 64,
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'min-width 0.18s cubic-bezier(.4,0,.2,1), width 0.18s cubic-bezier(.4,0,.2,1)'
  }

  // 菜单项分组和样式
  const menuItems: MenuProps['items'] = [
    {
      type: 'group',
      label: '缩放比例',
      children: zoomLevels.map(z => ({
        key: String(z),
        label: `${z * 100}%`
      }))
    },
    { type: 'divider' },
    {
      key: 'fit',
      label: (
        <span style={{ display: 'flex', alignItems: 'center' }}>
          适合屏幕
        </span>
      ),
      disabled: !onFitToWindow
    }
  ]

  return (
    <div
      className="dashboard-zoom-control"
      style={style}
      onMouseEnter={() => { setHovered(true) }}
      onMouseLeave={() => { setHovered(false) }}
    >
      <div className="zoom-control" style={containerStyle}>
        <Dropdown
          trigger={['click']}
          menu={{
            items: menuItems,
            selectable: true,
            selectedKeys: [zoomLevels.includes(zoom) ? String(zoom) : (zoom === -1 ? 'fit' : '')],
            onClick: ({ key }) => { handleSelect(key) },
            style: {
              borderRadius: 12,
              minWidth: 200,
              width: 200,
              boxShadow: '0 8px 32px rgba(0,21,41,0.12)',
              background: '#fff',
              padding: 8
            }
          }}
        >
          {`${Math.round(zoom * 100)}%`}
        </Dropdown>
        <div style={{ display: 'inline-flex', alignItems: 'center', transition: 'width 0.18s cubic-bezier(.4,0,.2,1)', width: hovered ? 56 : 0, overflow: 'hidden' }}>
          <Tooltip title="缩小">
            <Button
              icon={<ZoomOutOutlined />}
              size="small"
              style={transitionStyle}
              disabled={zoom <= 0.05}
              onClick={handleZoomOut}
            />
          </Tooltip>
          <Tooltip title="放大">
            <Button
              icon={<ZoomInOutlined />}
              size="small"
              style={{ ...transitionStyle, marginLeft: 4 }}
              disabled={zoom >= 3}
              onClick={handleZoomIn}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
