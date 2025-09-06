import React, { useEffect, useState } from 'react'
import { Result, Button, Spin } from 'antd'
import { useSearchParams, Link } from 'react-router-dom'
import { OrgApi } from '@lumina/api'

export default function AcceptInvite () {
  const [search] = useSearchParams()
  const token = search.get('token')
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    (async () => {
      if (!token) { setStatus('error'); setMessage('缺少 token'); return }
      try {
        await OrgApi.acceptInvite(token)
        setStatus('success')
      } catch (e) {
        setStatus('error')
        setMessage((e as Error)?.message || '接受失败')
      }
    })()
  }, [token])

  if (status === 'loading') {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin tip="正在接受邀请..." /></div>
  }
  if (status === 'success') {
    return (
      <Result
        status="success"
        title="已接受邀请"
        subTitle="您已加入组织，可前往首页开始使用。"
        extra={<Button type="primary"><Link to="/">返回首页</Link></Button>}
      />
    )
  }
  return (
    <Result
      status="error"
      title="接受邀请失败"
      subTitle={message}
      extra={<Button type="primary"><Link to="/login">去登录</Link></Button>}
    />
  )
}
