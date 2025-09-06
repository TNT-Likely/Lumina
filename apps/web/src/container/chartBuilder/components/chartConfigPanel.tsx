// src/components/ChartBuilder/components/ChartConfigPanel.tsx
import React, { useMemo, useState } from 'react'
import { Button, Card, Input, Modal, Segmented, Select, Space, Tooltip, Typography, message } from 'antd'
import { SaveOutlined, ReloadOutlined, EditOutlined, CheckOutlined, CloseOutlined, MenuOutlined, FilterOutlined, TagOutlined, SortAscendingOutlined } from '@ant-design/icons'
import DropZone from './dropZone'
import FilterDropZone from './filterDropZone'
import { type ChartConfig, type FilterConfig } from '../types'
import type { DatasetField } from '@lumina/types'
import { GroupFilterEditor, flattenGroupToExternalFilters, type FilterGroupUI } from '../../../components/GroupFilterEditor'

const { Text } = Typography

interface ViewInfo {
  id?: number
  name: string
  description: string
  isEditing: boolean
  isEditingName: boolean
  isEditingDescription: boolean
}

interface ChartConfigPanelProps {
  chartConfig: ChartConfig
  selectedDataset: number | null
  showPreview: boolean
  queryLoading?: boolean
  viewInfo?: ViewInfo
  fields: DatasetField[]
  onFieldDrop: (type: 'dimensions' | 'metrics' | 'filters') => (field: DatasetField) => void
  onFieldRemove: (type: 'dimensions' | 'metrics' | 'filters') => (index: number) => void
  onAggregationUpdate: (index: number, aggregation: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct') => void
  onFilterUpdate: (index: number, config: Partial<FilterConfig>) => void
  onReplaceAllFilters: (next: FilterConfig[]) => void
  onSaveChart: (viewName?: string, viewDescription?: string) => void
  onResetConfig?: () => void
  onViewInfoUpdate?: (updates: Partial<ViewInfo>) => void
  onOrderByChange?: (next: ChartConfig['orderBy']) => void
  onAliasChange?: (draft: { dimensions: Array<{ identifier: string, alias?: string }>, metrics: Array<{ identifier: string, aggregationType: ChartConfig['metrics'][0]['aggregationType'], alias?: string }> }) => void
  onTitleChange?: (title: string) => void
  onPreviewQuery?: () => void
  onRunQuery?: () => void
}

const ChartConfigPanel: React.FC<ChartConfigPanelProps> = (props) => {
  const {
    chartConfig,
    selectedDataset,
    showPreview,
    queryLoading = false,
    viewInfo,
    fields,
    onFieldDrop,
    onFieldRemove,
    onAggregationUpdate,
    onFilterUpdate,
    onReplaceAllFilters,
    onSaveChart,
    onResetConfig,
    onViewInfoUpdate,
    onOrderByChange,
    onAliasChange
  } = props

  // 保存视图（新增）
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false)
  const [viewName, setViewName] = useState('')
  const [viewDescription, setViewDescription] = useState('')

  // 高级筛选
  const [advOpen, setAdvOpen] = useState(false)
  const [group, setGroup] = useState<FilterGroupUI>({ op: 'AND', children: [] })

  // 排序（默认展示所有字段，三态切换：升/降/无）
  const [sortOpen, setSortOpen] = useState(false)
  type LocalSortItem = { field: string, direction: 'asc' | 'desc' | 'none' }
  const [sortDraft, setSortDraft] = useState<LocalSortItem[]>([])
  const [sortRemoved, setSortRemoved] = useState<string[]>([])
  const [sortAddValue, setSortAddValue] = useState<string | undefined>(undefined)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  // 别名
  const [aliasOpen, setAliasOpen] = useState(false)
  const [aliasDraft, setAliasDraft] = useState<{ dimensions: Array<{ identifier: string, alias?: string }>, metrics: Array<{ identifier: string, aggregationType: ChartConfig['metrics'][0]['aggregationType'], alias?: string }> }>({ dimensions: [], metrics: [] })

