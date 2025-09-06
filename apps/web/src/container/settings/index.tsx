import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message, Space } from 'antd'
import { UserApi, UploadApi, type UserProfileDTO } from '@lumina/api'
import { UploadAvatar } from '@lumina/components'
import { useAppContext } from '../../context/AppContext'

export default function Settings () {
  const [loading, setLoading] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [form] = Form.useForm<{ displayName?: string, avatarUrl?: string }>()
  const { profile, refresh } = useAppContext()

  // 载入当前用户资料，填充表单
  useEffect(() => {
    let mounted = true
    type ProfileLike = Pick<UserProfileDTO, 'displayName'> & { avatar?: string | null; avatarUrl?: string | null }
    const fill = (p: ProfileLike | null) => {
      if (!mounted || !p) return
      form.setFieldsValue({
        displayName: p.displayName || '',
        avatarUrl: p.avatar ?? p.avatarUrl ?? undefined
      })
    }
    if (profile) {
      const p = profile as unknown as ProfileLike
      fill(p)
    } else {
      (async () => {
        try {
          const fetched = await UserApi.profile().catch(() => null)
          fill(fetched as unknown as ProfileLike | null)
        } catch {}
      })()
    }
    return () => { mounted = false }
  }, [profile])

  const onSaveProfile = async (values: { displayName?: string, avatarUrl?: string }) => {
    setLoading(true)
    try {
      await UserApi.updateProfile(values)
      message.success('资料已更新')
      await (refresh?.())
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新失败'
      message.error(msg)
    } finally { setLoading(false) }
  }

  const onChangePassword = async (values: { oldPassword: string, newPassword: string, confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }
    setPwdLoading(true)
    try {
      await UserApi.changePassword(values.oldPassword, values.newPassword)
      message.success('密码已更新')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新失败'
      message.error(msg)
    } finally { setPwdLoading(false) }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="个人资料">
        <Form form={form} layout="vertical" onFinish={onSaveProfile}>
          <Form.Item label="显示名称" name="displayName">
            <Input placeholder="如：张三" allowClear />
          </Form.Item>
          <Form.Item label="头像" name="avatarUrl" valuePropName="value">
            <UploadAvatar
              uploader={async (file) => {
                const res = await UploadApi.upload(file, { category: 'avatar' })
                return res.url
              }}
              onChange={(url) => form.setFieldsValue({ avatarUrl: url || undefined })}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="修改密码">
        <Form layout="vertical" onFinish={onChangePassword}>
          <Form.Item label="当前密码" name="oldPassword" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item label="新密码" name="newPassword" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少 6 位' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item label="确认新密码" name="confirmPassword" dependencies={['newPassword']} rules={[{ required: true, message: '请再次输入新密码' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item shouldUpdate>
            {() => <Button type="primary" htmlType="submit" loading={pwdLoading}>更新密码</Button>}
          </Form.Item>
        </Form>
      </Card>
    </Space>
  )
}
