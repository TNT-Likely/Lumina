import { get, getApiClient, post } from '../index'

const TOKEN_KEY = 'lumina.accessToken'
const RT_KEY = 'lumina.refreshToken'

// 内存中的 accessToken，优先于 localStorage，降低被窃取风险
let memoryAccessToken: string | null = null
// 多标签页通信
let bc: BroadcastChannel | null = null
// 主动续期计时器
let refreshTimer: number | null = null

// 解析 JWT 过期时间（秒）
function getJwtExp ( token?: string | null ): number | null {
  if ( !token ) return null
  try {
    const [, payload] = token.split( '.' )
    if ( !payload ) return null
    if ( typeof atob !== 'function' ) return null
    const json = JSON.parse(
      atob( payload.replace( /-/g, '+' ).replace( /_/g, '/' ) )
    )
    const exp = Number( json.exp )
    return Number.isFinite( exp ) ? exp : null
  } catch { return null }
}

export function getAccessToken (): string | null {
  try {
    // 先读内存，退化到 localStorage（兼容刷新）
    if ( memoryAccessToken ) return memoryAccessToken
    const ls = localStorage.getItem( TOKEN_KEY )
    memoryAccessToken = ls
    return ls
  } catch { return null }
}

export function setAccessToken ( token: string | null ): void {
  try {
    memoryAccessToken = token || null
    if ( token ) localStorage.setItem( TOKEN_KEY, token )
    else localStorage.removeItem( TOKEN_KEY )
    // token 变化时重新调度主动续期
    scheduleProactiveRefresh( token )
    // 广播新 token（跨标签页同步）
    try { bc?.postMessage( { type: 'accessToken', token } ) } catch {}
  } catch {}
}

export function getRefreshToken (): string | null {
  try { return localStorage.getItem( RT_KEY ) } catch { return null }
}

export function setRefreshToken ( token: string | null ): void {
  try {
    if ( token ) localStorage.setItem( RT_KEY, token )
    else localStorage.removeItem( RT_KEY )
  } catch {}
}

function scheduleProactiveRefresh ( accessToken?: string | null, skewSeconds = 120 ): void {
  // 清理旧计时器
  if ( refreshTimer !== null ) {
    try { clearTimeout( refreshTimer ) } catch {}
    refreshTimer = null
  }
  const token = accessToken ?? getAccessToken()
  const exp = getJwtExp( token )
  if ( !exp ) return
  const nowSec = Math.floor( Date.now() / 1000 )
  const targetSec = Math.max( nowSec + 1, exp - Math.max( 0, skewSeconds ) )
  const delayMs = Math.max( 0, ( targetSec - nowSec ) * 1000 )

  // 仅在浏览器中运行
  if ( typeof window === 'undefined' ) return

  const run = async () => {
    // 仅在在线 & 页可见时刷新，降低无效请求
    const isOnline = typeof navigator !== 'undefined' ? ( navigator.onLine !== false ) : true
    const isVisible = typeof document !== 'undefined' ? ( document.visibilityState === 'visible' ) : true
    if ( !isOnline || !isVisible ) {
      // 延后到下次状态合适时
      refreshTimer = window.setTimeout( run, 30_000 )
      return
    }
    try {
      // 广播刷新开始，其他标签页可选择等待
      try { bc?.postMessage( { type: 'refresh-start' } ) } catch {}
      const rt = getRefreshToken() || undefined
      const data = await refreshAccessToken( rt )
      // 刷新成功会在 refreshAccessToken 内部 setAccessToken，从而触发重新调度
      try { bc?.postMessage( { type: 'refresh-done', token: data?.accessToken } ) } catch {}
    } catch {
      try { bc?.postMessage( { type: 'refresh-failed' } ) } catch {}
      // 失败则过一段时间再尝试一次，避免打扰
      refreshTimer = window.setTimeout( () => scheduleProactiveRefresh( getAccessToken() ), 60_000 )
    }
  }

  refreshTimer = window.setTimeout( run, delayMs )

  // 当标签页重新可见或网络恢复时，尝试提前触发
  const onResume = () => {
    const leftMs = targetSec * 1000 - Date.now()
    if ( leftMs <= skewSeconds * 1000 ) {
      // 即将过期，立即刷新
      if ( refreshTimer !== null ) { try { clearTimeout( refreshTimer ) } catch {} }
      refreshTimer = window.setTimeout( run, 0 )
    }
  }
  try { window.addEventListener( 'online', onResume ) } catch {}
  try { document.addEventListener( 'visibilitychange', onResume ) } catch {}
}

