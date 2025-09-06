import React from 'react'
import { Button, Input, Radio, Select, Space } from 'antd'

// 统一的分组筛选 UI 类型
export type FilterConditionUI = { field?: string; operator?: string; value?: string }
export type FilterGroupUI = { op: 'AND' | 'OR'; children: Array<FilterGroupUI | FilterConditionUI> }

export const isConditionNode = (n: FilterGroupUI | FilterConditionUI): n is FilterConditionUI => 'field' in n

// 将分组结构展开成 externalFilters 形态（尽可能将 OR of equals 折叠为 IN）
export const flattenGroupToExternalFilters = (group: FilterGroupUI): Record<string, unknown> => {
  const collect = (g: FilterGroupUI): Array<FilterConditionUI> => {
    if (g.op === 'AND') {
      const out: FilterConditionUI[] = []
      for (const ch of g.children) {
        if (isConditionNode(ch)) out.push(ch)
        else out.push(...collect(ch))
      }
      return out
    } else {
      const conds = g.children.filter(isConditionNode) as FilterConditionUI[]
      const groups = g.children.filter((ch) => !isConditionNode(ch)) as FilterGroupUI[]
      if (groups.length === 0 && conds.length > 0) {
        const sameField = conds.every((c) => c.field === conds[0].field)
        const allEquals = conds.every((c) => (c.operator || 'equals') === 'equals')
        if (sameField && allEquals) {
          const values = conds.map((c) => String(c.value ?? '')).filter(Boolean)
          return [{ field: conds[0].field, operator: 'in', value: values.join(',') }]
        }
      }
      const out: FilterConditionUI[] = []
      for (const ch of g.children) {
        if (isConditionNode(ch)) out.push(ch)
        else out.push(...collect(ch))
      }
      return out
    }
  }
  const conds = collect(group)
  const out: Record<string, unknown> = {}
  for (const c of conds) {
    if (!c.field) continue
    const op = c.operator || 'equals'
    const v = c.value ?? ''
    if (op === 'in') out[c.field] = String(v).split(',').map((s) => s.trim()).filter(Boolean)
    else if (op === 'between') {
      const [a, b] = String(v).split('..')
      out[c.field] = { operator: 'between', values: [a, b].filter(Boolean) }
    } else out[c.field] = { operator: op, values: [v] }
  }
  return out
}

// 可复用的分组筛选编辑器（操作符与引擎保持一致）
export const GroupFilterEditor: React.FC<{
  group: FilterGroupUI
  onChange: (g: FilterGroupUI) => void
  fieldOptions: Array<{ label: string; value: string }>
}> = ({ group, onChange, fieldOptions }) => {
  const update = (next: FilterGroupUI) => onChange({ ...next })
  const addCondition = () => update({ ...group, children: [...group.children, { field: undefined, operator: 'equals', value: '' }] })
  const addGroup = () => update({ ...group, children: [...group.children, { op: 'AND', children: [] }] })
  const removeAt = (idx: number) => update({ ...group, children: group.children.filter((_, i) => i !== idx) })
  const updateChild = (idx: number, child: FilterGroupUI | FilterConditionUI) => update({ ...group, children: group.children.map((c, i) => (i === idx ? child : c)) })

  return (
    <div style={{ border: '1px solid #eef0f3', borderRadius: 6, padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: '#666' }}>逻辑：</span>
        <Radio.Group value={group.op} onChange={(e) => update({ ...group, op: e.target.value })}>
          <Radio.Button value="AND">AND</Radio.Button>
          <Radio.Button value="OR">OR</Radio.Button>
        </Radio.Group>
        <Space style={{ marginLeft: 'auto' }}>
          <Button onClick={addCondition}>添加条件</Button>
          <Button onClick={addGroup}>添加分组</Button>
        </Space>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {group.children.length === 0 && <div style={{ color: '#999' }}>空分组，点击上方按钮添加</div>}
        {group.children.map((ch, idx) => (
          <div key={idx} style={{ border: '1px dashed #e5e7eb', borderRadius: 6, padding: 8 }}>
            {isConditionNode(ch)
              ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>字段</div>
                    <Select
                      options={fieldOptions}
                      value={ch.field}
                      onChange={(v) => updateChild(idx, { ...ch, field: v })}
                      showSearch
                      optionFilterProp="label"
                      placeholder="选择字段"
                    />
                  </div>
                  <div style={{ width: 160 }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>操作符</div>
                    <Select
                      value={ch.operator || 'equals'}
                      onChange={(v) => updateChild(idx, { ...ch, operator: v })}
                      options={[
                        { label: '等于', value: 'equals' },
                        { label: '不等于', value: 'not_equals' },
                        { label: '包含', value: 'contains' },
                        { label: '大于', value: 'greater_than' },
                        { label: '大于等于', value: 'greater_or_equal' },
                        { label: '小于', value: 'less_than' },
                        { label: '小于等于', value: 'less_or_equal' },
                        { label: '区间', value: 'between' },
                        { label: '多选', value: 'in' }
                      ]}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>值</div>
                    <Input value={ch.value} onChange={(e) => updateChild(idx, { ...ch, value: e.target.value })} placeholder="值；多选逗号分隔；区间a..b" />
                  </div>
                  <Button type="link" danger onClick={() => removeAt(idx)}>
                  删除
                  </Button>
                </div>
              )
              : (
                <div>
                  <GroupFilterEditor group={ch} onChange={(g) => updateChild(idx, g)} fieldOptions={fieldOptions} />
                  <div style={{ textAlign: 'right', marginTop: 6 }}>
                    <Button type="link" danger onClick={() => removeAt(idx)}>
                    删除分组
                    </Button>
                  </div>
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default GroupFilterEditor