  // 视图信息内联编辑
  const [tempName, setTempName] = useState('')
  const [tempDescription, setTempDescription] = useState('')

  const isEditMode = Boolean(viewInfo?.isEditing && viewInfo?.id)

  const startEditName = () => { setTempName(viewInfo?.name || ''); onViewInfoUpdate?.({ isEditingName: true }) }
  const confirmEditName = () => { if (!tempName.trim()) { message.warning('视图名称不能为空'); return } onViewInfoUpdate?.({ name: tempName.trim(), isEditingName: false }); setTempName('') }
  const cancelEditName = () => { setTempName(''); onViewInfoUpdate?.({ isEditingName: false }) }
  const startEditDescription = () => { setTempDescription(viewInfo?.description || ''); onViewInfoUpdate?.({ isEditingDescription: true }) }
  const confirmEditDescription = () => { onViewInfoUpdate?.({ description: tempDescription, isEditingDescription: false }); setTempDescription('') }
  const cancelEditDescription = () => { setTempDescription(''); onViewInfoUpdate?.({ isEditingDescription: false }) }

  // 下拉选项
  const fieldOptions = useMemo(() => (fields || []).map(f => ({ label: f.name || f.identifier, value: f.identifier })), [fields])
  const orderFieldOptions = useMemo(() => {
    const dimOpts = (chartConfig.dimensions || []).map(d => ({ label: `维度 · ${d.field.name || d.field.identifier}${d.alias ? `（别名：${d.alias}）` : ''}`, value: d.field.identifier }))
    const metOpts = (chartConfig.metrics || []).map(m => ({ label: `指标 · ${m.aggregationType.toUpperCase()}(${m.field.name || m.field.identifier})${m.alias ? `（别名：${m.alias}）` : ''}`, value: `${m.field.identifier}_${m.aggregationType}` }))
    return [...dimOpts, ...metOpts]
  }, [chartConfig.dimensions, chartConfig.metrics])

  // 打开排序面板时，初始化：默认展示所有字段，orderBy 中的设置优先，并将其排在前面
  const openSortModal = () => {
    const candidates = [...orderFieldOptions]
    // 将当前 orderBy 做索引映射
    const ob = Array.isArray(chartConfig.orderBy) ? chartConfig.orderBy : []
    const dirMap = new Map<string, 'asc' | 'desc'>(ob.map(o => [o.field, o.direction]))
    const orderIndex = new Map<string, number>(ob.map((o, i) => [o.field, i]))
    // 合成全字段列表，带方向，排序：已启用的在前，按 orderBy 顺序；其余按 candidates 原序
    const full: LocalSortItem[] = candidates.map(c => ({ field: c.value, direction: dirMap.get(c.value) || 'none' }))
    full.sort((a, b) => {
      const ia = orderIndex.has(a.field) ? (orderIndex.get(a.field) as number) : Number.POSITIVE_INFINITY
      const ib = orderIndex.has(b.field) ? (orderIndex.get(b.field) as number) : Number.POSITIVE_INFINITY
      if (ia !== ib) return ia - ib
      // 否则按 candidates 原序
      const pa = candidates.findIndex(c => c.value === a.field)
      const pb = candidates.findIndex(c => c.value === b.field)
      return pa - pb
    })
    setSortDraft(full)
    setSortRemoved([])
    setSortAddValue(undefined)
    setSortOpen(true)
  }

  const buildGroupFromFilters = (): FilterGroupUI => {
    const children: FilterGroupUI['children'] = (chartConfig.filters || []).map((f) => {
      const id = f.field.identifier
      const op = f.operator
      let uiOp: string = op
      if (op === 'gt') uiOp = 'greater_than'
      if (op === 'lt') uiOp = 'less_than'
      if (op === 'like') uiOp = 'contains'
      if (op === 'between') {
        const v0 = String(f.values?.[0] ?? '')
        const v1 = String(f.values?.[1] ?? '')
        return { field: id, operator: 'between', value: [v0, v1].filter(Boolean).join('..') }
      }
      if (op === 'in') return { field: id, operator: 'in', value: (f.values || []).map(v => String(v)).join(',') }
      return { field: id, operator: uiOp, value: String(f.values?.[0] ?? '') }
    })
    return { op: 'AND', children }
  }

