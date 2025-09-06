import React, { useEffect, useMemo } from 'react'
import { Modal, Form, Radio, message, Alert, Typography } from 'antd'

export type Visibility = 'private' | 'org' | 'public'

export interface PermissionTarget {
  id: number
  name: string
  ownerId?: number | null
  visibility?: Visibility | null
}

export interface PermissionDrawerProps<T extends PermissionTarget> {
  open: boolean
  title?: string
  loading?: boolean
  target?: T | null
  currentUserId?: number | null
  orgMembers?: Array<{ label: string, value: number }>
  onClose: () => void
  onSubmit: (patch: { visibility?: Visibility, ownerId?: number }) => Promise<void> | void
}

const PermissionDrawer = <T extends PermissionTarget>({ open, title = '权限设置', loading, target, currentUserId, orgMembers = [], onClose, onSubmit }: PermissionDrawerProps<T>) => {
  const [form] = Form.useForm<{ visibility: Visibility; ownerId?: number }>()

  const initialValues = useMemo(() => ({
    visibility: (target?.visibility || 'private') as Visibility,
    ownerId: target?.ownerId || currentUserId || undefined
  }), [target?.visibility, target?.ownerId, currentUserId])

  const visibility = Form.useWatch('visibility', form)

  // 打开时重置初始值，避免多次打开后状态残留
  useEffect(() => {
    if (open) {
      form.setFieldsValue(initialValues)
    }
  }, [open, target?.id, initialValues, form])

  return (
    <Modal open={open} title={title} onCancel={onClose} onOk={() => form.submit()} confirmLoading={loading} okText="保存" cancelText="取消" destroyOnClose>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={async (values) => {
          try {
            // 所有者只读展示，提交时忽略 ownerId 更改
            await onSubmit({ visibility: values.visibility })
            message.success('权限已更新')
            onClose()
          } catch (e) {
            message.error((e as Error)?.message || '更新失败')
          }
        }}
      >
        <Form.Item label="可见性" name="visibility">
          <Radio.Group>
            <Radio.Button value="private">仅自己</Radio.Button>
            <Radio.Button value="org">组织内</Radio.Button>
            <Radio.Button value="public">公开</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {visibility !== 'private' && (
          <Alert
            type="info"
            showIcon
            message={
              visibility === 'org'
                ? '设置为组织内：组织成员可见。注意：不会自动提升依赖资源可见性；仅在持有分享令牌的预览场景下，对依赖资源进行只读穿透访问。'
                : '设置为公开：任何人可访问（仅读）。注意：不会自动提升依赖资源可见性；仅在持有分享令牌的预览场景下，对依赖资源进行只读穿透访问。'
            }
            style={{ marginBottom: 8 }}
          />
        )}
        <Form.Item label="所有者">
          <Typography.Text>{target?.ownerId ? `用户 #${target.ownerId}` : '—'}</Typography.Text>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default PermissionDrawer
