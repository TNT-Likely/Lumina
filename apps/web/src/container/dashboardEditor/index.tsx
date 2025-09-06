import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Row, Col, Card, Spin, message, Input, Button, Space, Typography, Tooltip, Divider, Dropdown, Modal, List, Tag, Form, Select, Switch, Menu, Radio } from 'antd'
import { EditOutlined, CheckOutlined, CloseOutlined, CloudUploadOutlined, UndoOutlined, RedoOutlined, ImportOutlined, ExportOutlined, ShareAltOutlined, FontSizeOutlined, AppstoreAddOutlined, LeftOutlined, RightOutlined, MoreOutlined, LinkOutlined, PictureOutlined, BellOutlined, PlusOutlined, SafetyCertificateOutlined, FilterOutlined } from '@ant-design/icons'
import * as htmlToImage from 'html-to-image'
// PDF 导出已移除
import ShareModal from '../../components/share/ShareModal'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { PropertyPanel } from './components/PropertyPanel'
import { Canvas } from './components/Canvas'
import { ZoomControl } from './components/ZoomControl'
import { ViewPicker } from './components/ViewPicker'

import { DashboardProvider, useDashboardContext } from './context/DashboardContext'
import { subscriptionApi, notificationApi, dashboardApi, ShareApi } from '@lumina/api'
import SubscriptionFormModal from '../../components/subscription/SubscriptionFormModal'
import { CronPicker } from '@lumina/components'
import type { Subscription } from '@lumina/types'

import type {
  Dashboard,
  BaseComponent,
  ComponentType
} from './types/dashboard'

import './index.less'
import GlobalFiltersEditor from './components/GlobalFiltersEditor'

const { Title } = Typography

interface DashboardEditorProps {
  dashboardId?: string
  mode?: 'edit' | 'preview'
  onSave?: (dashboard: Dashboard) => void
  onExit?: () => void
}

const DashboardEditor: React.FC<DashboardEditorProps> = ({
  dashboardId,
  mode = 'edit',
  onSave,
  onExit
}) => {
  return (
    <DashboardProvider dashboardId={dashboardId}>
      <DashboardEditorContent
        dashboardId={Number(dashboardId)}
        mode={mode}
        onSave={onSave}
        onExit={onExit}
      />
    </DashboardProvider>
  )
}