  const applyAdvancedFilters = () => {
    const flattened = flattenGroupToExternalFilters(group)
    const next: FilterConfig[] = []
    for (const [identifier, conf] of Object.entries(flattened)) {
      const field = fields.find(f => f.identifier === identifier)
      if (!field) continue
      if (Array.isArray(conf)) next.push({ field, operator: 'in', values: conf as Array<string> })
      else if (conf && typeof conf === 'object') {
        const c = conf as { operator?: string, values?: unknown[] }
        let op = c.operator || 'equals'
        if (op === 'gt') op = 'greater_than'
        if (op === 'lt') op = 'less_than'
        if (op === 'like') op = 'contains'
        if (op === 'greater_or_equal') op = 'greater_than'
        if (op === 'less_or_equal') op = 'less_than'
        const vals = Array.isArray(c.values) ? c.values.map(v => v as string) : []
        next.push({ field, operator: op as FilterConfig['operator'], values: vals })
      }
    }
    onReplaceAllFilters(next)
    setAdvOpen(false)
  }

  const handleSaveView = () => {
    if (isEditMode) { onSaveChart(); return }
    if (!viewName.trim()) { Modal.error({ title: '错误', content: '请输入视图名称' }); return }
    onSaveChart(viewName, viewDescription)
    setIsSaveModalVisible(false); setViewName(''); setViewDescription('')
  }
  const openSaveModal = () => { if (isEditMode) handleSaveView(); else setIsSaveModalVisible(true) }

