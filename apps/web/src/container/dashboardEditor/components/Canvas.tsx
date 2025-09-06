import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { type Layout } from 'react-grid-layout'
import { ComponentRenderer } from './ComponentRenderer'
import { DropZone } from './DropZone'
import { GridBoard } from './GridBoard'
import { ComponentToolbar } from './ComponentToolbar'
import { ViewPicker } from './ViewPicker'
import type { Dashboard, BaseComponent } from '../types/dashboard'
import { useDashboardEditor } from '../hooks/useDashboardEditor'
import { useDashboardContext } from '../context/DashboardContext'
import { Tooltip } from 'antd'
import { PermissionsApi } from '@lumina/api'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { ComponentType } from '@lumina/types'

declare global {
  interface Window {
    __spacePressed?: boolean
  }
}

interface CanvasProps {
  isAdd?: boolean
  dashboard: Dashboard | null
  selectedComponentIds: string[]
  mode: 'edit' | 'preview'
  zoom: number
  heightMode?: 'auto' | 'fixed' // 新增：高度模式
  exporting?: boolean // 导出中：关闭网格、取消缩放，确保截图完整
  onSelectComponent: (id: string, multi?: boolean) => void
  onUpdateComponent: (id: string, updates: Partial<BaseComponent>) => void
  onUpdateLayout: (layouts: Layout[]) => void
  onDeleteComponent: (id: string) => void
  onAddComponent?: (type: ComponentType, position: { x: number, y: number }, config?: unknown) => void
  onZoomChange?: (zoom: number) => void
  onHeightModeChange?: (mode: 'auto' | 'fixed') => void // 新增：高度模式切换
  className?: string
  style?: CSSProperties
  // 当编辑态存在视图权限不足时，可注入一个 dashboard 级的临时 token 以只读方式渲染视图
  publicToken?: string | null
}
export const Canvas: React.FC<CanvasProps> = (props) => {
  const {
    dashboard,
    selectedComponentIds,
    mode,
    zoom = 1,
    heightMode = 'auto',
    exporting = false,
    className,
    style,
    onSelectComponent,
    onUpdateComponent,
    onUpdateLayout,
    onDeleteComponent,
    onAddComponent,
    onZoomChange,
    onHeightModeChange,
    publicToken,
    isAdd
  } = props
  // 拖拽状态：是否正在从组件库拖拽（全局）
  const { isLibraryDragging } = useDashboardContext()
  const canvasRef = useRef<HTMLDivElement>(null)
  // 外层未缩放的画布容器（.dashboard-canvas），用于承载不随缩放的悬浮工具栏
  const outerBoardRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // 获取 hooks 方法
  const { getComponentIdByPosition } = useDashboardEditor()
  const [containerWidth] = useState(1200) // 默认宽度
  const [contentHeight, setContentHeight] = useState<number>(dashboard?.settings?.canvas?.height || 800)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // 悬浮工具栏位置（相对于未缩放外层 .dashboard-canvas 定位）
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null)
  // 用于延迟隐藏，避免移入工具栏瞬间消失
  const hideHoverTimer = useRef<number | null>(null)
  // 视图编辑权限缓存：viewId -> boolean（是否具有内部访问权限）
  const [viewEditAccess, setViewEditAccess] = useState<Record<number, boolean>>({})

  // 从仪表板组件生成布局数组
  // 保证每次 dashboard.components 变化都能驱动 GridLayout 重新渲染
  const layout = useMemo(() => (
    dashboard?.components?.map(component => ({
      i: component.id,
      x: component.layout.x,
      y: component.layout.y,
      w: component.layout.w,
      h: component.layout.h,
      minW: component.layout.minW || 1,
      minH: component.layout.minH || 1,
      maxW: component.layout.maxW,
      maxH: component.layout.maxH,
      static: component.layout.static || false,
      isDraggable: mode === 'edit' && (component.layout.isDraggable !== false),
      isResizable: mode === 'edit' && (component.layout.isResizable !== false)
    })) || []
  ), [dashboard?.components, mode])

  // 画布区域100%等于grid-layout区域，辅助线全部以grid为基准
  const gridLayoutProps = useMemo(() => {
    return {
      className: 'layout',
      layout,
      cols: dashboard?.settings?.grid?.cols || 24,
      rowHeight: dashboard?.settings?.grid?.rowHeight || 40,
      width: dashboard?.settings?.canvas?.width || containerWidth,
      margin: dashboard?.settings?.grid?.margin || [8, 8],
      containerPadding: dashboard?.settings?.grid?.padding || [16, 16],
      autoSize: true,
      verticalCompact: dashboard?.settings?.grid?.verticalCompact || true,
      preventCollision: dashboard?.settings?.grid?.preventCollision || false,
      isDraggable: mode === 'edit' && !isPanning,
      isResizable: mode === 'edit' && !isPanning,
      // 仅保留右下角缩放手柄，与视觉把手一致
      resizeHandles: ['se'] as Array<'se'>,
      useCSSTransforms: true,
      isBounded: false
    }
  }, [layout, mode, isPanning, dashboard?.settings?.grid?.cols, dashboard?.settings?.grid?.rowHeight, dashboard?.settings?.canvas?.width, dashboard?.settings?.grid?.margin, dashboard?.settings?.grid?.padding, containerWidth])

  // 处理布局变化
  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    onUpdateLayout(newLayout)
  }, [onUpdateLayout, mode])

  // 处理鼠标滚轮缩放
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const newZoom = Math.max(0.05, Math.min(3, zoom + delta))
      onZoomChange?.(newZoom)
    }
  }, [zoom, onZoomChange, mode])

  // 处理鼠标按下：根据点击点选择组件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !dashboard) return
    // 正在平移时不进行选择
    if (e.shiftKey || window.__spacePressed) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const compId = getComponentIdByPosition(
      e.clientX - rect.left,
      e.clientY - rect.top,
      zoom
    )
    if (compId) {
      const isMulti = e.ctrlKey || e.metaKey
      onSelectComponent(compId, isMulti)
    } else {
      onSelectComponent('')
    }
  }, [dashboard, getComponentIdByPosition, onSelectComponent, zoom, mode])

  // 修改组件点击处理，为文本组件特殊处理
  const handleComponentClick = useCallback((componentId: string, event: React.MouseEvent) => {
    // 平移时忽略点击
    if (isPanning || event.shiftKey || window.__spacePressed) return
    const component = dashboard?.components.find(c => c.id === componentId)

    // 对于文本组件，只在非编辑状态下处理选择
    if (component?.type === 'text' && mode === 'edit') {
      const isTextEditing = (event.target as HTMLElement).closest('.text-component-editing')
      if (isTextEditing) {
        // 如果正在编辑文本，不处理选择逻辑
        return
      }
    }

    event.stopPropagation()
    const isMulti = event.ctrlKey || event.metaKey
    onSelectComponent(componentId, isMulti)
  }, [onSelectComponent, dashboard?.components, mode, isPanning])

  // 复制组件
  const handleDuplicate = useCallback((component: BaseComponent) => {
    const copy: BaseComponent = {
      ...component,
      id: `${component.id}-copy-${Date.now()}`,
      name: `${component.name}_copy`,
      layout: { ...component.layout, x: component.layout.x + 1, y: component.layout.y },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    // 通过 onAddComponent 添加复制件以复用布局冲突处理
    onAddComponent?.(component.type as ComponentType, { x: copy.layout.x, y: copy.layout.y }, { layout: copy.layout, style: copy.style, config: copy.config })
  }, [onAddComponent])

  // 画布点击处理
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (isPanning) return
    if (event.target === event.currentTarget) {
      onSelectComponent('')
    }
  }, [onSelectComponent, isPanning, mode])

  // 处理从组件库拖拽添加
  const handleDropFromLibrary = useCallback((componentType: ComponentType, position: { x: number, y: number }) => {
    if (onAddComponent) {
      // 考虑缩放比例调整位置
      const adjustedPosition = {
        x: Math.round(position.x / zoom),
        y: Math.round(position.y / zoom)
      }
      onAddComponent(componentType, adjustedPosition)
    } else {
      console.warn('[Canvas] onAddComponent is undefined')
    }
  }, [onAddComponent, zoom])

  // 计算并更新悬浮工具栏的位置（根据 hoveredId 对应元素的 DOMRect）
  const updateToolbarPosition = useCallback(() => {
    if (!outerBoardRef.current || !gridRef.current || !hoveredId) {
      setToolbarPos(null)
      return
    }
    // 组件元素：通过 data-component-id 查询
    const compEl = gridRef.current.querySelector(`[data-component-id="${hoveredId}"]`) as HTMLElement | null
    if (!compEl) {
      setToolbarPos(null)
      return
    }
    const compRect = compEl.getBoundingClientRect()
    const canvasRect = outerBoardRef.current.getBoundingClientRect()
    setToolbarPos({
      top: compRect.top - canvasRect.top + 8,
      left: compRect.right - canvasRect.left - 8
    })
  }, [hoveredId])

  // 悬浮 id、缩放、布局等变化时更新位置
  useEffect(() => {
    updateToolbarPosition()
  }, [updateToolbarPosition, zoom, layout])

  // 监听窗口尺寸变化和滚动，保持位置更新
  useEffect(() => {
    const onScroll = () => updateToolbarPosition()
    const onResize = () => updateToolbarPosition()
    // 外层滚动容器
    const scrollEl = canvasRef.current
    window.addEventListener('resize', onResize)
    scrollEl?.addEventListener('scroll', onScroll)
    return () => {
      window.removeEventListener('resize', onResize)
      scrollEl?.removeEventListener('scroll', onScroll)
    }
  }, [updateToolbarPosition])

  // 添加滚轮事件监听（支持 Cmd/Ctrl + 滚轮缩放）
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      return () => { canvas.removeEventListener('wheel', handleWheel) }
    }
  }, [handleWheel])

  // 按住空格进行画布平移（编辑器常见交互）
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const t = e.target
      if (!(t instanceof Element)) return
      // 仅当按住空格键时启用平移
      if (!e.shiftKey && !window.__spacePressed) return
      setIsPanning(true)
      panStart.current = { x: e.clientX + el.scrollLeft, y: e.clientY + el.scrollTop }
      el.style.cursor = 'grabbing'
      e.preventDefault()
      e.stopPropagation()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning) return
      el.scrollLeft = panStart.current.x - e.clientX
      el.scrollTop = panStart.current.y - e.clientY
    }
    const onMouseUp = () => {
      setIsPanning(false)
      el.style.cursor = 'default'
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { window.__spacePressed = true }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { window.__spacePressed = false }
    }
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      el.style.cursor = 'default'
    }
  }, [isPanning, mode])

  // 动态获取GridLayout真实高度并赋值给contentHeight
  useEffect(() => {
    if (heightMode === 'auto' && gridRef.current) {
      const realHeight = gridRef.current.offsetHeight
      setContentHeight(realHeight)
    } else if (heightMode === 'fixed') {
      setContentHeight(dashboard?.settings?.canvas?.height || 800)
    }
  }, [dashboard, layout, gridLayoutProps.width, gridLayoutProps.rowHeight, zoom, heightMode])

  // 键盘事件处理（空格键平移）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        document.body.style.cursor = 'grab'
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        document.body.style.cursor = 'default'
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.body.style.cursor = 'default'
    }
  }, [])

  // 探测视图内部访问权限（仅在无 publicToken 时需要；有 token 表示只读预览，不代表可编辑）
  useEffect(() => {
    if (!dashboard) return
    if (publicToken) return // 有只读token时不进行内部权限探测，编辑入口统一隐藏
    const viewIds = dashboard.components
      .filter(c => c.type === 'view')
      .map(c => (c.config as import('../types/dashboard').ViewConfig)?.viewId)
      .filter((v): v is number => typeof v === 'number' && v > 0)
    if (viewIds.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await PermissionsApi.batch(viewIds.map(id => ({ type: 'view' as const, id })))
        const next: Record<number, boolean> = {}
        for (const r of data || []) {
          // 具有 write 权限才认为可编辑
          if (r.type === 'view') next[r.id] = !!r.write
        }
        if (!cancelled) setViewEditAccess(next)
      } catch {
        // 静默失败：全部视为不可编辑
        if (!cancelled) {
          const next: Record<number, boolean> = {}
          viewIds.forEach(id => { next[id] = false })
          setViewEditAccess(next)
        }
      }
    })()
    return () => { cancelled = true }
  }, [dashboard?.id, dashboard?.components, publicToken])

  if (!dashboard) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#999',
        fontSize: 16,
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div>请选择或创建一个仪表板</div>
        </div>
      </div>
    )
  }

  const contentWidth = dashboard?.settings?.canvas?.width || 1200

  return (
    <div
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        position: 'relative',
        background: '#f5f5f5',
        display: 'grid',
        placeItems: 'center',
        ...(style || {})
      }}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      data-canvas-height-mode={heightMode}
    >
      {/* 虚拟容器：宽高为内容宽高 × zoom，用于在高缩放时保留自然滚动条 */}
      <div
        className="dashboard-canvas"
        ref={outerBoardRef}
        style={{
          // 导出时外层使用真实内容尺寸，便于一次性完整截图；平时则用缩放后的尺寸以获得自然滚动体验
          width: exporting ? contentWidth : contentWidth * zoom,
          height: exporting ? contentHeight : contentHeight * zoom,
          position: 'relative',
          pointerEvents: 'auto',
          background: dashboard.settings.canvas.backgroundColor || '#fff',
          backgroundImage: dashboard.settings.canvas.backgroundImage
            ? `url(${dashboard.settings.canvas.backgroundImage})`
            : 'none',
          backgroundRepeat: dashboard.settings.canvas.backgroundRepeat || 'no-repeat',
          backgroundSize: dashboard.settings.canvas.backgroundSize || 'cover',
          backgroundPosition: dashboard.settings.canvas.backgroundPosition || 'center',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          cursor: isPanning ? 'grabbing' : 'default',
          overflow: 'visible'
        }}
      >
        <div
          ref={contentRef}
          className="dashboard-canvas-inner"
          style={{
            width: contentWidth,
            height: contentHeight,
            // 导出时取消缩放，确保截图实际尺寸与画布一致
            transform: exporting ? 'scale(1)' : `scale(${zoom})`,
            transformOrigin: 'top left',
            position: 'relative',
            overflow: heightMode === 'fixed' ? 'hidden' : 'visible',
            display: 'block'
          }}
        >
          {/* 拖放区域 */}
          {mode === 'edit' && (
            <DropZone
              onDrop={handleDropFromLibrary}
              gridSize={gridLayoutProps.rowHeight}
              margin={gridLayoutProps.margin[0]}
              padding={gridLayoutProps.containerPadding[0]}
              isDrag={isLibraryDragging}
            />
          )}

          {/* React Grid Layout 主容器 */}
          <GridBoard
            layout={layout}
            cols={gridLayoutProps.cols}
            rowHeight={gridLayoutProps.rowHeight}
            width={gridLayoutProps.width}
            margin={gridLayoutProps.margin}
            containerPadding={gridLayoutProps.containerPadding}
            autoSize={gridLayoutProps.autoSize}
            verticalCompact={gridLayoutProps.verticalCompact}
            preventCollision={gridLayoutProps.preventCollision}
            isDraggable={gridLayoutProps.isDraggable}
            isResizable={gridLayoutProps.isResizable}
            resizeHandles={gridLayoutProps.resizeHandles}
            transformScale={exporting ? 1 : zoom}
            onLayoutChange={handleLayoutChange}
            innerRef={gridRef}
            // 当存在背景图片时，格子需要在图片之下，这里仍由 GridBoard 自身生成小网格背景
            // 但仅在无背景图时显示；导出时也关闭
            showTofuGrid={!exporting && !dashboard.settings.canvas.backgroundImage}
          >
            {dashboard.components.map(component => (
              <div
                key={component.id}
                data-component-id={component.id}
                onClick={(e) => { handleComponentClick(component.id, e) }}
                onMouseEnter={() => {
                  // 预览和编辑态都允许 hover，但仅在编辑态显示全局工具栏
                  if (hideHoverTimer.current) {
                    window.clearTimeout(hideHoverTimer.current)
                    hideHoverTimer.current = null
                  }
                  setHoveredId(component.id)
                }}
                onMouseLeave={() => {
                  // 编辑态延迟清空，便于鼠标移入工具栏
                  if (hideHoverTimer.current) window.clearTimeout(hideHoverTimer.current)
                  hideHoverTimer.current = window.setTimeout(() => {
                    setHoveredId(curr => (curr === component.id ? null : curr))
                  }, 150)
                }}
                style={{
                  background: component.style.backgroundColor || '#fff',
                  border: `${component.style.borderWidth || 1}px solid ${selectedComponentIds.includes(component.id) ? '#1890ff' : (component.style.borderColor || '#d9d9d9')}`,
                  borderRadius: component.style.borderRadius || 6,
                  boxShadow: (selectedComponentIds.includes(component.id)
                    ? '0 0 0 2px rgba(24, 144, 255, 0.2)'
                    : (component.style.boxShadow || '0 1px 3px rgba(0, 0, 0, 0.1)')),
                  opacity: component.style.opacity || 1,
                  overflow: 'hidden',
                  cursor: mode === 'edit' ? 'move' : 'default',
                  position: 'relative',
                  userSelect: mode === 'edit' ? 'none' : 'auto',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {(mode === 'edit') && (() => {
                  const handleEdit = () => {
                    if (component.type !== 'view') return
                    const cfg = component.config as import('../types/dashboard').ViewConfig
                    if (cfg && typeof cfg.viewId === 'number' && cfg.viewId > 0) {
                      window.open(`/chartBuilder?viewId=${cfg.viewId}`, '_blank')
                    }
                  }
                  const canEditView = (() => {
                    if (component.type !== 'view') return false
                    const cfg = component.config as import('../types/dashboard').ViewConfig
                    const vid = cfg?.viewId
                    if (!vid) return false
                    // 有 publicToken 视为只读，不提供编辑入口；否则需内部权限为 true
                    if (publicToken) return false
                    return !!viewEditAccess[vid]
                  })()
                  const common = {
                    onEdit: (component.type === 'view' && canEditView) ? handleEdit : undefined,
                    onReplace: component.type === 'view' && mode === 'edit' ? () => setReplaceTargetId(component.id) : undefined,
                    onDuplicate: mode === 'edit' ? () => handleDuplicate(component) : undefined,
                    onDelete: mode === 'edit' ? () => onDeleteComponent(component.id) : undefined
                  }
                  // 编辑态改为全局悬浮工具栏，这里不再渲染 per-component 工具栏
                  return null
                })()}

                {/* 右下角自定义 resize 视觉把手，仅在可调整大小时显示；实际拖拽仍由 react-grid-layout 处理 */}
                {mode === 'edit' && (component.layout.isResizable !== false) && (
                  <div
                    className="resize-corner-handle"
                    style={{
                      position: 'absolute',
                      right: 2,
                      bottom: 2,
                      width: 14,
                      height: 14,
                      pointerEvents: 'none'
                    }}
                    aria-hidden
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.6 }}>
                      <path d="M4 10H10V4" stroke="#C9CDD4" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M7 13H13V7" stroke="#E5EAF3" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                {(() => {
                  const externalFilters = undefined
                  const onConfigReadyProp = undefined
                  return (
                    <ComponentRenderer
                      component={component}
                      mode={mode}
                      selected={selectedComponentIds.includes(component.id)}
                      onUpdate={(updates) => { onUpdateComponent(component.id, updates) }}
                      externalFilters={externalFilters}
                      onConfigReady={onConfigReadyProp}
                      publicToken={publicToken || undefined}
                    />
                  )
                })()}
              </div>
            ))}
          </GridBoard>

          {/* 去除顶部标尺与辅助网格线以简化视觉 */}

          {/* 空状态提示 */}
          {dashboard.components.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#999',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div style={{ fontSize: 18, marginBottom: 8 }}>空白画布</div>
              <div style={{ fontSize: 14 }}>使用顶部“添加视图/添加文本”开始创建仪表板</div>
            </div>
          )}
        </div>
        {/* 编辑态：全局悬浮工具栏（不随缩放），渲染在未缩放容器内，基于组件 DOMRect 定位 */}
        {mode === 'edit' && !exporting && hoveredId && toolbarPos && (
          <div
            className="dashboard-global-toolbar"
            style={{
              position: 'absolute',
              top: toolbarPos.top,
              left: toolbarPos.left,
              transform: 'translate(-100%, 0)', // 使右边缘贴合组件右上角
              zIndex: 100,
              pointerEvents: 'auto'
            }}
            onMouseEnter={() => {
              if (hideHoverTimer.current) {
                window.clearTimeout(hideHoverTimer.current)
                hideHoverTimer.current = null
              }
            }}
            onMouseLeave={() => {
              if (hideHoverTimer.current) window.clearTimeout(hideHoverTimer.current)
              hideHoverTimer.current = window.setTimeout(() => setHoveredId(null), 150)
            }}
          >
            {(() => {
              const component = dashboard.components.find(c => c.id === hoveredId)
              if (!component) return null
              const handleEdit = () => {
                if (component.type !== 'view') return
                const cfg = component.config as import('../types/dashboard').ViewConfig
                if (cfg && typeof cfg.viewId === 'number' && cfg.viewId > 0) {
                  window.open(`/chartBuilder?viewId=${cfg.viewId}`, '_blank')
                }
              }
              const canEditView = (() => {
                if (component.type !== 'view') return false
                const cfg = component.config as import('../types/dashboard').ViewConfig
                const vid = cfg?.viewId
                if (!vid) return false
                if (publicToken) return false
                return !!viewEditAccess[vid]
              })()
              const common = {
                onEdit: (component.type === 'view' && canEditView) ? handleEdit : undefined,
                onReplace: component.type === 'view' ? () => setReplaceTargetId(component.id) : undefined,
                onDuplicate: () => handleDuplicate(component),
                onDelete: () => onDeleteComponent(component.id)
              }
              return (
                <ComponentToolbar visible {...common} />
              )
            })()}
          </div>
        )}
      </div>
      {/* 预览模式：已移除内置高级筛选，统一在 ChartBuilder 中提供 */}
      {/* 替换视图抽屉（与添加一致） */}
      <ViewPicker
        mode="drawer"
        title="替换视图"
        actionText="替换"
        open={!!replaceTargetId}
        onClose={() => setReplaceTargetId(null)}
        onConfirm={(viewId: number) => {
          const target = dashboard?.components.find(c => c.id === replaceTargetId)
          if (target) {
            onUpdateComponent(target.id, { config: { ...(target.config as object), viewId } as never })
          }
          setReplaceTargetId(null)
        }}
      />
    </div>
  )
}
