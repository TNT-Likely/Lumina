import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Input, Select, message } from 'antd'
import { datasourceApi } from '@lumina/api'
import type { Datasource } from '@lumina/types'

export interface QuickCreateDatasourceModalProps {
  open: boolean
  onClose: () => void
  // 提交成功回调：创建返回新ID，编辑返回原ID
  onSuccess?: (id: number) => void
  // 可选：编辑模式时传入初始数据（至少包含 id 与 type/config 用于回填）
  initial?: Partial<Datasource> | null
}

const engineOptions = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'ClickHouse', value: 'clickhouse' },
  { label: 'SQL Server', value: 'mssql' },
  { label: 'Oracle', value: 'oracle' },
  { label: 'MongoDB', value: 'mongodb' },
  { label: 'Elasticsearch', value: 'essearch' }
]

const QuickCreateDatasourceModal: React.FC<QuickCreateDatasourceModalProps> = ({ open, onClose, onSuccess, initial }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const type = Form.useWatch('type', form)

  const isEdit = useMemo(() => !!initial?.id, [initial])

  // 根据 initial 回填表单
  useEffect(() => {
    if (!open) return
    // 重置避免残留
    form.resetFields()
    if (initial && initial.id) {
      const rawType = String(initial.type || '').toLowerCase()
      // 从 config 推断常用字段
      const cfg = (initial.config || {}) as Record<string, unknown>
      const pick = (k: string): Record<string, unknown> | undefined => (cfg && typeof cfg === 'object' ? (cfg as Record<string, unknown>)[k] as Record<string, unknown> : undefined)
      type FormValues = { name?: string; type?: string; host?: string; port?: number; user?: string; password?: string; database?: string; uri?: string; index?: string }
      let values: Partial<FormValues> = {
        name: initial.name,
        type: rawType
      }
      if (rawType === 'mysql') {
        const c = (pick('mysql') || {}) as Record<string, unknown>
        values = { ...values, host: c.host as string, port: c.port as number, user: c.user as string, password: c.password as string, database: c.database as string }
      } else if (rawType === 'postgresql' || rawType === 'postgres') {
        const c = (pick('postgresql') || pick('postgres') || {}) as Record<string, unknown>
        values = { ...values, host: c.host as string, port: c.port as number, user: c.user as string, password: c.password as string, database: c.database as string }
      } else if (rawType === 'clickhouse') {
        const c = (pick('clickhouse') || {}) as Record<string, unknown>
        values = { ...values, host: c.host as string, port: c.port as number, user: c.user as string, password: c.password as string, database: c.database as string }
      } else if (rawType === 'mssql' || rawType === 'sqlserver') {
        const c = (pick('mssql') || pick('sqlserver') || {}) as Record<string, unknown>
        values = { ...values, host: (c.host as string) || (c.server as string), port: c.port as number, user: c.user as string, password: c.password as string, database: c.database as string }
      } else if (rawType === 'oracle') {
        const c = (pick('oracle') || {}) as Record<string, unknown>
        values = { ...values, user: c.user as string, password: c.password as string, host: c.connectString as string }
      } else if (rawType === 'mongodb') {
        const c = (pick('mongodb') || {}) as Record<string, unknown>
        values = { ...values, uri: c.uri as string, database: (c.dbName as string) || (c.database as string) }
      } else if (rawType === 'essearch' || rawType === 'elasticsearch' || rawType === 'es') {
        const c = (pick('essearch') || pick('elasticsearch') || pick('es') || {}) as Record<string, unknown>
        values = { ...values, uri: c.node as string, index: c.index as string, user: c.username as string, password: c.password as string }
        values.type = 'essearch'
      }
      form.setFieldsValue(values)
    }
  }, [open, initial, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const type = String(values.type || '').toLowerCase()
      const cfgKey = type
      let config: Record<string, unknown> = {}
      if (['mysql', 'postgresql', 'postgres', 'clickhouse', 'mssql'].includes(type)) {
        config = { [cfgKey]: { host: values.host, port: Number(values.port), user: values.user, password: values.password, database: values.database } }
      } else if (type === 'oracle') {
        config = { oracle: { user: values.user, connectString: values.host, password: values.password } }
      } else if (type === 'mongodb') {
        config = { mongodb: { uri: values.uri || values.host, dbName: values.database } }
      } else if (type === 'essearch' || type === 'elasticsearch' || type === 'es') {
        config = { essearch: { node: values.uri || values.host, index: values.index, username: values.user, password: values.password } }
      }
      if (isEdit && initial?.id) {
        const payload = { name: values.name as string, config }
        await datasourceApi.update(Number(initial.id), payload)
        message.success('数据源已更新')
        onSuccess?.(Number(initial.id))
        onClose()
        form.resetFields()
      } else {
        const payload = { name: values.name as string, type, config }
        const ds = await datasourceApi.create(payload)
        message.success('数据源创建成功')
        onSuccess?.(Number(ds.id))
        onClose()
        form.resetFields()
      }
    } catch (e) {
      if (e instanceof Error) console.error(e)
      message.error(isEdit ? '保存失败，请检查配置' : '创建失败，请检查配置')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onCancel={onClose} onOk={handleOk} confirmLoading={loading} width={720} title={isEdit ? '编辑数据源' : '快速创建数据源'} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="示例：生产库 / BI ClickHouse" />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
          <Select options={engineOptions} placeholder="选择引擎" showSearch optionFilterProp="label" disabled={isEdit} />
        </Form.Item>
        {/* SQL 系列 */}
        {(['mysql', 'postgresql', 'postgres', 'clickhouse', 'mssql'].includes(type)) && (<>
          <Form.Item name="host" label="主机" rules={[{ required: true, message: '请输入主机' }]}>
            <Input placeholder="127.0.0.1" />
          </Form.Item>
          <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
            <Input placeholder="3306" />
          </Form.Item>
          <Form.Item name="user" label="用户" rules={[{ required: true, message: '请输入用户' }]}>
            <Input placeholder="root" />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input.Password placeholder="••••••" />
          </Form.Item>
          <Form.Item name="database" label="数据库/Schema">
            <Input placeholder="可选，部分引擎必填" />
          </Form.Item>
        </>)}
        {/* Oracle */}
        {type === 'oracle' && (<>
          <Form.Item name="user" label="用户" rules={[{ required: true, message: '请输入用户' }]}>
            <Input placeholder="system" />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input.Password placeholder="••••••" />
          </Form.Item>
          <Form.Item name="host" label="连接串" rules={[{ required: true, message: '请输入连接串' }]}>
            <Input placeholder="host:port/serviceName" />
          </Form.Item>
        </>)}
        {/* MongoDB */}
        {type === 'mongodb' && (<>
          <Form.Item name="uri" label="连接 URI" rules={[{ required: true, message: '请输入连接 URI' }]}>
            <Input placeholder="mongodb://user:pass@host:port" />
          </Form.Item>
          <Form.Item name="database" label="数据库" rules={[{ required: true, message: '请输入数据库' }]}>
            <Input placeholder="dbName" />
          </Form.Item>
        </>)}
        {/* Elasticsearch */}
        {(type === 'essearch' || type === 'elasticsearch' || type === 'es') && (<>
          <Form.Item name="uri" label="节点地址" rules={[{ required: true, message: '请输入节点地址' }]}>
            <Input placeholder="http://127.0.0.1:9200" />
          </Form.Item>
          <Form.Item name="index" label="默认索引" rules={[{ required: true, message: '请输入默认索引' }]}>
            <Input placeholder="index-name" />
          </Form.Item>
          <Form.Item name="user" label="用户名">
            <Input placeholder="elastic" />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input.Password placeholder="••••••" />
          </Form.Item>
        </>)}
      </Form>
    </Modal>
  )
}

export default QuickCreateDatasourceModal
