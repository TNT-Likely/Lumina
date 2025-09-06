import React, { useEffect, lazy, Suspense, useState } from 'react'
import { Spin, Select, Tooltip } from 'antd'
import { Link, Outlet, Routes, Route, useLocation } from 'react-router-dom'
import {
  Layout,
  Menu,
  Dropdown,
  Avatar,
  Space,
  Typography,
  theme,
  type MenuProps
} from 'antd'
import {
  AlertOutlined,
  BookOutlined,
  DatabaseOutlined,
  HddOutlined,
  DashboardOutlined,
  ShareAltOutlined,
  BugOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons'
import NoFoundPage from './components/404'
import './App.less'
import { OrgApi, UserApi } from '@lumina/api'
import AppLayout from './layouts/AppLayout'

const { Header, Content } = Layout
const { Text } = Typography

// 懒加载组件
const Home = lazy(async () => await import('./container/home'))
const Guide = lazy(async () => await import('./container/guide'))
const Dashboard = lazy(async () => await import('./container/dashboard/index'))
const SubscriptionList = lazy(async () => await import('./container/subscription/list'))
const DataSourceList = lazy(async () => await import('./container/datasource/list'))
const DatasetList = lazy(async () => await import('./container/dataset/list'))
const DatasetEdit = lazy(async () => await import('./container/dataset/edit'))

const DashboardList = lazy(async () => await import('./container/dashboard/list'))
const DashboardPreview = lazy(async () => await import('./container/dashboard/preview'))
const AcceptInvite = lazy(async () => await import('./container/invite/Accept'))
const ChartBuilder = lazy(async () => await import('./container/chartBuilder/index'))
const ViewList = lazy(async () => await import('./container/views/list'))
const ViewPreview = lazy(async () => await import('./container/views/preview'))
const NotificationList = lazy(async () => await import('./container/notify/list'))
const TestPage = lazy(async () => await import('./container/test'))
const Login = lazy(async () => await import('./container/auth/Login'))
const Register = lazy(async () => await import('./container/auth/Register'))
const VerifyEmail = lazy(async () => await import('./container/auth/VerifyEmail'))
const ForgotPassword = lazy(async () => await import('./container/auth/ForgotPassword'))
const ResetPassword = lazy(async () => await import('./container/auth/ResetPassword'))
const AdminOrgList = lazy(async () => await import('./container/admin/OrgList'))
const AdminOrgMembers = lazy(async () => await import('./container/admin/OrgMembers'))
const Settings = lazy(async () => await import('./container/settings'))

function App () {
  // simple route guard: redirect to /login if no token
  useEffect(() => {
    const publicPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/dashboard/preview', '/view/preview', '/invite/accept']
    const hasToken = !!localStorage.getItem('lumina.accessToken')
    const shouldProtect = !publicPaths.includes(window.location.pathname)
    if (shouldProtect && !hasToken) {
      window.history.replaceState(null, '', '/login')
    }
  }, [])
  return (
    <Suspense
      fallback={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'rgba(255,255,255,0.9)',
          zIndex: 9999
        }}>
          <Spin size="large" tip="页面加载中..." style={{ color: '#1677ff' }} />
        </div>
      }
    >
      <Routes>
        {/* 独立预览页：不使用默认布局，无 Header/侧栏等 */}
        <Route path="/dashboard/preview" element={<DashboardPreview />} />
        {/* 视图预览：公开只读 */}
        <Route path="/view/preview" element={<Suspense fallback={null}><ViewPreview /></Suspense>} />
        <Route path="/invite/accept" element={<AcceptInvite />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="dashboard/:id" element={<Dashboard />} />
          <Route path="dashboard/list" element={<DashboardList />} />
          <Route path="notification/list" element={<NotificationList />} />
          <Route path="subscription/list" element={<Suspense fallback={null}><SubscriptionList /></Suspense>} />
          <Route path="dataSource/list" element={<Suspense fallback={null}><DataSourceList /></Suspense>} />
          <Route path="dataset/list" element={<Suspense fallback={null}><DatasetList /></Suspense>} />
          <Route path="dataset/edit" element={<Suspense fallback={null}><DatasetEdit /></Suspense>} />
          <Route path="chartBuilder" element={<Suspense fallback={null}><ChartBuilder /></Suspense>} />
          <Route path="view/list" element={<Suspense fallback={null}><ViewList /></Suspense>} />
          <Route path="admin/orgs" element={<Suspense fallback={null}><AdminOrgList /></Suspense>} />
          <Route path="admin/orgs/:orgId/members" element={<Suspense fallback={null}><AdminOrgMembers /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={null}><Settings /></Suspense>} />
          <Route path="test" element={<Suspense fallback={null}><TestPage /></Suspense>} />
          <Route path="*" element={<NoFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
export default App
