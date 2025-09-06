// types/dashboard.ts - 数据结构设计（编辑器本地形态）
import type {
  BaseComponent as TBaseComponent,
  ComponentType as TComponentType,
  ComponentLayout as TComponentLayout,
  ComponentStyle as TComponentStyle,
  ComponentConfig as TComponentConfig,
  DashboardSettings as TDashboardSettings,
  GlobalFilterDefinition
} from '@lumina/types'

// 统一复用 @lumina/types 中的通用组件类型，避免重复定义
export type {
  BaseComponent,
  ComponentType,
  ComponentLayout,
  ComponentStyle,
  ComponentConfig,
  TextConfig as _TextConfig,
  ImageConfig,
  DividerConfig,
  ContainerConfig,
  DashboardSettings
} from '@lumina/types'

// 向后兼容：本地文件仍导出 ViewConfig 名称
export type { ViewComponentConfig as ViewConfig } from '@lumina/types'
export type { TextConfig } from '@lumina/types'

// 编辑器用的仪表板结构（扁平：直接包含 components 与 settings）
export interface Dashboard {
  id: number
  name: string
  description?: string
  components: import('@lumina/types').BaseComponent[]
  settings: import('@lumina/types').DashboardSettings
  // 仪表板级全局筛选器定义（编辑页可编辑）
  globalFilters?: GlobalFilterDefinition[]
  // 权限相关（与后端对齐）
  ownerId?: number
  visibility?: 'private' | 'org' | 'public'
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

// 组件操作历史
export interface ComponentAction {
  id: string
  type: 'create' | 'update' | 'delete' | 'move' | 'resize'
  componentId: string
  timestamp: number
  oldState?: Partial<TBaseComponent>
  newState?: Partial<TBaseComponent>
  userId: string
}

// 编辑器状态
export interface EditorState {
  // 当前仪表板
  dashboard: Dashboard | null

  // 选中状态
  selectedComponentIds: string[]
  hoveredComponentId: string | null

  // 编辑模式
  mode: 'edit' | 'preview' | 'present'

  // 工具状态
  showGrid: boolean
  showRuler: boolean
  showGuides: boolean
  snapToGrid: boolean

  // 缩放和位置
  zoom: number
  panX: number
  panY: number

  // 历史记录
  history: Array<{ dashboard: Dashboard | null, selectedComponentIds: string[] }>
  historyIndex: number

  // 剪贴板
  clipboard: TBaseComponent[]

  // 加载状态
  loading: boolean
  saving: boolean

  // 错误状态
  error: string | null
}

// 组件库定义
export interface ComponentLibraryItem {
  type: TComponentType
  name: string
  icon: string
  description: string
  defaultConfig: TComponentConfig
  defaultLayout: Partial<TComponentLayout>
  defaultStyle: Partial<TComponentStyle>
  category: 'basic' | 'chart' | 'media' | 'layout' | 'advanced'
  tags: string[]
  previewImage?: string
}

// 预设模板
export interface DashboardTemplate {
  id: string
  name: string
  description: string
  thumbnail: string
  category: string
  tags: string[]
  dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
  popularity: number
  createdAt: string
}

// API 接口类型
export interface CreateDashboardRequest {
  name: string
  description?: string
  templateId?: string
  settings?: Partial<TDashboardSettings>
}

export interface UpdateDashboardRequest {
  name?: string
  description?: string
  components?: TBaseComponent[]
  settings?: Partial<TDashboardSettings>
}

export interface DashboardQueryParams {
  name?: string
  createdBy?: string
  tags?: string[]
  category?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 导出配置
export interface ExportConfig {
  format: 'pdf' | 'png' | 'jpeg' | 'svg' | 'json'
  width?: number
  height?: number
  quality?: number
  includeData?: boolean
  includeSettings?: boolean
  watermark?: {
    text: string
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    opacity: number
  }
}
