import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Input, Select, Switch, message } from 'antd'
import { CronPicker } from '@lumina/components'
import { notificationApi, subscriptionApi } from '@lumina/api'
import type { Subscription } from '@lumina/types'

export interface DashboardOption { label: string; value: string }

interface SubscriptionFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  dashboardId?: number | string
  record?: Subscription | null
  onClose: () => void
  onSuccess?: () => Promise<void> | void
  // 在订阅列表中使用时需要选择仪表盘
  showDashboardSelect?: boolean
  dashboardOptions?: DashboardOption[]
}

const SubscriptionFormModal: React.FC<SubscriptionFormModalProps> = ({
  open,
  mode,
  dashboardId,
  record,
  onClose,
  onSuccess,
  showDashboardSelect = false,
  dashboardOptions = []
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [notifyOptions, setNotifyOptions] = useState<Array<{ label: string, value: string }>>([])

  useEffect(() => {
    if (!open) return
    (async () => {
      try {
        const res = await notificationApi.list({ page: 1, pageSize: 200 })
        setNotifyOptions((res.list || []).map((n: { id: number, name: string }) => ({ label: n.name, value: String(n.id) })))
      } catch {}
    })()
  }, [open])

  useEffect(() => {
    if (!open) { form.resetFields(); return }
    const initial = {
      name: record?.name || '',
      dashboardId: record?.dashboardId ? String(record.dashboardId) : (dashboardId ? String(dashboardId) : undefined),
      notifyIds: record?.notifyIds || [],
      schedule: record?.config?.schedule || '* * * * *',
      format: record?.config?.format || 'image',
      enabled: record?.enabled ?? true,
      remark: record?.config?.remark || ''
    }
    form.setFieldsValue(initial)
  }, [open, record, dashboardId, form])

  const title = useMemo(() => (mode === 'edit' ? '编辑订阅' : '新建订阅'), [mode])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      if (mode === 'edit' && record) {
        await subscriptionApi.update(record.id, {
          name: values.name,
          notifyIds: (values.notifyIds || []).map(String),
          config: {
            schedule: values.schedule,
            format: values.format,
            remark: values.remark
          }
        })
        if (typeof values.enabled === 'boolean' && values.enabled !== record.enabled) {
          await subscriptionApi.toggleEnabled(record.id, !!values.enabled)
        }
        message.success('已保存')
      } else {
        const dashId = showDashboardSelect ? values.dashboardId : (dashboardId ? String(dashboardId) : undefined)
        if (!dashId) { message.error('请选择仪表盘'); return }
        const created = await subscriptionApi.create({
          name: values.name,
          dashboardId: String(dashId),
          notifyIds: (values.notifyIds || []).map(String),
          config: {
            schedule: values.schedule,
            format: values.format,
            remark: values.remark
          }
        })
        if (typeof values.enabled === 'boolean' && values.enabled === false) {
          try { await subscriptionApi.toggleEnabled(created.id, false) } catch {}
        }
        message.success('已创建')
      }
      if (onSuccess) await onSuccess()
      onClose()
    } catch (e) {
      // 校验失败或请求失败
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      okText={mode === 'edit' ? '保存' : '创建'}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="订阅名称" />
        </Form.Item>

        {showDashboardSelect && (
          <Form.Item name="dashboardId" label="仪表盘" rules={[{ required: true, message: '请选择仪表盘' }]}>
            <Select options={dashboardOptions} placeholder="选择仪表盘" />
          </Form.Item>
        )}

        <Form.Item name="notifyIds" label="通知方式" rules={[{ required: true, message: '请选择通知方式' }]}>
          <Select mode="multiple" options={notifyOptions} placeholder="选择一个或多个通知通道" />
        </Form.Item>

        <Form.Item name="schedule" label="订阅时间" rules={[{ required: true, message: '请选择或输入时间' }]}>
          <CronPicker />
        </Form.Item>

        <Form.Item name="format" label="订阅格式" rules={[{ required: true, message: '请选择格式' }]}>
          <Select
            options={[
              { label: '图片', value: 'image' },
              { label: 'PDF', value: 'pdf' },
              { label: '表格', value: 'table' },
              { label: 'Excel', value: 'excel' }
            ]}
          />
        </Form.Item>

        <Form.Item name="enabled" label="状态" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>

        <Form.Item name="remark" label="备注说明">
          <Input.TextArea rows={3} placeholder="用途说明" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default SubscriptionFormModal
