// app/controller/datasources.ts
import { Controller } from 'egg'
import { datasourceService, rbacService } from '@lumina/data'
import type { ServiceContext } from '@lumina/data'

export default class DatasourceController extends Controller {
  public async list() {
    const { ctx } = this
    try {
      // 从查询参数中提取筛选条件
      const {
        id,
        name,
        type,
        page,
        pageSize,
        sortBy,
        sortOrder,
        createdAfter,
        createdBefore,
      } = ctx.query

      // 参数验证和转换
      const queryParams = {
        id: id ? parseInt(id as string, 10) : undefined,
        name: name as string,
        type: type as string,
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

      if (queryParams.sortOrder && ![ 'asc', 'desc' ].includes(queryParams.sortOrder)) {
        ctx.body = {
          success: false,
          message: 'SortOrder must be either "asc" or "desc"',
        }
        return
      }

      // 日期格式验证
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
      // compute role and fetch list (use ctx-aware service)
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const svcCtx: ServiceContext = { user: { id: ctx.state.user?.id, username: ctx.state.user?.username }, orgId: ctx.state.orgId, role }
      const result = await datasourceService.findAll({ ...queryParams }, svcCtx)
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
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const datasource = await datasourceService.findById(Number(id), { explainAuth: false }, { ...ctx.state, role } as ServiceContext)
      if (datasource) {
        ctx.body = {
          success: true,
          data: datasource,
        }
      } else {
        ctx.body = {
          success: false,
          message: 'Datasource not found',
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
      const payload = {
        ...ctx.request.body,
        orgId: ctx.state.orgId,
        ownerId: ctx.state.user?.id,
      }
      // 必填字段校验
      if (!payload.name || String(payload.name).trim() === '') {
        ctx.status = 400
        ctx.body = { success: false, message: 'Missing datasource name' }
        return
      }
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const datasource = await datasourceService.create(payload, { ...ctx.state, role } as ServiceContext)
      ctx.body = {
        success: true,
        data: datasource,
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async update() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const datasource = await datasourceService.update(Number(id), ctx.request.body, { ...ctx.state, role } as ServiceContext)
      if (datasource) {
        ctx.body = { success: true, data: datasource }
      } else {
        ctx.body = { success: false, message: 'Datasource not found' }
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
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await datasourceService.delete(Number(id), { ...ctx.state, role } as ServiceContext)
      if (result) {
        ctx.body = { success: true, message: 'Datasource deleted successfully' }
      } else {
        ctx.body = { success: false, message: 'Datasource not found' }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async getConfig() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const datasource = await datasourceService.findById(Number(id), { explainAuth: false }, { ...ctx.state, role } as ServiceContext)
      if (datasource) {
        ctx.body = {
          success: true,
          data: datasource.config || {},
        }
      } else {
        ctx.body = {
          success: false,
          message: 'Datasource not found',
        }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // 新增：列出 schemas
  public async listSchemas() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const data = await datasourceService.listSchemas(Number(id), { ...ctx.state, role } as ServiceContext)
      ctx.body = { success: true, data }
    } catch (error) {
      ctx.body = { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // 新增：列出 tables（可选 schema）
  public async listTables() {
    const { ctx } = this
    const { id } = ctx.params
    const { schema } = ctx.query
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const data = await datasourceService.listTables(Number(id), schema as string | undefined, { ...ctx.state, role } as ServiceContext)
      ctx.body = { success: true, data }
    } catch (error) {
      ctx.body = { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // 新增：列出 columns（需 table，schema 可选）
  public async listColumns() {
    const { ctx } = this
    const { id } = ctx.params
    const { schema, table } = ctx.query
    if (!table) {
      ctx.body = { success: false, message: 'Missing table' }
      return
    }
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const data = await datasourceService.listColumns(Number(id), (schema as string) || undefined, table as string, { ...ctx.state, role } as ServiceContext)
      ctx.body = { success: true, data }
    } catch (error) {
      ctx.body = { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