const DashboardEditorContent: React.FC<{
  dashboardId?: number
  mode: 'edit' | 'preview'
  onSave?: (dashboard: Dashboard) => void
  onExit?: () => void
}> = ({ mode, onSave, dashboardId }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const {

    // 状态
    dashboard,
    selectedComponentIds,
    loading,

    zoom,
    onZoomChange,

    // 操作
    addComponent,
    addComponentAtPosition,
    updateComponent,
    deleteComponent,
    selectComponent,
    updateLayout,
    updateDashboard,
    updateDashboardSettings,
    saveDashboard,

    // 历史操作
    undo,
    redo,
    canUndo,
    canRedo,

    // 其他
    exportDashboard,
    importDashboard
  } = useDashboardContext()

  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const [shareVisible, setShareVisible] = useState(false)
  const [addDrawerOpen, setAddDrawerOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [subsOpen, setSubsOpen] = useState(false)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [subsModalOpen, setSubsModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<Subscription | null>(null)
  const [subForm] = Form.useForm()
  const [notifyOptions, setNotifyOptions] = useState<Array<{ label: string, value: string }>>([])
  // 可见性弹窗
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [visibilityValue, setVisibilityValue] = useState<'private' | 'org' | 'public'>('private')
  const [visibilityLoading, setVisibilityLoading] = useState(false)
  // 全局筛选器编辑器开关
  const [gfEditorOpen, setGfEditorOpen] = useState(false)
  // 编辑期视图只读令牌：根据后端 needViewToken 自动签发
  const [readonlyFixToken, setReadonlyFixToken] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState<boolean>(false)
  // 隐藏导出容器引用
  const hiddenExportRef = React.useRef<HTMLDivElement>(null)
  const [exportKey, setExportKey] = useState(0)
  const noop = () => undefined
  const initialFitTriesRef = useRef(0)

  // 订阅表单：打开时拉取通知方式
  useEffect(() => {
    if (!subsModalOpen) return
    (async () => {
      try {
        const res = await notificationApi.list({ page: 1, pageSize: 200 })
        setNotifyOptions((res.list || []).map((n: { id: number, name: string }) => ({ label: n.name, value: String(n.id) })))
      } catch { }
    })()
  }, [subsModalOpen])

  // 根据后端 needViewToken 自动签发编辑期只读 token（不污染URL）
  useEffect(() => {
    (async () => {
      try {
        console.log(dashboardId, dashboard)
        if (!dashboardId) { setPreviewReady(true); return }
        if (!dashboard?.id) { setPreviewReady(false); return }
        // 重新获取一次 dashboard 元信息（包含 needViewToken 标志）
        const d = await dashboardApi.get(String(dashboard.id)) as unknown as { id: number; needViewToken?: boolean }
        if (d?.needViewToken) {
          const signed = await ShareApi.signDashboard(Number(d.id), { expiresIn: '2h', orgScope: true })
          setReadonlyFixToken(signed.token)
          setPreviewReady(true)
        } else {
          setReadonlyFixToken(null)
          setPreviewReady(true)
        }
      } catch {
        // 静默失败，不影响编辑
        setReadonlyFixToken(null)
        setPreviewReady(true)
      }
    })()
  }, [dashboard?.id])

  // 同步订阅表单数据：在弹窗打开或切换编辑对象时刷新表单值
  useEffect(() => {
    if (!subsModalOpen) {
      subForm.resetFields()
      return
    }
    const initial = {
      name: editingSub?.name || (dashboard?.name ? `${dashboard.name}-订阅` : ''),
      notifyIds: editingSub?.notifyIds || [],
      schedule: editingSub?.config?.schedule || '* * * * *',
      format: editingSub?.config?.format || 'image',
      enabled: editingSub?.enabled ?? true,
      remark: editingSub?.config?.remark || ''
    }
    subForm.setFieldsValue(initial)
  }, [subsModalOpen, editingSub, dashboard, subForm])

  // 打开可见性时同步当前值
  useEffect(() => {
    if (!visibilityOpen) return
    const v = (dashboard && typeof (dashboard as { visibility?: unknown }).visibility === 'string')
      ? (dashboard as { visibility?: unknown }).visibility as string
      : undefined
    if (v === 'private' || v === 'org' || v === 'public') {
      setVisibilityValue(v)
    } else {
      setVisibilityValue('private')
    }
  }, [visibilityOpen, dashboard])

  // 处理导入
  const handleImport = useCallback(async (importedDashboard: Dashboard) => {
    return await importDashboard(importedDashboard)
  }, [importDashboard])

  // 等待下一帧，确保导出模式布局/样式生效
  const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  // 等待画布稳定：无加载中、图片加载完成或超时
  const waitForCanvasStable = useCallback(async (node: HTMLElement, timeoutMs = 4000) => {
    const start = Date.now()
    const hasVisibleSpinner = () => {
      const spins = Array.from(node.querySelectorAll('.ant-spin-spinning')) as HTMLElement[]
      return spins.some(sp => sp.offsetParent !== null)
    }
    while (Date.now() - start < timeoutMs) {
      if (!hasVisibleSpinner()) {
        // 检查<img/>是否加载完成
        const imgs = Array.from(node.querySelectorAll('img')) as HTMLImageElement[]
        const notReady = imgs.filter(img => !img.complete || img.naturalWidth === 0)
        if (notReady.length === 0) return
      }
      await sleep(150)
    }
  }, [])

  // 使用隐藏 DOM 生成无闪烁截图（函数定义见下）

  // 将背景图转为 dataURL，避免跨域导致的截图缺失；失败则回退原 URL
  const getBgImageForExport = useCallback(async (): Promise<string | undefined> => {
    const url = dashboard?.settings?.canvas?.backgroundImage
    if (!url) return undefined
    try {
      // 已是 dataURL 直接返回
      if (url.startsWith('data:')) return url
      // 同源也可直接返回
      const sameOrigin = (() => {
        try {
          const u = new URL(url, window.location.href)
          return u.origin === window.location.origin
        } catch { return false }
      })()
      if (sameOrigin) return url

      const resp = await fetch(url, { mode: 'cors', credentials: 'omit' })
      const blob = await resp.blob()
      const reader = new FileReader()
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error('read error'))
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(blob)
      })
      return dataUrl
    } catch {
      return url
    }
  }, [dashboard?.settings?.canvas?.backgroundImage])

  // 使用隐藏 DOM 生成无闪烁截图
  const renderHiddenExportAndCapture = useCallback(async (): Promise<{ dataUrl: string, width: number, height: number } | null> => {
    if (!dashboard) return null
    const host = hiddenExportRef.current
    if (!host) return null
    // 渲染一个隐藏的 Canvas，强制 exporting=true、zoom=1
    setExportKey((k) => k + 1)
    await nextFrame() // 等容器挂载
    const node = host.querySelector('.dashboard-canvas') as HTMLElement | null
    if (!node) return null
    // 双 rAF 确保布局计算完成
    await nextFrame(); await nextFrame()
    const width = node.offsetWidth
    const height = node.offsetHeight
    const bgDataUrl = await getBgImageForExport()
    const dataUrl = await htmlToImage.toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      width,
      height,
      backgroundColor: dashboard.settings.canvas.backgroundColor || '#fff',
      style: {
        backgroundColor: dashboard.settings.canvas.backgroundColor || '#fff',
        backgroundImage: bgDataUrl ? `url(${bgDataUrl})` : 'none',
        backgroundRepeat: dashboard.settings.canvas.backgroundRepeat || 'no-repeat',
        backgroundSize: dashboard.settings.canvas.backgroundSize || 'cover',
        backgroundPosition: dashboard.settings.canvas.backgroundPosition || 'center'
      }
    })
    return { dataUrl, width, height }
  }, [dashboard, getBgImageForExport])

  // 使用当前 DOM 截图：避免复制DOM导致的“加载中”，优先尝试，失败回退隐藏容器
  const captureFromCurrentCanvas = useCallback(async (): Promise<{ dataUrl: string, width: number, height: number } | null> => {
    if (!dashboard) return null
    const node = document.querySelector('.dashboard-canvas') as HTMLElement | null
    if (!node) return null
    // 等待稳定并确保布局完成
    await waitForCanvasStable(node)
    await nextFrame(); await nextFrame()
    const width = node.offsetWidth
    const height = node.offsetHeight
    const bgDataUrl = await getBgImageForExport()
    const dataUrl = await htmlToImage.toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      width,
      height,
      backgroundColor: dashboard.settings.canvas.backgroundColor || '#fff',
      style: {
        backgroundColor: dashboard.settings.canvas.backgroundColor || '#fff',
        backgroundImage: bgDataUrl ? `url(${bgDataUrl})` : 'none',
        backgroundRepeat: dashboard.settings.canvas.backgroundRepeat || 'no-repeat',
        backgroundSize: dashboard.settings.canvas.backgroundSize || 'cover',
        backgroundPosition: dashboard.settings.canvas.backgroundPosition || 'center'
      }
    })
    return { dataUrl, width, height }
  }, [dashboard, waitForCanvasStable, getBgImageForExport])

  const handleShareImage = useCallback(async () => {
    try {
      if (!dashboard) return
      // 优先使用当前 DOM，避免“加载中”复现；失败则回退隐藏容器
      let result = await captureFromCurrentCanvas()
      if (!result) {
        result = await renderHiddenExportAndCapture()
      }
      if (!result) { return }
      const { dataUrl } = result
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${dashboard.name || 'dashboard'}.png`
      a.click()
    } catch (e) {
      message.error('导出图片失败')
    }
  }, [dashboard, captureFromCurrentCanvas, renderHiddenExportAndCapture])

  // handleSharePDF 已移除

  // 自适应窗口（按最长边：contain => min(widthRatio, heightRatio)），使用实际 DOM 宽高
  const handleFitToWindow = useCallback(() => {
    const container = document.querySelector('.dashboard-canvas-container') as HTMLElement | null
    if (!container) return
    const inner = container.querySelector('.dashboard-canvas-inner') as HTMLElement | null
    if (!inner) return
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const contentWidth = inner.offsetWidth
    const contentHeight = inner.offsetHeight
    if (contentWidth <= 0 || contentHeight <= 0) return
    // 取最小比例，确保画布完整可见
    const ratioW = containerWidth / contentWidth
    const ratioH = containerHeight / contentHeight
    const fitZoom = Math.min(ratioW, ratioH)
    const clampedZoom = Math.max(0.25, Math.min(3, fitZoom))
    onZoomChange(clampedZoom)
  }, [onZoomChange, dashboard])

  // 处理保存
  const handleSave = useCallback(async () => {
    try {
      const isNew = !dashboard?.id || Number(dashboard?.id) === 0
      const savedDashboard = await saveDashboard()
      message.success(isNew ? '创建成功' : '保存成功')
      onSave?.(savedDashboard)
      // 新建成功后，更新路由为编辑模式（携带新 id）
      if (isNew && savedDashboard?.id) {
        const params = new URLSearchParams(location.search)
        params.set('id', String(savedDashboard.id))
        navigate(`${location.pathname}?${params.toString()}`, { replace: true })
      }
    } catch (error) {
      message.error('保存失败')
    }
  }, [saveDashboard, onSave, dashboard?.id, location.search, location.pathname, navigate])

  // 统一添加组件逻辑：优先使用 hooks 的 addComponentAtPosition；无位置时用 addComponent 自动寻址
  type AddConfig = { layout?: Partial<BaseComponent['layout']>; style?: Partial<BaseComponent['style']>; config?: BaseComponent['config'] }
  const handleAddComponent = useCallback(
    (type: ComponentType, position?: { x: number; y: number }, config?: AddConfig) => {
      if (position) {
        addComponentAtPosition(type, position, config)
      } else {
        addComponent(type, config as NonNullable<AddConfig>)
      }
    },
    [addComponent, addComponentAtPosition]
  )

  // 处理名称编辑
  const handleNameEdit = useCallback((editing: boolean) => {
    if (editing) {
      setTempName(dashboard?.name || '')
      setIsEditingName(true)
    } else {
      setIsEditingName(false)
    }
  }, [dashboard?.name])

  const handleNameSave = useCallback(() => {
    if (tempName.trim() && tempName !== dashboard?.name) {
      updateDashboard({ name: tempName.trim() })
    }
    setIsEditingName(false)
  }, [tempName, dashboard?.name, updateDashboard])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
        case 's':
          e.preventDefault()
          handleSave()
          break
        case 'z':
          e.preventDefault()
          if (e.shiftKey) {
            redo()
          } else {
            undo()
          }
          break
        case '+':
        case '=':
          e.preventDefault()
          onZoomChange(Math.min(zoom + 0.1, 3))
          break
        case '-':
          e.preventDefault()
          onZoomChange(Math.max(zoom - 0.1, 0.25))
          break
        case '0':
          if (e.shiftKey) return
          e.preventDefault()
          onZoomChange(1)
          break
        }
      }

      if (e.key === 'Delete' && selectedComponentIds.length > 0) {
        selectedComponentIds.forEach(id => { deleteComponent(id) })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [handleSave, undo, redo, selectedComponentIds, deleteComponent, onZoomChange, zoom])

  // 初始化加载与窗口尺寸变化时自动适应屏幕（contain）
  useEffect(() => {
    initialFitTriesRef.current = 0
    const tryFit = () => {
      const container = document.querySelector('.dashboard-canvas-container') as HTMLElement | null
      const inner = container?.querySelector('.dashboard-canvas-inner') as HTMLElement | null
      if (!container || !inner) return false
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const contentWidth = inner.offsetWidth
      const contentHeight = inner.offsetHeight
      if (contentWidth > 0 && contentHeight > 0) {
        const ratioW = containerWidth / contentWidth
        const ratioH = containerHeight / contentHeight
        const fitZoom = Math.min(ratioW, ratioH)
        const clampedZoom = Math.max(0.25, Math.min(3, fitZoom))
        if (Math.abs(clampedZoom - zoom) > 0.005) {
          onZoomChange(clampedZoom)
        }
        return true
      }
      return false
    }
    const pump = () => {
      // 多次尝试，等待布局/图片/字体影响的尺寸稳定
      if (tryFit()) return
      if (initialFitTriesRef.current++ < 12) {
        requestAnimationFrame(pump)
      }
    }
    requestAnimationFrame(pump)

    const onResize = () => {
      // 简化：窗口变化时直接按当前内容适配
      handleFitToWindow()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [dashboard?.id, handleFitToWindow])

  return (
    <div className="dashboard-editor" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div className="dashboard-editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 顶部工具栏（吸顶） */}
        <div style={{ flexShrink: 0 }}>
          <Card
            className="dashboard-toolbar-card"
            bodyStyle={{ padding: '8px 16px' }}
            style={{ background: '#ffffff' }}
          >
            <Row align="middle" wrap={false}>
              {/* 左：名称、保存、历史操作 */}
              <Col flex="360px">
                <Space size="small" align="center">
                  <div className="dashboard-name-section" style={{ display: 'flex', alignItems: 'center' }}>
                    {isEditingName
                      ? (
                        <Space>
                          <Input
                            value={tempName}
                            onChange={(e) => { setTempName(e.target.value) }}
                            onPressEnter={handleNameSave}
                            onBlur={handleNameSave}
                            placeholder="输入仪表板名称"
                            style={{ width: 200 }}
                            autoFocus
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={handleNameSave}
                            className="edit-action-btn confirm"
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={() => { handleNameEdit(false) }}
                            className="edit-action-btn cancel"
                          />
                        </Space>
                      )
                      : (
                        <Space>
                          <Typography.Text strong style={{ margin: 0, fontSize: 14 }}>
                            {dashboard?.name || '未命名仪表板'}
                          </Typography.Text>
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => { handleNameEdit(true) }}
                            className="edit-trigger-btn"
                          />
                        </Space>
                      )}
                  </div>
                  <Tooltip title="保存 (Ctrl+S)">
                    <Button type="text" icon={<CloudUploadOutlined />} onClick={handleSave} loading={loading} />
                  </Tooltip>
                  <Tooltip title="撤销 (Ctrl+Z)">
                    <Button type="text" icon={<UndoOutlined />} onClick={undo} disabled={!canUndo} />
                  </Tooltip>
                  <Tooltip title="重做 (Ctrl+Shift+Z)">
                    <Button type="text" icon={<RedoOutlined />} onClick={redo} disabled={!canRedo} />
                  </Tooltip>
                </Space>
              </Col>

              {/* 中：添加组件（居中） */}
              <Col flex="auto" style={{ display: 'flex', justifyContent: 'center' }}>
                {mode === 'edit' && (
                  <Space size="middle">
                    <Tooltip title="添加文本到画布">
                      <Button type="text" icon={<FontSizeOutlined />} onClick={() => handleAddComponent('text')}>添加文本</Button>
                    </Tooltip>
                    <Tooltip title="添加视图到画布">
                      <Button type="text" icon={<AppstoreAddOutlined />} onClick={() => setAddDrawerOpen(true)}>添加视图</Button>
                    </Tooltip>
                    <Tooltip title="全局筛选器">
                      <Button type="text" icon={<FilterOutlined />} onClick={() => setGfEditorOpen(true)}>全局筛选</Button>
                    </Tooltip>
                  </Space>
                )}
              </Col>

              {/* 右：分享/导入等 */}
              <Col flex="360px" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Space size="small">
                  {/* 订阅：点击直接打开列表 */}
                  <Button
                    type="text"
                    icon={<BellOutlined />}
                    onClick={async () => {
                      setSubsOpen(true)
                      try {
                        setSubsLoading(true)
                        const res = await subscriptionApi.list({ dashboardId: dashboard?.id })
                        setSubs(res.list || [])
                      } finally {
                        setSubsLoading(false)
                      }
                    }}
                  >
                    订阅
                  </Button>
                  {/* 分享下拉：分享链接 / 图片；导出配置单独放在其下 */}
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'link', icon: <LinkOutlined />, label: '分享链接', onClick: () => setShareVisible(true) },
                        { key: 'image', icon: <PictureOutlined />, label: '分享图片', onClick: handleShareImage },
                        // PDF 导出项已移除
                        { type: 'divider' as const },
                        { key: 'export', icon: <ExportOutlined />, label: '导出配置', onClick: exportDashboard }
                      ]
                    }}
                  >
                    <Button type="text" icon={<ShareAltOutlined />}>分享</Button>
                  </Dropdown>
                  {/* 更多：导入放到这里 */}
                  <Dropdown
                    overlay={(
                      <Menu
                        items={[
                          {
                            key: 'import',
                            icon: <ImportOutlined />,
                            label: '导入配置',
                            onClick: () => {
                              const input = document.createElement('input')
                              input.type = 'file'
                              input.accept = '.json'
                              input.onchange = async (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0]
                                if (file) {
                                  try {
                                    const text = await file.text()
                                    const importedDashboard = JSON.parse(text)
                                    await handleImport(importedDashboard)
                                    message.success('导入成功')
                                  } catch (error) {
                                    message.error('导入失败: ' + (error as Error).message)
                                  }
                                }
                              }
                              input.click()
                            }
                          },
                          { type: 'divider' as const },
                          { key: 'visibility', icon: <SafetyCertificateOutlined />, label: '设置可见性' }
                        ]}
                        onClick={(info) => {
                          if (info.key === 'visibility') {
                            setVisibilityOpen(true)
                          }
                        }}
                      />
                    )}
                    trigger={['click']}
                  >
                    <Button type="text" icon={<MoreOutlined />}>更多</Button>
                  </Dropdown>
                </Space>
              </Col>
            </Row>
          </Card>
        </div>

        {/* 主体内容区域 */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 0' }}>
          <div style={{ display: 'flex', height: '100%', gap: 16 }}>
            {/* 左侧面板移除，改为顶部添加按钮 */}

            {/* 中间：画布区域 */}
            <div
              className="dashboard-canvas-container"
              style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}
            >
              {/* 移除权限体检横幅，改为自动签发只读令牌 */}
              {previewReady && (
                <Canvas
                  dashboard={dashboard}
                  selectedComponentIds={selectedComponentIds}
                  mode={mode}
                  zoom={zoom}
                  exporting={exporting}
                  onSelectComponent={selectComponent}
                  onUpdateComponent={updateComponent}
                  onUpdateLayout={updateLayout}
                  onDeleteComponent={deleteComponent}
                  onAddComponent={(type, position) => handleAddComponent(type, position)}
                  onZoomChange={onZoomChange}
                  heightMode={dashboard?.settings?.canvas?.heightMode}
                  publicToken={readonlyFixToken}
                />)}

              {/* 缩放控制 */}
              <div className="dashboard-zoom-control">
                <ZoomControl
                  zoom={zoom}
                  onZoomChange={onZoomChange}
                  onFitToWindow={handleFitToWindow}
                />
              </div>
            </div>

            {/* 右侧：属性面板（挤压画布区） */}
            {mode === 'edit' && (
              <RightDockPropertyPanel
                selectedComponentIds={selectedComponentIds}
                dashboard={dashboard}
                onUpdateComponent={updateComponent}
                onUpdateDashboardSettings={updateDashboardSettings}
              />
            )}
          </div>
        </div>
      </div>

      <ShareModal open={shareVisible} dashboardId={Number(dashboard?.id || 0)} visibility={dashboard?.visibility as 'private' | 'org' | 'public' | undefined} onClose={() => { setShareVisible(false) }} />
      {/* 订阅列表（点击直接打开），右上角+ 新建 */}
      <Modal
        open={subsOpen}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button type="text" icon={<PlusOutlined />} onClick={() => { setEditingSub(null); setSubsModalOpen(true) }} />
            <span>订阅</span>
          </div>
        }
        onCancel={() => setSubsOpen(false)}
        footer={null}
        width={640}
      >
        <List
          loading={subsLoading}
          dataSource={subs}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              actions={[
                <Button type="link" onClick={() => { setEditingSub(item); setSubsModalOpen(true) }}>编辑</Button>
              ]}
              onClick={() => { setEditingSub(item); setSubsModalOpen(true) }}
            >
              <List.Item.Meta
                title={<span>{item.name} {item.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}</span>}
                description={`格式: ${item.config?.format || 'image'}，计划: ${item.config?.schedule || '-'}`}
              />
            </List.Item>
          )}
        />
      </Modal>
      <SubscriptionFormModal
        open={subsModalOpen}
        mode={editingSub ? 'edit' : 'create'}
        record={editingSub}
        dashboardId={dashboard?.id as number}
        onClose={() => setSubsModalOpen(false)}
        onSuccess={async () => {
          const res = await subscriptionApi.list({ dashboardId: dashboard?.id })
          setSubs(res.list || [])
        }}
      />
      {/* 可见性弹窗 */}
      <Modal
        open={visibilityOpen}
        title="设置可见性"
        okText="确认"
        cancelText="取消"
        confirmLoading={visibilityLoading}
        onCancel={() => setVisibilityOpen(false)}
        onOk={async () => {
          if (!dashboard?.id) { setVisibilityOpen(false); return }
          try {
            setVisibilityLoading(true)
            await dashboardApi.update(Number(dashboard.id), { visibility: visibilityValue })
            message.success('已更新可见性')
            setVisibilityOpen(false)
          } catch (e) {
            message.error('更新可见性失败')
          } finally {
            setVisibilityLoading(false)
          }
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            选择可见范围，确认后将更新该仪表板的访问权限。
          </Typography.Paragraph>
          <Radio.Group
            value={visibilityValue}
            onChange={(e) => setVisibilityValue(e.target.value)}
          >
            <Space direction="vertical">
              <Radio value="private">仅自己可见</Radio>
              <Radio value="org">组织内可见</Radio>
              <Radio value="public">公开可见</Radio>
            </Space>
          </Radio.Group>
        </Space>
      </Modal>
      <ViewPicker
        mode="drawer"
        title="添加视图"
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        onConfirm={(viewId) => {
          handleAddComponent('view', undefined, { config: { viewId, showBorder: true, showLoading: true } as unknown as BaseComponent['config'] })
          setAddDrawerOpen(false)
        }}
      />
      <GlobalFiltersEditor
        open={gfEditorOpen}
        value={dashboard?.globalFilters || []}
        components={dashboard?.components || []}
        onClose={() => setGfEditorOpen(false)}
        onChange={(next) => {
          // 先本地更新，立即反馈到 UI
          updateDashboard({ globalFilters: next })
          // 再用 overrides 直传，避免异步 setState 导致的“点两次才生效”
          saveDashboard({ globalFilters: next }).catch(() => { /* 已有统一错误提示 */ })
        }}
      />
      {/* 隐藏导出容器：放在视图末尾，避免布局影响 */}
      <div
        ref={hiddenExportRef}
        style={{ position: 'fixed', left: -100000, top: -100000, width: '1px', height: '1px', overflow: 'hidden' }}
      >
        {/* 使用相同的 Canvas，强制 exporting=true、zoom=1，避免现有页面闪烁 */}
        <div style={{ width: '10000px', height: '10000px' }} key={exportKey}>
          {previewReady && (
            <Canvas
              dashboard={dashboard}
              selectedComponentIds={[]}
              mode={'edit'}
              zoom={1}
              exporting
              onSelectComponent={noop}
              onUpdateComponent={() => undefined}
              onUpdateLayout={() => undefined}
              onDeleteComponent={noop}
              onAddComponent={() => undefined}
              onZoomChange={noop}
              heightMode={dashboard?.settings?.canvas?.heightMode}
              publicToken={readonlyFixToken}
            />)}
        </div>
      </div>

      {/* 隐藏导出函数已在文件上方通过 useCallback 定义 */}
    </div>
  )
}

// 右侧属性面板（挤压画布区）+ 折叠按钮
const RightDockPropertyPanel: React.FC<{
  selectedComponentIds: string[]
  dashboard: Dashboard | null
  onUpdateComponent: (id: string, updates: Partial<BaseComponent>) => void
  onUpdateDashboardSettings: (settings: Partial<Dashboard['settings']>) => void
}> = ({ selectedComponentIds, dashboard, onUpdateComponent, onUpdateDashboardSettings }) => {
  const [open, setOpen] = useState(true)
  const { saveDashboard, loading } = useDashboardContext()
  if (!open) {
    return (
      <div style={{ flexShrink: 0, width: 32, height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 12 }}>
        <Tooltip title="展开属性">
          <Button shape="circle" size="small" type="text" icon={<LeftOutlined />} onClick={() => setOpen(true)} />
        </Tooltip>
      </div>
    )
  }
  return (
    <div style={{ flexShrink: 0, width: 320, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card
        headStyle={{ padding: '6px 8px' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tooltip title="收起属性">
              <Button shape="circle" size="small" type="text" icon={<RightOutlined />} onClick={() => setOpen(false)} />
            </Tooltip>
            <span style={{ fontSize: 12 }}>{selectedComponentIds.length > 0 ? '组件属性' : '全局属性'}</span>
          </div>
        }
        className="dashboard-panel-card"
        bodyStyle={{ padding: 0, height: 'calc(100% - 40px)' }}
        style={{ height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            <PropertyPanel
              selectedComponents={selectedComponentIds.map(id =>
                dashboard?.components.find(c => c.id === id)
              ).filter(Boolean) as BaseComponent[]}
              dashboard={dashboard}
              onUpdateComponent={onUpdateComponent}
              onUpdateDashboardSettings={onUpdateDashboardSettings}
            />
          </div>
          {/* 去掉底部保存提示与按钮 */}
        </div>
      </Card>
    </div>
  )
}

export default DashboardEditor
