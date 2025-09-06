// 计算指定坐标命中的组件 id（支持缩放和偏移）
// ===========================================
// useDashboardEditor Hook
// ===========================================

// DashboardEditor/hooks/useDashboardEditor.ts
import { useState, useCallback, useReducer, useEffect } from 'react'
import mergeWith from 'lodash/mergeWith'
import { message } from 'antd'
import { v4 as uuidv4 } from 'uuid'
import { type Layout } from 'react-grid-layout'
import { viewApi, dashboardApi } from '@lumina/api'
import type {
  Dashboard,
  BaseComponent,
  ComponentType,
  DashboardSettings,
  EditorState,
  ViewConfig,
  ComponentLayout
} from '../types/dashboard'
import type { DashboardConfig } from '@lumina/types'

function getComponentIdByPosition (
  components: BaseComponent[],
  settings: DashboardSettings['grid'],
  x: number,
  y: number,
  zoom = 1,
  panOffset: { x: number, y: number } = { x: 0, y: 0 }
): string | null {
  // 先将屏幕坐标还原为画布坐标
  const realX = (x - panOffset.x) / zoom
  const realY = (y - panOffset.y) / zoom
  // 忽略 margin/padding，以等分列宽与固定行高进行命中计算，确保与视觉网格一致
  const colWidth = 1200 / Math.max(1, settings.cols)
  // 倒序遍历，优先命中上层组件
  for (let i = components.length - 1; i >= 0; i--) {
    const comp = components[i]
    const { x: cx, y: cy, w, h } = comp.layout
    const left = cx * colWidth
    const top = cy * settings.rowHeight
    const width = w * colWidth
    const height = h * settings.rowHeight
    if (
      realX >= left &&
      realX <= left + width &&
      realY >= top &&
      realY <= top + height
    ) {
      return comp.id
    }
  }
  return null
}

// 默认仪表板设置
const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  grid: {
    cols: 12,
    rows: 0,
    rowHeight: 40,
    margin: [8, 8],
    padding: [16, 16],
    autoSize: true,
    verticalCompact: true,
    preventCollision: false
  },
  canvas: {
    width: 1920,
    height: 1080,
    backgroundColor: '#fff',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  },
  theme: {
    primary: '#1890ff',
    secondary: '#722ed1',
    success: '#52c41a',
    warning: '#faad14',
    error: '#f5222d',
    text: '#333333',
    background: '#ffffff',
    surface: '#fafafa',
    border: '#d9d9d9'
  },
  interaction: {
    enableEdit: true,
    enableFullscreen: true,
    enableExport: true,
    enableShare: true,
    autoRefresh: false,
    refreshInterval: 300
  }
}

// 编辑器状态reducer
type EditorAction =
  | { type: 'SET_DASHBOARD'; payload: Dashboard | null }
  | { type: 'UPDATE_DASHBOARD'; payload: Dashboard }
  | { type: 'SET_SELECTED_COMPONENTS'; payload: string[] }
  | { type: 'SET_MODE'; payload: EditorState['mode'] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_COMPONENT'; payload: BaseComponent }
  | { type: 'UPDATE_COMPONENT'; payload: { id: string; updates: Partial<BaseComponent> } }
  | { type: 'DELETE_COMPONENT'; payload: string }
  | { type: 'UPDATE_DASHBOARD_SETTINGS'; payload: Partial<DashboardSettings> }
  | { type: 'UNDO' }
  | { type: 'REDO' }

function pushHistory (state: EditorState): EditorState {
  const newHistory = state.history.slice(0, state.historyIndex + 1)
  newHistory.push({
    dashboard: state.dashboard,
    selectedComponentIds: state.selectedComponentIds
  } as { dashboard: typeof state.dashboard, selectedComponentIds: typeof state.selectedComponentIds })

  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1
  }
}

