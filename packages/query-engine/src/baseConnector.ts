import type { QueryDataset, QueryExecutionParams, QueryResult, QueryFilter, QueryFilterGroup } from './types'

export abstract class BaseConnector {
  /** 数据源类型，如 mysql、postgresql、clickhouse 等 */
  abstract readonly type: string
  /** 数据库客户端实例，子类需实现具体类型；基类不约束 */
  protected abstract client: unknown

  /**
   * 通用 SQL 构建主入口，可被子类重写
   */
  protected buildSQL (dataset: QueryDataset, params: QueryExecutionParams): string {
    const { dimensions, metrics, filters, limit = 1000, offset = 0, orderBy } = params
    const fieldMap = new Map<string, string>((dataset.fields as Array<{ identifier: string, expression: string }>)
      .map((field) => [field.identifier, field.expression]))
    const selectFields: string[] = []
    // 注意：执行查询时不使用前端 alias，仅使用稳定键名（identifier / identifier_agg）
    dimensions.forEach(dim => {
      const stableAlias = dim.field.identifier
      const expression = fieldMap.get(dim.field.identifier)
      if (!expression) throw new Error(`Field expression not found for identifier: ${dim.field.identifier}`)
      selectFields.push(`${expression} AS ${this.escapeField(stableAlias)}`)
    })
    metrics.forEach(metric => {
      const stableAlias = `${metric.field.identifier}_${metric.aggregationType}`
      const expression = fieldMap.get(metric.field.identifier)
      if (!expression) throw new Error(`Field expression not found for identifier: ${metric.field.identifier}`)
      const aggregation = this.buildAggregation(expression, metric.aggregationType)
      selectFields.push(`${aggregation} AS ${this.escapeField(stableAlias)}`)
    })
    if (selectFields.length === 0) throw new Error('At least one dimension or metric must be specified')
    let tableName = dataset.baseTable || dataset.name
    if (dataset.baseSchema) tableName = `${dataset.baseSchema}.${tableName}`
    let fromClause = this.escapeField(tableName)
    // 可视化联表：追加 JOIN 语句
    if (Array.isArray(dataset.joins) && dataset.joins.length > 0) {
      const joinSql = dataset.joins.map(j => {
        let jt: string
        if (j.type === 'LEFT') jt = 'LEFT JOIN'
        else if (j.type === 'RIGHT') jt = 'RIGHT JOIN'
        else if (j.type === 'FULL') jt = 'FULL JOIN'
        else jt = 'INNER JOIN'
        const tbl = j.schema ? `${j.schema}.${j.table}` : j.table
        const target = this.escapeField(tbl)
        const alias = j.alias ? ` ${this.escapeField(j.alias)}` : ''
        const onConds = (j.on || []).map(c => `${this.escapeField(c.left)} = ${this.escapeField(c.right)}`).join(' AND ')
        const on = onConds ? ` ON ${onConds}` : ''
        return `${jt} ${target}${alias}${on}`
      }).join(' ')
      fromClause = `${fromClause} ${joinSql}`
    }
    const whereClause = this.buildWhereClause(filters, fieldMap)
    const groupByClause = this.buildGroupByClause(dimensions, fieldMap)
    const orderByClause = this.buildOrderByClause(orderBy, dimensions, metrics, fieldMap)
    const limitClause = this.buildLimitClause(limit, offset)
    let sql = `SELECT ${selectFields.join(', ')} FROM ${fromClause}`
    if (whereClause) sql += ` WHERE ${whereClause}`
    if (groupByClause) sql += ` GROUP BY ${groupByClause}`
    if (orderByClause) sql += ` ORDER BY ${orderByClause}`
    if (limitClause) sql += ` ${limitClause}`
    return sql
  }

  /**
   * 构建聚合表达式
   */
  protected buildAggregation (expression: string, aggregationType: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct'): string {
    switch (aggregationType) {
      case 'sum': return `SUM(${expression})`
      case 'count': return `COUNT(${expression})`
      case 'count_distinct': return `COUNT(DISTINCT ${expression})`
      case 'avg': return `AVG(${expression})`
      case 'max': return `MAX(${expression})`
      case 'min': return `MIN(${expression})`
      default: throw new Error(`Unsupported aggregation type: ${aggregationType}`)
    }
  }

  /**
   * 构建 WHERE 子句，可被子类重写
   */
  protected buildWhereClause (filters: QueryExecutionParams['filters'], fieldMap: Map<string, string>): string {
    if (!filters) return ''
    // 兼容：数组表示 AND 连接；对象表示分组
    if (Array.isArray(filters)) {
      if (filters.length === 0) return ''
      return filters.map(f => this.renderFilter(f, fieldMap)).join(' AND ')
    }
    return this.renderFilterGroup(filters as QueryFilterGroup, fieldMap)
  }

  private renderFilterGroup (group: QueryFilterGroup, fieldMap: Map<string, string>): string {
    const parts = group.children
      .map(child => {
        if (this.isGroup(child)) return this.renderFilterGroup(child, fieldMap)
        return this.renderFilter(child as QueryFilter, fieldMap)
      })
      .filter(Boolean)
    if (parts.length === 0) return ''
    const glue = group.op === 'OR' ? ' OR ' : ' AND '
    // 外层包裹括号，确保优先级
    return `(${parts.join(glue)})`
  }

