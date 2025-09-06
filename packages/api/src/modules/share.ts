import { post } from '..'

export const shareApi = {
  signDashboard: async ( dashboardId: number, payload: { expiresIn?: string | number, orgScope?: boolean } ) => {
    return await post<{ token: string, url: string }>( '/api/share/dashboard/sign', { dashboardId, ...payload } )
  },
  signView: async ( viewId: number, payload: { expiresIn?: string | number, orgScope?: boolean } ) => {
    return await post<{ token: string, url: string }>( '/api/share/view/sign', { viewId, ...payload } )
  }
}
