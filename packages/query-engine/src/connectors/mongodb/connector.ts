/* eslint-disable indent */
import { BaseConnector } from '../../baseConnector'
import type { QueryExecutionParams, QueryDataset, QueryResult, QueryFilter, QueryFilterGroup } from '../../types'
import { MongoClient, type Db, type MongoClientOptions, type Filter, type Document } from 'mongodb'

export interface MongoDBConnectorConfig extends MongoClientOptions {
  uri: string
  dbName: string
}

export class MongoDBConnector extends BaseConnector {
  readonly type = 'mongodb'
  protected client: MongoClient
  protected db: Db
  private connected = false

  constructor (config: MongoDBConnectorConfig) {
    super()
    this.client = new MongoClient(config.uri, config)
    this.db = this.client.db(config.dbName)
  }

  // MongoDB 不用 SQL，重写 buildSQL 相关方法为 noop
  protected buildSQL (): string {
    return ''
  }

  private async ensureConnected (): Promise<void> {
    if (!this.connected) {
      await this.client.connect()
      this.connected = true
    }
  }

  async query (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult> {
    await this.ensureConnected()
  if (!this.db) throw new Error('MongoDBConnector not initialized')
  const ds = dataset as unknown as QueryDataset
  const collection = this.db.collection(ds.baseTable || ds.name)

    const start = Date.now()
    const fieldMap = new Map<string, string>(
      (ds.fields as Array<{ identifier: string, expression: string }>)
        .map(f => [f.identifier, f.expression])
    )

    // 构建 $match
  const match = this.buildMongoMatch(params.filters, fieldMap)

    const hasDims = Array.isArray(params.dimensions) && params.dimensions.length > 0
    const hasMetrics = Array.isArray(params.metrics) && params.metrics.length > 0
    const limit = params.limit ?? 1000
    const offset = params.offset ?? 0

    // 无分组：
  if (!hasDims) {
      if (!hasMetrics) {
        const cursor = collection.find(match as Filter<Document> || {}).skip(offset).limit(limit)
        const data = await cursor.toArray()
        const totalCount = await collection.countDocuments(match as Filter<Document> || {})
        return { data, totalCount, executionTime: Date.now() - start, sql: '' }
      }
      // 仅指标：使用 $group 聚合出单行
      const groupStage: Record<string, unknown> = { _id: null }
      const needSizePostProject: Array<{ alias: string, tmp: string }> = []
      for (const m of params.metrics) {
        const expr = this.toMongoField(fieldMap.get(m.field.identifier) || m.field.identifier)
        const alias = `${m.field.identifier}_${m.aggregationType}`
        switch (m.aggregationType) {
          case 'sum': groupStage[alias] = { $sum: expr }; break
          case 'avg': groupStage[alias] = { $avg: expr }; break
          case 'max': groupStage[alias] = { $max: expr }; break
          case 'min': groupStage[alias] = { $min: expr }; break
          case 'count': groupStage[alias] = { $sum: 1 }; break
          case 'count_distinct': {
            const tmp = `__tmp_set_${alias}`
            groupStage[tmp] = { $addToSet: expr }
            needSizePostProject.push({ alias, tmp })
            break
          }
          default: throw new Error(`Unsupported aggregation type: ${m.aggregationType}`)
        }
      }
      const pipeline: Array<Record<string, unknown>> = []
      if (match && Object.keys(match).length > 0) pipeline.push({ $match: match })
      pipeline.push({ $group: groupStage })
      if (needSizePostProject.length > 0) {
        const proj: Record<string, unknown> = {}
        for (const { alias, tmp } of needSizePostProject) proj[alias] = { $size: `$${tmp}` }
        pipeline.push({ $project: proj })
      }
      const rows = await collection.aggregate(pipeline).toArray()
      const row = rows[0] || {}
      // 统一格式：返回单行
      return { data: [row], totalCount: 1, executionTime: Date.now() - start, sql: '' }
    }

    // 有分组：构建聚合管道
    const groupId: Record<string, unknown> = {}
    const dimAliases: string[] = []
    for (const d of params.dimensions) {
      const expr = this.toMongoField(fieldMap.get(d.field.identifier) || d.field.identifier)
      const alias = d.field.identifier
      dimAliases.push(alias)
      groupId[alias] = expr
    }
    const groupStage: Record<string, unknown> = { _id: groupId }
    const needSizePostProject: Array<{ alias: string, tmp: string }> = []
    for (const m of params.metrics) {
      const expr = this.toMongoField(fieldMap.get(m.field.identifier) || m.field.identifier)
      const alias = `${m.field.identifier}_${m.aggregationType}`
      switch (m.aggregationType) {
        case 'sum': groupStage[alias] = { $sum: expr }; break
        case 'avg': groupStage[alias] = { $avg: expr }; break
        case 'max': groupStage[alias] = { $max: expr }; break
        case 'min': groupStage[alias] = { $min: expr }; break
        case 'count': groupStage[alias] = { $sum: 1 }; break
        case 'count_distinct': {
          const tmp = `__tmp_set_${alias}`
          groupStage[tmp] = { $addToSet: expr }
          needSizePostProject.push({ alias, tmp })
          break
        }
        default: throw new Error(`Unsupported aggregation type: ${m.aggregationType}`)
      }
    }

    const projectStage: Record<string, unknown> = {}
    for (const a of dimAliases) projectStage[a] = `$_id.${a}`
    for (const m of params.metrics) {
      const alias = `${m.field.identifier}_${m.aggregationType}`
      projectStage[alias] = `$${alias}`
    }
    for (const { alias, tmp } of needSizePostProject) projectStage[alias] = { $size: `$${tmp}` }

    // 排序
    const sortStage: Record<string, 1 | -1> = {}
  if (params.orderBy && params.orderBy.length > 0) {
      for (const o of params.orderBy) sortStage[o.field] = (o.direction === 'desc') ? -1 : 1
  }

    const pipeline: Array<Record<string, unknown>> = []
    if (match && Object.keys(match).length > 0) pipeline.push({ $match: match })
    pipeline.push({ $group: groupStage })
    pipeline.push({ $project: projectStage })
    if (Object.keys(sortStage).length > 0) pipeline.push({ $sort: sortStage })
    if (offset > 0) pipeline.push({ $skip: offset })
    if (limit > 0) pipeline.push({ $limit: limit })

    const data = await collection.aggregate(pipeline).toArray()

    // 统计总分组数
  const countPipeline: Array<Record<string, unknown>> = []
    if (match && Object.keys(match).length > 0) countPipeline.push({ $match: match })
    countPipeline.push({ $group: { _id: groupId } })
    countPipeline.push({ $count: 'total' })
    const cr = await collection.aggregate(countPipeline).toArray()
    const totalCount = cr[0]?.total ?? 0

    return { data, totalCount, executionTime: Date.now() - start, sql: '' }
  }

  // 预览查询（返回描述信息）
  public previewQuery (): { sql: string } {
    return { sql: '// MongoDB query (preview not applicable): using find with limit' }
  }

  // 元数据枚举
  async listSchemas (): Promise<string[]> {
    await this.ensureConnected()
    // 列出所有数据库名称
    const admin = this.client.db().admin()
    const { databases } = await admin.listDatabases()
    return (databases || []).map(db => db.name).filter(Boolean)
  }

  async listTables (schema?: string): Promise<Array<{ schema?: string, name: string }>> {
    await this.ensureConnected()
    const dbName = schema || this.db.databaseName
    const db = this.client.db(dbName)
    const cols = await db.listCollections({}, { nameOnly: true }).toArray()
    return cols.map(c => ({ schema: dbName, name: c.name }))
  }

  async listColumns (schema: string | undefined, table: string): Promise<Array<{ name: string, type: string }>> {
    await this.ensureConnected()
    const dbName = schema || this.db.databaseName
    const db = this.client.db(dbName)
    const col = db.collection(table)
    // 采样部分文档推断字段
    const docs = await col.find({}, { projection: {} }).limit(50).toArray()
    const fieldTypes = new Map<string, string>()

    const inferType = (val: unknown): string => {
      if (val === null || val === undefined) return 'NULL'
      if (Array.isArray(val)) return 'ARRAY'
      const t = typeof val
      switch (t) {
        case 'string': return 'STRING'
        case 'number': return 'NUMBER'
        case 'boolean': return 'BOOLEAN'
        case 'object': return 'OBJECT'
        default: return 'UNKNOWN'
      }
    }

    const walk = (obj: Record<string, unknown>, prefix = ''): void => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
          const key = prefix ? `${prefix}.${k}` : k
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            // 记录对象类型并继续下钻
            if (!fieldTypes.has(key)) fieldTypes.set(key, 'OBJECT')
            walk(v as Record<string, unknown>, key)
          } else if (Array.isArray(v)) {
            if (!fieldTypes.has(key)) fieldTypes.set(key, 'ARRAY')
            // 对数组元素做一次采样类型
            if (v.length > 0) fieldTypes.set(key, inferType(v[0] as unknown))
          } else {
            if (!fieldTypes.has(key)) fieldTypes.set(key, inferType(v))
          }
        }
      }
    }

    for (const d of docs) {
      walk(d)
    }

    return Array.from(fieldTypes.entries()).map(([name, type]) => ({ name, type }))
  }

  async close (): Promise<void> {
    await this.client.close()
  }

  // 将通用过滤映射到 MongoDB $match
  private buildMongoMatch (filters: QueryExecutionParams['filters'], fieldMap: Map<string, string>): Record<string, unknown> | undefined {
    if (!filters || (Array.isArray(filters) && filters.length === 0)) return undefined
    if (Array.isArray(filters)) {
      const parts = filters.map(f => this.renderMongoFilter(f as QueryFilter, fieldMap)).filter(Boolean)
      if (parts.length === 1) return parts[0]
      if (parts.length > 1) return { $and: parts }
      return undefined
    }
    return this.renderMongoFilterGroup(filters as QueryFilterGroup, fieldMap)
  }

  private renderMongoFilterGroup (group: QueryFilterGroup, fieldMap: Map<string, string>): Record<string, unknown> {
    const children = group.children || []
    const rendered = children.map(c => {
      // @ts-expect-error 运行时判断
      if (c && c.op && Array.isArray(c.children)) return this.renderMongoFilterGroup(c as QueryFilterGroup, fieldMap)
      return this.renderMongoFilter(c as QueryFilter, fieldMap)
    }).filter(Boolean)
    if (rendered.length === 0) return {}
    const glue = group.op === 'OR' ? '$or' : '$and'
    return { [glue]: rendered }
  }

  private renderMongoFilter (filter: QueryFilter, fieldMap: Map<string, string>): Record<string, unknown> {
    const exprRaw = fieldMap.get(filter.field.identifier) || filter.field.identifier
    const field = typeof exprRaw === 'string' && exprRaw.startsWith('$') ? exprRaw.slice(1) : exprRaw
    const { operator, values } = filter
    switch (operator) {
      case 'equals': return { [field]: values?.[0] }
      case 'not_equals': return { [field]: { $ne: values?.[0] } }
      case 'contains': return { [field]: { $regex: String(values?.[0] ?? ''), $options: 'i' } }
      case 'not_contains': return { [field]: { $not: { $regex: String(values?.[0] ?? ''), $options: 'i' } } }
      case 'greater_than': return { [field]: { $gt: values?.[0] } }
      case 'less_than': return { [field]: { $lt: values?.[0] } }
      case 'between': return { [field]: { $gte: values?.[0], $lte: values?.[1] } }
      case 'in': return { [field]: { $in: Array.isArray(values) ? values : [values] } }
      case 'not_in': return { [field]: { $nin: Array.isArray(values) ? values : [values] } }
      case 'is_null': return { $or: [{ [field]: null }, { [field]: { $exists: false } }] }
      case 'is_not_null': return { [field]: { $ne: null, $exists: true } }
      default: throw new Error(`Unsupported filter operator: ${operator}`)
    }
  }

  private toMongoField (expressionOrIdentifier: string): string {
    const expr = expressionOrIdentifier
    // 若已经以 $ 开头，直接返回（作为表达式），否则作为字段路径
    if (expr.startsWith('$')) return expr
    return `$${expr}`
  }
}