  private isGroup (node: QueryFilter | QueryFilterGroup): node is QueryFilterGroup {
    return (node as QueryFilterGroup).op !== undefined && Array.isArray((node as QueryFilterGroup).children)
  }

  private renderFilter (filter: QueryFilter, fieldMap: Map<string, string>): string {
    const expression = fieldMap.get(filter.field.identifier)
    if (!expression) throw new Error(`Field expression not found for identifier: ${filter.field.identifier}`)
    const { operator, values } = filter
    switch (operator) {
      case 'equals': return `${expression} = ${this.escapeValue(values[0])}`
      case 'not_equals': return `${expression} != ${this.escapeValue(values[0])}`
      case 'contains': return `${expression} LIKE ${this.escapeValue(`%${values[0]}%`)}`
      case 'not_contains': return `${expression} NOT LIKE ${this.escapeValue(`%${values[0]}%`)}`
      case 'greater_than': return `${expression} > ${this.escapeValue(values[0])}`
      case 'less_than': return `${expression} < ${this.escapeValue(values[0])}`
      case 'between': {
        const a = values?.[0]
        const b = values?.[1]
        if (a === undefined || b === undefined) {
          throw new Error('Operator "between" requires two values')
        }
        const va = this.escapeValue(a)
        const vb = this.escapeValue(b)
        // 使用 >= 与 <= 语义覆盖完整区间
        return `(${expression} >= ${va} AND ${expression} <= ${vb})`
      }
      case 'in': return `${expression} IN (${values.map(v => this.escapeValue(v)).join(', ')})`
      case 'not_in': return `${expression} NOT IN (${values.map(v => this.escapeValue(v)).join(', ')})`
      case 'is_null': return `${expression} IS NULL`
      case 'is_not_null': return `${expression} IS NOT NULL`
      default: throw new Error(`Unsupported filter operator: ${operator}`)
    }
  }

  /**
   * 构建 GROUP BY 子句，可被子类重写
   */
  protected buildGroupByClause (dimensions: QueryExecutionParams['dimensions'], fieldMap: Map<string, string>): string {
    if (!dimensions || dimensions.length === 0) return ''
    return dimensions.map(dim => {
      const expression = fieldMap.get(dim.field.identifier)
      if (!expression) throw new Error(`Field expression not found for identifier: ${dim.field.identifier}`)
      return expression
    }).join(', ')
  }

  /**
   * 构建 ORDER BY 子句，可被子类重写
   */
  protected buildOrderByClause (orderBy: QueryExecutionParams['orderBy'], dimensions: QueryExecutionParams['dimensions'], metrics: QueryExecutionParams['metrics'], fieldMap: Map<string, string>): string {
    // 不做默认排序：仅当明确提供 orderBy 时才生成 ORDER BY 子句
    if (!orderBy || orderBy.length === 0) return ''
    return orderBy.map(order => {
      const direction = order.direction.toUpperCase()
      // 维度：按稳定键 identifier 匹配
      const dimById = dimensions.find(dim => dim.field.identifier === order.field)
      if (dimById) {
        const expression = fieldMap.get(dimById.field.identifier)
        return expression ? `${expression} ${direction}` : ''
      }
      // 指标：按稳定键 `${identifier}_${aggregationType}` 匹配
      const metByStable = metrics.find(met => `${met.field.identifier}_${met.aggregationType}` === order.field)
      if (metByStable) {
        const expr = fieldMap.get(metByStable.field.identifier)
        const agg = this.buildAggregation(expr || this.escapeField(metByStable.field.identifier), metByStable.aggregationType)
        return `${agg} ${direction}`
      }
      // 兜底：若传入的是原始字段 identifier 或表达式 key
      const expression = fieldMap.get(order.field)
      if (expression) {
        return `${expression} ${direction}`
      }
      return `${this.escapeField(order.field)} ${direction}`
    }).join(', ')
  }

  /**
   * 构建 LIMIT 子句，可被子类重写
   */
  protected buildLimitClause (limit: number, offset: number): string {
    // 默认实现为 MySQL 语法，子类可重写
    return `LIMIT ${offset}, ${limit}`
  }

  /**
   * 字段/表名转义，子类可重写
   */
  protected escapeField (field: string): string {
    if (field.includes('(') || field.includes('.') || field.includes(' ')) return field
    return `\`${field}\``
  }

  /**
   * 值转义，子类可重写
   */
  protected escapeValue (value: string | number | boolean | null | Date): string {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value ? '1' : '0'
    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`
    return `'${String(value)}'`
  }

  /**
   * 各子类必须实现：执行 SQL 查询
   */
  abstract query (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult>

  public previewQuery (dataset: QueryDataset, params: QueryExecutionParams): { sql: string } {
    const sql = this.buildSQL(dataset, params)
    return { sql }
  }

  /**
   * 元数据枚举：列出可用的 schema（如数据库/命名空间）。
   * 默认未实现，子类可按需覆盖。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listSchemas (): Promise<string[]> {
    throw new Error('listSchemas not implemented')
  }

  /**
   * 元数据枚举：列出表。
   * 默认未实现，子类可按需覆盖。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listTables (_schema?: string): Promise<Array<{ schema?: string, name: string }>> {
    throw new Error('listTables not implemented')
  }

  /**
   * 元数据枚举：列出列。
   * 默认未实现，子类可按需覆盖。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listColumns (_schema: string | undefined, _table: string): Promise<Array<{ name: string, type: string }>> {
    throw new Error('listColumns not implemented')
  }
}
