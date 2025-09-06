import React, { useEffect, useState } from 'react'
import { Card, Result, Spin } from 'antd'
import { useSearchParams, Link } from 'react-router-dom'
import { AuthApi } from '@lumina/api'

export default function VerifyEmail () {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const token = params.get('token') || ''

  useEffect(() => {
    const run = async () => {
      try {
        if (!token) throw new Error('missing token')
        await AuthApi.verifyEmail(token)
        setStatus('ok')
      } catch {
        setStatus('error')
      }
    }
    run()
  }, [token])

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 480 }}>
        {status === 'ok'
          ? (
            <Result status="success" title="邮箱验证成功" subTitle="现在可以使用账号登录" extra={<Link to="/login">去登录</Link>} />
          )
          : (
            <Result status="error" title="验证失败或链接已过期" extra={<Link to="/login">返回登录</Link>} />
          )}
      </Card>
    </div>
  )
}
