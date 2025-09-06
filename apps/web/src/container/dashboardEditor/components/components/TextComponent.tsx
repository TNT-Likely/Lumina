import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Input, Typography } from 'antd'
import type { BaseComponent, TextConfig } from '../../types/dashboard'

const { TextArea } = Input

interface TextComponentProps {
  component: BaseComponent
  mode: 'edit' | 'preview'
  selected: boolean
  onUpdate: (updates: Partial<BaseComponent>) => void
}

export const TextComponent: React.FC<TextComponentProps> = ({
  component,
  mode,
  selected,
  onUpdate
}) => {
  const config = component.config as TextConfig
  const [isEditing, setIsEditing] = useState(false)
  const [tempContent, setTempContent] = useState(config.content)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const doubleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 处理双击进入编辑模式
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // 防止事件冒泡到父组件

    if (mode === 'edit' && !isEditing) {
      console.log('Double click detected, entering edit mode')
      setIsEditing(true)
      setTempContent(config.content)
    }
  }, [mode, isEditing, config.content])

  // 处理单击（防止与双击冲突）
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation() // 仅编辑状态下阻止冒泡
    }
    // 清除之前的定时器
    if (doubleClickTimerRef.current) {
      clearTimeout(doubleClickTimerRef.current)
      doubleClickTimerRef.current = null
    }
  }, [isEditing])

  // 完成编辑
  const handleFinishEdit = useCallback(() => {
    console.log('Finishing edit mode')
    setIsEditing(false)
    if (tempContent !== config.content) {
      onUpdate({
        config: {
          ...config,
          content: tempContent
        }
      })
    }
  }, [tempContent, config, onUpdate])

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    console.log('Canceling edit mode')
    setIsEditing(false)
    setTempContent(config.content)
  }, [config.content])

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation() // 防止快捷键冲突

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleFinishEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }, [handleFinishEdit, handleCancelEdit])

  // 处理失去焦点
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // 延迟处理，防止点击工具栏等操作时意外退出编辑
    setTimeout(() => {
      handleFinishEdit()
    }, 100)
  }, [handleFinishEdit])

  // 自动聚焦和选中
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current
      // 延迟聚焦，确保DOM已更新
      setTimeout(() => {
        input.focus()
        if (input.select) {
          input.select()
        } else if (input.setSelectionRange) {
          input.setSelectionRange(0, input.value.length)
        }
      }, 10)
    }
  }, [isEditing])

  // 监听外部点击退出编辑模式
  useEffect(() => {
    if (!isEditing) return

    const handleClickOutside = (event: MouseEvent) => {
      const container = containerRef.current
      if (container && !container.contains(event.target as Node)) {
        handleFinishEdit()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => { document.removeEventListener('mousedown', handleClickOutside) }
  }, [isEditing, handleFinishEdit])

  // 文本样式
  const textStyle: React.CSSProperties = {
    fontSize: config.fontSize || 14,
    fontWeight: config.fontWeight || 'normal',
    fontFamily: config.fontFamily || 'inherit',
    color: config.color || '#333',
    textAlign: (config.textAlign || 'left') as React.CSSProperties['textAlign'],
    lineHeight: config.lineHeight || 1.5,
    letterSpacing: config.letterSpacing || 'normal',
    textDecoration: config.textDecoration || 'none',
    wordWrap: (config.wordWrap || 'break-word') as React.CSSProperties['wordWrap'],
    whiteSpace: config.whiteSpace || 'pre-wrap',
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 8,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    resize: 'none'
  }

  // 容器样式
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    // 编辑模式下未进入编辑时，支持拖拽，设置为 move 光标更直观
    cursor: mode === 'edit' && !isEditing ? 'move' : 'default',
    display: 'flex',
    alignItems: config.textAlign === 'center' ? 'center' : 'flex-start',
    justifyContent: config.textAlign === 'center'
      ? 'center'
      : config.textAlign === 'right' ? 'flex-end' : 'flex-start',
    minHeight: '100%',
    // 防止被 React Grid Layout 的拖拽影响
    userSelect: isEditing ? 'text' : 'none'
  }

  // 编辑模式渲染
  if (mode === 'edit' && isEditing) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          padding: 8,
          position: 'relative'
        }}
        className="text-component-editing"
      >
        <TextArea
          ref={inputRef}
          value={tempContent}
          onChange={(e) => { setTempContent(e.target.value) }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            ...textStyle,
            background: 'rgba(24, 144, 255, 0.05)',
            border: '1px dashed #1890ff',
            borderRadius: 4,
            minHeight: '100%',
            resize: 'none'
          }}
          autoSize={{ minRows: 1 }}
          placeholder="输入文本内容..."
          // 防止 React Grid Layout 拦截事件
          onMouseDown={(e) => { e.stopPropagation() }}
          onMouseUp={(e) => { e.stopPropagation() }}
        />
      </div>
    )
  }

  // 显示模式渲染
  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className="text-component-display"
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      title={mode === 'edit' ? '双击编辑文本' : undefined}
    >
      {config.isRichText
        ? (
          <div
            dangerouslySetInnerHTML={{
              __html: config.htmlContent || config.content
            }}
            style={{
              width: '100%',
              padding: 8,
              ...textStyle,
              background: 'transparent',
              border: 'none'
            }}
          />
        )
        : (
          <div
            style={{
              width: '100%',
              padding: 8,
              ...textStyle,
              background: 'transparent',
              border: 'none',
              minHeight: isEditing ? 'auto' : '100%',
              display: 'flex',
              alignItems: config.textAlign === 'center' ? 'center' : 'flex-start',
              justifyContent: config.textAlign === 'center'
                ? 'center'
                : config.textAlign === 'right' ? 'flex-end' : 'flex-start'
            }}
          >
            {config.content || (mode === 'edit'
              ? <span style={{ color: '#ccc', fontStyle: 'italic' }}>
              双击编辑文本
              </span>
              : ''
            )}
          </div>
        )}

      {/* 编辑提示 */}
      {mode === 'edit' && selected && !isEditing && (
        <div
          style={{
            position: 'absolute',
            top: -24,
            left: 0,
            background: 'rgba(24, 144, 255, 0.9)',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: 2,
            fontSize: 10,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 1000
          }}
        >
          双击编辑
        </div>
      )}
    </div>
  )
}
