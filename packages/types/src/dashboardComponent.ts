// 仪表板组件类型（通用）

export type ComponentType = 'text' | 'view' | 'image' | 'divider' | 'container'

export interface ComponentLayout {
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
  isDraggable?: boolean
  isResizable?: boolean
}

export interface ComponentStyle {
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  boxShadow?: string
  padding?: number | string
  margin?: number | string
  opacity?: number
  zIndex?: number
}

export interface TextConfig {
  content: string
  fontSize: number
  fontWeight: string
  fontFamily: string
  color: string
  textAlign: string
  lineHeight: number
  letterSpacing?: number
  textDecoration?: string
  wordWrap: string
  whiteSpace: string
  isRichText: boolean
  htmlContent?: string
}

export interface ViewComponentConfig {
  viewId: number
  refreshInterval?: number
  showTitle: boolean
  titlePosition: string
  showBorder: boolean
  showLoading: boolean
  errorRetryCount: number
  headerStyle?: ComponentStyle
  contentStyle?: ComponentStyle
  filters?: Record<string, string | number | boolean | null>
  parameters?: Record<string, string | number | boolean | null>
  viewData?: unknown
}

export interface ImageConfig {
  src: string
  alt: string
  fit: string
  alignment: string
  lazy: boolean
  clickAction?: string
  linkUrl?: string
  customAction?: string
}

export interface DividerConfig {
  direction: string
  style: string
  thickness: number
  color: string
  spacing: number
}

export interface ContainerConfig {
  children: string[]
  layout: string
  flexDirection?: string
  justifyContent?: string
  alignItems?: string
  gap?: number
  gridColumns?: number
  gridRows?: number
  gridGap?: number
}

export type ComponentConfig = TextConfig | ViewComponentConfig | ImageConfig | DividerConfig | ContainerConfig

export interface BaseComponent {
  id: string
  type: ComponentType
  name: string
  layout: ComponentLayout
  style: ComponentStyle
  config: ComponentConfig
  createdAt: string
  updatedAt: string
}

export interface DashboardSettings {
  grid: {
    cols: number
    rows: number
    rowHeight: number
    margin: [number, number]
    padding: [number, number]
    maxRows?: number
    autoSize: boolean
    verticalCompact: boolean
    preventCollision: boolean
  }
  canvas: {
    width: number
    height: number
    heightMode?: 'auto' | 'fixed'
    backgroundColor: string
    backgroundImage?: string
    backgroundRepeat: string
    backgroundSize: string
    backgroundPosition: string
  }
  theme: {
    primary: string
    secondary: string
    success: string
    warning: string
    error: string
    text: string
    background: string
    surface: string
    border: string
  }
  interaction: {
    enableEdit: boolean
    enableFullscreen: boolean
    enableExport: boolean
    enableShare: boolean
    autoRefresh: boolean
    refreshInterval: number
  }
}
