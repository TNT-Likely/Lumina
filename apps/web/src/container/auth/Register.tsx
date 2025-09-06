import React, { useState } from 'react'
import { Button, Card, Form, Input, Typography, message, Result } from 'antd'
import { AuthApi } from '@lumina/api'
import { Link } from 'react-router-dom'
const { Title } = Typography

export default function Register () {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ email: string } | null>(null)

  const onFinish = async (values: { email: string; username: string; password: string }) => {
    setLoading(true)
    try {
      await AuthApi.register(values)
      message.success('注册成功，请前往邮箱完成验证')
      setDone({ email: values.email })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '注册失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fb' }}>
      <Card style={{ width: 520, padding: 8 }}>
        {done && (
          <Result
            status="success"
            title="注册成功"
            subTitle={
              <div>
                我们已向 {done.email} 发送了一封验证邮件，请在 24 小时内完成验证后再登录。
                <div style={{ color: '#999', marginTop: 8 }}>
                  如果未收到，请检查垃圾邮箱或稍后再试。
                </div>
              </div>
            }
            extra={<Link to="/login">返回登录</Link>}
          />
        )}
        {!done && (
          <>
            <Title level={4} style={{ textAlign: 'center' }}>注册账号</Title>
            <Form layout="vertical" onFinish={onFinish}>
              <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                <Input placeholder="you@example.com" />
              </Form.Item>
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少 3 个字符' }]}>
                <Input placeholder="用户名" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少 6 位' }]}>
                <Input.Password placeholder="••••••" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>注册</Button>
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                已有账号？<Link to="/login">去登录</Link>
              </div>
            </Form>
          </>
        )}
      </Card>
    </div>
  )
}
