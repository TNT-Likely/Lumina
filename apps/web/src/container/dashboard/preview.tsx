import { useSearchParams } from 'react-router-dom'
import { PreviewApi, dashboardApi, ShareApi } from '@lumina/api'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dashboard as ApiDashboard, DashboardConfig, GlobalFilterDefinition } from '@lumina/types'
import { ComponentRenderer } from '../dashboardEditor/components/ComponentRenderer'
import type { ViewComponentHandle } from '../dashboardEditor/components/components/ViewComponent'
import type { BaseComponent, Dashboard as EditorDashboard, DashboardSettings } from '../dashboardEditor/types/dashboard'
import GridLayout from 'react-grid-layout'
import { Button, Tag, Modal, Form, Select, Input, Space, Divider, Tooltip, DatePicker, Switch, InputNumber, Radio, Result } from 'antd'
import { LightFilter, ProFormText, ProFormDateRangePicker, ProFormSelect, ProFormDigit } from '@ant-design/pro-components'
import dayjs from 'dayjs'
import { FilterOutlined, ClearOutlined, ReloadOutlined, SlidersOutlined } from '@ant-design/icons'
import GroupFilterEditor, { flattenGroupToExternalFilters, type FilterGroupUI } from '../../components/GroupFilterEditor'
import { buildFilterableFields, type ComponentFieldInfo } from '../../utils/filterableFields'
// 预览页：顶部旧的 PreviewCanvas 已移除，统一使用 PreviewCanvasInner

import { useAppContext } from '../../context/AppContext'

