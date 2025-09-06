import React, { useEffect, useMemo, useState } from 'react'
import { Card, Form, Input, Button, Select, Space, message, Row, Col, Popconfirm, Switch, Typography, Tooltip, AutoComplete } from 'antd'
import { EditOutlined, CheckOutlined, PlusOutlined, DeleteOutlined, CopyOutlined, SaveOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { datasetApi, datasourceApi } from '@lumina/api'
import { v4 as uuidv4 } from 'uuid'
import type { FieldType, Dataset, DatasetField } from '@lumina/types'
import SampleDataModal from '../../components/dataset/SampleDataModal'

const fieldTypeOptions = [
  { label: '文本', value: 'STRING' },
  { label: '整数', value: 'INTEGER' },
  { label: '浮点数', value: 'FLOAT' },
  { label: '日期', value: 'DATE' },
  { label: '布尔值', value: 'BOOLEAN' },
  { label: '时间戳', value: 'TIMESTAMP' }
]

// Dataset 类型补充 baseTable/baseSchema/queryTemplate 字段
interface DatasetWithBase {
  name: string;
  sourceId: number;
  baseTable: string;
  baseSchema?: string;
  description?: string;
  fields: DatasetField[];
  joins?: Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>
}

const EditDataset: React.FC = () => {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')
  const presetSourceId = searchParams.get('sourceId')
  const mode = searchParams.get('mode')
  const readonly = mode === 'readonly'
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [datasourceOptions, setDatasourceOptions] = useState<{ label: string; value: number }[]>([])
  const [fields, setFields] = useState<Array<{
    identifier: string;
    name: string;
    expression: string;
    type: FieldType;
    isDimension: boolean;
    isMetric: boolean;
    description: string;
    valueMap?: Array<{ value: string | number | boolean | null; label: string }>
  }>>([
    {
      identifier: `field_${uuidv4().replace(/-/g, '').substring(0, 8)}`,
      name: '',
      expression: '',
      type: 'STRING',
      isDimension: true,
      isMetric: false,
      description: '',
      valueMap: undefined
    }
  ])
  // 值映射编辑器
  const [mappingEditor, setMappingEditor] = useState<{
    open: boolean,
    index: number | null,
    items: Array<{ value: string, label: string }>,
    optionsByRow: Record<number, Array<{ label: string, value: string }>>,
    defaultOptions: Array<{ label: string, value: string }>
  }>({ open: false, index: null, items: [], optionsByRow: {}, defaultOptions: [] })
  // 基础信息编辑状态
  const [editField, setEditField] = useState<string | null>(null)
  const [baseInfo, setBaseInfo] = useState({
    name: '',
    sourceId: 0,
    baseTable: '',
    baseSchema: '',
    description: ''
  })
  const [joins, setJoins] = useState<Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>>([])
  const [fieldErrors, setFieldErrors] = useState<{ [k: string]: { name?: boolean; expression?: boolean } }>({})
  // 预览 Modal
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null)

  // 元数据：schemas / tables / columns
  const [schemaOptions, setSchemaOptions] = useState<string[]>([])
  const [tableOptions, setTableOptions] = useState<Array<{ schema?: string, name: string }>>([])
  const [baseColumns, setBaseColumns] = useState<Array<{ name: string, type: string }>>([])
  // 每个 join 的列
  const [joinColumns, setJoinColumns] = useState<Record<number, Array<{ name: string, type: string }>>>({})

  // 组合可用列供下拉（含基础表与每个联表，值为 别名.列名 或 表名.列名）
  const availableColumnOptions = useMemo(() => {
    const opts: Array<{ label: string, value: string, group: string }> = []
    const baseAlias = baseInfo.baseTable || 'base'
    if (baseColumns.length > 0) {
      for (const c of baseColumns) {
        const val = `${baseAlias}.${c.name}`
        opts.push({ label: `${val} (${c.type})`, value: val, group: '基础表' })
      }
    }
    joins.forEach((j, idx) => {
      const alias = j.alias || j.table
      const cols = joinColumns[idx] || []
      for (const c of cols) {
        const val = `${alias}.${c.name}`
        opts.push({ label: `${val} (${c.type})`, value: val, group: alias })
      }
    })
    return opts
  }, [baseColumns, joins, joinColumns, baseInfo.baseTable])

  useEffect(() => {
    setLoading(true)
    datasourceApi.list()
      .then((res) => {
        setDatasourceOptions((res?.list || []).map(ds => ({ label: ds.name, value: ds.id })))
      })
      .catch(() => setDatasourceOptions([]))
    if (id) {
      datasetApi.get(Number(id))
        .then((res) => {
          // 兼容 DatasetWithBase
          const dataset = res as unknown as (Dataset & Partial<DatasetWithBase>)
          setBaseInfo({
            name: dataset.name ?? '',
            sourceId: Number(dataset.sourceId) ?? 0,
            baseTable: dataset.baseTable ?? '',
            baseSchema: dataset.baseSchema ?? '',
            description: dataset.description ?? ''
          })
          setFields((dataset.fields || []).map((f: Partial<DatasetField>) => ({
            identifier: f.identifier ?? '',
            name: f.name ?? '',
            expression: f.expression ?? '',
            type: (f.type ?? 'STRING') as FieldType,
            isDimension: f.isDimension ?? false,
            isMetric: f.isMetric ?? false,
            description: f.description ?? '',
            valueMap: Array.isArray(f.valueMap) ? f.valueMap.map(item => ({ value: item.value as unknown as string | number | boolean | null, label: String(item.label ?? '') })) : undefined
          })))
          setJoins(dataset.joins || [])
        })
        .catch(() => setError('加载数据集失败'))
        .finally(() => setLoading(false))
    } else {
      // 新建时，如果带了 sourceId 预填
      if (presetSourceId) {
        setBaseInfo(prev => ({ ...prev, sourceId: Number(presetSourceId) }))
      }
      setLoading(false)
    }
  }, [id])

  // 当选择数据源变化时，加载 schemas 与 tables 列表，清空现有表/列/联表
  useEffect(() => {
    const sid = Number(baseInfo.sourceId)
    if (!sid) return
    ;(async () => {
      try {
        const schemas = await datasourceApi.listSchemas(sid).catch(() => [])
        setSchemaOptions(schemas || [])
        const tables = await datasourceApi.listTables(sid).catch(() => [])
        setTableOptions(tables || [])
      } catch (_) {
        setSchemaOptions([])
        setTableOptions([])
      }
    })()
    // 同时清空列与联表列
    setBaseColumns([])
    setJoinColumns({})
  }, [baseInfo.sourceId])

  // 当基础表或 schema 变化时，拉取基础列
  useEffect(() => {
    const sid = Number(baseInfo.sourceId)
    if (!sid || !baseInfo.baseTable) return
    ;(async () => {
      try {
        const cols = await datasourceApi.listColumns(sid, baseInfo.baseTable, baseInfo.baseSchema || undefined)
        setBaseColumns(cols || [])
      } catch (_) {
        setBaseColumns([])
      }
    })()
  }, [baseInfo.sourceId, baseInfo.baseSchema, baseInfo.baseTable])

  // 当联表配置变化或加载已有数据集时，自动拉取每个联表的列，供“快速填充/ON条件选择”等使用
  useEffect(() => {
    const sid = Number(baseInfo.sourceId)
    if (!sid) return
    joins.forEach(async (j, idx) => {
      if (!j?.table) return
      // 若该索引尚未加载过列或为空，则加载
      if (joinColumns[idx] && (joinColumns[idx]?.length || 0) > 0) return
      try {
        const cols = await datasourceApi.listColumns(sid, j.table, j.schema || undefined)
        setJoinColumns(prev => ({ ...prev, [idx]: cols || [] }))
      } catch (_) {
        setJoinColumns(prev => ({ ...prev, [idx]: [] }))
      }
    })
  }, [joins, baseInfo.sourceId])

  // 字段操作
  const handleFieldChange = (idx: number, key: keyof typeof fields[0], value: unknown) => {
    setFields(f =>
      f.map((item, i) => (i === idx ? { ...item, [key]: value } : item))
    )
  }
  const handleFieldDelete = (idx: number) => {
    setFields(f => f.filter((_, i) => i !== idx))
  }
  const handleFieldCopy = (idx: number) => {
    setFields(f => [
      ...f.slice(0, idx + 1),
      { ...f[idx], identifier: `field_${uuidv4().replace(/-/g, '').substring(0, 8)}` },
      ...f.slice(idx + 1)
    ])
  }
  const handleAddField = () => {
    setFields(f => [
      ...f,
      {
        identifier: `field_${uuidv4().replace(/-/g, '').substring(0, 8)}`,
        name: '',
        expression: '',
        type: 'STRING',
        isDimension: true,
        isMetric: false,
        description: ''
      }
    ])
  }
  const handleFieldBlur = (idx: number, key: 'name' | 'expression', value: string) => {
    setFieldErrors(prev => {
      const identifier = fields[idx].identifier
      return {
        ...prev,
        [identifier]: {
          ...prev[identifier],
          [key]: !value
        }
      }
    })
  }

  // 保存
  const handleSave = async () => {
    try {
      // 校验基础信息
      if (!baseInfo.name || !baseInfo.sourceId || !baseInfo.baseTable) {
        message.error('请填写完整的基础信息（名称、数据源、基础表名）')
        return
      }
      if (fields.length === 0) {
        message.error('请至少添加一个字段')
        return
      }
      for (const field of fields) {
        if (!field.name || !field.expression || !field.type) {
          message.error('字段名称、类型、表达式不能为空')
          return
        }
      }
      setLoading(true)
      const { queryTemplate, ...restBase } = baseInfo as unknown as { queryTemplate?: string }
      const payload = { ...restBase, fields: fields.map(f => ({ ...f, type: f.type as FieldType })), joins }
      if (id) {
        await datasetApi.update(Number(id), payload)
        message.success('保存成功')
        navigate(`/dataset/edit?id=${id}`)
      } else {
        const res = await datasetApi.create(
          payload as unknown as {
            name: string,
            sourceId: number,
            baseTable: string,
            baseSchema?: string,
            description?: string,
            fields: DatasetField[],
            joins?: Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>
          }
        )
        message.success('创建成功')
        if (res && res.id) {
          navigate(`/dataset/edit?id=${res.id}`)
        } else {
          navigate(-1)
        }
      }
    } catch (e) {
      // 校验失败不提示
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return <Card style={{ margin: 32 }}><span style={{ color: 'red' }}>{error}</span></Card>
  }

  return (
    <div style={{ margin: 0, height: '100%', overflowY: 'scroll' }} className='no-scrollBar'>
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 12px #e6eaff',
          width: '100%',
          padding: 0
        }}
        bodyStyle={{ background: '#fff', borderRadius: 12 }}
        title={
          <Row justify="space-between" align="middle" style={{ marginBottom: 0 }}>
            <Col>
              <Typography.Title level={4}>
                {id ? (readonly ? '查看数据集' : '编辑数据集') : '新建数据集'}
              </Typography.Title>
            </Col>
            <Col>
              {!readonly && (
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
                  保存
                </Button>
              )}
              <Button
                style={{ marginLeft: 8 }}
                icon={<EyeOutlined />}
                onClick={async () => {
                  try {
                    // 尝试获取最新数据集定义用于预览
                    let ds: Dataset
                    if (id) {
                      ds = await datasetApi.get(Number(id))
                    } else {
                      ds = {
                        id: 0,
                        name: baseInfo.name || '未命名数据集',
                        sourceId: baseInfo.sourceId,
                        fields: fields as unknown as DatasetField[],
                        baseTable: baseInfo.baseTable,
                        baseSchema: baseInfo.baseSchema
                      } as unknown as Dataset
                    }
                    setPreviewDataset(ds)
                    setPreviewOpen(true)
                  } catch {
                    setPreviewDataset(null)
                    setPreviewOpen(true)
                  }
                }}
              >预览数据</Button>
            </Col>
          </Row>
        }
      >
        <div style={{ padding: '0 8px', maxWidth: 1400, margin: '0 auto' }}>
          <Row gutter={16}>
            <Col span={6}>
              <div style={{ position: 'relative', minHeight: 56 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>数据集名称</div>
                <div
                  style={{ lineHeight: '32px', borderRadius: 4, padding: '0 8px', transition: 'background .2s', position: 'relative', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={() => !readonly && editField !== 'name' && setEditField('name-hover')}
                  onMouseLeave={() => !readonly && editField === 'name-hover' && setEditField(null)}
                >
                  {editField === 'name' && !readonly
                    ? (
                      <>
                        <Input
                          autoFocus
                          value={baseInfo.name}
                          onChange={e => setBaseInfo({ ...baseInfo, name: e.target.value })}
                          style={{ flex: 1, marginRight: 8 }}
                          onBlur={() => setEditField(null)}
                          onPressEnter={() => setEditField(null)}
                          disabled={readonly}
                        />
                        <CheckOutlined style={{ color: '#3056d3', cursor: 'pointer', marginRight: 8 }} onMouseDown={e => { e.preventDefault(); setEditField(null) }} />
                        <CloseOutlined style={{ color: '#bbb', cursor: 'pointer' }} onMouseDown={e => { e.preventDefault(); setEditField(null) }} />
                      </>
                    )
                    : (
                      <>
                        <span style={{ flex: 1 }}>{baseInfo.name || <span style={{ color: '#bbb' }}>未填写</span>}</span>
                        {!readonly && editField === 'name-hover' && (
                          <EditOutlined style={{ marginLeft: 6, color: '#bbb', fontSize: 16, verticalAlign: -2, cursor: 'pointer' }} onMouseDown={e => { e.preventDefault(); setEditField('name') }} />
                        )}
                      </>
                    )}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ position: 'relative', minHeight: 56 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>关联数据源</div>
                <div
                  style={{ lineHeight: '32px', borderRadius: 4, padding: '0 8px', transition: 'background .2s', position: 'relative', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={() => !readonly && editField !== 'sourceId' && setEditField('sourceId-hover')}
                  onMouseLeave={() => !readonly && editField === 'sourceId-hover' && setEditField(null)}
                >
                  {editField === 'sourceId' && !readonly
                    ? (
                      <Select
                        autoFocus
                        style={{ width: '100%' }}
                        value={baseInfo.sourceId}
                        options={datasourceOptions}
                        onChange={v => setBaseInfo({ ...baseInfo, sourceId: v })}
                        onBlur={() => setEditField(null)}
                        dropdownMatchSelectWidth={false}
                        disabled={readonly}
                        showSearch
                        optionFilterProp="label"
                      />
                    )
                    : (
                      <>
                        <span style={{ flex: 1 }}>{datasourceOptions.find(opt => opt.value === baseInfo.sourceId)?.label || <span style={{ color: '#bbb' }}>未选择</span>}</span>
                        {!readonly && editField === 'sourceId-hover' && (
                          <EditOutlined style={{ marginLeft: 6, color: '#bbb', fontSize: 16, verticalAlign: -2, cursor: 'pointer' }} onMouseDown={e => { e.preventDefault(); setEditField('sourceId') }} />
                        )}
                      </>
                    )}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ position: 'relative', minHeight: 56 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>基础表名</div>
                <div
                  style={{ lineHeight: '32px', borderRadius: 4, padding: '0 8px', transition: 'background .2s', position: 'relative', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={() => !readonly && editField !== 'baseTable' && setEditField('baseTable-hover')}
                  onMouseLeave={() => !readonly && editField === 'baseTable-hover' && setEditField(null)}
                >
                  {editField === 'baseTable' && !readonly
                    ? (
                      <Select
                        autoFocus
                        style={{ width: '100%' }}
                        placeholder={baseInfo.baseSchema ? `选择表（${baseInfo.baseSchema}）` : '选择表'}
                        value={baseInfo.baseTable || undefined}
                        options={tableOptions
                          .filter(t => (baseInfo.baseSchema ? t.schema === baseInfo.baseSchema : true))
                          .map(t => ({ label: baseInfo.baseSchema ? t.name : `${t.schema ? `${t.schema}.` : ''}${t.name}`, value: t.name }))}
                        onChange={v => setBaseInfo({ ...baseInfo, baseTable: v })}
                        onBlur={() => setEditField(null)}
                        showSearch
                        optionFilterProp="label"
                        disabled={readonly || !baseInfo.sourceId}
                      />
                    )
                    : (
                      <>
                        <span style={{ flex: 1 }}>{baseInfo.baseTable || <span style={{ color: '#bbb' }}>未选择</span>}</span>
                        {!readonly && editField === 'baseTable-hover' && (
                          <EditOutlined style={{ marginLeft: 6, color: '#bbb', fontSize: 16, verticalAlign: -2, cursor: 'pointer' }} onMouseDown={e => { e.preventDefault(); setEditField('baseTable') }} />
                        )}
                      </>
                    )}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ position: 'relative', minHeight: 56 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>数据库Schema</div>
                <div
                  style={{ lineHeight: '32px', borderRadius: 4, padding: '0 8px', transition: 'background .2s', position: 'relative', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={() => !readonly && editField !== 'baseSchema' && setEditField('baseSchema-hover')}
                  onMouseLeave={() => !readonly && editField === 'baseSchema-hover' && setEditField(null)}
                >
                  {editField === 'baseSchema' && !readonly
                    ? (
                      <Select
                        autoFocus
                        style={{ width: '100%' }}
                        placeholder="选择数据库/Schema（可选）"
                        value={baseInfo.baseSchema || undefined}
                        options={(schemaOptions || []).map(s => ({ label: s, value: s }))}
                        onChange={v => setBaseInfo({ ...baseInfo, baseSchema: v, baseTable: '' })}
                        onBlur={() => setEditField(null)}
                        disabled={readonly || !baseInfo.sourceId}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                      />
                    )
                    : (
                      <>
                        <span style={{ flex: 1 }}>{baseInfo.baseSchema || <span style={{ color: '#bbb' }}>未选择</span>}</span>
                        {!readonly && editField === 'baseSchema-hover' && (
                          <EditOutlined style={{ marginLeft: 6, color: '#bbb', fontSize: 16, verticalAlign: -2, cursor: 'pointer' }} onMouseDown={e => { e.preventDefault(); setEditField('baseSchema') }} />
                        )}
                      </>
                    )}
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ position: 'relative', minHeight: 56 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>描述</div>
                <div
                  style={{ lineHeight: '32px', borderRadius: 4, padding: '0 8px', transition: 'background .2s', position: 'relative', display: 'flex', alignItems: 'center', minHeight: 32, whiteSpace: 'pre-line' }}
                  onMouseEnter={() => !readonly && editField !== 'description' && setEditField('description-hover')}
                  onMouseLeave={() => !readonly && editField === 'description-hover' && setEditField(null)}
                >
                  {editField === 'description' && !readonly
                    ? (
                      <Input.TextArea
                        autoSize
                        value={baseInfo.description}
                        onChange={e => setBaseInfo({ ...baseInfo, description: e.target.value })}
                        onBlur={() => setEditField(null)}
                        style={{ flex: 1 }}
                        disabled={readonly}
                      />
                    )
                    : (
                      <>
                        <span style={{ flex: 1 }}>{baseInfo.description || <span style={{ color: '#bbb' }}>未填写</span>}</span>
                        {!readonly && editField === 'description-hover' && (
                          <EditOutlined style={{ marginLeft: 6, color: '#bbb', fontSize: 16, verticalAlign: -2, cursor: 'pointer' }} onMouseDown={e => { e.preventDefault(); setEditField('description') }} />
                        )}
                      </>
                    )}
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </Card>
      <Card
        title={<span>联表配置（Beta）</span>}
        bordered={false}
        style={{ margin: '20px 0', boxShadow: '0 2px 12px #e6f7ff', marginLeft: 'auto', marginRight: 'auto' }}
        bodyStyle={{ padding: 20, background: '#fff' }}
        extra={!readonly && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setJoins(j => [...j, { table: '', type: 'INNER', on: [{ left: '', right: '' }] }])}>添加联表</Button>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '120px 180px 200px 140px 1fr 80px', fontWeight: 500, marginBottom: 8, columnGap: 12 }}>
          <div>类型</div>
          <div>Schema</div>
          <div>表名</div>
          <div>别名</div>
          <div>ON 条件（左 = 右，可添加多行）</div>
          <div></div>
        </div>
        {joins.map((j, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 180px 200px 140px 1fr 80px', alignItems: 'start', columnGap: 12, marginBottom: 10 }}>
            <div>
              <Select
                disabled={readonly}
                style={{ width: '100%' }}
                value={j.type}
                options={[{ label: 'INNER', value: 'INNER' }, { label: 'LEFT', value: 'LEFT' }, { label: 'RIGHT', value: 'RIGHT' }, { label: 'FULL', value: 'FULL' }]}
                onChange={(v) => setJoins(arr => arr.map((it, i) => i === idx ? { ...it, type: v as 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' } : it))}
              />
            </div>
            <div>
              <Select
                disabled={readonly || !baseInfo.sourceId}
                style={{ width: '100%' }}
                placeholder="选择Schema（可选）"
                allowClear
                value={j.schema || undefined}
                options={(schemaOptions || []).map(s => ({ label: s, value: s }))}
                onChange={(v) => {
                  setJoins(arr => arr.map((it, i) => i === idx ? { ...it, schema: v || undefined, table: '', alias: it.alias } : it))
                }}
                showSearch
                optionFilterProp="label"
              />
            </div>
            <div>
              <Select
                disabled={readonly || !baseInfo.sourceId}
                style={{ width: '100%' }}
                placeholder={j.schema ? `选择表（${j.schema}）` : '选择表'}
                value={j.table || undefined}
                options={tableOptions
                  .filter(t => (j.schema ? t.schema === j.schema : true))
                  .map(t => ({ label: j.schema ? t.name : `${t.schema ? `${t.schema}.` : ''}${t.name}`, value: t.name }))}
                onChange={async (v) => {
                  const next = joins.map((it, i) => i === idx ? { ...it, table: v, alias: it.alias || v } : it)
                  setJoins(next)
                  // 选定表后拉取列
                  try {
                    const cols = await datasourceApi.listColumns(Number(baseInfo.sourceId), v, j.schema || undefined)
                    setJoinColumns(prev => ({ ...prev, [idx]: cols || [] }))
                  } catch (_) {
                    setJoinColumns(prev => ({ ...prev, [idx]: [] }))
                  }
                }}
                showSearch
                optionFilterProp="label"
              />
            </div>
            <div>
              <Input
                disabled={readonly}
                placeholder="别名（可选）"
                value={j.alias || ''}
                onChange={e => setJoins(arr => arr.map((it, i) => i === idx ? { ...it, alias: e.target.value } : it))}
              />
            </div>
            <div>
              <Space direction="vertical" style={{ width: '100%' }}>
                {j.on.map((c, ci) => (
                  <div key={ci} style={{ display: 'grid', gridTemplateColumns: '1fr 20px 1fr 28px', columnGap: 8, alignItems: 'center' }}>
                    <Select
                      disabled={readonly}
                      placeholder="选择左侧列"
                      value={c.left || undefined}
                      options={availableColumnOptions.map(o => ({ label: o.label, value: o.value }))}
                      onChange={(v) => setJoins(arr => arr.map((it, i) => i === idx ? { ...it, on: it.on.map((oc, oi) => oi === ci ? { ...oc, left: v } : oc) } : it))}
                      showSearch
                      optionFilterProp="label"
                    />
                    <span style={{ textAlign: 'center' }}>=</span>
                    <Select
                      disabled={readonly}
                      placeholder="选择右侧列"
                      value={c.right || undefined}
                      options={availableColumnOptions.map(o => ({ label: o.label, value: o.value }))}
                      onChange={(v) => setJoins(arr => arr.map((it, i) => i === idx ? { ...it, on: it.on.map((oc, oi) => oi === ci ? { ...oc, right: v } : oc) } : it))}
                      showSearch
                      optionFilterProp="label"
                    />
                    {!readonly && (
                      <Button danger size="small" onClick={() => setJoins(arr => arr.map((it, i) => i === idx ? { ...it, on: it.on.filter((_, k) => k !== ci) } : it))}>删</Button>
                    )}
                  </div>
                ))}
                {!readonly && (
                  <Button size="small" onClick={() => setJoins(arr => arr.map((it, i) => i === idx ? { ...it, on: [...it.on, { left: '', right: '' }] } : it))}>+ 添加条件</Button>
                )}
              </Space>
            </div>
            <div>
              {!readonly && (
                <Space>
                  <Button danger onClick={() => setJoins(arr => arr.filter((_, i) => i !== idx))}>删除</Button>
                </Space>
              )}
            </div>
          </div>
        ))}
        {joins.length === 0 && <div style={{ color: '#aaa' }}>暂无联表。点击右上角“添加联表”。</div>}
      </Card>
      <Card
        title={<span>字段信息</span>}
        bordered={false}
        style={{ margin: '20px 0', boxShadow: '0 2px 12px #e6f7ff', marginLeft: 'auto', marginRight: 'auto' }}
        bodyStyle={{ padding: 20, background: '#fafdff' }}
        extra={
          !readonly && (
            <Button icon={<PlusOutlined />} onClick={handleAddField} type="dashed">
              添加字段
            </Button>
          )
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 120px 110px 1fr 110px 110px 120px 160px 90px',
            fontWeight: 500,
            marginBottom: 8,
            borderRadius: 4,
            padding: '4px 8px',
            alignItems: 'center',
            columnGap: 12
          }}
        >
          <div>Identifier</div>
          <div>字段名称</div>
          <div>类型</div>
          <div>表达式<Tooltip title="可直接从下拉选择库表列填充表达式"><span style={{ color: '#999', marginLeft: 6 }}>(支持下拉)</span></Tooltip></div>
          <div style={{ textAlign: 'center' }}>是否维度</div>
          <div style={{ textAlign: 'center' }}>是否指标</div>
          <div>值映射</div>
          <div>描述</div>
          <div></div>
        </div>
        { fields.map((field, idx) => (
          <div
            key={field.identifier}
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 120px 110px 1fr 110px 110px 120px 160px 90px',
              alignItems: 'center',
              marginBottom: 10,
              borderRadius: 4,
              padding: '4px 0',
              boxShadow: '0 1px 4px #f0f1fa',
              columnGap: 12
            }}
          >
            <div><Input style={{ width: '100%' }} value={field.identifier} disabled /></div>
            <div>
              <Input
                style={{ width: '100%', borderColor: fieldErrors[field.identifier]?.name ? '#ff4d4f' : undefined }}
                placeholder="字段名称"
                value={field.name}
                onChange={e => handleFieldChange(idx, 'name', e.target.value)}
                onBlur={e => handleFieldBlur(idx, 'name', e.target.value)}
                disabled={readonly}
              />
            </div>
            <div><Select style={{ width: '100%' }} options={fieldTypeOptions} value={field.type} onChange={v => handleFieldChange(idx, 'type', v)} disabled={readonly} /></div>
            <div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  style={{ width: '100%', borderColor: fieldErrors[field.identifier]?.expression ? '#ff4d4f' : undefined }}
                  placeholder="表达式（可手输或右侧选择）"
                  value={field.expression}
                  onChange={e => handleFieldChange(idx, 'expression', e.target.value)}
                  onBlur={e => handleFieldBlur(idx, 'expression', e.target.value)}
                  disabled={readonly}
                />
                <Select
                  style={{ minWidth: 220 }}
                  placeholder="选择列快速填充"
                  value={undefined}
                  options={availableColumnOptions.map(o => ({ label: o.label, value: o.value }))}
                  onChange={(v) => handleFieldChange(idx, 'expression', v)}
                  showSearch
                  optionFilterProp="label"
                  disabled={readonly || availableColumnOptions.length === 0}
                />
              </div>
            </div>
            <div style={{ textAlign: 'center' }}><Switch checked={field.isDimension} onChange={v => handleFieldChange(idx, 'isDimension', v)} checkedChildren="是" unCheckedChildren="否" style={{ background: field.isDimension ? '#3056d3' : '#d9d9d9' }} disabled={readonly} /></div>
            <div style={{ textAlign: 'center' }}><Switch checked={field.isMetric} onChange={v => handleFieldChange(idx, 'isMetric', v)} checkedChildren="是" unCheckedChildren="否" style={{ background: field.isMetric ? '#13c2c2' : '#d9d9d9' }} disabled={readonly} /></div>
            <div>
              <Button size="small" disabled={readonly} onClick={() => {
                const items = (field.valueMap || []).map(it => ({ value: String(it.value ?? ''), label: String(it.label ?? '') }))
                setMappingEditor({ open: true, index: idx, items, optionsByRow: {}, defaultOptions: [] })
                // 打开时预取前10个去重值，作为默认候选
                ;(async () => {
                  try {
                    if (!id) return
                    const targetField = fields[idx]
                    if (!targetField) return
                    const { values } = await datasetApi.getDistinctValues(Number(id), {
                      field: { identifier: targetField.identifier, name: targetField.name, type: targetField.type },
                      limit: 10
                    })
                    const opts = (values || []).map(v => ({ label: String(v.label ?? v.value ?? ''), value: String(v.value ?? v.label ?? '') }))
                    setMappingEditor(prev => ({ ...prev, defaultOptions: opts }))
                  } catch {
                    // 忽略
                  }
                })()
              }}>
                编辑{Array.isArray(field.valueMap) && field.valueMap.length ? `（${field.valueMap.length}）` : ''}
              </Button>
            </div>
            <div><Input style={{ width: '100%' }} placeholder="描述（可选）" value={field.description} onChange={e => handleFieldChange(idx, 'description', e.target.value)} disabled={readonly} /></div>
            <div><Space>
              {!readonly && <Button icon={<CopyOutlined />} onClick={() => handleFieldCopy(idx)} />}
              {!readonly && <Popconfirm title="确定删除该字段？" onConfirm={() => handleFieldDelete(idx)}><Button icon={<DeleteOutlined />} danger /></Popconfirm>}
            </Space></div>
          </div>
        )) }
        {fields.length === 0 && <div style={{ color: '#aaa', marginTop: 8 }}>请添加字段</div>}
      </Card>
      {/* 值映射编辑 Modal */}
      {mappingEditor.open && (
        <Card
          style={{ position: 'fixed', left: '50%', top: '20%', transform: 'translateX(-50%)', zIndex: 1000, width: 560, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}
          title="编辑值映射"
          extra={<Space>
            <Button onClick={() => setMappingEditor({ open: false, index: null, items: [], optionsByRow: {}, defaultOptions: [] })}>取消</Button>
            <Button type="primary" onClick={() => {
              if (mappingEditor.index == null) return
              const idx = mappingEditor.index
              const items = mappingEditor.items
              setFields(arr => arr.map((it, i) => i === idx ? { ...it, valueMap: items.map(x => ({ value: x.value, label: x.label })) } : it))
              setMappingEditor({ open: false, index: null, items: [], optionsByRow: {}, defaultOptions: [] })
            }}>保存</Button>
          </Space>}
          bodyStyle={{ padding: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: 8, fontWeight: 500, marginBottom: 8 }}>
            <div>原始值</div>
            <div>显示标签</div>
            <div></div>
          </div>
          {mappingEditor.items.map((row, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: 8, marginBottom: 8 }}>
              <AutoComplete
                value={row.value}
                options={mappingEditor.optionsByRow[ri] || mappingEditor.defaultOptions || []}
                onSearch={async (q) => {
                  // 行内远程搜索去重值
                  try {
                    if (!id || mappingEditor.index == null) return
                    const targetField = fields[mappingEditor.index]
                    if (!targetField) return
                    const { values } = await datasetApi.getDistinctValues(Number(id), {
                      field: { identifier: targetField.identifier, name: targetField.name, type: targetField.type },
                      limit: 20,
                      search: q
                    })
                    const opts = (values || []).map(v => ({ label: String(v.label ?? v.value ?? ''), value: String(v.value ?? v.label ?? '') }))
                    setMappingEditor(prev => ({ ...prev, optionsByRow: { ...prev.optionsByRow, [ri]: opts } }))
                  } catch {
                    setMappingEditor(prev => ({ ...prev, optionsByRow: { ...prev.optionsByRow, [ri]: [] } }))
                  }
                }}
                onChange={(v) => setMappingEditor(prev => ({ ...prev, items: prev.items.map((it, i) => i === ri ? { ...it, value: String(v) } : it) }))}
                onSelect={(v) => setMappingEditor(prev => ({ ...prev, items: prev.items.map((it, i) => i === ri ? { ...it, value: String(v) } : it) }))}
                onFocus={() => {
                  // 若该行暂无自定义候选，先使用默认候选
                  if (!mappingEditor.optionsByRow[ri] && mappingEditor.defaultOptions.length) {
                    setMappingEditor(prev => ({ ...prev, optionsByRow: { ...prev.optionsByRow, [ri]: prev.defaultOptions } }))
                  }
                }}
                placeholder="输入或搜索原始值"
                allowClear
                filterOption={false}
              />
              <Input placeholder="显示标签" value={row.label} onChange={e => setMappingEditor(prev => ({ ...prev, items: prev.items.map((it, i) => i === ri ? { ...it, label: e.target.value } : it) }))} />
              <Button danger onClick={() => setMappingEditor(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== ri), optionsByRow: {}, defaultOptions: prev.defaultOptions }))}>删除</Button>
            </div>
          ))}
          <Button type="dashed" block onClick={() => setMappingEditor(prev => ({ ...prev, items: [...prev.items, { value: '', label: '' }] }))}>+ 添加映射</Button>
          <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>提示：仅用于展示替换，不影响查询条件与底层数据。值按字符串比较；若需数值比较，请保持原值格式一致。</div>
        </Card>
      )}
      {/* 样本数据预览 */}
      <SampleDataModal open={previewOpen} dataset={previewDataset} onClose={() => setPreviewOpen(false)} />
    </div>
  )
}

export default EditDataset