  const renderCardTitle = () => {
    if (!viewInfo?.isEditing && !viewInfo?.name) {
      return (
        <div className="card-title-container" style={{ justifyContent: 'flex-start' }}>
          <div className="view-status new-view">
            <span className="status-icon">📊</span>
            <span className="status-text">新建视图</span>
          </div>
        </div>
      )
    }
    if (viewInfo?.isEditing) {
      return (
        <div className="card-title-container" style={{ justifyContent: 'flex-start' }}>
          <div className="view-info-inline" style={{ justifyContent: 'flex-start' }}>
            <div className="view-name-inline">
              {viewInfo.isEditingName && (
                <div className="edit-inline-wrapper">
                  <Input value={tempName} onChange={(e) => setTempName(e.target.value)} placeholder="视图名称" onPressEnter={confirmEditName} size="small" className="edit-inline-input" autoFocus />
                  <Button type="text" size="small" icon={<CheckOutlined />} onClick={confirmEditName} className="edit-action-btn confirm" />
                  <Button type="text" size="small" icon={<CloseOutlined />} onClick={cancelEditName} className="edit-action-btn cancel" />
                </div>
              )}
              {!viewInfo.isEditingName && (
                <div className="view-display-inline">
                  <Tooltip title={viewInfo.name || '未命名视图'}>
                    <span className="view-name-text">{viewInfo.name || '未命名视图'}</span>
                  </Tooltip>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={startEditName} className="edit-trigger-btn" />
                </div>
              )}
            </div>
            <div className="view-description-inline">
              {viewInfo.isEditingDescription && (
                <div className="edit-inline-wrapper">
                  <Input value={tempDescription} onChange={(e) => setTempDescription(e.target.value)} placeholder="视图描述" onPressEnter={confirmEditDescription} size="small" className="edit-inline-input" autoFocus />
                  <Button type="text" size="small" icon={<CheckOutlined />} onClick={confirmEditDescription} className="edit-action-btn confirm" />
                  <Button type="text" size="small" icon={<CloseOutlined />} onClick={cancelEditDescription} className="edit-action-btn cancel" />
                </div>
              )}
              {!viewInfo.isEditingDescription && (
                <div className="view-display-inline">
                  <Tooltip title={viewInfo.description || '暂无描述'}>
                    <Text type="secondary" className="view-description-text">{viewInfo.description || '暂无描述'}</Text>
                  </Tooltip>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={startEditDescription} className="edit-trigger-btn" />
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="card-title-container" style={{ justifyContent: 'flex-start' }}>
        <div className="view-info-inline" style={{ justifyContent: 'flex-start' }}>
          <div className="view-display-inline">
            <Tooltip title={viewInfo?.name || '未命名视图'}>
              <span className="view-name-text">{viewInfo?.name || '未命名视图'}</span>
            </Tooltip>
          </div>
          {viewInfo?.description && (
            <div className="view-display-inline">
              <Text type="secondary" className="view-description-text">{viewInfo.description}</Text>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderHeaderExtra = () => (
    <Space size={8} align="center">
      {onResetConfig && (
        <Button icon={<ReloadOutlined />} onClick={onResetConfig} disabled={queryLoading} size="small">重置</Button>
      )}
      <Button icon={<FilterOutlined />} size="small" onClick={() => { setGroup(buildGroupFromFilters()); setAdvOpen(true) }}>高级筛选 (beta)</Button>
      <Button icon={<TagOutlined />} size="small" onClick={() => {
        setAliasDraft({
          dimensions: (chartConfig.dimensions || []).map(d => ({ identifier: d.field.identifier, alias: d.alias })),
          metrics: (chartConfig.metrics || []).map(m => ({ identifier: m.field.identifier, aggregationType: m.aggregationType, alias: m.alias }))
        })
        setAliasOpen(true)
      }}>别名</Button>
      <Button icon={<SortAscendingOutlined />} size="small" onClick={openSortModal}>排序</Button>
      <Button type="primary" icon={<SaveOutlined />} size="small" onClick={() => { if (isEditMode) { onSaveChart() } else { setIsSaveModalVisible(true) } }} disabled={!showPreview}>保存</Button>
    </Space>
  )

  return (
    <Card title={renderCardTitle()} extra={renderHeaderExtra()} size="small" className="chart-config-card">
      <div className='chart-config-inner'>
        <DropZone title="维度" type="dimensions" items={chartConfig.dimensions} onDrop={onFieldDrop('dimensions')} onRemove={onFieldRemove('dimensions')} />
        <DropZone title="指标" type="metrics" items={chartConfig.metrics} onDrop={onFieldDrop('metrics')} onRemove={onFieldRemove('metrics')} onUpdateAggregation={onAggregationUpdate} />
        {chartConfig.chartType === 'candlestick' && (
          <div style={{ marginTop: 6, fontSize: 12 }}>
            <span style={{ color: '#8c8c8c' }}>K 线图指标顺序：</span>
            <span style={{ marginLeft: 8 }}>
              <span style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '0 6px', marginRight: 6 }}>开</span>
              <span style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '0 6px', marginRight: 6 }}>收</span>
              <span style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '0 6px', marginRight: 6 }}>低</span>
              <span style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '0 6px' }}>高</span>
            </span>
            {chartConfig.metrics.length !== 4 && (<span style={{ color: '#faad14', marginLeft: 8 }}>（请拖拽 4 个指标并按顺序排列为 开/收/低/高）</span>)}
          </div>
        )}
        <FilterDropZone
          filters={chartConfig.filters}
          onDrop={onFieldDrop('filters')}
          onRemove={onFieldRemove('filters')}
          onUpdateFilter={onFilterUpdate}
          datasetId={selectedDataset || undefined}
        />
      </div>