const PreviewInner: React.FC<{ dashboardId?: string, token?: string | null, orgId?: string | null }> = ({ dashboardId, token, orgId }) => {
  const [dashboard, setDashboard] = useState<EditorDashboard | null>(null)
  const [publicToken, setPublicToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const hideGlobalFilters = searchParams.get('screenshot') === '1'
  const { userId } = useAppContext()
  useEffect(() => {
    if (!dashboardId) return
    // 若已登录且无 token，则优先使用内部接口；否则走公开接口
    const load = async () => {
      let d: (ApiDashboard & { needViewToken?: boolean }) | null = null
      setError(null)
      try {
        if (!token && userId) {
          d = await dashboardApi.get(String(dashboardId))
        }
      } catch (e) {
        // 内部接口失败则回退到公开接口
        d = null
      }
      if (!d) {
        try {
          d = await PreviewApi.getDashboardPublic(dashboardId, { orgId: orgId || undefined, token: token || undefined })
        } catch (ee) {
          const msg = (ee as Error)?.message || ''
          if (/403/.test(msg) || /forbidden/i.test(msg)) setError('没有权限查看该仪表盘')
          else if (/404/.test(msg) || /not found|不存在/i.test(msg)) setError('仪表盘不存在或已删除')
          else setError('加载仪表盘失败')
          d = null
        }
      }
      if (!d) return
      // 若当前URL没有token，且内部接口提示需要视图token，则尝试生成一个dashboard级别的预览token
      // 注意：带token的分享/订阅URL不受影响（此时 token 已有，不生成新的）
      if (!token && d?.needViewToken) {
        try {
          const signed = await ShareApi.signDashboard(Number(dashboardId), { expiresIn: '2h', orgScope: true })
          setPublicToken(signed.token)
        } catch {
          setPublicToken(null)
        }
      } else {
        setPublicToken(token || null)
      }

      const cfg = (d.config || {}) as DashboardConfig
      const settings: DashboardSettings = (cfg.settings as unknown as DashboardSettings) || {
        grid: { cols: 12, rows: 0, rowHeight: 40, margin: [8, 8], padding: [16, 16], autoSize: true, verticalCompact: true, preventCollision: false },
        canvas: { width: 1200, height: 800, backgroundColor: '#f5f5f5', backgroundRepeat: 'no-repeat', backgroundSize: 'cover', backgroundPosition: 'center' },
        theme: { primary: '#1890ff', secondary: '#722ed1', success: '#52c41a', warning: '#faad14', error: '#f5222d', text: '#333333', background: '#ffffff', surface: '#fafafa', border: '#d9d9d9' },
        interaction: { enableEdit: false, enableFullscreen: true, enableExport: false, enableShare: false, autoRefresh: false, refreshInterval: 300 }
      }
      const ed: EditorDashboard = {
        id: d.id,
        name: d.name,
        description: (d as Partial<ApiDashboard>).description || '',
        components: ((cfg.components || []) as unknown) as EditorDashboard['components'],
        // 透传全局筛选器定义
        globalFilters: (cfg as { globalFilters?: GlobalFilterDefinition[] }).globalFilters || [],
        createdAt: (d as Partial<ApiDashboard>).createdAt || new Date().toISOString(),
        updatedAt: (d as Partial<ApiDashboard>).updatedAt || new Date().toISOString(),
        createdBy: 'preview',
        updatedBy: 'preview',
        settings
      }
      setDashboard(ed)
    }
    load().catch((e) => { console.error('加载仪表板失败', e) })
  }, [dashboardId, token, orgId, userId])

  if (error) {
    const is403 = /403/.test(error) || /无权限|没有权限|forbidden/i.test(error)
    const is404 = /404/.test(error) || /not found|不存在|已删除/i.test(error)
    return (
      <div style={{ width: '100vw', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7fb', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <Result
            status={is404 ? '404' : (is403 ? '403' : 'error')}
            title={is404 ? '仪表盘不存在' : (is403 ? '没有访问权限' : '加载失败')}
            subTitle={is404 ? '该仪表盘可能已删除或不可见。' : (is403 ? '请联系所有者为你授权，或使用有效的预览 Token 访问。' : (error || '加载仪表盘失败，请稍后重试。'))}
            extra={
              <Button type="primary" onClick={() => window.location.reload()}>刷新重试</Button>
            }
          />
        </div>
      </div>
    )
  }
  if (!dashboard) return null
  // 通过 context-like prop 将隐藏参数传入，避免在 PreviewCanvas 内重复读取 URL
  return (
    <div>
      <PreviewCanvasWithOptions dashboard={dashboard} hideGlobalFilters={hideGlobalFilters} publicToken={publicToken} />
    </div>
  )
}

// 包装：给 PreviewCanvas 额外的可选项（是否隐藏全局筛选栏）
const PreviewCanvasWithOptions: React.FC<{ dashboard: EditorDashboard, hideGlobalFilters?: boolean, publicToken?: string | null }> = ({ dashboard, hideGlobalFilters, publicToken }) => {
  // 复用原 PreviewCanvas 内容，但在渲染 GF 处加开关
  return <PreviewCanvasInner dashboard={dashboard} hideGlobalFilters={!!hideGlobalFilters} publicToken={publicToken || null} />
}

// 将原 PreviewCanvas 主体提取为可接收开关的内部组件
const PreviewCanvasInner: React.FC<{ dashboard: EditorDashboard, hideGlobalFilters: boolean, publicToken: string | null }> = ({ dashboard, hideGlobalFilters, publicToken }) => {
  // 以下为原 PreviewCanvas 内容（轻改：GF 区域增加 hideGlobalFilters 判断）
  // 全局筛选定义与值
  const gfDefs = (dashboard.globalFilters || []) as GlobalFilterDefinition[]
  const [gfValues, setGfValues] = useState<Record<string, string[]>>({})
  // 草稿值：输入不立刻生效，点击“应用”后同步到 gfValues
  const [gfDraftValues, setGfDraftValues] = useState<Record<string, string[]>>({})
  const [gfOptions, setGfOptions] = useState<Record<string, Array<{ label: string, value: string }>>>({})
  const [gfLoading, setGfLoading] = useState<Record<string, boolean>>({})
  const [refreshTick, setRefreshTick] = React.useState(0)
  const compRefs = React.useRef<Record<string, React.RefObject<ViewComponentHandle>>>({})
  const [componentFilters, setComponentFilters] = React.useState<Record<string, Record<string, unknown>>>({})
  const [lastClick, setLastClick] = React.useState<{ componentId: string, dimensionValues: Record<string, string | number> } | null>(null)
  const [filterModal, setFilterModal] = React.useState<{ open: boolean, componentId?: string }>({ open: false })
  const [componentFields, setComponentFields] = React.useState<Record<string, { dimensions: Array<{ identifier: string, name: string }>, metrics: Array<{ identifier: string, name: string }>, filters?: Array<{ field: { identifier: string, name: string }, operator: string, values: Array<string | number | boolean | null> }> }>>({})
  const [form] = Form.useForm()
  const [groupEditor, setGroupEditor] = React.useState<{ enabled: boolean, group: FilterGroupUI }>({ enabled: false, group: { op: 'AND', children: [] } })

  const filterableFields = useMemo(() => {
    const compId = filterModal.componentId || ''
    const info = compId ? componentFields[compId] : undefined
    const adapted: ComponentFieldInfo | undefined = info
      ? {
        dimensions: info.dimensions,
        metrics: info.metrics,
        filters: info.filters?.map(f => ({ field: f.field }))
      }
      : undefined
    return buildFilterableFields(adapted)
  }, [filterModal.componentId, componentFields])

  const fieldOptions = useMemo(
    () => filterableFields.map(f => ({ label: f.name || f.identifier, value: f.identifier })),
    [filterableFields]
  )

  const nameOfField = useCallback(
    (fieldId: string) => (filterableFields.find(f => f.identifier === fieldId)?.name || fieldId),
    [filterableFields]
  )

  React.useEffect(() => {
    const onResize = () => {
      const map = compRefs.current
      Object.keys(map).forEach(id => map[id]?.current?.resize?.())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  React.useEffect(() => {
    const map: Record<string, React.RefObject<ViewComponentHandle>> = {}
    for (const c of dashboard.components) {
      map[c.id] = React.createRef<ViewComponentHandle>()
    }
    compRefs.current = map
  }, [dashboard.components])
  useEffect(() => { /* no-op for bindings-only */ }, [])
  // 同步草稿值
  useEffect(() => {
    const next: Record<string, string[]> = {}
    for (const def of gfDefs) {
      next[def.id] = Array.isArray(gfValues[def.id]) ? [...gfValues[def.id]] : []
    }
    setGfDraftValues(next)
  }, [gfDefs, gfValues])

  const clearGf = (id?: string) => {
    if (id) setGfValues(prev => ({ ...prev, [id]: [] }))
    else setGfValues({})
  }

  const loadGfOptions = React.useCallback(async (def: GlobalFilterDefinition) => {
    setGfLoading(prev => ({ ...prev, [def.id]: true }))
    setGfOptions(prev => ({ ...prev, [def.id]: [] }))
    setGfLoading(prev => ({ ...prev, [def.id]: false }))
  }, [])

  useEffect(() => {
    gfDefs.forEach(def => { loadGfOptions(def) })
  }, [gfDefs, loadGfOptions, JSON.stringify(Object.fromEntries(gfDefs.map(d => [d.id, gfValues[d.id] || []])))])

  const layout = useMemo(() => (
    dashboard?.components?.map(c => ({
      i: c.id,
      x: c.layout.x,
      y: c.layout.y,
      w: c.layout.w,
      h: c.layout.h,
      static: true,
      isDraggable: false,
      isResizable: false
    })) || []
  ), [dashboard?.components])

  const prevExtFiltersRef = React.useRef<Record<string, Record<string, unknown> | undefined>>({})
  const extFiltersByComp = useMemo(() => {
    const nextMap: Record<string, Record<string, unknown> | undefined> = {}
    const compIds = dashboard.components.map(c => c.id)
    const equalShallow = (a?: Record<string, unknown>, b?: Record<string, unknown>) => {
      if (a === b) return true
      if (!a && !b) return true
      if (!a || !b) return false
      const ak = Object.keys(a)
      const bk = Object.keys(b)
      if (ak.length !== bk.length) return false
      for (const k of ak) {
        if (!bk.includes(k)) return false
        const va = a[k]
        const vb = b[k]
        if (Array.isArray(va) && Array.isArray(vb)) {
          if (va.length !== vb.length) return false
          for (let i = 0; i < va.length; i++) { if (String(va[i]) !== String(vb[i])) return false }
          continue
        }
        if (va && typeof va === 'object' && vb && typeof vb === 'object') {
          const oa = va as { operator?: unknown, values?: unknown }
          const ob = vb as { operator?: unknown, values?: unknown }
          if (String(oa.operator ?? 'equals') !== String(ob.operator ?? 'equals')) return false
          const vaArr = Array.isArray(oa.values) ? oa.values as unknown[] : (oa.values !== undefined ? [oa.values as unknown] : [])
          const vbArr = Array.isArray(ob.values) ? ob.values as unknown[] : (ob.values !== undefined ? [ob.values as unknown] : [])
          if (vaArr.length !== vbArr.length) return false
          for (let i = 0; i < vaArr.length; i++) { if (String(vaArr[i]) !== String(vbArr[i])) return false }
          continue
        }
        if (String(va) !== String(vb)) return false
      }
      return true
    }

    for (const compId of compIds) {
      const out: Record<string, unknown> = { ...(componentFilters[compId] || {}) }
      for (const def of gfDefs) {
        const sel = gfValues[def.id] || []
        if (sel.length === 0) continue
        if (def.bindings && def.bindings.length > 0) {
          def.bindings
            .filter(b => b.componentId === compId && b.field && typeof b.field.identifier === 'string')
            .forEach(b => {
              const fieldId = String(b.field.identifier)
              const baseOp = b.operator || def.operator || (def.mode === 'multi' ? 'in' : 'equals')
              const isTimeRange = (def.valueType === 'date' || def.valueType === 'datetime') && sel.length === 2
              const op = isTimeRange ? 'between' : baseOp
              if (def.mode === 'multi' || op === 'in') out[fieldId] = sel
              else out[fieldId] = { operator: op, values: sel }
            })
        }
      }
      const candidate = Object.keys(out).length > 0 ? out : undefined
      const prev = prevExtFiltersRef.current[compId]
      if (equalShallow(candidate as Record<string, unknown> | undefined, prev as Record<string, unknown> | undefined)) {
        nextMap[compId] = prev
      } else {
        nextMap[compId] = candidate
      }
    }
    prevExtFiltersRef.current = nextMap
    return nextMap
  }, [dashboard.components, componentFilters, gfDefs, gfValues])

  const externalFiltersForComponent = useCallback((compId: string) => extFiltersByComp[compId], [extFiltersByComp])

  // 容器宽度自适应：用 ref 观察容器宽度，驱动 GridLayout width
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = React.useState<number>(1280)
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      setContainerWidth(Math.max(320, w))
    })
    ro.observe(el)
    setContainerWidth(Math.max(320, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const gridProps = {
    className: 'layout',
    layout,
    cols: dashboard?.settings?.grid?.cols || 24,
    rowHeight: dashboard?.settings?.grid?.rowHeight || 40,
    width: containerWidth,
    margin: dashboard?.settings?.grid?.margin || [0, 0],
    containerPadding: dashboard?.settings?.grid?.padding || [0, 0],
    autoSize: true,
    isDraggable: false,
    isResizable: false
  } as const

  return (
    <div style={{ width: '100vw', background: '#f6f7fb' }}>
      <div ref={containerRef} style={{ width: '100%', maxWidth: 1400, minHeight: '100vh', overflow: 'auto', margin: '0 auto', padding: '8px 0 24px 0' }}>
        {/* 全局筛选器控件（非实时，点击“应用筛选”才生效） */}
        {!hideGlobalFilters && (
          <div style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            {gfDefs.length > 0 && (
              <><LightFilter
                onFinish={async () => { setGfValues({ ...gfDraftValues }) }}
                submitter={{
                  render: () => [
                    <Button key="clear" icon={<ClearOutlined />} onClick={() => { setGfDraftValues({}); setGfValues({}) }}>清空</Button>,
                    <Button key="apply" type="primary" icon={<FilterOutlined />} onClick={() => setGfValues({ ...gfDraftValues })}>应用</Button>,
                    <Button key="refresh" icon={<ReloadOutlined />} onClick={() => { Object.keys(compRefs.current).forEach(cid => compRefs.current[cid]?.current?.reload?.()) }}>刷新</Button>
                  ]
                }}
              >
                {gfDefs.map(def => {
                  const vt = def.valueType || 'string'
                  if (def.mode === 'multi') {
                    return (
                      <ProFormSelect
                        key={def.id}
                        name={def.id}
                        label={def.label}
                        fieldProps={{
                          mode: 'tags',
                          tokenSeparators: [','],
                          options: gfOptions[def.id] || [],
                          loading: !!gfLoading[def.id],
                          onDropdownVisibleChange: (open) => { if (open) loadGfOptions(def) },
                          onChange: (vals) => {
                            const arr = Array.isArray(vals) ? (vals as (string | number | boolean)[]).map(v => String(v)) : []
                            setGfDraftValues(prev => ({ ...prev, [def.id]: arr }))
                          },
                          value: gfDraftValues[def.id]
                        }}
                      />
                    )
                  }
                  switch (vt) {
                  case 'number':
                    return (
                      <ProFormDigit
                        key={def.id}
                        name={def.id}
                        label={def.label}
                        fieldProps={{
                          value: gfDraftValues[def.id]?.[0] ? Number(gfDraftValues[def.id][0]) : undefined,
                          onChange: (v) => {
                            const s = v === null || v === undefined ? '' : String(v)
                            setGfDraftValues(prev => ({ ...prev, [def.id]: s ? [s] : [] }))
                          }
                        }}
                      />
                    )
                  case 'date':
                    return (
                      <ProFormDateRangePicker
                        key={def.id}
                        name={def.id}
                        label={def.label}
                        fieldProps={{
                          value: Array.isArray(gfDraftValues[def.id]) && gfDraftValues[def.id].length === 2 ? [dayjs(gfDraftValues[def.id][0]), dayjs(gfDraftValues[def.id][1])] : undefined,
                          onChange: (d) => {
                            const s = Array.isArray(d) && d[0] && d[1] ? [d[0].format('YYYY-MM-DD'), d[1].format('YYYY-MM-DD')] : []
                            setGfDraftValues(prev => ({ ...prev, [def.id]: s as string[] }))
                          }
                        }}
                      />
                    )
                  case 'datetime':
                    return (
                      <ProFormDateRangePicker
                        key={def.id}
                        name={def.id}
                        label={def.label}
                        fieldProps={{
                          showTime: true,
                          value: Array.isArray(gfDraftValues[def.id]) && gfDraftValues[def.id].length === 2 ? [dayjs(gfDraftValues[def.id][0]), dayjs(gfDraftValues[def.id][1])] : undefined,
                          onChange: (d) => {
                            const s = Array.isArray(d) && d[0] && d[1] ? [d[0].format('YYYY-MM-DD HH:mm:ss'), d[1].format('YYYY-MM-DD HH:mm:ss')] : []
                            setGfDraftValues(prev => ({ ...prev, [def.id]: s as string[] }))
                          }
                        }}
                      />
                    )
                  case 'boolean':
                    return (
                      <ProFormSelect
                        key={def.id}
                        name={def.id}
                        label={def.label}
                        fieldProps={{
                          options: [
                            { label: '是', value: 'true' },
                            { label: '否', value: 'false' }
                          ],
                          value: gfDraftValues[def.id]?.[0],
                          onChange: (v) => setGfDraftValues(prev => ({ ...prev, [def.id]: v ? [String(v)] : [] }))
                        }}
                      />
                    )
                  case 'geo':
                  case 'string':
                  default:
                    return (
                      <ProFormText
                        key={def.id}
                        name={def.id}
                        label={def.label}
                        fieldProps={{
                          value: gfDraftValues[def.id]?.[0] || '',
                          onChange: (e) => {
                            const v = e.target.value
                            setGfDraftValues(prev => ({ ...prev, [def.id]: v ? [v] : [] }))
                          }
                        }}
                      />
                    )
                  }
                })}
              </LightFilter>
              <Button icon={<ReloadOutlined />} onClick={() => { Object.keys(compRefs.current).forEach(cid => compRefs.current[cid]?.current?.reload?.()) }}>刷新</Button>
              </>
            )}
          </div>
        )}
        {hideGlobalFilters && (
          <div style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Button icon={<ReloadOutlined />} onClick={() => { Object.keys(compRefs.current).forEach(cid => compRefs.current[cid]?.current?.reload?.()) }}>
              刷新
            </Button>
          </div>
        )}
        <div
          style={{
            background: dashboard.settings.canvas.backgroundColor || '#fff',
            backgroundImage: dashboard.settings.canvas.backgroundImage ? `url(${dashboard.settings.canvas.backgroundImage})` : 'none',
            backgroundRepeat: dashboard.settings.canvas.backgroundRepeat || 'no-repeat',
            backgroundSize: dashboard.settings.canvas.backgroundSize || 'cover',
            backgroundPosition: dashboard.settings.canvas.backgroundPosition || 'center',
            boxShadow: '0 2px 8px rgba(15,23,42,0.04)'
          }}
        >
          <GridLayout {...gridProps}>
            {dashboard.components.map((component: BaseComponent) => {
              const compId = component.id
              const extFilters = externalFiltersForComponent(compId)
              return (
                <div
                  key={component.id}
                  data-component-id={component.id}
                  style={{ background: component.style.backgroundColor || '#fff', borderRadius: component.style.borderRadius || 6, overflow: 'hidden', position: 'relative', height: '100%' }}
                  onMouseEnter={(e) => { const el = (e.currentTarget as HTMLDivElement).querySelector('.preview-toolbar') as HTMLDivElement | null; if (el) el.style.opacity = '1' }}
                  onMouseLeave={(e) => { const el = (e.currentTarget as HTMLDivElement).querySelector('.preview-toolbar') as HTMLDivElement | null; if (el) el.style.opacity = '0' }}
                >
                  {/* hover toolbar */}
                  <div className="preview-toolbar" style={{ position: 'absolute', top: 8, right: 8, zIndex: 5, opacity: 0, transition: 'opacity .15s', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* 全局筛选影响提示 */}
                    {(() => {
                      // 计算该组件当前受哪些全局筛选器影响（有绑定且有值）
                      const labels = gfDefs
                        .filter(def => (def.bindings || []).some(b => b.componentId === compId) && (gfValues[def.id]?.length || 0) > 0)
                        .map(def => def.label || def.id)
                      if (labels.length > 0) {
                        return (
                          <Tooltip title={`受全局筛选：${labels.join('、')}`}>
                            <Button
                              size="small"
                              type="text"
                              icon={<FilterOutlined style={{ color: '#000' }} />}
                              disabled
                              style={{ background: '#fff', borderRadius: 4 }}
                            />
                          </Tooltip>
                        )
                      }
                      return null
                    })()}
                    {/* 若有待应用的点击点，展示“筛选此点” */}
                    {lastClick && lastClick.componentId === compId && (
                      <Tooltip title="筛选此点">
                        <Button
                          size="small"
                          type="primary"
                          icon={<FilterOutlined />}
                          onClick={() => {
                            const dv = lastClick.dimensionValues || {}
                            setComponentFilters(prev => ({ ...prev, [compId]: { ...(prev[compId] || {}), ...dv } }))
                            setLastClick(null)
                          }}
                        />
                      </Tooltip>
                    )}
                    {/* 仅当该组件有外部筛选时，显示清除 */}
                    {extFilters && Object.keys(extFilters).length > 0 && (
                      <Tooltip title="清除筛选">
                        <Button
                          size="small"
                          type="text"
                          icon={<ClearOutlined />}
                          onClick={() => {
                            setComponentFilters(prev => ({ ...prev, [compId]: {} }))
                          }}
                        />
                      </Tooltip>
                    )}
                    <Space size={6}>
                      <Tooltip title="刷新">
                        <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => compRefs.current[compId]?.current?.reload?.()} />
                      </Tooltip>
                      <Tooltip title="高级筛选">
                        <Button size="small" type="text" icon={<SlidersOutlined />} onClick={() => {
                          const ef = componentFilters[compId] || {}
                          const entries = Object.entries(ef)
                          const initial = entries.length
                            ? entries.map(([k, v]) => {
                              if (Array.isArray(v)) return { field: k, operator: 'in', value: v.join(',') }
                              if (v && typeof v === 'object') {
                                const ov = v as { operator?: string, values?: unknown }
                                const vs = Array.isArray(ov.values) ? (ov.values as unknown[]).join(',') : String(ov.values ?? '')
                                return { field: k, operator: ov.operator || 'equals', value: vs }
                              }
                              return { field: k, operator: 'equals', value: String(v) }
                            })
                            : [{ field: undefined, operator: 'equals', value: '' }]
                          form.setFieldsValue({ conditions: initial })
                          setGroupEditor({ enabled: false, group: { op: 'AND', children: [] } })
                          setFilterModal({ open: true, componentId: compId })
                          setLastClick(null)
                        }} />
                      </Tooltip>
                    </Space>
                  </div>
                  <div style={{ height: '100%' }}>
                    <ComponentRenderer
                      component={component}
                      mode="preview"
                      selected={false}
                      onUpdate={() => undefined}
                      componentRef={compRefs.current[compId]}
                      externalFilters={extFilters}
                      publicToken={publicToken}
                      onPointClick={({ componentId, dimensionValues }) => {
                        setLastClick({ componentId, dimensionValues })
                      }}
                      onConfigReady={({ componentId, dimensions, metrics, filters }) => {
                        setComponentFields(prev => ({ ...prev, [componentId]: { dimensions, metrics, filters } }))
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </GridLayout>
        </div>
      </div>

      {/* 高级筛选 Modal */}
      <Modal
        title="高级筛选 (beta)"
        open={filterModal.open}
        width={880}
        onCancel={() => { setFilterModal({ open: false }) }}
        footer={null}
        destroyOnClose
      >
        {filterModal.componentId && (
          <>
            <div style={{ marginBottom: 8 }}>
              <Space>
                <span style={{ color: '#666' }}>模式：</span>
                <Radio.Group
                  value={groupEditor.enabled ? 'group' : 'simple'}
                  onChange={(e) => setGroupEditor(prev => ({ ...prev, enabled: e.target.value === 'group' }))}
                >
                  <Radio.Button value="simple">简易</Radio.Button>
                  <Radio.Button value="group">分组(beta)</Radio.Button>
                </Radio.Group>
              </Space>
            </div>

            {!groupEditor.enabled && (
              <Form form={form} layout="vertical" onFinish={(vals) => {
                const compId = filterModal.componentId || ''
                if (!compId) return
                const conds = (vals.conditions || []) as Array<{ field: string, operator: string, value: string }>
                const out: Record<string, unknown> = {}
                for (const c of conds) {
                  if (!c?.field) continue
                  const v = c?.value
                  if (v === undefined || v === '') continue
                  const op = c?.operator || 'equals'
                  if (op === 'in') {
                    out[c.field] = String(v).split(',').map(s => s.trim()).filter(Boolean)
                  } else if (op === 'between') {
                    const [a, b] = String(v).split('..')
                    out[c.field] = { operator: 'between', values: [a, b].filter(Boolean) }
                  } else {
                    out[c.field] = { operator: op, values: [v] }
                  }
                }
                setComponentFilters(prev => ({ ...prev, [compId]: out }))
                setFilterModal({ open: false })
              }}>
                <Form.List name="conditions" initialValue={[{ field: undefined, operator: 'equals', value: '' }]}>
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name }) => {
                        const options = fieldOptions
                        return (
                          <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            <Form.Item name={[name, 'field']} label="字段" style={{ flex: 1 }} rules={[{ required: true, message: '请选择字段' }]}>
                              <Select options={options} placeholder="选择字段" showSearch optionFilterProp="label" />
                            </Form.Item>
                            <Form.Item name={[name, 'operator']} label="操作符" style={{ width: 120 }}>
                              <Select
                                options={[
                                  { label: '等于', value: 'equals' },
                                  { label: '不等于', value: 'not_equals' },
                                  { label: '包含', value: 'contains' },
                                  { label: '大于', value: 'greater_than' },
                                  { label: '小于', value: 'less_than' },
                                  { label: '区间', value: 'between' },
                                  { label: '多选', value: 'in' }
                                ]}
                              />
                            </Form.Item>
                            <Form.Item name={[name, 'value']} label="值" style={{ flex: 1 }}>
                              <Input placeholder="值；多选用逗号分隔；区间用a..b" />
                            </Form.Item>
                            <Button type="link" onClick={() => remove(name)} danger>删除</Button>
                          </div>
                        )
                      })}
                      <Divider style={{ margin: '8px 0' }} />
                      <Space>
                        <Button onClick={() => add({ field: undefined, operator: 'equals', value: '' })}>添加条件</Button>
                        <Button type="primary" htmlType="submit">应用</Button>
                      </Space>
                    </>
                  )}
                </Form.List>
              </Form>
            )}

            {groupEditor.enabled && (
              <div>
                <GroupFilterEditor
                  group={groupEditor.group}
                  onChange={(g) => setGroupEditor(prev => ({ ...prev, group: g }))}
                  fieldOptions={fieldOptions}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                  <div style={{ color: '#999' }}>提示：当前查询引擎暂不支持通用 OR 嵌套，我们会在可能的情况下将 OR 折叠为 IN；其余情况按 AND 展开处理。</div>
                  <Space>
                    <Button onClick={() => setGroupEditor(prev => ({ enabled: false, group: prev.group }))}>返回简易</Button>
                    <Button type="primary" onClick={() => {
                      const compId = filterModal.componentId || ''
                      if (!compId) return
                      const out = flattenGroupToExternalFilters(groupEditor.group)
                      setComponentFilters(prev => ({ ...prev, [compId]: out }))
                      setFilterModal({ open: false })
                    }}>应用</Button>
                  </Space>
                </div>
              </div>
            )}

            <Divider />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(() => {
                const compId = filterModal.componentId || ''
                if (!compId) return null
                const ef = componentFilters[compId] || {}
                const entries = Object.entries(ef)
                if (!entries.length) return null
                const nameOf = nameOfField
                return entries.map(([k, v]) => {
                  let text = ''
                  if (Array.isArray(v)) text = `${nameOf(k)} in (${v.join(', ')})`
                  else if (v && typeof v === 'object') {
                    const ov = v as { operator?: string, values?: unknown }
                    const vs = Array.isArray(ov.values) ? ov.values.join(', ') : String(ov.values)
                    text = `${nameOf(k)} ${ov.operator || 'equals'} ${vs}`
                  } else text = `${nameOf(k)} = ${String(v)}`
                  return (
                    <Tag key={k} closable onClose={(e) => { e.preventDefault(); const compId2 = filterModal.componentId || ''; if (!compId2) return; setComponentFilters(prev => { const n = { ...(prev[compId2] || {}) }; delete n[k]; return { ...prev, [compId2]: n } }) }}>{text}</Tag>
                  )
                })
              })()}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

const DashboardPreview = () => {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id') || undefined
  const token = searchParams.get('token')
  const orgId = searchParams.get('orgId')
  return <PreviewInner dashboardId={id} token={token} orgId={orgId} />
}

export default DashboardPreview
