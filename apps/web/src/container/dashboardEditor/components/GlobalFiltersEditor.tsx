import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Divider, Form, Input, Modal, Radio, Select, Space, Tooltip, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { datasetApi, viewApi } from '@lumina/api'
import type { GlobalFilterDefinition, DatasetField } from '@lumina/types'
import type { BaseComponent } from '../types/dashboard'
import { v4 as uuidv4 } from 'uuid'

interface GlobalFiltersEditorProps {
  open: boolean
  value: GlobalFilterDefinition[]
  components: BaseComponent[]
  onClose: () => void
  onChange: (next: GlobalFilterDefinition[]) => void
}

export const GlobalFiltersEditor: React.FC<GlobalFiltersEditorProps> = ({
  open,
  value,
  components,
  onClose,
  onChange
}) => {
  const [form] = Form.useForm()
  const [componentLabelMap, setComponentLabelMap] = useState<Record<string, string>>({})
  const componentOptions = useMemo(
    () => components.map((c) => {
      const viewId = c.type === 'view' ? (c.config as unknown as { viewId?: number })?.viewId : undefined
      const fallback = `${c.name || c.id}${viewId ? ` (#${viewId})` : ''}`
      const label = componentLabelMap[c.id] || fallback
      return { label, value: c.id }
    }),
    [components, componentLabelMap]
  )
  // 缓存：componentId -> datasetId，datasetId -> fields
  const [componentDatasetMap, setComponentDatasetMap] = useState<Record<string, number | undefined>>({})
  const [datasetFieldsMap, setDatasetFieldsMap] = useState<Record<number, DatasetField[]>>({})
  // 点选模式（Metabase风格）：进入点选时隐藏弹窗，悬浮高亮；选中后恢复并回填
  const [picking, setPicking] = useState<{ active: boolean, path?: Array<string | number> }>({ active: false })
  const pendingPickRef = useRef<{ path: Array<string | number>, id: string } | null>(null)
  const cachedFormRef = useRef<Record<string, unknown> | null>(null)

  // 根据组件的 viewId 推断 datasetId
  const ensureDatasetForComponent = async (componentId: string): Promise<number | undefined> => {
    const cached = componentDatasetMap[componentId]
    if (cached !== undefined) return cached
    const comp = components.find(c => c.id === componentId)
    const viewId = comp?.type === 'view' ? (comp.config as unknown as { viewId?: number })?.viewId : undefined
    if (!viewId) {
      setComponentDatasetMap(prev => ({ ...prev, [componentId]: undefined }))
      return undefined
    }
    try {
      const v = await viewApi.get(Number(viewId))
      const dsId = (v as unknown as { datasetId?: number })?.datasetId
      const viewName = ((v as unknown as { name?: string, title?: string })?.name) || ((v as unknown as { title?: string })?.title)
      if (viewName) {
        setComponentLabelMap(prev => ({ ...prev, [componentId]: `${viewName} (#${viewId})` }))
      }
      setComponentDatasetMap(prev => ({ ...prev, [componentId]: dsId }))
      return dsId
    } catch {
      setComponentDatasetMap(prev => ({ ...prev, [componentId]: undefined }))
      return undefined
    }
  }

  const ensureFieldsForDataset = async (datasetId: number): Promise<DatasetField[]> => {
    if (datasetFieldsMap[datasetId]) return datasetFieldsMap[datasetId]
    try {
      const fields = await datasetApi.getFields(datasetId)
      setDatasetFieldsMap(prev => ({ ...prev, [datasetId]: fields }))
      return fields
    } catch {
      setDatasetFieldsMap(prev => ({ ...prev, [datasetId]: [] }))
      return []
    }
  }

  useEffect(() => {
    // 初始化表单 rows，兼容已有数据
    const rows = (value || []).map((g) => ({
      id: g.id,
      label: g.label,
      mode: g.mode || 'single',
      operator: g.operator,
      valueType: g.valueType || 'string',
      bindings: (g.bindings || []).map((b) => ({
        componentId: b.componentId,
        fieldIdentifier: b.field.identifier,
        fieldName: b.field.name,
        operator: b.operator
      }))
    }))
    form.setFieldsValue({ rows })
    // 预热 labelMap：尽力补齐视图名称
    ;(async () => {
      for (const c of components) {
        const viewId = c.type === 'view' ? (c.config as unknown as { viewId?: number })?.viewId : undefined
        if (!viewId) continue
        try {
          const v = await viewApi.get(Number(viewId))
          const viewName = ((v as unknown as { name?: string, title?: string })?.name) || ((v as unknown as { title?: string })?.title)
          if (viewName) setComponentLabelMap(prev => ({ ...prev, [c.id]: `${viewName} (#${viewId})` }))
        } catch { /* ignore */ }
      }
    })()
  }, [open, value, form])

  // 预取所有已绑定组件的数据集字段，确保下拉框能显示字段名称（否则只会显示 identifier）
  useEffect(() => {
    if (!open) return
    const rows = (form.getFieldValue('rows') || []) as Array<{ bindings?: Array<{ componentId?: string }> }>
    const ids = new Set<string>()
    rows.forEach(r => (r.bindings || []).forEach(b => { if (b?.componentId) ids.add(String(b.componentId)) }))
    ;(async () => {
      for (const cid of ids) {
        const dsId = await ensureDatasetForComponent(cid)
        if (dsId) await ensureFieldsForDataset(dsId)
      }
    })()
  }, [open])

  useEffect(() => {
    // 组件点选模式：在画布上点击某个组件即选择该组件；同时提供悬浮高亮，ESC 取消
    if (!picking.active) return

    let lastHoverEl: HTMLElement | null = null
    let lastSavedOutline: string | undefined

    const highlight = (el: HTMLElement | null) => {
      if (el === lastHoverEl) return
      if (lastHoverEl) lastHoverEl.style.outline = lastSavedOutline || ''
      lastHoverEl = el
      if (el) {
        lastSavedOutline = el.style.outline
        el.style.outline = '2px solid #1890ff'
      } else {
        lastSavedOutline = undefined
      }
    }

    const handleMove = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-component-id]') as HTMLElement | null
      highlight(el)
    }

    const handleClick = (e: MouseEvent) => {
      const elRaw = (e.target as Element | null)?.closest?.('[data-component-id]') as HTMLElement | null
      const id = elRaw?.getAttribute?.('data-component-id') || ''
      if (!id || !elRaw || !picking.path) return
      // 点击确认：短暂成功高亮（绿色），随后恢复
      const oldOutlineLocal = elRaw.style.outline
      elRaw.style.outline = '2px solid #52c41a'
      window.setTimeout(() => {
        if (lastHoverEl === elRaw) elRaw.style.outline = '2px solid #1890ff'
        else elRaw.style.outline = oldOutlineLocal
      }, 500)

      // 记录待回填；隐藏点选状态后再恢复表单并回填
      pendingPickRef.current = { path: picking.path, id }
      message.success('已选择组件')
      setPicking({ active: false })
    }
    const cancelOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicking({ active: false })
    }
    document.addEventListener('mousemove', handleMove, { capture: true })
    document.addEventListener('click', handleClick, { capture: true })
    window.addEventListener('keydown', cancelOnEsc)
    return () => {
      document.removeEventListener('mousemove', handleMove, { capture: true } as AddEventListenerOptions)
      document.removeEventListener('click', handleClick, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('keydown', cancelOnEsc)
      if (lastHoverEl) lastHoverEl.style.outline = lastSavedOutline || ''
      lastHoverEl = null
      lastSavedOutline = undefined
    }
  }, [picking])

  // 点选结束后，恢复表单并应用待回填值
  useEffect(() => {
    if (picking.active) return
    // 恢复缓存的表单
    if (cachedFormRef.current) {
      form.setFieldsValue(cachedFormRef.current)
    }
    const pending = pendingPickRef.current
    if (pending) {
      form.setFieldValue(pending.path, pending.id)
      // 预取字段
      ensureDatasetForComponent(String(pending.id)).then(dsId => { if (dsId) ensureFieldsForDataset(dsId) })
    }
    pendingPickRef.current = null
  }, [picking.active])

  return (
    <>
      {/* 点选模式提示条（不拦截点击） */}
      {picking.active && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24,144,255,0.95)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            zIndex: 10000,
            pointerEvents: 'none'
          }}
        >
          在画布上点击要绑定的组件（Esc 取消）
        </div>
      )}

      {/* 点选时隐藏弹窗，避免拦截点击（Metabase风格） */}
      {!picking.active && (
        <Modal
          open={open}
          onCancel={onClose}
          width={920}
          title="全局筛选器"
          okText="保存"
          mask
          maskClosable
          onOk={async () => {
            const vals = await form.validateFields()
            const rows = (vals.rows || []) as Array<Record<string, unknown>>
            const normalized: GlobalFilterDefinition[] = rows.map((r) => {
              const id = (r.id as string) || uuidv4()
              const mode = ((r.mode as string) === 'multi' ? 'multi' : 'single') as 'single' | 'multi'
              const defOp = (r.operator as 'equals' | 'in') || (mode === 'multi' ? 'in' : 'equals')
              const bindings = Array.isArray(r.bindings)
                ? (r.bindings as Array<Record<string, unknown>>)
                  .filter((b) => b && b.componentId && b.fieldIdentifier)
                  .map((b) => ({
                    componentId: String(b.componentId),
                    field: { identifier: String(b.fieldIdentifier), name: ((b.fieldName as string) || undefined) as string | undefined },
                    operator: (b.operator as 'equals' | 'in') || undefined
                  }))
                : []
              return {
                id,
                label: (r.label as string) || id,
                mode,
                operator: defOp,
                valueType: (r.valueType as GlobalFilterDefinition['valueType']) || 'string',
                bindings
              }
            })
            onChange(normalized)
            onClose()
          }}
        >
          <Form form={form} layout="vertical">
            <Form.List
              name="rows"
              initialValue={[]}
              rules={[
                {
                  validator: async (_, rows) => {
                    if (!rows || rows.length === 0) {
                      throw new Error('请至少添加一个筛选器')
                    }
                  }
                }
              ]}
            >
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {fields.map((f, idx) => (
                    <Card key={f.key} size="small" bodyStyle={{ padding: 12 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                        <Form.Item name={[f.name, 'id']} style={{ display: 'none' }}>
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name={[f.name, 'label']}
                          label="名称"
                          style={{ flex: 1 }}
                          rules={[{ required: true, message: '请输入名称' }]}
                        >
                          <Input placeholder="例如：产品、地区、时间…" />
                        </Form.Item>
                        <Form.Item name={[f.name, 'mode']} label="模式" initialValue={value?.[idx]?.mode || 'single'}>
                          <Radio.Group>
                            <Radio.Button value="single">单选</Radio.Button>
                            <Radio.Button value="multi">多选</Radio.Button>
                          </Radio.Group>
                        </Form.Item>
                        <Tooltip title="删除">
                          <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(f.name)} />
                        </Tooltip>
                      </div>

                      {/* 绑定列表 */}
                      <div style={{ marginTop: 12 }}>
                        <Form.List name={[f.name, 'bindings']} initialValue={[]}>
                          {(bFields, { add: addBind, remove: removeBind }) => (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              {bFields.map((bf) => (
                                <div key={bf.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                                  <Form.Item
                                    name={[bf.name, 'componentId']}
                                    label="组件"
                                    style={{ width: 240 }}
                                    rules={[{ required: true, message: '请选择组件' }]}
                                  >
                                    <Select
                                      options={componentOptions}
                                      showSearch
                                      optionFilterProp="label"
                                      placeholder="选择组件"
                                      onChange={async (cid: string) => {
                                        // 选择组件后尝试加载其数据集字段
                                        const dsId = await ensureDatasetForComponent(cid)
                                        if (dsId) await ensureFieldsForDataset(dsId)
                                      }}
                                    />
                                  </Form.Item>
                                  <div style={{ paddingBottom: 24 }}>
                                    <Button
                                      type="link"
                                      onClick={() => {
                                        // 缓存当前表单并进入点选；弹窗隐藏，选择后恢复并回填
                                        cachedFormRef.current = form.getFieldsValue(true)
                                        const path = ['rows', f.name, 'bindings', bf.name, 'componentId']
                                        setPicking({ active: true, path })
                                        message.info('请在画布上点击要绑定的图表（Esc 取消）', 3)
                                      }}
                                    >
                                  在画布上点选
                                    </Button>
                                  </div>
                                  <Form.Item
                                    name={[bf.name, 'fieldIdentifier']}
                                    label="字段"
                                    style={{ flex: 1 }}
                                    rules={[{ required: true, message: '请选择字段' }]}
                                  >
                                    <Select
                                      placeholder="选择字段"
                                      showSearch
                                      optionFilterProp="label"
                                      // 字段选项依赖于所选组件
                                      options={(() => {
                                        const cid = form.getFieldValue(['rows', f.name, 'bindings', bf.name, 'componentId']) as string | undefined
                                        if (!cid) return []
                                        const dsId = componentDatasetMap[cid]
                                        if (!dsId) return []
                                        const fields = datasetFieldsMap[dsId] || []
                                        return fields.map(fd => ({ label: fd.name || fd.identifier, value: fd.identifier }))
                                      })()}
                                      onDropdownVisibleChange={async (open) => {
                                        if (!open) return
                                        const cid = form.getFieldValue(['rows', f.name, 'bindings', bf.name, 'componentId']) as string | undefined
                                        if (!cid) return
                                        const dsId = await ensureDatasetForComponent(cid)
                                        if (dsId) await ensureFieldsForDataset(dsId)
                                      }}
                                    />
                                  </Form.Item>
                                  <Form.Item name={[bf.name, 'operator']} label="操作符" style={{ width: 140 }}>
                                    <Select
                                      allowClear
                                      options={[
                                        { label: '等于', value: 'equals' },
                                        { label: '包含(多选)', value: 'in' }
                                      ]}
                                      placeholder="默认随模式"
                                    />
                                  </Form.Item>
                                  <Tooltip title="移除绑定">
                                    <Button type="link" danger onClick={() => removeBind(bf.name)}>移除</Button>
                                  </Tooltip>
                                </div>
                              ))}
                              <Button type="dashed" icon={<PlusOutlined />} onClick={() => addBind({})}>
                            添加绑定
                              </Button>
                            </Space>
                          )}
                        </Form.List>
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                          <Form.Item name={[f.name, 'valueType']} label="值类型" initialValue={value?.[idx]?.valueType || 'string'}>
                            <Select
                              style={{ width: 200 }}
                              options={[
                                { label: '字符串', value: 'string' },
                                { label: '数值', value: 'number' },
                                { label: '日期', value: 'date' },
                                { label: '日期时间', value: 'datetime' },
                                { label: '布尔', value: 'boolean' },
                                { label: '地理位置', value: 'geo' }
                              ]}
                            />
                          </Form.Item>
                        </div>
                        <Form.Item shouldUpdate noStyle>
                          {() => {
                            const binds = form.getFieldValue([f.name, 'bindings']) as unknown[]
                            if (Array.isArray(binds) && binds.length > 0) return null
                            return <div style={{ color: '#faad14' }}>请至少添加一个绑定（组件 + 字段）</div>
                          }}
                        </Form.Item>
                      </div>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ id: uuidv4(), mode: 'single', bindings: [] })}
                  >
                添加筛选器
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form>
          <Divider />
          <div style={{ color: '#999' }}>
        说明：新模式仅支持“输入值 + 多视图字段绑定（bindings）”，每个筛选器可绑定多个视图字段。
          </div>
        </Modal>
      )}
    </>
  )
}

export default GlobalFiltersEditor