// 深度合并工具
function isPlainObject (v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepMerge<T> (target: T, source: Partial<T>): T {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return (source as T) || target
  }
  const tRec = target as unknown as Record<string, unknown>
  const sRec = source as unknown as Record<string, unknown>
  const resRec: Record<string, unknown> = { ...tRec }
  for (const key in sRec) {
    if (!Object.prototype.hasOwnProperty.call(sRec, key)) continue
    const sVal = sRec[key]
    const tVal = tRec[key]
    if (isPlainObject(sVal) && isPlainObject(tVal)) {
      resRec[key] = deepMerge(tVal, sVal)
    } else {
      resRec[key] = sVal
    }
  }
  return resRec as unknown as T
}

const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
  case 'SET_DASHBOARD': {
    // 直接设置dashboard，不推送到历史记录（用于初始加载）
    return { ...state, dashboard: action.payload }
  }

  case 'UPDATE_DASHBOARD':
    // 更新dashboard并推送到历史记录（用于编辑操作）
    return pushHistory({ ...state, dashboard: action.payload })

  case 'SET_SELECTED_COMPONENTS':
    return { ...state, selectedComponentIds: action.payload }

  case 'SET_MODE':
    return { ...state, mode: action.payload }

  case 'SET_LOADING':
    return { ...state, loading: action.payload }

  case 'SET_ERROR':
    return { ...state, error: action.payload }

  case 'ADD_COMPONENT':
    if (!state.dashboard) return state
    return pushHistory({
      ...state,
      dashboard: {
        ...state.dashboard,
        components: [...state.dashboard.components, action.payload]
      }
    })

  case 'UPDATE_COMPONENT':
    if (!state.dashboard) return state
    return pushHistory({
      ...state,
      dashboard: {
        ...state.dashboard,
        components: state.dashboard.components.map(comp =>
          comp.id === action.payload.id ? { ...comp, ...action.payload.updates } : comp
        )
      }
    })

  case 'DELETE_COMPONENT':
    if (!state.dashboard) return state
    return pushHistory({
      ...state,
      dashboard: {
        ...state.dashboard,
        components: state.dashboard.components.filter(comp => comp.id !== action.payload)
      },
      selectedComponentIds: state.selectedComponentIds.filter(id => id !== action.payload)
    })

  case 'UPDATE_DASHBOARD_SETTINGS': {
    if (!state.dashboard) return state
    return pushHistory({
      ...state,
      dashboard: {
        ...state.dashboard,
        settings: deepMerge<DashboardSettings>(state.dashboard.settings, action.payload)
      }
    })
  }

  case 'UNDO': {
    if (state.historyIndex > 0) {
      const prev = state.history[state.historyIndex - 1] as { dashboard: typeof state.dashboard, selectedComponentIds: typeof state.selectedComponentIds }
      return {
        ...state,
        dashboard: prev.dashboard,
        selectedComponentIds: prev.selectedComponentIds,
        historyIndex: state.historyIndex - 1
      }
    }
    return state
  }
  case 'REDO': {
    if (state.historyIndex < state.history.length - 1) {
      const next = state.history[state.historyIndex + 1] as { dashboard: typeof state.dashboard, selectedComponentIds: typeof state.selectedComponentIds }
      return {
        ...state,
        dashboard: next.dashboard,
        selectedComponentIds: next.selectedComponentIds,
        historyIndex: state.historyIndex + 1
      }
    }
    return state
  }

  default:
    return state
  }
}

