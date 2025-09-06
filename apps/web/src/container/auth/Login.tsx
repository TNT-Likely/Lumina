import React, { useState } from 'react'
import { Button, Card, Form, Input, Typography, message, Checkbox } from 'antd'
import { Link } from 'react-router-dom'
import { AuthApi } from '@lumina/api'
const { Title } = Typography

export default function Login () {
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { identifier: string; password: string; remember: boolean }) => {
    setLoading(true)
    try {
      await AuthApi.login(values.identifier, values.password, values.remember)
      message.success('登录成功')
      window.location.replace('/')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '登录失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fb' }}>
      <Card style={{ width: 360 }}>
        <Title level={4} style={{ textAlign: 'center' }}>登录 Lumina</Title>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ identifier: 'admin', password: 'admin123', remember: true }}>
          <Form.Item name="identifier" label="用户名或邮箱" rules={[{ required: true, message: '请输入' }]}>
            <Input autoFocus placeholder="admin 或 email" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="••••••" />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>记住我</Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>登录</Button>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>
              没有账号？<Link to="/register">去注册</Link>
            </span>
            <span>
              <Link to="/forgot-password">忘记密码</Link>
            </span>
          </div>
        </Form>
      </Card>
    </div>
  )
}
