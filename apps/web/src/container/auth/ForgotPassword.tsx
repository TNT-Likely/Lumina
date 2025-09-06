import React, { useState } from 'react'
import { Card, Form, Input, Button, Result } from 'antd'
import { AuthApi } from '@lumina/api'

export default function ForgotPassword () {
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const onFinish = async (values: { email: string }) => {
    setLoading(true)
    try {
      await AuthApi.forgotPassword(values.email)
      setDone(true)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 420 }}>
        {done
          ? (
            <Result status="success" title="邮件已发送（如存在该邮箱账号）" subTitle="请查收邮件并按指引重置密码" />
          )
          : (
            <Form layout="vertical" onFinish={onFinish}>
              <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email' }]}>
                <Input placeholder="your@email.com" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>发送重置邮件</Button>
            </Form>
          )}
      </Card>
    </div>
  )
}
