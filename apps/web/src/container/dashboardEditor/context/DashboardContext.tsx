// ===========================================
// DashboardContext 上下文
// ===========================================

// DashboardEditor/context/DashboardContext.tsx

import React, { createContext, useContext } from 'react'
import { useDashboardEditor } from '../hooks/useDashboardEditor'
import type { Dashboard, BaseComponent, DashboardSettings } from '../types/dashboard'

type DashboardEditorContextType = ReturnType<typeof useDashboardEditor>

interface DashboardContextProps {
  dashboardId?: string
  children: React.ReactNode
}

const DashboardContext = createContext<DashboardEditorContextType | null>(null)

export const DashboardProvider: React.FC<DashboardContextProps> = (props) => {
  const { dashboardId, children } = props
  const editorState = useDashboardEditor(dashboardId)
  return (
    <DashboardContext.Provider value={editorState}>
      {children}
    </DashboardContext.Provider>
  )
}

export const useDashboardContext = () => {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboardContext must be used within DashboardProvider')
  }
  return context
}
