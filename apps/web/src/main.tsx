import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, message } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { ProConfigProvider } from '@ant-design/pro-components'
import themeConfig from './config/antd'
import App from './App'
import './index.less'
import { initApiClient, setDefaultErrorHandler, AuthApi, OrgApi, setupOrgInterceptors, setSelectedOrgId, getSelectedOrgId } from '@lumina/api'

initApiClient({
  baseURL: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:7001',
  timeout: 30000
})

// 安装组织拦截器，统一注入 X-Org-Id
setupOrgInterceptors()
// 默认组织（如未选择），设为 1
try { if (!getSelectedOrgId()) setSelectedOrgId('1') } catch {}

// 注入鉴权拦截器
AuthApi.setupAuthInterceptors()

// 启动鉴权生命周期：内存 token + 主动续期 + 多标签页协同
AuthApi.startAuthLifecycle()

// 设置全局错误处理
setDefaultErrorHandler((error) => {
  console.error('API请求出错:', error)
  message.error(error?.message || '请求失败')
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')
ReactDOM.createRoot(rootEl).render(
  <BrowserRouter>
    <ProConfigProvider dark={false} hashed={false} token={themeConfig.token} prefixCls="ant-pro">
      <ConfigProvider theme={themeConfig}>
        <App />
      </ConfigProvider>
    </ProConfigProvider>
  </BrowserRouter>
)
