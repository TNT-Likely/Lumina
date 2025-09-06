import type { DatasetField, DatasetServiceQueryParams, QueryExecutionParams, ServiceContext } from '@lumina/data'
// apps/api-server/app/controller/datasets.ts
import { Controller } from 'egg'
import { datasetService, rbacService } from '@lumina/data'

export default class DatasetController extends Controller {
  public async list() {
    const { ctx } = this
    try {
      const {
        id,
        name,
        sourceId,
        page,
        pageSize,
        sortBy,
        sortOrder,
        createdAfter,
        createdBefore,
        search,
      } = ctx.query

      const queryParams: DatasetServiceQueryParams = {
        id: id ? parseInt(id as string, 10) : undefined,
        name: name as string,
        sourceId: sourceId ? parseInt(sourceId as string, 10) : undefined,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        createdAfter: createdAfter as string,
        createdBefore: createdBefore as string,
      }

      // 参数校验
      if (queryParams.page && queryParams.page < 1) {
        ctx.body = {
          success: false,
          message: 'Page must be greater than 0',
        }
        return
      }

      if (queryParams.pageSize && (queryParams.pageSize < 1 || queryParams.pageSize > 100)) {
        ctx.body = {
          success: false,
          message: 'PageSize must be between 1 and 100',
        }
        return
      }

      if (queryParams.sortOrder && ![ 'asc', 'desc' ].includes(queryParams.sortOrder)) {
        ctx.body = {
          success: false,
          message: 'SortOrder must be either "asc" or "desc"',
        }
        return
      }

      if (queryParams.createdAfter && isNaN(Date.parse(queryParams.createdAfter))) {
        ctx.body = {
          success: false,
          message: 'Invalid createdAfter date format',
        }
        return
      }

      if (queryParams.createdBefore && isNaN(Date.parse(queryParams.createdBefore))) {
        ctx.body = {
          success: false,
          message: 'Invalid createdBefore date format',
        }
        return
      }

      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await datasetService.findAll({ ...queryParams }, { ...ctx.state, role } as ServiceContext)
      ctx.body = {
        success: true,
        data: {
          list: result.data,
          ...result.pagination,
          canCreate: result.canCreate,
        },
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async show() {
    const { ctx } = this
    const { id } = ctx.params
    const { includeSource } = ctx.query

    try {
      const datasetId = parseInt(id, 10)
      if (isNaN(datasetId)) {
        ctx.body = {
          success: false,
          message: 'Invalid dataset ID',
        }
        return
      }
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const dataset = await datasetService.findById(datasetId, { includeSource: includeSource === 'true', explainAuth: false }, { ...ctx.state, role } as ServiceContext)

      if (dataset) {
        ctx.body = {
          success: true,
          data: dataset,
        }
      } else {
        ctx.body = {
          success: false,
          message: 'Dataset not found',
        }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async create() {
    const { ctx } = this
    try {
      const requiredFields = [ 'name', 'sourceId', 'fields' ]
      const missingFields = requiredFields.filter(field => !ctx.request.body[field])

      if (missingFields.length > 0) {
        ctx.body = {
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
        }
        return
      }

      if (!Array.isArray(ctx.request.body.fields)) {
        ctx.body = {
          success: false,
          message: 'Fields must be an array',
        }
        return
      }

      // 预校验 baseTable/baseSchema 友好提示
      const baseTable: string | undefined = ctx.request.body.baseTable
      const baseSchema: string | undefined = ctx.request.body.baseSchema
      const tableRe = /^[a-zA-Z][a-zA-Z0-9_]*$/
      if (!baseTable || !tableRe.test(baseTable)) {
        ctx.body = { success: false, message: 'Invalid baseTable, must start with a letter and contain only letters, numbers, and underscores' }
        return
      }
      if (baseSchema && !tableRe.test(baseSchema)) {
        ctx.body = { success: false, message: 'Invalid baseSchema, must start with a letter and contain only letters, numbers, and underscores' }
        return
      }
      const fields = ctx.request.body.fields.map((field: DatasetField, index: number) => {
        if (!field.identifier) {
          return {
            ...field,
            identifier: `${field.name.replace(/\s+/g, '_').toLowerCase()}_${index}`,
          }
        }
        return field
      })

      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const dataset = await datasetService.create({
        ...ctx.request.body,
        fields,
        createdBy: ctx.state.user?.username || 'system',
        updatedBy: ctx.state.user?.username || 'system',
        orgId: ctx.state.orgId,
        ownerId: ctx.state.user?.id,
      }, { ...ctx.state, role } as ServiceContext)

      ctx.body = {
        success: true,
        data: dataset,
      }
    } catch (error) {
      // 规范化 Sequelize 校验错误信息
      const err = error as { name?: string; errors?: Array<{ message?: string }> }
      if (err?.name === 'SequelizeUniqueConstraintError') {
        ctx.body = { success: false, message: 'Dataset name already exists' }
        return
      }
      if (err?.name === 'SequelizeValidationError' && Array.isArray(err?.errors) && err.errors.length) {
        ctx.body = { success: false, message: err.errors.map(e => e?.message || 'Validation error').join('; ') }
        return
      }
      ctx.body = { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  public async update() {
    const { ctx } = this
    const { id } = ctx.params

    try {
      const datasetId = parseInt(id, 10)
      if (isNaN(datasetId)) {
        ctx.body = {
          success: false,
          message: 'Invalid dataset ID',
        }
        return
      }

      if (ctx.request.body.fields && !Array.isArray(ctx.request.body.fields)) {
        ctx.body = {
          success: false,
          message: 'Fields must be an array',
        }
        return
      }

      const updateData = {
        ...ctx.request.body,
        updatedBy: ctx.state.user?.username || 'system',
      }

      if (updateData.fields) {
        updateData.fields = updateData.fields.map((field: DatasetField, index: number) => {
          if (!field.identifier) {
            return {
              ...field,
              identifier: `${field.name.replace(/\s+/g, '_').toLowerCase()}_${index}`,
            }
          }
          return field
        })
      }

      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const dataset = await datasetService.update(datasetId, updateData, { ...ctx.state, role } as ServiceContext)

      if (dataset) {
        ctx.body = {
          success: true,
          data: dataset,
        }
      } else {
        ctx.body = {
          success: false,
          message: 'Dataset not found',
        }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async destroy() {
    const { ctx } = this
    const { id } = ctx.params

    try {
      const datasetId = parseInt(id, 10)
      if (isNaN(datasetId)) {
        ctx.body = {
          success: false,
          message: 'Invalid dataset ID',
        }
        return
      }

      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await datasetService.delete(datasetId, { ...ctx.state, role } as ServiceContext)
      if (result) {
        ctx.body = { success: true, message: 'Dataset deleted successfully' }
      } else {
        ctx.body = { success: false, message: 'Dataset not found' }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async fields() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const datasetId = parseInt(id, 10)
      if (isNaN(datasetId)) {
        ctx.body = {
          success: false,
          message: 'Invalid dataset ID',
        }
        return
      }

      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const fields = await datasetService.getDatasetFields(datasetId, { ...ctx.state, role } as ServiceContext)
      ctx.body = {
        success: true,
        data: fields,
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get dataset fields',
      }
    }
  }

  public async validateExpression() {
    const { ctx } = this
    const { expression, sourceId } = ctx.request.body

    try {
      if (!expression || !sourceId) {
        ctx.body = {
          success: false,
          message: 'Missing expression or sourceId',
        }
        return
      }

      const sourceIdNum = parseInt(sourceId, 10)
      if (isNaN(sourceIdNum)) {
        ctx.body = {
          success: false,
          message: 'Invalid sourceId',
        }
        return
      }

      const result = await datasetService.validateFieldExpression(expression, sourceIdNum)
      ctx.body = {
        success: true,
        data: result,
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to validate expression',
      }
    }
  }

  public async getConfig() {
    const { ctx } = this
    const { id } = ctx.params

    try {
      const datasetId = parseInt(id, 10)
      if (isNaN(datasetId)) {
        ctx.body = {
          success: false,
          message: 'Invalid dataset ID',
        }
        return
      }

      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const dataset = await datasetService.findById(datasetId, { includeSource: false, explainAuth: false }, { ...ctx.state, role } as ServiceContext)

      if (dataset) {
        ctx.body = {
          success: true,
          data: {
            fields: dataset.fields,
            parameters: dataset.parameters || [],
          },
        }
      } else {
        ctx.body = {
          success: false,
          message: 'Dataset not found',
        }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get dataset config',
      }
    }
  }

  // 新增：执行数据集查询
  public async executeQuery() {
    const { ctx } = this
    const { id } = ctx.params
    const queryParams = ctx.request.body

    try {
      const datasetId = parseInt(id, 10)
      if (isNaN(datasetId)) {
        ctx.body = {
          success: false,
          message: 'Invalid dataset ID',
        }
        return
      }

      // 验证查询参数；为样本预览场景增加兜底：若维度与指标均为空但提供了 limit/offset，则尝试自动填充一个维度字段
      let effectiveParams = queryParams as QueryExecutionParams
      if (
        effectiveParams &&
        Array.isArray(effectiveParams.dimensions) &&
        Array.isArray(effectiveParams.metrics) &&
        Array.isArray(effectiveParams.filters) &&
        effectiveParams.dimensions.length === 0 &&
        effectiveParams.metrics.length === 0 &&
        (effectiveParams.limit !== undefined || effectiveParams.offset !== undefined)
      ) {
        // 自动探测一个字段作为维度（优先选择第一个字段，或 _id）
        const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
        const fields = await datasetService.getDatasetFields(parseInt(id, 10), { ...ctx.state, role } as ServiceContext)
        const first = fields[0]
        if (first) {
          effectiveParams = {
            ...effectiveParams,
            dimensions: [{ field: { identifier: first.identifier, name: first.name, type: first.type } }],
            metrics: [],
            filters: effectiveParams.filters || [],
          }
        }
      }

      const validationError = this.validateQueryParams(effectiveParams)
      if (validationError) {
        ctx.body = {
          success: false,
          message: validationError,
        }
        return
      }

      // 执行查询
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await datasetService.executeQuery(datasetId, effectiveParams, { ...ctx.state, role } as ServiceContext)

      ctx.body = {
        success: true,
        data: result,
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to execute query',
      }
    }
  }

  // 新增：预览查询SQL
  public async previewQuery() {
    const { ctx } = this
    const { id } = ctx.params
    const queryParams = ctx.request.body

    try {
      const datasetId = parseInt(id, 10)
      if (isNaN(datasetId)) {
        ctx.body = {
          success: false,
          message: 'Invalid dataset ID',
        }
        return
      }

      // 验证查询参数；为样本预览场景增加兜底
      let effectiveParams = queryParams as QueryExecutionParams
      if (
        effectiveParams &&
        Array.isArray(effectiveParams.dimensions) &&
        Array.isArray(effectiveParams.metrics) &&
        Array.isArray(effectiveParams.filters) &&
        effectiveParams.dimensions.length === 0 &&
        effectiveParams.metrics.length === 0 &&
        (effectiveParams.limit !== undefined || effectiveParams.offset !== undefined)
      ) {
        const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
        const fields = await datasetService.getDatasetFields(parseInt(id, 10), { ...ctx.state, role } as ServiceContext)
        const first = fields[0]
        if (first) {
          effectiveParams = {
            ...effectiveParams,
            dimensions: [{ field: { identifier: first.identifier, name: first.name, type: first.type } }],
            metrics: [],
            filters: effectiveParams.filters || [],
          }
        }
      }

      const validationError = this.validateQueryParams(effectiveParams)
      if (validationError) {
        ctx.body = {
          success: false,
          message: validationError,
        }
        return
      }

      // 预览查询
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await datasetService.previewQuery(datasetId, effectiveParams, { ...ctx.state, role } as ServiceContext)

      ctx.body = {
        success: true,
        data: result,
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to preview query',
      }
    }
  }

  // 新增：字段去重取值（支持上下文 filters 与 prefix 搜索）
  public async distinctValues() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const datasetId = parseInt(id, 10)
      if (isNaN(datasetId)) {
        ctx.body = { success: false, message: 'Invalid dataset ID' }
        return
      }
      const { field, filters, limit, search } = ctx.request.body || {}
      if (!field || !field.identifier) {
        ctx.body = { success: false, message: 'Missing field identifier' }
        return
      }
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const res = await datasetService.getDistinctValues(datasetId, { field, filters, limit, search }, { ...ctx.state, role } as ServiceContext)
      ctx.body = { success: true, data: res }
    } catch (error) {
      ctx.body = { success: false, message: error instanceof Error ? error.message : 'Failed to get distinct values' }
    }
  }

  // 私有方法：验证查询参数
  private validateQueryParams(params: QueryExecutionParams): string | null {
    if (!params) {
      return 'Query parameters are required'
    }

    if (!Array.isArray(params.dimensions)) {
      return 'Dimensions must be an array'
    }

    if (!Array.isArray(params.metrics)) {
      return 'Metrics must be an array'
    }

    if (!Array.isArray(params.filters)) {
      return 'Filters must be an array'
    }

    if (params.dimensions.length === 0 && params.metrics.length === 0) {
      return 'At least one dimension or metric must be specified'
    }

    // 验证维度字段
    for (const dim of params.dimensions) {
      if (!dim.field || !dim.field.identifier) {
        return 'Each dimension must have a valid field with identifier'
      }
    }

    // 验证指标字段
    for (const metric of params.metrics) {
      if (!metric.field || !metric.field.identifier) {
        return 'Each metric must have a valid field with identifier'
      }

      const validAggregations = [ 'sum', 'count', 'avg', 'max', 'min', 'count_distinct' ]
      if (!validAggregations.includes(metric.aggregationType)) {
        return `Invalid aggregation type: ${metric.aggregationType}. Must be one of: ${validAggregations.join(', ')}`
      }
    }

    // 验证筛选器
    for (const filter of params.filters) {
      if (!filter.field || !filter.field.identifier) {
        return 'Each filter must have a valid field with identifier'
      }

      const validOperators = [
        'equals', 'not_equals', 'contains', 'not_contains',
        'greater_than', 'less_than', 'in', 'not_in',
        'is_null', 'is_not_null',
      ]
      if (!validOperators.includes(filter.operator)) {
        return `Invalid filter operator: ${filter.operator}. Must be one of: ${validOperators.join(', ')}`
      }

      // 检查需要值的操作符
      const operatorsRequiringValues = [
        'equals', 'not_equals', 'contains', 'not_contains',
        'greater_than', 'less_than', 'in', 'not_in',
      ]
      if (operatorsRequiringValues.includes(filter.operator) && (!filter.values || filter.values.length === 0)) {
        return `Filter with operator '${filter.operator}' must have at least one value`
      }
    }

    // 验证分页参数
    if (params.limit !== undefined && (params.limit < 1 || params.limit > 10000)) {
      return 'Limit must be between 1 and 10000'
    }

    if (params.offset !== undefined && params.offset < 0) {
      return 'Offset must be non-negative'
    }

    // 验证排序参数
    if (params.orderBy) {
      for (const order of params.orderBy) {
        if (!order.field) {
          return 'Each order by clause must specify a field'
        }
        if (![ 'asc', 'desc' ].includes(order.direction)) {
          return 'Order direction must be either "asc" or "desc"'
        }
      }
    }

    return null
  }
}
