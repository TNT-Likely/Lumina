import React, { useMemo, useState } from 'react'
import { Modal, Form, DatePicker, Radio, Input, Button, Space, message, Typography } from 'antd'
import dayjs from 'dayjs'
import { post } from '@lumina/api'

const { Text } = Typography

export default function ShareModal ({ open, onClose, dashboardId, visibility }: { open: boolean, onClose: () => void, dashboardId: number, visibility?: 'private' | 'org' | 'public' }) {
  const [form] = Form.useForm<{ expiry: 'never' | 'custom', date?: dayjs.Dayjs, scope: 'public' | 'org' }>()
  const [url, setUrl] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const canCopy = !!url
  const expiry = Form.useWatch('expiry', form)
  const scope = Form.useWatch('scope', form)
  const isPublic = visibility === 'public'

  const help = useMemo(() => scope === 'public' ? '公开资源无需签名，任何人可访问' : '组织范围：仅持有 token 且带 orgId 的链接可访问', [scope])

  const onGenerate = async () => {
    setGenerating(true)
    try {
      const v = await form.validateFields()
      if (v.scope === 'public') {
        // 公开资源的直链（仅 visibility=public 时有效）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const base = (import.meta as any)?.env?.VITE_WEB_URL ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).WEB_URL || window.location.origin
        setUrl(`${String(base).replace(/\/$/, '')}/dashboard/preview?id=${dashboardId}`)
      } else {
        let expiresIn: string | number | undefined
        if (v.expiry === 'custom' && v.date) {
          const secs = Math.max(60, Math.floor((v.date.valueOf() - Date.now()) / 1000))
          expiresIn = secs
        } else if (v.expiry === 'never') {
          // 特殊标记，后端视为永久有效
          expiresIn = 'never' as unknown as number
        }
        const res = await post<{ token: string, url: string }>('/api/share/dashboard/sign', { dashboardId, expiresIn, orgScope: true })
        setUrl(res.url)
      }
    } catch (e) {
      message.error((e as Error)?.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const onCopy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    message.success('已复制')
  }

  return (
    <Modal title="分享仪表盘" open={open} onCancel={onClose} onOk={onGenerate} confirmLoading={generating} okText={generating ? '生成中…' : '生成链接'}>
      <Form form={form} layout="vertical" initialValues={{ expiry: 'custom', scope: 'org' }}>
        <Form.Item label="分享范围" name="scope">
          <Radio.Group options={isPublic
            ? [
              { label: '公开（仅public资源）', value: 'public' },
              { label: '签名（支持有效期与org范围）', value: 'org' }
            ]
            : [
              { label: '签名（支持有效期与org范围）', value: 'org' }
            ]
          } />
        </Form.Item>
        {scope !== 'public' && (
          <>
            <Form.Item label="有效期" name="expiry" tooltip={help}>
              <Radio.Group options={[{ label: '指定时间', value: 'custom' }, { label: '永久', value: 'never' }]} />
            </Form.Item>
            {expiry === 'custom' && (
              <Form.Item label="过期时间" name="date" rules={[{ required: true, message: '请选择过期时间' }]}>
                <DatePicker showTime disabledDate={(d) => d && d.isBefore(dayjs().add(1, 'minute'))} style={{ width: '100%' }} />
              </Form.Item>
            )}
          </>
        )}
        <Form.Item label="分享链接">
          <Space.Compact style={{ width: '100%' }}>
            <Input value={url} readOnly placeholder={generating ? '生成中…' : '生成后显示'} />
            <Button disabled={!canCopy} loading={generating} onClick={onCopy}>复制</Button>
          </Space.Compact>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            {scope === 'public' ? '仅当仪表盘可见性为公开时可访问' : '签名链接可用于访问私有/组织范围仪表盘'}
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  )
}