export const useDashboardEditor = (dashboardId?: string) => {
  const [state, dispatch] = useReducer(editorReducer, {
    dashboard: null,
    selectedComponentIds: [],
    hoveredComponentId: null,
    mode: 'edit',
    showGrid: true,
    showRuler: false,
    showGuides: true,
    snapToGrid: true,
    zoom: 1,
    panX: 0,
    panY: 0,
    history: [],
    historyIndex: -1,
    clipboard: [],
    loading: false,
    saving: false,
    error: null
  })

  // 拖拽状态：组件库拖拽
  const [isLibraryDragging, setIsLibraryDragging] = useState(false)

  // 添加缩放状态
  const [zoom, setZoom] = useState(1)

  // 缩放控制
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.max(0.05, Math.min(3, newZoom)))
  }, [])

  // 新增：处理 React Grid Layout 的布局更新
  const updateLayoutFromGrid = useCallback((newLayouts: Layout[]) => {
    if (!state.dashboard) return

    const updatedComponents = state.dashboard.components.map(component => {
      const layoutItem = newLayouts.find(l => l.i === component.id)
      if (layoutItem) {
        return {
          ...component,
          layout: {
            ...component.layout,
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h
          },
          updatedAt: new Date().toISOString()
        }
      }
      return component
    })

    dispatch({
      type: 'UPDATE_DASHBOARD',
      payload: {
        ...state.dashboard,
        components: updatedComponents,
        updatedAt: new Date().toISOString()
      }
    })
  }, [state.dashboard])

  // 新增：在指定位置添加组件
  const addComponentAtPosition = useCallback((
    type: ComponentType,
    position: { x: number, y: number },
    config: Partial<{ layout: Partial<ComponentLayout>; style: Partial<BaseComponent['style']>; config: BaseComponent['config'] }> = {}
  ) => {
    // 获取组件类型的默认配置
    const getDefaultConfig = (componentType: ComponentType): BaseComponent['config'] => {
      switch (componentType) {
      case 'text':
        return ({
          content: '双击编辑文本',
          fontSize: 40,
          fontWeight: 'normal',
          fontFamily: 'inherit',
          color: '#333',
          textAlign: 'left',
          lineHeight: 1.5,
          isRichText: false
        } as unknown) as BaseComponent['config']
      case 'view':
        return ({
          viewId: 0,
          showTitle: true,
          titlePosition: 'top',
          showBorder: true,
          showLoading: true
        } as unknown) as ViewConfig
      default:
        return {} as BaseComponent['config']
      }
    }

    // 获取组件类型的默认尺寸
    const getDefaultSize = (componentType: ComponentType) => {
      switch (componentType) {
      case 'text':
        return { w: 12, h: 4 }
      case 'view':
        return { w: 6, h: 8 }
      default:
        return { w: 6, h: 6 }
      }
    }

    const defaultSize = getDefaultSize(type)
    const newComponent: BaseComponent = {
      id: uuidv4(),
      type,
      name: `${type}_${Date.now()}`,
      layout: {
        x: position.x,
        y: position.y,
        w: config.layout?.w || defaultSize.w,
        h: config.layout?.h || defaultSize.h,
        minW: config.layout?.minW || 1,
        minH: config.layout?.minH || 1,
        maxW: config.layout?.maxW,
        maxH: config.layout?.maxH,
        static: config.layout?.static || false,
        isDraggable: config.layout?.isDraggable !== false,
        isResizable: config.layout?.isResizable !== false
      },
      style: {
        backgroundColor: '#ffffff',
        borderColor: '#d9d9d9',
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        ...config.style
      },
      config: config.config || getDefaultConfig(type),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    dispatch({ type: 'ADD_COMPONENT', payload: newComponent })
    dispatch({ type: 'SET_SELECTED_COMPONENTS', payload: [newComponent.id] })

    message.success(`已添加 ${type} 组件`)
  }, [])

  // 加载仪表板
  const loadDashboard = useCallback(async (id: string): Promise<Dashboard> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const result = await dashboardApi.get(id)

      // 转换API返回的dashboard为前端Dashboard类型
      const config = result.config as DashboardConfig
      // 使用lodash.mergeWith递归合并settings
      const mergedSettings = mergeWith({}, DEFAULT_DASHBOARD_SETTINGS, config.settings || {}, (objValue, srcValue) => {
        // 如果是数组，直接用srcValue覆盖
        if (Array.isArray(objValue)) return srcValue
      })
      const dashboard: Dashboard = {
        id: result.id,
        name: result.name,
        description: result.description,
        components: config.components || [],
        ownerId: (result as { ownerId?: number }).ownerId,
        visibility: (result as { visibility?: 'private' | 'org' | 'public' }).visibility,
        createdAt: result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || new Date().toISOString(),
        createdBy: 'current-user',
        updatedBy: 'current-user',
        settings: mergedSettings,
        // 透传后端 DashboardConfig.globalFilters
        globalFilters: (config as { globalFilters?: Dashboard['globalFilters'] }).globalFilters || []
      }

      dispatch({ type: 'SET_DASHBOARD', payload: dashboard })
      message.success('加载成功')
      return dashboard
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载失败'
      message.error(errorMessage)
      throw new Error(errorMessage)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  // 创建新仪表板
  const createNewDashboard = useCallback(() => {
    const newDashboard: Dashboard = {
      id: 0,
      name: '新建仪表板',
      description: '',
      components: [],
      settings: DEFAULT_DASHBOARD_SETTINGS,
      visibility: 'private',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current_user',
      updatedBy: 'current_user'
    }
    dispatch({ type: 'SET_DASHBOARD', payload: newDashboard })
  }, [])

  // 初始化
  useEffect(() => {
    if (dashboardId) {
      loadDashboard(dashboardId)
    } else {
      createNewDashboard()
    }
  }, [dashboardId, loadDashboard, createNewDashboard])

  // 修改原有的 addComponent 方法，支持自动布局，且参数与 addComponentAtPosition 保持一致
  const addComponent = useCallback((
    type: ComponentType,
    config: Partial<{ layout: Partial<ComponentLayout>; style: Partial<BaseComponent['style']>; config: BaseComponent['config'] }> = {}
  ) => {
    if (!state.dashboard) return

    // 找到一个空的位置放置新组件
    const findEmptyPosition = (): { x: number, y: number } => {
      const gridCols = state.dashboard?.settings?.grid?.cols || 12
      const existingComponents = state.dashboard?.components || []

      // 简单的位置查找算法：从左上角开始，找第一个空位置
      for (let y = 0; y < 100; y++) {
        for (let x = 0; x <= gridCols - (config.layout?.w || 4); x++) {
          const isOccupied = existingComponents.some(comp => {
            const { x: cx, y: cy, w: cw, h: ch } = comp.layout
            return !(x >= cx + cw || x + (config.layout?.w || 4) <= cx ||
              y >= cy + ch || y + (config.layout?.h || 4) <= cy)
          })

          if (!isOccupied) {
            return { x, y }
          }
        }
      }

      // 如果找不到空位置，就放在最下面
      const maxY = Math.max(0, ...existingComponents.map(comp => comp.layout.y + comp.layout.h))
      return { x: 0, y: maxY }
    }

    const position = findEmptyPosition()
    addComponentAtPosition(type, position, config)
  }, [state.dashboard, addComponentAtPosition])

  // 更新组件
  const updateComponent = useCallback((id: string, updates: Partial<BaseComponent>) => {
    dispatch({
      type: 'UPDATE_COMPONENT',
      payload: { id, updates: { ...updates, updatedAt: new Date().toISOString() } }
    })
  }, [])

  // 删除组件
  const deleteComponent = useCallback((id: string) => {
    dispatch({ type: 'DELETE_COMPONENT', payload: id })
  }, [])

  // 选择组件
  const selectComponent = useCallback((id: string, multi = false) => {
    if (multi) {
      dispatch({
        type: 'SET_SELECTED_COMPONENTS',
        payload: state.selectedComponentIds.includes(id)
          ? state.selectedComponentIds.filter(selectedId => selectedId !== id)
          : [...state.selectedComponentIds, id]
      })
    } else {
      dispatch({ type: 'SET_SELECTED_COMPONENTS', payload: id ? [id] : [] })
    }
  }, [state.selectedComponentIds])

  // 移除旧的任意类型 updateLayout（已由 updateLayoutFromGrid 取代）

  // 更新仪表板基本信息
  const updateDashboard = useCallback((updates: Partial<Dashboard>) => {
    if (!state.dashboard) return

    dispatch({
      type: 'UPDATE_DASHBOARD',
      payload: {
        ...state.dashboard,
        ...updates,
        updatedAt: new Date().toISOString()
      }
    })
  }, [state.dashboard])

  // 更新仪表板设置
  const updateDashboardSettings = useCallback((settings: Partial<DashboardSettings>) => {
    dispatch({ type: 'UPDATE_DASHBOARD_SETTINGS', payload: settings })
  }, [])

  // 保存仪表板
  const saveDashboard = useCallback(async (overrides?: Partial<Dashboard>): Promise<Dashboard> => {
    if (!state.dashboard) throw new Error('没有可保存的仪表板')
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const effective = { ...state.dashboard, ...(overrides || {}) }
      let result: { id: number } | undefined
      const configData: DashboardConfig = {
        components: effective.components,
        settings: {
          ...effective.settings
        },
        filters: [],
        globalFilters: effective.globalFilters || [],
        version: '1.0.0'
      }

      if (dashboardId) {
        // 更新现有仪表板
        result = await dashboardApi.update(Number(dashboardId), {
          name: effective.name,
          description: effective.description,
          config: configData
        })
      } else {
        // 创建新仪表板
        result = await dashboardApi.create({
          name: effective.name,
          description: effective.description,
          config: configData
        })

        dispatch({
          type: 'SET_DASHBOARD',
          payload: { ...effective, id: result.id }
        })
      }

      message.success('保存成功')
      // 返回当前前端形态的 Dashboard
      return { ...(effective as Dashboard), id: result?.id ?? effective.id }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存失败'
      message.error(errorMessage)
      throw new Error(errorMessage)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.dashboard, dashboardId])

  const importDashboard = useCallback(async (importedDashboard: Dashboard) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })

      // 处理视图组件的视图查询
      const processedComponents = await Promise.all(
        importedDashboard.components.map(async (component) => {
          if (component.type === 'view') {
            const viewConfig = component.config as ViewConfig
            if (viewConfig.viewId) {
              return {
                ...component,
                config: {
                  ...viewConfig
                }
              }
            }
          }
          return component
        })
      )

      // 直接设置完整的dashboard
      const processedDashboard: Dashboard = {
        ...importedDashboard,
        components: processedComponents
      }

      dispatch({ type: 'SET_DASHBOARD', payload: processedDashboard })

      message.success('导入成功！')
      return processedDashboard
    } catch (error) {
      console.error('导入失败:', error)
      message.error('导入失败，请检查文件格式')
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  // 撤销/重做功能（简化版）
  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [])

  // 导出功能
  const exportDashboard = useCallback(() => {
    if (!state.dashboard) {
      message.warning('没有可导出的仪表板')
      return
    }

    try {
      // 创建导出数据
      const exportData = {
        ...state.dashboard,
        exportTime: new Date().toISOString(),
        version: '1.0.0'
      }

      // 转换为JSON字符串
      const dataStr = JSON.stringify(exportData, null, 2)

      // 创建Blob对象
      const blob = new Blob([dataStr], { type: 'application/json' })

      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dashboard-${state.dashboard.name || 'untitled'}-${new Date().getTime()}.json`

      // 触发下载
      document.body.appendChild(link)
      link.click()

      // 清理
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success('导出成功')
    } catch (error) {
      console.error('Export failed:', error)
      message.error('导出失败')
    }
  }, [state.dashboard])

  // 新增：支持缩放和偏移的命中判定
  return {
    getComponentIdByPosition: (
      x: number,
      y: number,
      zoom = 1,
      panOffset: { x: number, y: number } = { x: 0, y: 0 }
    ) => {
      if (!state.dashboard) return null
      return getComponentIdByPosition(
        state.dashboard.components,
        state.dashboard.settings.grid,
        x,
        y,
        zoom,
        panOffset
      )
    },
    // 状态
    dashboard: state.dashboard,
    selectedComponentIds: state.selectedComponentIds,
    editorMode: state.mode,
    loading: state.loading,
    error: state.error,

    // 新增缩放相关
    zoom,
    onZoomChange: handleZoomChange,

    // 操作方法
    addComponent,
    addComponentAtPosition, // 新增
    updateComponent,
    deleteComponent,
    selectComponent,
    updateLayout: updateLayoutFromGrid, // 使用新的布局更新方法
    updateDashboard,
    updateDashboardSettings,
    saveDashboard,
    loadDashboard,

    // 历史操作
    undo,
    redo,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,

    // 其他
    exportDashboard,
    importDashboard,
    // 拖拽状态
    isLibraryDragging,
    setIsLibraryDragging
  }
}
