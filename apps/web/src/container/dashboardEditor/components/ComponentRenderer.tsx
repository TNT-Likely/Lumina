import React from 'react'
import { TextComponent } from './components/TextComponent'
import { ViewComponent, type ViewComponentHandle } from './components/ViewComponent'
import type { BaseComponent } from '../types/dashboard'

interface ComponentRendererProps {
  component: BaseComponent
  mode: 'edit' | 'preview'
  selected: boolean
  onUpdate: (updates: Partial<BaseComponent>) => void
  onSelect?: (event: React.MouseEvent) => void
  componentRef?: React.Ref<ViewComponentHandle>
  externalFilters?: Record<string, unknown>
  onPointClick?: (args: { componentId: string, dimensionValues: Record<string, string | number> }) => void
  onConfigReady?: (args: { componentId: string, dimensions: Array<{ identifier: string, name: string }>, metrics: Array<{ identifier: string, name: string }>, filters?: Array<{ field: { identifier: string, name: string }, operator: string, values: Array<string | number | boolean | null> }> }) => void
  // 公开预览：透传 dashboard 级 token 给视图组件
  publicToken?: string | null
}

export const ComponentRenderer: React.FC<ComponentRendererProps> = ({
  component,
  mode,
  selected,
  onUpdate,
  onSelect,
  componentRef
  , externalFilters
  , onPointClick
  , onConfigReady
  , publicToken
}) => {
  const commonProps = {
    component,
    mode,
    selected,
    onUpdate
  }

  // 组件容器样式
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'inherit',
    position: 'relative'
  }

  const renderComponent = () => {
    switch (component.type) {
    case 'text':
      return <TextComponent {...commonProps} />
    case 'view':
      return (
        <ViewComponent
          {...commonProps}
          ref={componentRef}
          externalFilters={externalFilters}
          onPointClick={onPointClick}
          onConfigReady={onConfigReady}
          publicToken={publicToken}
        />
      )
    default:
      return (
        <div style={{
          padding: 16,
          textAlign: 'center',
          color: '#999',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          height: '100%'
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>❓</div>
          <div>未知组件类型</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{component.type}</div>
        </div>
      )
    }
  }

  return (
    <div
      style={containerStyle}
      className={`component-renderer component-${component.type}`}
    >
      {renderComponent()}
    </div>
  )
}
