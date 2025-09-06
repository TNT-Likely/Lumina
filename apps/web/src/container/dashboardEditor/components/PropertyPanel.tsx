// DashboardEditor/components/PropertyPanel.tsx
import React, { useState, useRef } from 'react'
import { Tabs, Form, InputNumber, ColorPicker, Select, Switch, Divider, Input, Card, Space, Tooltip, Slider, Spin, Upload, Button } from 'antd'
import { PropertyRow } from './PropertyRow'
import { viewApi, UploadApi } from '@lumina/api'
import { QuestionCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { BaseComponent, TextConfig, ViewConfig, Dashboard } from '../types/dashboard'
import type { DashboardSettings } from '@lumina/types'

const { TabPane } = Tabs
const { Option } = Select

interface PropertyPanelProps {
  selectedComponents: BaseComponent[]
  dashboard: Dashboard | null
  onUpdateComponent: (id: string, updates: Partial<BaseComponent>) => void
  onUpdateDashboardSettings: (settings: Partial<Dashboard['settings']>) => void
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedComponents,
  dashboard,
  onUpdateComponent,
  onUpdateDashboardSettings
}) => {
  const [activeTab, setActiveTab] = React.useState('config')
  const [viewOptions, setViewOptions] = useState<Array<{ label: string, value: number }>>([])
  const [viewFetching, setViewFetching] = useState(false)
  const fetchRef = useRef(0)
  const selectedComponent = selectedComponents[0] // 目前只支持单选
  const selectedViewId: number | undefined = selectedComponent?.type === 'view'
    ? (selectedComponent.config as ViewConfig | undefined)?.viewId
    : undefined

  React.useEffect(() => {
    setActiveTab('config')
  }, [selectedComponent?.id])

  // 若当前选中的是视图组件，且存在 viewId，但下拉选项中未包含该项，则补充一次详情以显示名称
  React.useEffect(() => {
    const isView = selectedComponent?.type === 'view'
    const viewId = selectedViewId
    if (!isView || typeof viewId !== 'number') return
    if (viewOptions.some(o => o.value === viewId)) return
    let aborted = false
      ; (async () => {
      try {
        const detail = await viewApi.get(viewId)
        if (!aborted && detail && typeof detail.id === 'number') {
          setViewOptions(prev => [{ label: `${detail.name}（ID:${detail.id}）`, value: detail.id }, ...prev.filter(p => p.value !== detail.id)])
        }
      } catch { /* ignore */ }
    })()
    return () => { aborted = true }
  }, [selectedComponent?.id, selectedViewId, viewOptions])

  // 合并 helpers，避免在更新时使用 any
  const mergeCanvas = (patch: Partial<DashboardSettings['canvas']>): Partial<Dashboard['settings']> => ({
    canvas: {
      width: dashboard?.settings?.canvas?.width ?? 1920,
      height: dashboard?.settings?.canvas?.height ?? 1080,
      heightMode: dashboard?.settings?.canvas?.heightMode ?? 'auto',
      backgroundColor: dashboard?.settings?.canvas?.backgroundColor ?? '#ffffff',
      backgroundImage: dashboard?.settings?.canvas?.backgroundImage,
      backgroundRepeat: dashboard?.settings?.canvas?.backgroundRepeat ?? 'no-repeat',
      backgroundSize: dashboard?.settings?.canvas?.backgroundSize ?? 'auto',
      backgroundPosition: dashboard?.settings?.canvas?.backgroundPosition ?? 'center',
      ...patch
    }
  })
  const mergeGrid = (patch: Partial<DashboardSettings['grid']>): Partial<Dashboard['settings']> => ({
    grid: {
      cols: dashboard?.settings?.grid?.cols ?? 24,
      rows: dashboard?.settings?.grid?.rows ?? 100,
      rowHeight: dashboard?.settings?.grid?.rowHeight ?? 40,
      margin: dashboard?.settings?.grid?.margin ?? [0, 0],
      padding: dashboard?.settings?.grid?.padding ?? [0, 0],
      autoSize: dashboard?.settings?.grid?.autoSize ?? false,
      verticalCompact: dashboard?.settings?.grid?.verticalCompact ?? true,
      preventCollision: dashboard?.settings?.grid?.preventCollision ?? false,
      maxRows: dashboard?.settings?.grid?.maxRows,
      ...patch
    }
  })
  const mergeTheme = (patch: Partial<DashboardSettings['theme']>): Partial<Dashboard['settings']> => ({
    theme: {
      primary: dashboard?.settings?.theme?.primary ?? '#1677ff',
      secondary: dashboard?.settings?.theme?.secondary ?? '#13c2c2',
      success: dashboard?.settings?.theme?.success ?? '#52c41a',
      warning: dashboard?.settings?.theme?.warning ?? '#faad14',
      error: dashboard?.settings?.theme?.error ?? '#ff4d4f',
      text: dashboard?.settings?.theme?.text ?? '#333333',
      background: dashboard?.settings?.theme?.background ?? '#ffffff',
      surface: dashboard?.settings?.theme?.surface ?? '#ffffff',
      border: dashboard?.settings?.theme?.border ?? '#d9d9d9',
      ...patch
    }
  })
  const mergeInteraction = (patch: Partial<DashboardSettings['interaction']>): Partial<Dashboard['settings']> => ({
    interaction: {
      enableEdit: dashboard?.settings?.interaction?.enableEdit ?? true,
      enableFullscreen: dashboard?.settings?.interaction?.enableFullscreen ?? false,
      enableExport: dashboard?.settings?.interaction?.enableExport ?? true,
      enableShare: dashboard?.settings?.interaction?.enableShare ?? false,
      autoRefresh: dashboard?.settings?.interaction?.autoRefresh ?? false,
      refreshInterval: dashboard?.settings?.interaction?.refreshInterval ?? 0,
      ...patch
    }
  })

  // 常用大屏尺寸预设（移到组件顶层，保证Hook顺序）
  const screenPresets = React.useMemo(() => [
    { label: '1920×1080 (FHD 16:9)', value: '1920x1080', width: 1920, height: 1080, cols: 24, rowHeight: 40 },
    { label: '2560×1440 (QHD 16:9)', value: '2560x1440', width: 2560, height: 1440, cols: 24, rowHeight: 48 },
    { label: '3840×2160 (4K UHD)', value: '3840x2160', width: 3840, height: 2160, cols: 24, rowHeight: 80 },
    { label: '1600×900 (HD+ 16:9)', value: '1600x900', width: 1600, height: 900, cols: 24, rowHeight: 32 },
    { label: '1280×720 (HD 16:9)', value: '1280x720', width: 1280, height: 720, cols: 24, rowHeight: 24 },
    { label: '自定义', value: 'custom' }
  ], [])

  const [selectedPreset, setSelectedPreset] = React.useState<string>('custom')
  const hasCanvasBg = Boolean(dashboard?.settings?.canvas?.backgroundImage)
  const canvasBg: string = (dashboard?.settings?.canvas?.backgroundImage ?? '') as string

  React.useEffect(() => {
    // 自动根据当前设置匹配预设
    if (!dashboard?.settings?.canvas?.width || !dashboard?.settings?.canvas?.height) {
      setSelectedPreset('custom')
      return
    }
    const match = screenPresets.find(
      p => p.width === dashboard.settings.canvas.width && p.height === dashboard.settings.canvas.height
    )
    setSelectedPreset(match ? match.value : 'custom')
  }, [dashboard?.settings?.canvas?.width, dashboard?.settings?.canvas?.height, screenPresets])

  const handlePresetChange = (val: string) => {
    setSelectedPreset(val)
    const preset = screenPresets.find(p => p.value === val)
    if (preset && preset.value !== 'custom') {
      onUpdateDashboardSettings({
        ...mergeCanvas({ width: Number(preset.width ?? 1920), height: Number(preset.height ?? 1080) }),
        ...mergeGrid({ cols: Number(preset.cols ?? 24), rowHeight: Number(preset.rowHeight ?? 40) })
      })
    }
  }

  if (!selectedComponent) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Tabs
          defaultActiveKey="canvas"
          style={{ flex: 1 }}
          tabBarStyle={{ marginBottom: 0, padding: '0 12px' }}
        >
          <Tabs.TabPane tab="画布" key="canvas">
            <div style={{ padding: 12 }}>

              <PropertyRow label="常用大屏尺寸">
                <Select
                  size="small"
                  value={selectedPreset}
                  style={{ width: '100%' }}
                  onChange={handlePresetChange}
                >
                  {screenPresets.map(p => (
                    <Option key={p.value} value={p.value}>{p.label}</Option>
                  ))}
                </Select>
              </PropertyRow>
              <PropertyRow label="高度模式">
                <Select
                  size="small"
                  value={dashboard?.settings?.canvas?.heightMode || 'auto'}
                  style={{ width: 120 }}
                  onChange={val => { onUpdateDashboardSettings(mergeCanvas({ heightMode: val })) }}
                >
                  <Option value="auto">自适应</Option>
                  <Option value="fixed">固定</Option>
                </Select>
              </PropertyRow>
              <PropertyRow label="宽度(px)">
                <InputNumber
                  size="small"
                  min={320}
                  max={10000}
                  value={dashboard?.settings?.canvas?.width || 1920}
                  onChange={(v) => { onUpdateDashboardSettings(mergeCanvas({ width: Number(v ?? 1920) })) }}
                  style={{ width: 140 }}
                />
              </PropertyRow>
              <PropertyRow label="高度(px)">
                <InputNumber
                  size="small"
                  min={200}
                  max={10000}
                  disabled={(dashboard?.settings?.canvas?.heightMode || 'auto') !== 'fixed'}
                  value={dashboard?.settings?.canvas?.height || 1080}
                  onChange={(v) => { onUpdateDashboardSettings(mergeCanvas({ height: Number(v ?? 1080) })) }}
                  style={{ width: 140 }}
                />
              </PropertyRow>
              <PropertyRow label="背景颜色">
                <ColorPicker
                  value={dashboard?.settings?.canvas?.backgroundColor || '#f5f5f5'}
                  onChange={color => { onUpdateDashboardSettings(mergeCanvas({ backgroundColor: color.toHexString() })) }}
                />
              </PropertyRow>
              <PropertyRow label="背景图片">
                <Upload
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    try {
                      const res = await UploadApi.upload(file, { category: 'dashboard-bg' })
                      onUpdateDashboardSettings(mergeCanvas({ backgroundImage: res.url }))
                    } catch (e) {
                      // ignore
                    }
                    return false
                  }}
                >
                  <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 6, overflow: 'hidden', border: '1px solid #eee', background: '#fafafa', cursor: 'pointer' }}>
                    {hasCanvasBg && (
                      <img src={canvasBg} alt="bg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {!hasCanvasBg && (
                      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#bbb' }}>
                        <PlusOutlined />
                      </div>
                    )}
                    {hasCanvasBg && (
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdateDashboardSettings(mergeCanvas({ backgroundImage: '' })) }}
                        style={{ position: 'absolute', top: 0, right: 0, padding: 2, height: 20, lineHeight: '16px', color: '#ff4d4f' }}
                      />
                    )}
                  </div>
                </Upload>
              </PropertyRow>
              <PropertyRow label="背景重复">
                <Select
                  size="small"
                  value={dashboard?.settings?.canvas?.backgroundRepeat || 'no-repeat'}
                  onChange={v => { onUpdateDashboardSettings(mergeCanvas({ backgroundRepeat: v })) }}
                >
                  <Option value="no-repeat">不重复</Option>
                  <Option value="repeat">重复</Option>
                  <Option value="repeat-x">水平重复</Option>
                  <Option value="repeat-y">垂直重复</Option>
                </Select>
              </PropertyRow>
              <PropertyRow label="背景大小">
                <Select
                  size="small"
                  value={dashboard?.settings?.canvas?.backgroundSize || 'auto'}
                  onChange={v => { onUpdateDashboardSettings(mergeCanvas({ backgroundSize: v })) }}
                >
                  <Option value="auto">自动</Option>
                  <Option value="cover">覆盖</Option>
                  <Option value="contain">包含</Option>
                </Select>
              </PropertyRow>
              <PropertyRow label="背景位置">
                <Select
                  size="small"
                  value={dashboard?.settings?.canvas?.backgroundPosition || 'center'}
                  onChange={v => { onUpdateDashboardSettings(mergeCanvas({ backgroundPosition: v })) }}
                >
                  <Option value="left top">左上</Option>
                  <Option value="center top">中上</Option>
                  <Option value="right top">右上</Option>
                  <Option value="left center">左中</Option>
                  <Option value="center">居中</Option>
                  <Option value="right center">右中</Option>
                  <Option value="left bottom">左下</Option>
                  <Option value="center bottom">中下</Option>
                  <Option value="right bottom">右下</Option>
                </Select>
              </PropertyRow>
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab="布局" key="layout">
            <div style={{ padding: 12 }}>
              <PropertyRow label="列数">
                <InputNumber
                  size="small"
                  min={1}
                  max={24}
                  value={dashboard?.settings?.grid?.cols || 12}
                  style={{ width: 100 }}
                  onChange={v => { onUpdateDashboardSettings(mergeGrid({ cols: Number(v ?? 0) })) }}
                />
              </PropertyRow>
              <PropertyRow label="行高">
                <InputNumber
                  size="small"
                  min={10}
                  max={200}
                  value={dashboard?.settings?.grid?.rowHeight || 40}
                  style={{ width: 100 }}
                  onChange={v => { onUpdateDashboardSettings(mergeGrid({ rowHeight: Number(v ?? 0) })) }}
                />
              </PropertyRow>
              <PropertyRow label="格子间距">
                <div style={{ display: 'flex', gap: 12 }}>
                  <InputNumber
                    size="small"
                    min={0}
                    max={100}
                    value={dashboard?.settings?.grid?.margin?.[0] ?? 0}
                    style={{ width: 80 }}
                    onChange={v => {
                      const currentMargin = dashboard?.settings?.grid?.margin || [0, 0]
                      onUpdateDashboardSettings(mergeGrid({ margin: [Number(v ?? 0), currentMargin[1]] }))
                    }}
                  />
                  <InputNumber
                    size="small"
                    min={0}
                    max={100}
                    value={dashboard?.settings?.grid?.margin?.[1] ?? 0}
                    style={{ width: 80 }}
                    onChange={v => {
                      const currentMargin = dashboard?.settings?.grid?.margin || [0, 0]
                      onUpdateDashboardSettings(mergeGrid({ margin: [currentMargin[0], Number(v ?? 0)] }))
                    }}
                  />
                </div>
              </PropertyRow>
              <PropertyRow label="容器内边距">
                <div style={{ display: 'flex', gap: 12 }}>
                  <InputNumber
                    size="small"
                    min={0}
                    max={100}
                    value={dashboard?.settings?.grid?.padding?.[0] ?? 0}
                    style={{ width: 80 }}
                    onChange={v => {
                      const currentPadding = dashboard?.settings?.grid?.padding || [0, 0]
                      onUpdateDashboardSettings(mergeGrid({ padding: [Number(v ?? 0), currentPadding[1]] }))
                    }}
                  />
                  <InputNumber
                    size="small"
                    min={0}
                    max={100}
                    value={dashboard?.settings?.grid?.padding?.[1] ?? 0}
                    style={{ width: 80 }}
                    onChange={v => {
                      const currentPadding = dashboard?.settings?.grid?.padding || [0, 0]
                      onUpdateDashboardSettings(mergeGrid({ padding: [currentPadding[0], Number(v ?? 0)] }))
                    }}
                  />
                </div>
              </PropertyRow>
              <PropertyRow label="垂直压缩">
                <Switch
                  size="small"
                  checked={dashboard?.settings?.grid?.verticalCompact}
                  onChange={v => { onUpdateDashboardSettings(mergeGrid({ verticalCompact: v })) }}
                />
              </PropertyRow>
              <PropertyRow label="防止碰撞">
                <Switch
                  size="small"
                  checked={dashboard?.settings?.grid?.preventCollision}
                  onChange={v => { onUpdateDashboardSettings(mergeGrid({ preventCollision: v })) }}
                />
              </PropertyRow>
            </div>
          </Tabs.TabPane>
          {false && (
            <Tabs.TabPane tab="主题" key="theme">
              <div style={{ padding: 20 }}>
                <Form layout="vertical">
                  <Form.Item label="主色调">
                    <ColorPicker
                      value={dashboard?.settings?.theme?.primary || '#1890ff'}
                      onChange={color => { onUpdateDashboardSettings(mergeTheme({ primary: color.toHexString() })) }}
                    />
                  </Form.Item>
                  <Form.Item label="次要色">
                    <ColorPicker
                      value={dashboard?.settings?.theme?.secondary || '#13c2c2'}
                      onChange={color => { onUpdateDashboardSettings(mergeTheme({ secondary: color.toHexString() })) }}
                    />
                  </Form.Item>
                  <Form.Item label="成功色">
                    <ColorPicker
                      value={dashboard?.settings?.theme?.success || '#52c41a'}
                      onChange={color => { onUpdateDashboardSettings(mergeTheme({ success: color.toHexString() })) }}
                    />
                  </Form.Item>
                  <Form.Item label="警告色">
                    <ColorPicker
                      value={dashboard?.settings?.theme?.warning || '#faad14'}
                      onChange={color => { onUpdateDashboardSettings(mergeTheme({ warning: color.toHexString() })) }}
                    />
                  </Form.Item>
                  <Form.Item label="错误色">
                    <ColorPicker
                      value={dashboard?.settings?.theme?.error || '#ff4d4f'}
                      onChange={color => { onUpdateDashboardSettings(mergeTheme({ error: color.toHexString() })) }}
                    />
                  </Form.Item>
                  <Form.Item label="文本色">
                    <ColorPicker
                      value={dashboard?.settings?.theme?.text || '#333'}
                      onChange={color => { onUpdateDashboardSettings(mergeTheme({ text: color.toHexString() })) }}
                    />
                  </Form.Item>
                  <Form.Item label="背景色">
                    <ColorPicker
                      value={dashboard?.settings?.theme?.background || '#fff'}
                      onChange={color => { onUpdateDashboardSettings(mergeTheme({ background: color.toHexString() })) }}
                    />
                  </Form.Item>
                </Form>
              </div>
            </Tabs.TabPane>
          )}
          {false && (
            <Tabs.TabPane tab="交互" key="interaction">
              <div style={{ padding: 20 }}>
                <Form layout="vertical">
                  <Form.Item label="启用全屏">
                    <Switch
                      checked={dashboard?.settings?.interaction?.enableFullscreen}
                      onChange={v => { onUpdateDashboardSettings(mergeInteraction({ enableFullscreen: v })) }}
                    />
                  </Form.Item>
                  <Form.Item label="启用导出">
                    <Switch
                      checked={dashboard?.settings?.interaction?.enableExport}
                      onChange={v => { onUpdateDashboardSettings(mergeInteraction({ enableExport: v })) }}
                    />
                  </Form.Item>
                  <Form.Item label="启用分享">
                    <Switch
                      checked={dashboard?.settings?.interaction?.enableShare}
                      onChange={v => { onUpdateDashboardSettings(mergeInteraction({ enableShare: v })) }}
                    />
                  </Form.Item>
                  <Form.Item label="自动刷新">
                    <Switch
                      checked={dashboard?.settings?.interaction?.autoRefresh}
                      onChange={v => { onUpdateDashboardSettings(mergeInteraction({ autoRefresh: v })) }}
                    />
                  </Form.Item>
                  <Form.Item label="刷新间隔(秒)">
                    <InputNumber
                      min={0}
                      value={dashboard?.settings?.interaction?.refreshInterval || 0}
                      onChange={v => { onUpdateDashboardSettings(mergeInteraction({ refreshInterval: Number(v ?? 0) })) }}
                    />
                  </Form.Item>
                </Form>
              </div>
            </Tabs.TabPane>
          )}
        </Tabs>
      </div>
    )
  }

  // 更新组件属性
  const handleUpdate = (field: string, value: unknown) => {
    if (field.startsWith('config.')) {
      const configField = field.replace('config.', '')
      onUpdateComponent(selectedComponent.id, {
        config: {
          ...selectedComponent.config,
          [configField]: value as never
        }
      })
    } else if (field.startsWith('style.')) {
      const styleField = field.replace('style.', '')
      onUpdateComponent(selectedComponent.id, {
        style: {
          ...selectedComponent.style,
          [styleField]: value as never
        }
      })
    } else {
      onUpdateComponent(selectedComponent.id, {
        [field]: value as never
      })
    }
  }

  // 渲染文本组件属性
  const renderTextProperties = (config: TextConfig) => (
    <>
      <PropertyRow label="文本内容">
        <Input.TextArea
          value={config.content}
          onChange={(e) => { handleUpdate('config.content', e.target.value) }}
          rows={3}
        />
      </PropertyRow>
      <PropertyRow label="字体大小">
        <InputNumber
          size="small"
          value={config.fontSize}
          onChange={(value) => { handleUpdate('config.fontSize', value) }}
          min={8}
          max={72}
          addonAfter="px"
        />
      </PropertyRow>
      <PropertyRow label="字体颜色">
        <ColorPicker
          value={config.color}
          onChange={(color) => { handleUpdate('config.color', color.toHexString()) }}
        />
      </PropertyRow>
      <PropertyRow label="字体粗细">
        <Select
          size="small"
          value={config.fontWeight}
          onChange={(value) => { handleUpdate('config.fontWeight', value) }}
        >
          <Option value="normal">普通</Option>
          <Option value="bold">粗体</Option>
          <Option value="lighter">细体</Option>
        </Select>
      </PropertyRow>
      <PropertyRow label="对齐方式">
        <Select
          size="small"
          value={config.textAlign}
          onChange={(value) => { handleUpdate('config.textAlign', value) }}
        >
          <Option value="left">左对齐</Option>
          <Option value="center">居中</Option>
          <Option value="right">右对齐</Option>
          <Option value="justify">两端对齐</Option>
        </Select>
      </PropertyRow>
      <PropertyRow label="行高">
        <InputNumber
          size="small"
          value={config.lineHeight}
          onChange={(value) => { handleUpdate('config.lineHeight', value) }}
          min={1}
          max={3}
          step={0.1}
        />
      </PropertyRow>
    </>
  )

  // 视图下拉选项与搜索
  // 已移至组件顶层，避免重复声明

  const handleViewSearch = async (value: string) => {
    fetchRef.current += 1
    const fetchId = fetchRef.current
    setViewFetching(true)
    try {
      const res = await viewApi.list({ name: value, page: 1, pageSize: 20 })
      if (fetchId !== fetchRef.current) return
      setViewOptions(res.list.map((v: { id: number, name: string }) => ({ label: v.name + `（ID:${v.id}）`, value: v.id })))
    } finally {
      setViewFetching(false)
    }
  }

  // 渲染视图组件属性
  const renderViewProperties = (config: ViewConfig) => (
    <>
      <PropertyRow label="视图ID">
        <Select
          size="small"
          showSearch
          allowClear
          filterOption={false}
          placeholder="请输入名称或ID搜索视图"
          notFoundContent={viewFetching ? <Spin /> : null}
          onSearch={handleViewSearch}
          onFocus={async () => { await handleViewSearch('') }}
          value={typeof config.viewId === 'number' ? config.viewId : undefined}
          onChange={(value) => { handleUpdate('config.viewId', value) }}
          options={viewOptions}
          style={{ width: '100%' }}
        />
      </PropertyRow>
      {/* 去掉标题显示与位置配置 */}
      <PropertyRow label="显示边框">
        <Switch
          size="small"
          checked={config.showBorder}
          onChange={(checked) => { handleUpdate('config.showBorder', checked) }}
        />
      </PropertyRow>
      <PropertyRow label="自动刷新间隔">
        <InputNumber
          size="small"
          value={config.refreshInterval}
          onChange={(value) => { handleUpdate('config.refreshInterval', value) }}
          min={0}
          addonAfter="秒"
          placeholder="0表示不自动刷新"
        />
      </PropertyRow>
    </>
  )

  // 渲染通用样式属性（分组美化、滑块、色块、Tooltip等）
  const renderStyleProperties = () => (
    <>
      <PropertyRow label="背景色">
        <ColorPicker
          value={selectedComponent.style.backgroundColor || '#ffffff'}
          onChange={(color) => { handleUpdate('style.backgroundColor', color.toHexString()) }}
        />
      </PropertyRow>
      <PropertyRow label="边框色">
        <ColorPicker
          value={selectedComponent.style.borderColor || '#d9d9d9'}
          onChange={(color) => { handleUpdate('style.borderColor', color.toHexString()) }}
        />
      </PropertyRow>
      <PropertyRow label="边框宽度">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Slider
            min={0}
            max={10}
            value={selectedComponent.style.borderWidth ?? 1}
            onChange={(value) => { handleUpdate('style.borderWidth', value) }}
            style={{ flex: 1, marginRight: 0 }}
          />
          <span style={{ minWidth: 32, textAlign: 'right', color: '#555', flexShrink: 0 }}>{selectedComponent.style.borderWidth ?? 1}</span>
        </div>
      </PropertyRow>
      <PropertyRow label="圆角">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Slider
            min={0}
            max={50}
            value={selectedComponent.style.borderRadius ?? 4}
            onChange={(value) => { handleUpdate('style.borderRadius', value) }}
            style={{ flex: 1, marginRight: 0 }}
          />
          <span style={{ minWidth: 32, textAlign: 'right', color: '#555', flexShrink: 0 }}>{selectedComponent.style.borderRadius ?? 4}</span>
        </div>
      </PropertyRow>
      <PropertyRow label="内边距">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Slider
            min={0}
            max={50}
            value={typeof selectedComponent.style.padding === 'number' ? selectedComponent.style.padding : Number(selectedComponent.style.padding) || 8}
            onChange={(value) => { handleUpdate('style.padding', value) }}
            style={{ flex: 1, marginRight: 0 }}
          />
          <span style={{ minWidth: 32, textAlign: 'right', color: '#555', flexShrink: 0 }}>{selectedComponent.style.padding || 8}</span>
        </div>
      </PropertyRow>
      <PropertyRow label="透明度">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={selectedComponent.style.opacity ?? 1}
            onChange={(value) => { handleUpdate('style.opacity', value) }}
            style={{ flex: 1, marginRight: 0 }}
          />
          <span style={{ minWidth: 32, textAlign: 'right', color: '#555', flexShrink: 0 }}>{selectedComponent.style.opacity ?? 1}</span>
        </div>
      </PropertyRow>
    </>
  )

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 0 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ flex: 1 }}
        tabBarStyle={{ marginBottom: 0, padding: '0 20px' }}
      >
        <TabPane tab="配置" key="config">
          <div style={{ padding: 20 }}>
            <PropertyRow label="组件名称">
              <Input
                size="small"
                value={selectedComponent.name}
                onChange={(e) => { handleUpdate('name', e.target.value) }}
                style={{ borderRadius: 6 }}
              />
            </PropertyRow>
            {selectedComponent.type === 'text' && renderTextProperties(selectedComponent.config as TextConfig)}
            {selectedComponent.type === 'view' && renderViewProperties(selectedComponent.config as ViewConfig)}
          </div>
        </TabPane>
        <TabPane tab="样式" key="style">
          <div style={{ padding: 20 }}>
            {renderStyleProperties()}
          </div>
        </TabPane>
        <TabPane tab="布局" key="layout">
          <div style={{ padding: 20 }}>
            <PropertyRow label={<span>横坐标 <Tooltip title="以栅格为单位，非像素"><QuestionCircleOutlined style={{ color: '#999', marginLeft: 4 }} /></Tooltip></span>}>
              <InputNumber
                size="small"
                value={selectedComponent.layout.x}
                disabled
                min={0}
                max={11}
                style={{ width: 120, borderRadius: 6 }}
              />
            </PropertyRow>
            <PropertyRow label={<span>纵坐标 <Tooltip title="以栅格为单位，非像素"><QuestionCircleOutlined style={{ color: '#999', marginLeft: 4 }} /></Tooltip></span>}>
              <InputNumber
                size="small"
                value={selectedComponent.layout.y}
                disabled
                min={0}
                style={{ width: 120, borderRadius: 6 }}
              />
            </PropertyRow>
            <PropertyRow label={<span>宽 <Tooltip title="以栅格为单位，非像素"><QuestionCircleOutlined style={{ color: '#999', marginLeft: 4 }} /></Tooltip></span>}>
              <InputNumber
                size="small"
                value={selectedComponent.layout.w}
                onChange={(value) => { handleUpdate('layout', { ...selectedComponent.layout, w: value }) }}
                min={1}
                max={12}
                style={{ width: 120, borderRadius: 6 }}
              />
            </PropertyRow>
            <PropertyRow label={<span>高 <Tooltip title="以栅格为单位，非像素"><QuestionCircleOutlined style={{ color: '#999', marginLeft: 4 }} /></Tooltip></span>}>
              <InputNumber
                size="small"
                value={selectedComponent.layout.h}
                onChange={(value) => { handleUpdate('layout', { ...selectedComponent.layout, h: value }) }}
                min={1}
                style={{ width: 120, borderRadius: 6 }}
              />
            </PropertyRow>
          </div>
        </TabPane>
      </Tabs >
    </div >
  )
}
