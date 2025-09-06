import puppeteer from 'puppeteer-core'
import { Buffer } from 'buffer'
import jwt from 'jsonwebtoken'
import { Dashboard } from '../models'

/**
 * 获取订阅仪表盘分享页截图
 * @param dashboardId 仪表盘id
 * @param host 服务host（如 http://localhost:3000）
 * @returns 图片Buffer
 */
export async function getDashboardShareScreenshot (
  dashboardId: number,
  host: string,
  options?: {
    orgId?: number
    /** 若传入现成的 token 则直接使用；否则会基于 PREVIEW_TOKEN_SECRET 动态签发 */
    token?: string
    /** 签发 token 的 secret（默认取环境变量 PREVIEW_TOKEN_SECRET） */
    tokenSecret?: string
    /** token 有效期（如 '2m' | 120 等），默认 2 分钟 */
    expiresIn?: string | number
  }
): Promise<Buffer> {
  let orgId = options?.orgId
  let token = options?.token
  let ownerId: number | undefined

  // 若未提供现成 token，则尝试基于 PREVIEW_TOKEN_SECRET 动态签发用于访问私有/组织看板
  if ( !token ) {
    const secret = options?.tokenSecret || process.env.PREVIEW_TOKEN_SECRET
    // 在签发 token 前尝试查询看板以获取真实 ownerId（以及回填 orgId）
    try {
      const d = await Dashboard.findOne( { where: { id: Number( dashboardId ) } } )
      if ( d ) {
        ownerId = d.ownerId ?? ownerId
        orgId = ( orgId ?? d.orgId ?? orgId ) as number | undefined
      }
    } catch { }
    const payload: { rid: string, orgId?: number, ownerId?: number } = { rid: `dashboard:${dashboardId}` }
    if ( typeof orgId === 'number' ) payload.orgId = orgId
    if ( typeof ownerId === 'number' ) payload.ownerId = ownerId
    // 统一为数字秒，避免额外类型依赖
    const expiresInSeconds = typeof options?.expiresIn === 'number' ? options.expiresIn : 120
    token = jwt.sign( payload, secret as import( 'jsonwebtoken' ).Secret, { expiresIn: expiresInSeconds } )
  }

  const search = new URLSearchParams( { id: String( dashboardId ) } )
  if ( typeof orgId === 'number' ) search.set( 'orgId', String( orgId ) )
  if ( token ) search.set( 'token', token )
  // 标记截图模式，前端可据此隐藏全局筛选等交互控件
  search.set( 'screenshot', '1' )
  const url = `${host}/dashboard/preview?${search.toString()}`
  const isMac = process.platform === 'darwin'
  const executablePath = process.env.NODE_ENV === 'production'
    ? '/usr/bin/chromium'
    : ( isMac
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : 'google chrome' )

  const browser = await puppeteer.launch( {
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  } ).catch( () => {
    throw new Error( 'Failed to launch Puppeteer browser' )
  } )
  try {
    const page = await browser.newPage()
    // 不再使用内部旁路密钥，统一使用 PREVIEW_TOKEN_SECRET 签发的 JWT
    // 统一预览视口宽度为 1366（更常见的桌面宽度），高度先给 800，截图使用 fullPage
    await page.setViewport( { width: 1366, height: 800, deviceScaleFactor: 1 } )
    await page.goto( url, { waitUntil: 'networkidle0', timeout: 60000 } )
    // 可根据需要等待页面元素加载
    const buffer = await page.screenshot( { type: 'png', fullPage: true } )
    return Buffer.from( buffer )
  } finally {
    await browser.close()
  }
}
