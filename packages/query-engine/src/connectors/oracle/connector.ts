import { BaseConnector } from '../../baseConnector'
import type { QueryExecutionParams, QueryDataset, QueryResult } from '../../types'
import oracledb, { type Pool, type PoolAttributes } from 'oracledb'

export type OracleConnectorConfig = PoolAttributes

export class OracleConnector extends BaseConnector {
  protected client: oracledb.Connection | undefined
  readonly type = 'oracle'
  protected pool: Pool | null

  constructor (config: OracleConnectorConfig) {
    super()
    this.pool = null
    this.init(config)
  }

  private async init (config: OracleConnectorConfig) {
    this.pool = await oracledb.createPool(config)
  }

  protected buildLimitClause (limit: number, offset: number): string {
    return `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
  }

  protected escapeField (field: string): string {
    if (field.includes('(') || field.includes('.') || field.includes(' ')) return field
    return `"${field}"`
  }

  async query (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult> {
    if (!this.pool) throw new Error('OracleConnector not initialized')
    const sql = this.buildSQL(dataset, params)
    const start = Date.now()
    const conn = await this.pool.getConnection()
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })
      const rows = (result.rows ?? []) as Array<Record<string, unknown>>
      // 统一：总数不受 LIMIT 影响，始终基于去除 LIMIT 的子查询统计
      let totalCount = rows.length
      const countSQL = this.buildCountSQL(sql)
      const countResult = await conn.execute(countSQL, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })
      if (Array.isArray(countResult.rows) && countResult.rows.length > 0) {
        const row = countResult.rows[0] as Record<string, unknown>
        const raw = (row.TOTAL_COUNT ?? row.total_count) as unknown
        totalCount = typeof raw === 'number' ? raw : Number(raw ?? 0)
      } else {
        totalCount = 0
      }
      return {
        data: rows,
        totalCount,
        executionTime: Date.now() - start,
        sql
      }
    } finally {
      await conn.close()
    }
  }

  protected buildCountSQL (originalSQL: string): string {
    const withoutLimit = originalSQL.replace(/\s+OFFSET\s+\d+\s+ROWS\s+FETCH\s+NEXT\s+\d+\s+ROWS\s+ONLY\s*$/i, '')
    return `SELECT COUNT(*) as TOTAL_COUNT FROM (${withoutLimit})`
  }

  async close (): Promise<void> {
    if (this.pool) await this.pool.close()
  }

  /**
   * 列出 Oracle schemas（用户）
   */
  async listSchemas (): Promise<string[]> {
    if (!this.pool) throw new Error('OracleConnector not initialized')
    const conn = await this.pool.getConnection()
    try {
      const sql = "SELECT USERNAME as NAME FROM ALL_USERS WHERE USERNAME NOT IN ('SYS','SYSTEM','OUTLN','XDB','CTXSYS','MDSYS','ORDSYS','ORDPLUGINS','LBACSYS','WMSYS','APEX_PUBLIC_USER','FLOWS_FILES','MDDATA','OLAPSYS','GSMADMIN_INTERNAL') AND USERNAME NOT LIKE 'APEX$%' ORDER BY USERNAME"
      const res = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })
      const rows = (res.rows ?? []) as Array<{ NAME?: string }>
      return rows.map(r => String(r.NAME))
    } finally {
      await conn.close()
    }
  }

  /**
   * 列出表
   */
  async listTables (schema?: string): Promise<Array<{ schema?: string, name: string }>> {
    if (!this.pool) throw new Error('OracleConnector not initialized')
    const conn = await this.pool.getConnection()
    try {
      let sql = 'SELECT OWNER as SCHEMA, TABLE_NAME as NAME FROM ALL_TABLES'
      const params: unknown[] = []
      if (schema) {
        sql += ' WHERE OWNER = :owner'
        params.push(schema)
      }
      sql += ' ORDER BY OWNER, TABLE_NAME'
      const res = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT })
      const rows = (res.rows ?? []) as Array<{ SCHEMA?: string, NAME?: string }>
      return rows.map(r => ({ schema: r.SCHEMA ? String(r.SCHEMA) : undefined, name: String(r.NAME) }))
    } finally {
      await conn.close()
    }
  }

  /**
   * 列出列
   */
  async listColumns (schema: string | undefined, table: string): Promise<Array<{ name: string, type: string }>> {
    if (!this.pool) throw new Error('OracleConnector not initialized')
    const conn = await this.pool.getConnection()
    try {
      let sql = 'SELECT COLUMN_NAME as NAME, DATA_TYPE as TYPE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = :table'
      const params: unknown[] = [table]
      if (schema) {
        sql += ' AND OWNER = :owner'
        params.push(schema)
      }
      sql += ' ORDER BY COLUMN_ID'
      const res = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT })
      const rows = (res.rows ?? []) as Array<{ NAME?: string, TYPE?: string }>
      return rows.map(r => ({ name: String(r.NAME), type: String(r.TYPE) }))
    } finally {
      await conn.close()
    }
  }
}
