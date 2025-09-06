import React, { useState } from 'react'
import { Card, Form, Input, Button, Result, message } from 'antd'
import { useSearchParams, Link } from 'react-router-dom'
import { AuthApi } from '@lumina/api'

export default function ResetPassword () {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const onFinish = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      message.error('两次输入不一致')
      return
    }
    if (!token) {
      message.error('链接无效')
      return
    }
    setLoading(true)
    try {
      await AuthApi.resetPassword(token, values.password)
      setDone(true)
    } catch (e) {
      message.error('重置失败或链接过期')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 420 }}>
        {done
          ? (
            <Result status="success" title="密码已重置" extra={<Link to="/login">去登录</Link>} />
          )
          : (
            <Form layout="vertical" onFinish={onFinish}>
              <Form.Item label="新密码" name="password" rules={[{ required: true, min: 6 }]}>
                <Input.Password placeholder="至少 6 位" />
              </Form.Item>
              <Form.Item label="确认新密码" name="confirm" dependencies={['password']} rules={[{ required: true }]}>
                <Input.Password placeholder="再次输入" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>重置密码</Button>
            </Form>
          )}
      </Card>
    </div>
  )
}