      <Modal
        title="排序"
        open={sortOpen}
        onCancel={() => setSortOpen(false)}
        onOk={() => {
          // 输出仅包含已启用排序的字段，保持当前顺序
          const next = (sortDraft || [])
            .filter(item => item.direction !== 'none')
            .map(item => ({ field: item.field, direction: item.direction as 'asc' | 'desc' }))
          onOrderByChange?.(next)
          setSortOpen(false)
        }}
        okText="应用"
        cancelText="取消"
      >
        {/* 添加被删除字段 */}
        {sortRemoved.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <Select
              placeholder="添加字段"
              style={{ minWidth: 260 }}
              value={sortAddValue}
              onChange={setSortAddValue}
              options={orderFieldOptions.filter(o => sortRemoved.includes(o.value))}
            />
            <Button size="small" type="primary" disabled={!sortAddValue} onClick={() => {
              if (!sortAddValue) return
              // 从移除列表恢复，插入末尾
              const items = [...(sortDraft || [])]
              const idx = items.findIndex(it => it.field === sortAddValue)
              if (idx === -1) {
                items.push({ field: sortAddValue, direction: 'none' })
              }
              setSortDraft(items)
              setSortRemoved(prev => prev.filter(f => f !== sortAddValue))
              setSortAddValue(undefined)
            }}>添加</Button>
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {(sortDraft || []).filter(item => !sortRemoved.includes(item.field)).map((item, visibleIdx, arr) => (
            <li
              key={item.field}
              draggable
              onDragStart={(e) => {
                // 允许从整行开始拖拽
                try {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(visibleIdx))
                } catch {}
                setDraggingIndex(visibleIdx)
              }}
              onDragEnter={(e) => {
                // 悬停即重排，体验更直观
                e.preventDefault()
                if (draggingIndex === null || draggingIndex === visibleIdx) return
                const visible = arr
                const all = [...(sortDraft || [])]
                const getRealIndex = (vi: number) => all.findIndex(it => it.field === visible[vi].field)
                const from = getRealIndex(draggingIndex)
                const to = getRealIndex(visibleIdx)
                if (from === -1 || to === -1) return
                const [moved] = all.splice(from, 1)
                all.splice(to, 0, moved)
                setSortDraft(all)
                setDraggingIndex(visibleIdx)
              }}
              onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move' } catch {} }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggingIndex === null || draggingIndex === visibleIdx) return
                let fromIdx = draggingIndex
                // 兼容某些浏览器 state 丢失的情况，从 dataTransfer 兜底
                try {
                  const dt = e.dataTransfer.getData('text/plain')
                  if (dt) fromIdx = parseInt(dt, 10)
                } catch {}
                // 只对可见项做重排
                const visible = arr
                const all = [...(sortDraft || [])]
                // visibleIdx 是可见项索引，找到其在 sortDraft 中的真实索引
                const getRealIndex = (vi: number) => all.findIndex(it => it.field === visible[vi].field)
                const from = getRealIndex(fromIdx)
                const to = getRealIndex(visibleIdx)
                const [moved] = all.splice(from, 1)
                all.splice(to, 0, moved)
                setSortDraft(all)
                setDraggingIndex(null)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid #f0f0f0', borderRadius: 6, marginBottom: 8, background: '#fff', cursor: 'move' }}
            >
              <span
                aria-label="drag-handle"
                style={{ width: 18, textAlign: 'center', color: '#aaa', cursor: 'grab' }}
                draggable
                onDragStart={(e) => {
                  try {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', String(visibleIdx))
                  } catch {}
                  setDraggingIndex(visibleIdx)
                }}
                onDragEnd={() => setDraggingIndex(null)}
              >
                <MenuOutlined />
              </span>
              <span style={{ flex: 1 }}>{orderFieldOptions.find(o => o.value === item.field)?.label || item.field}</span>
              <Segmented
                size="small"
                value={item.direction}
                onChange={(val) => {
                  const v = String(val)
                  const dir = (v === 'asc' || v === 'desc') ? v : 'none'
                  const all = [...(sortDraft || [])]
                  const idx = all.findIndex(it => it.field === item.field)
                  if (idx >= 0) {
                    all[idx] = { ...all[idx], direction: dir as LocalSortItem['direction'] }
                    setSortDraft(all)
                  }
                }}
                options={[{ label: '无排序', value: 'none' }, { label: '升序', value: 'asc' }, { label: '降序', value: 'desc' }]}
              />
              <Button size="small" danger onClick={() => {
                setSortRemoved(prev => Array.from(new Set([...prev, item.field])))
              }}>删除</Button>
            </li>
          ))}
        </ul>
        {(sortDraft && sortDraft.filter(i => !sortRemoved.includes(i.field)).length > 0) && (
          <div style={{ marginTop: 4 }}>
            <Button size="small" onClick={() => {
              // 将所有可见项置为无排序
              setSortDraft(prev => prev.map(it => sortRemoved.includes(it.field) ? it : ({ ...it, direction: 'none' })))
            }} type="link">清空全部</Button>
          </div>
        )}
      </Modal>

