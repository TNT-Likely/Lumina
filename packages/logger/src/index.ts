import pino, { type Logger } from 'pino'
import { createStream, type Generator as RfsGenerator } from 'rotating-file-stream'
import { AsyncLocalStorage } from 'node:async_hooks'

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LoggerContext {
  requestId?: string;
  userId?: number | string;
  orgId?: number | string;
}

export interface FileRotationOptions {
  enabled?: boolean;
  // 按天或按大小轮转，可同时启用（任选其一或两者都设置）
  rotateBy?: 'time' | 'size';
  // 当 rotateBy=time 时，pattern 如 'yyyy-mm-dd'.log
  pattern?: string;
  // 当 rotateBy=size 时，size 如 '10M'
  size?: string;
  // 保留个数或天数（按时间轮转使用 days，按大小轮转使用 count）
  days?: number;
  count?: number;
  // 输出目录
  dir?: string;
}

export interface CreateLoggerOptions {
  level?: LogLevel;
  pretty?: boolean; // dev 默认 true，prod 默认 false
  file?: FileRotationOptions;
  base?: Record<string, unknown>;
}

const als = new AsyncLocalStorage<LoggerContext>()

export function runWithContext<T> ( ctx: LoggerContext, fn: () => Promise<T> | T ): Promise<T> | T {
  return als.run( ctx, fn )
}

export function setContext ( partial: LoggerContext ) {
  const store = als.getStore() || {}
  Object.assign( store, partial )
}

export function getContext (): LoggerContext {
  return als.getStore() || {}
}

let rootLogger: Logger | null = null

export function createAppLogger ( opts: CreateLoggerOptions = {} ): Logger {
  if ( rootLogger ) return rootLogger

  const isProd = process.env.NODE_ENV === 'production'
  const pretty = opts.pretty ?? !isProd
  const level = opts.level ?? ( isProd ? 'info' : 'debug' )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streams: any[] = []

  // 控制台输出
  streams.push( {
    stream: pretty
      ? pino.transport( { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', singleLine: true } } )
      : process.stdout
  } )

  // 文件轮转
  if ( opts.file?.enabled ) {
    const dir = opts.file.dir || process.env.LOG_DIR || 'logs'
    const rotateBy = opts.file.rotateBy || 'time'
    const ext = '.log'
    const generator: RfsGenerator = ( time?: number | Date, index?: number ) => {
      if ( !time ) return `app${ext}` // 初始文件名
      // 只要配置了按时间轮转（或提供了 pattern），就采用按日期命名
      const d = typeof time === 'number' ? new Date( time ) : time
      if ( rotateBy === 'time' || opts.file?.pattern ) {
        const y = d.getFullYear()
        const m = String( d.getMonth() + 1 ).padStart( 2, '0' )
        const day = String( d.getDate() ).padStart( 2, '0' )
        return `app-${y}${m}${day}${ext}`
      }
      return `app-${index}${ext}`
    }

    const sizeOpt = ( opts.file.size || ( rotateBy === 'size' ? '10M' : undefined ) ) as `${number}B` | `${number}K` | `${number}M` | `${number}G` | undefined
    const intervalOpt = ( opts.file.pattern || ( rotateBy === 'time' ? '1d' : undefined ) ) as `${number}M` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | undefined
    const rfs = createStream( generator, {
      path: dir,
      // 同时支持 size 与 interval：提供其中任意一个即可生效
      size: sizeOpt,
      interval: intervalOpt,
      // 统一用 maxFiles 控制保留数量：优先用 days，否则 count，否则默认 7
      maxFiles: ( opts.file.days || opts.file.count || 7 ),
      compress: 'gzip'
    } )

    streams.push( { stream: rfs } )
  }

  const logger = pino( {
    level,
    base: { ...opts.base },
    mixin () {
      const ctx = getContext()
      return {
        requestId: ctx.requestId,
        userId: ctx.userId,
        orgId: ctx.orgId
      }
    }
  }, pino.multistream( streams ) )

  rootLogger = logger
  return logger
}

export function getLogger (): Logger {
  if ( !rootLogger ) {
    rootLogger = createAppLogger()
  }
  return rootLogger
}