export function setupAuthInterceptors (): void {
  const inst = getApiClient().getInstance()
  // 初始化广播通道，仅在浏览器存在
  if ( typeof window !== 'undefined' && !bc ) {
    try {
      bc = new BroadcastChannel( 'lumina-auth' )
      bc.onmessage = ( ev ) => {
        const msg = ev?.data as { type?: string, token?: string | null }
        if ( !msg || typeof msg !== 'object' ) return
        if ( msg.type === 'accessToken' ) {
          if ( typeof msg.token === 'string' || msg.token === null ) {
            // 被动同步 accessToken（不再次广播）
            try { memoryAccessToken = msg.token } catch {}
            try {
              if ( msg.token ) localStorage.setItem( TOKEN_KEY, msg.token )
              else localStorage.removeItem( TOKEN_KEY )
            } catch {}
            scheduleProactiveRefresh( msg.token ?? null )
          }
        } else if ( msg.type === 'logout' ) {
          memoryAccessToken = null
          try { localStorage.removeItem( TOKEN_KEY ) } catch {}
          try { localStorage.removeItem( RT_KEY ) } catch {}
        }
      }
    } catch { /* ignore BroadcastChannel errors */ }
  }
  inst.interceptors.request.use( cfg => {
    const t = getAccessToken()
    if ( t ) {
      cfg.headers = cfg.headers || {}
      cfg.headers.Authorization = `Bearer ${t}`
    }
    return cfg
  } )

  let isRefreshing = false
  let queue: Array<( token: string | null ) => void> = []

  inst.interceptors.response.use( undefined, async ( error ) => {
    const { response, config } = error || {}
    const originalRequest = config || {}
    if ( response && response.status === 401 && !originalRequest._retry ) {
      // 在预览页或公共端点上，避免触发登录重定向，保持静默失败以便走公开接口
      try {
        const url: string | undefined = ( originalRequest && originalRequest.url ) || undefined
        const onPreview = typeof window !== 'undefined' && window.location.pathname.includes( '/dashboard/preview' )
        const isPublicApi = typeof url === 'string' && url.includes( '/api/public/' )
        if ( onPreview || isPublicApi ) {
          return Promise.reject( error )
        }
      } catch { /* ignore guard errors */ }
      originalRequest._retry = true
      if ( isRefreshing ) {
        return new Promise( ( resolve ) => {
          queue.push( ( token ) => {
            if ( token ) originalRequest.headers = { ...( originalRequest.headers || {} ), Authorization: `Bearer ${token}` }
            resolve( inst.request( originalRequest ) )
          } )
        } )
      }
      isRefreshing = true
      try {
        const rt = getRefreshToken()
        const data = await refreshAccessToken( rt || undefined )
        const newToken = data.accessToken
        setAccessToken( newToken )
        try { bc?.postMessage( { type: 'accessToken', token: newToken } ) } catch {}
        // 重放队列
        queue.forEach( fn => fn( newToken ) )
        queue = []
        // 重试当前请求
        originalRequest.headers = { ...( originalRequest.headers || {} ), Authorization: `Bearer ${newToken}` }
        return inst.request( originalRequest )
      } catch ( e ) {
        // 刷新失败，清理并跳转登录
        setAccessToken( null )
        setRefreshToken( null )
        try { bc?.postMessage( { type: 'logout' } ) } catch {}
        queue.forEach( fn => fn( null ) )
        queue = []
        // 避免在预览页/公共端点自动跳转到登录
        const onPreview = typeof window !== 'undefined' && window.location.pathname.includes( '/dashboard/preview' )
        if ( typeof window !== 'undefined' && !onPreview ) window.location.replace( '/login' )
        return Promise.reject( e )
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject( error )
  } )
}

export async function login ( identifier: string, password: string, remember?: boolean ) {
  const data = await post<{ accessToken: string, refreshToken?: string, user: { id: number, username: string, email: string } }>( '/api/auth/login', { identifier, password } )
  setAccessToken( data.accessToken )
  // 仅当勾选“记住我”时才持久化 refreshToken；否则保持在内存中仅用 accessToken，退出浏览器即失效
  if ( remember && data.refreshToken ) setRefreshToken( data.refreshToken )
  try { bc?.postMessage( { type: 'accessToken', token: data.accessToken } ) } catch {}
  return data
}

export async function refreshAccessToken ( refreshToken?: string ) {
  const data = await post<{ accessToken: string }>( '/api/auth/refresh', refreshToken ? { refreshToken } : undefined )
  setAccessToken( data.accessToken )
  try { bc?.postMessage( { type: 'accessToken', token: data.accessToken } ) } catch {}
  return data
}

export async function logout () {
  await post( '/api/auth/logout' )
  setAccessToken( null )
  setRefreshToken( null )
  try { bc?.postMessage( { type: 'logout' } ) } catch {}
}

export async function register ( payload: { email: string, username: string, password: string } ) {
  return await post<{ id: number, email: string, username: string }>( '/api/auth/register', payload )
}

export async function verifyEmail ( token: string ) { return await get( '/api/auth/verify-email', { params: { token } } ) }

export async function forgotPassword ( email: string ) {
  return await post( '/api/auth/forgot-password', { email } )
}

export async function resetPassword ( token: string, password: string ) {
  return await post( '/api/auth/reset-password', { token, password } )
}

// 在应用启动时调用：
// 1) 根据当前 accessToken 调度主动续期
// 2) 打开跨标签页同步
export function startAuthLifecycle (): void {
  // 确保拦截器已初始化，从而 bc 初始化
  if ( typeof window !== 'undefined' ) {
    // 使用当前 token 安排一次主动续期
    scheduleProactiveRefresh( getAccessToken() )
    // 如果无 access 但有 refresh，尝试一次静默刷新（忽略失败）
    try {
      const at = getAccessToken()
      const rt = getRefreshToken()
      if ( !at && rt ) {
        refreshAccessToken( rt ).catch( () => { /* ignore silent refresh errors */ } )
      }
    } catch {}
  }
}
