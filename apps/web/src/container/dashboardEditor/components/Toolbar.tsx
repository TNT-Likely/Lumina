import React, { useState, useRef } from 'react'
import { Button, Space, Divider, Typography, Tooltip, Input, message } from 'antd'
import {
  SaveOutlined,
  UndoOutlined,
  RedoOutlined,
  EyeOutlined,
  EditOutlined,
  DownloadOutlined,
  UploadOutlined
} from '@ant-design/icons'
import type { Dashboard } from '../types/dashboard'

const { Text } = Typography

interface ToolbarProps {
  dashboard: Dashboard | null
  canUndo: boolean
  canRedo: boolean
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
  onPreview: () => void
  onUpdateDashboard?: (updates: Partial<Dashboard>) => void
  onExport?: () => void
  onImport?: (dashboard: Dashboard) => void
}

export const Toolbar: React.FC<ToolbarProps> = ({
  dashboard,
  canUndo,
  canRedo,
  onSave,
  onUndo,
  onRedo,
  onPreview,
  onUpdateDashboard,
  onExport,
  onImport
}) => {
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState(dashboard?.name || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleNameEdit = () => {
    setTempName(dashboard?.name || '')
    setIsEditingName(true)
  }

  const handleNameSave = () => {
    if (onUpdateDashboard && tempName.trim()) {
      onUpdateDashboard({ name: tempName.trim() })
    }
    setIsEditingName(false)
  }

  const handleNameCancel = () => {
    setTempName(dashboard?.name || '')
    setIsEditingName(false)
  }

  const handleExport = () => {
    if (!dashboard) return

    const dataStr = JSON.stringify(dashboard, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${dashboard.name || 'dashboard'}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    message.success('仪表板配置已导出')
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedDashboard = JSON.parse(e.target?.result as string)
        if (onImport) {
          onImport(importedDashboard)
          message.success('仪表板配置已导入')
        }
      } catch (error) {
        message.error('导入失败：文件格式不正确')
      }
    }
    reader.readAsText(file)

    // 清空input值，允许重复选择同一个文件
    event.target.value = ''
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      height: 48,
      background: '#fff',
      borderBottom: '1px solid #f0f0f0'
    }}>
      {/* 左侧：标题和基础操作 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {isEditingName
          ? (
            <Input
              value={tempName}
              onChange={(e) => { setTempName(e.target.value) }}
              onPressEnter={handleNameSave}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleNameCancel()
                }
              }}
              style={{ width: 200, fontSize: 16, fontWeight: 600 }}
              autoFocus
            />
          )
          : (
            <div
              onClick={handleNameEdit}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 4,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f0f0'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Text strong style={{ fontSize: 16 }}>
                {dashboard?.name || '新建仪表板'}
              </Text>
              <EditOutlined style={{ fontSize: 12, color: '#999' }} />
            </div>
          )}

        <Space split={<Divider type="vertical" />}>
          <Space>
            <Tooltip title="保存 (Ctrl+S)">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={onSave}
              >
                保存
              </Button>
            </Tooltip>

            <Tooltip title="撤销 (Ctrl+Z)">
              <Button
                icon={<UndoOutlined />}
                disabled={!canUndo}
                onClick={onUndo}
              />
            </Tooltip>

            <Tooltip title="重做 (Ctrl+Shift+Z)">
              <Button
                icon={<RedoOutlined />}
                disabled={!canRedo}
                onClick={onRedo}
              />
            </Tooltip>
          </Space>

          <Space>
            <Tooltip title="预览">
              <Button
                icon={<EyeOutlined />}
                onClick={onPreview}
              >
                预览
              </Button>
            </Tooltip>

            <Tooltip title="导出配置">
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
              >
                导出
              </Button>
            </Tooltip>

            <Tooltip title="导入配置">
              <Button
                icon={<UploadOutlined />}
                onClick={handleImportClick}
              >
                导入
              </Button>
            </Tooltip>
          </Space>
        </Space>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}
