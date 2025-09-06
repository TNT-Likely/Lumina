import React from 'react'
import { Result, Button } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { UserApi, ShareApi } from '@lumina/api'
import type { BaseComponent } from '../dashboardEditor/types/dashboard'
import { ViewComponent } from '../dashboardEditor/components/components/ViewComponent'

const ViewPreview: React.FC = () => {
  const [sp] = useSearchParams()
  const id = sp.get('id')
  const token = sp.get('token')
  if (!id) {
    return (
      <div style={{ width: '100vw', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7fb', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <Result status="404" title="缺少参数" subTitle="缺少必须的参数：id" extra={<Button type="primary" onClick={() => window.history.back()}>返回</Button>} />
        </div>
      </div>
    )
  }

  const component: BaseComponent = {
    id: 'preview-view',
    type: 'view',
    name: 'ViewPreview',
    layout: { x: 0, y: 0, w: 24, h: 18 },
    style: { backgroundColor: '#fff', borderRadius: 8 },
    config: {
      viewId: Number(id),
      showTitle: false,
      titlePosition: 'top',
      showBorder: false,
      showLoading: true,
      errorRetryCount: 0,
      filters: {},
      parameters: {}
    } as unknown as BaseComponent['config'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#f6f7fb', padding: '16px 0' }}>
      <div style={{ width: '100%', maxWidth: 1200, height: '70vh', minHeight: 360, margin: '0 auto', borderRadius: 8, padding: 16 }}>
        <ViewComponent
          component={component}
          mode="preview"
          selected={false}
          onUpdate={() => undefined}
          publicToken={(token as string) || null}
        />
      </div>
    </div>
  )
}

export default ViewPreview