      <Modal
        title="别名设置"
        open={aliasOpen}
        width={760}
        onCancel={() => setAliasOpen(false)}
        onOk={() => { onAliasChange?.(aliasDraft); setAliasOpen(false); message.success('别名已更新（仅用于展示，不影响查询）') }}
        okText="应用"
        cancelText="取消"
      >
        <div>
          <div style={{ marginBottom: 8, color: '#666' }}>为当前已选字段设置展示别名（只影响图表和表格显示，不影响 SQL 查询）。</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>维度</div>
            {(chartConfig.dimensions || []).map((d, idx) => (
              <div key={d.field.identifier} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ minWidth: 200 }}>{d.field.name || d.field.identifier}</span>
                <Input placeholder="展示别名" value={aliasDraft.dimensions[idx]?.alias || ''} onChange={(e) => {
                  const next = { ...aliasDraft }
                  next.dimensions = [...next.dimensions]
                  next.dimensions[idx] = { identifier: d.field.identifier, alias: e.target.value }
                  setAliasDraft(next)
                }} style={{ maxWidth: 360 }} />
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>指标</div>
            {(chartConfig.metrics || []).map((m, idx) => (
              <div key={`${m.field.identifier}_${m.aggregationType}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ minWidth: 200 }}>{m.aggregationType.toUpperCase()}({m.field.name || m.field.identifier})</span>
                <Input placeholder="展示别名" value={aliasDraft.metrics[idx]?.alias || ''} onChange={(e) => {
                  const next = { ...aliasDraft }
                  next.metrics = [...next.metrics]
                  next.metrics[idx] = { identifier: m.field.identifier, aggregationType: m.aggregationType, alias: e.target.value }
                  setAliasDraft(next)
                }} style={{ maxWidth: 360 }} />
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {!isEditMode && (
        <Modal title="保存视图" open={isSaveModalVisible} onOk={handleSaveView} onCancel={() => setIsSaveModalVisible(false)} okText="保存" cancelText="取消">
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>视图名称 <span style={{ color: '#ff4d4f' }}>*</span>:</div>
            <Input placeholder="请输入视图名称" value={viewName} onChange={(e) => setViewName(e.target.value)} />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>视图描述:</div>
            <Input.TextArea placeholder="请输入视图描述(可选)" value={viewDescription} onChange={(e) => setViewDescription(e.target.value)} rows={3} />
          </div>
        </Modal>
      )}

      <Modal title="高级筛选 (beta)" open={advOpen} width={880} onCancel={() => setAdvOpen(false)} onOk={applyAdvancedFilters} okText="应用" cancelText="取消">
        <div style={{ marginBottom: 8, color: '#666' }}>支持 AND/OR 嵌套；OR 等值将尽可能折叠为 IN。</div>
        <GroupFilterEditor group={group} onChange={setGroup} fieldOptions={fieldOptions} />
      </Modal>
    </Card>
  )
}

export default ChartConfigPanel
