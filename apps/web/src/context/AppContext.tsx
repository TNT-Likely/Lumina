import React, { createContext, useContext } from 'react'

export type OrgRole = 'ADMIN' | 'EDITOR' | 'VIEWER'

export interface AppOrg {
  id: number
  name: string
  role: OrgRole | string
}

export interface AppProfile {
  id?: number
  displayName?: string
  avatar?: string
  username?: string
  email?: string
}

export interface AppContextValue {
  userId: number | null
  profile: AppProfile | null
  orgs: AppOrg[]
  currentOrg: AppOrg | null
  switchOrg: (orgId: number) => void
  refresh?: () => Promise<void>
}

const defaultCtx: AppContextValue = {
  userId: null,
  profile: null,
  orgs: [],
  currentOrg: null,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  switchOrg: () => {}
}

export const AppContext = createContext<AppContextValue>(defaultCtx)

export const useAppContext = () => useContext(AppContext)
