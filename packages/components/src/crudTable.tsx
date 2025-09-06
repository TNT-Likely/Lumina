// components/CrudTable.tsx (重建版)
import React, { useRef, useEffect } from 'react'
import { Button, Modal, message } from 'antd'
import { ProTable, BetaSchemaForm } from '@ant-design/pro-components'
import type { ProColumns, ProFormColumnsType, ActionType, ProFormInstance } from '@ant-design/pro-components'
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import OverflowMenu, { type OverflowItem } from './ui/OverflowMenu'
import { useSearchParams } from 'react-router-dom'

// 统一的 CRUD 操作契约
export interface CrudOperations<T extends object> {
  create?: ( data: T ) => Promise<void | T>
  update?: ( id: number, data: Partial<T> ) => Promise<void | T>
  delete?: ( id: number ) => Promise<void>
  list: ( params: Record<string, unknown> ) => Promise<{ data: T[]; total: number; success: boolean }>
}

export interface CrudTableProps<T extends object> {
  title: string
  columns: Array<ProColumns<T>>
  formColumns: ProFormColumnsType[] | ( ( record?: T ) => ProFormColumnsType[] )
  operations: CrudOperations<T>
  rowKey: string
  defaultFormValues?: Partial<T>
  formWidth?: number
  onFormSubmit?: ( values: T, isEdit: boolean ) => Promise<boolean>
  enableUrlQuery?: boolean
  urlQueryMapper?: ( urlParams: URLSearchParams, isToUrl: boolean ) => Record<string, unknown>
  actionRender?: (
    tools: React.ReactNode[],
    record: T,
    actionRef: React.MutableRefObject<ActionType | undefined>
  ) => React.ReactNode
  toolBarRender?: ( actionRef: React.MutableRefObject<ActionType | undefined> ) => React.ReactNode[]
  tableProps?: Record<string, unknown>
  // 可自定义覆写内置的查看/编辑/删除行为
  viewRender?: ( record: T ) => React.ReactNode
  editRender?: ( record: T, reload: () => void ) => React.ReactNode
  deleteRender?: ( record: T, reload: () => void ) => React.ReactNode
  // 搜索模式：standard=ProTable内置，simple=派生弹窗筛选，none=无搜索
  searchMode?: 'standard' | 'none' | 'simple'
  /**
   * @deprecated 将被忽略；现在从 columns 自动派生简易筛选项
   */
  simpleSearchForm?: ProFormColumnsType[]
  /**
   * @deprecated 将被忽略；触发按钮固定为“筛选”
   */
  simpleSearchTrigger?: React.ReactElement
  // 操作列相关
  actionColumnWidth?: number
  actionsMode?: 'default' | 'none'
  actionsVariant?: 'buttons' | 'menu'
  /**
   * 完全自定义菜单项，返回后将不再渲染内置的“编辑/删除”。
   */
  actionMenuItemsRender?: ( record: T, reload: () => void ) => OverflowItem[]
  /**
   * 追加到默认菜单项（在“编辑/删除”旁一起显示）。更常用：便于保留内置编辑/删除的同时新增自定义项。
   */
  actionMenuItemsExtra?: ( record: T, reload: () => void ) => OverflowItem[]
  /**
   * 行为可见性控制：便于按角色/记录权限隐藏“新建/编辑/删除”。
   */
  actionsVisibility?: {
    create?: boolean | ( () => boolean )
    edit?: ( record: T ) => boolean
    delete?: ( record: T ) => boolean
  }
}

const defaultUrlQueryMapper = ( urlParams: URLSearchParams, isToUrl: boolean ): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  if ( isToUrl ) {
    urlParams.forEach( ( value, key ) => {
      if ( !value || ['current', 'pageSize', 'sorter', 'filter'].includes( key ) ) return
      result[key] = String( value )
    } )
  } else {
    urlParams.forEach( ( value, key ) => {
      if ( value === 'true' ) result[key] = true
      else if ( value === 'false' ) result[key] = false
      else if ( !isNaN( Number( value ) ) && value !== '' ) result[key] = Number( value )
      else result[key] = value
    } )
  }
  return result
}

function CrudTableInner<T extends object> (
  props: CrudTableProps<T>,
  ref: React.Ref<ActionType>
) {
  const {
    title,
    columns,
    formColumns,
    operations,
    rowKey,
    defaultFormValues = {},
    formWidth = 600,
    onFormSubmit,
    enableUrlQuery = false,
    urlQueryMapper = defaultUrlQueryMapper,
    actionRender,
    toolBarRender,
    tableProps = {},
    viewRender,
    editRender,
    deleteRender,
    searchMode = 'standard',
    // 兼容旧入参，不再使用
    simpleSearchForm: _ignoredSimpleForm,
    simpleSearchTrigger: _ignoredTrigger,
    actionsMode = 'default',
    actionColumnWidth,
    actionsVariant = 'buttons',
    actionMenuItemsRender,
    actionMenuItemsExtra,
    actionsVisibility
  } = props

  const actionRef = useRef<ActionType>()
  const [searchParams] = useSearchParams()
  const formRef = useRef<ProFormInstance<T>>()
  const externalFiltersRef = useRef<Record<string, unknown>>( {} )
  const [editRecord, setEditRecord] = React.useState<T | null>( null )

  React.useImperativeHandle( ref, () => actionRef.current as ActionType, [actionRef.current] )

  // 同步 URL 参数到表单（可选）
  useEffect( () => {
    if ( !enableUrlQuery ) return
    const newParams = urlQueryMapper( searchParams, false )
    if ( formRef.current && Object.keys( newParams ).length > 0 ) {
      // @ts-expect-error 宽松注入
      formRef.current.setFieldsValue( newParams )
      formRef.current.submit()
    }
  }, [searchParams, enableUrlQuery, urlQueryMapper] )

  // 获取表单列配置
  const getFormColumns = ( record?: T ) => {
    const baseColumns: ProFormColumnsType[] = [
      { dataIndex: rowKey as string, title: 'ID', readonly: true, formItemProps: { hidden: true } }
    ]
    const rest = typeof formColumns === 'function' ? formColumns( record ) : formColumns
    return [...baseColumns, ...rest]
  }

  // 创建/更新统一处理
  const handleSubmit = async ( values: T ) => {
    try {
      const raw = values as unknown as Record<string, unknown>
      const isEdit = !!raw[rowKey]
      if ( onFormSubmit ) {
        const ok = await onFormSubmit( values, isEdit )
        if ( ok ) { actionRef.current?.reload(); message.success( isEdit ? '更新成功！' : '创建成功！' ) }
        return ok
      }
      if ( isEdit ) {
        if ( !operations.update ) throw new Error( '未配置更新操作' )
        const idNum = Number( raw[rowKey] )
        if ( Number.isNaN( idNum ) ) { message.error( '无法识别的ID，更新失败' ); return false }
        await operations.update( idNum, values )
        message.success( '更新成功！' )
      } else {
        if ( !operations.create ) throw new Error( '未配置创建操作' )
        await operations.create( values )
        message.success( '创建成功！' )
      }
      actionRef.current?.reload()
      return true
    } catch ( e ) {
      const isEdit = !!( values as unknown as Record<string, unknown> )[rowKey]
      console.error( e )
      return false
    }
  }

  // 删除
  const handleDelete = ( record: T ) => {
    if ( !operations.delete ) { message.error( '未配置删除操作' ); return }
    const rec = record as unknown as Record<string, unknown>
    const recordId = rec[rowKey]
    const name = ( rec.name as string ) || ( rec.title as string ) || String( recordId )
    Modal.confirm( {
      title: '确认删除',
      content: `确定要删除 "${name}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const idNum = Number( recordId )
          if ( Number.isNaN( idNum ) ) { message.error( '无法识别的ID，删除失败' ); return }
          await operations.delete!( idNum )
          message.success( '删除成功' )
          actionRef.current?.reload()
        } catch ( e ) {
          console.error( e )
        }
      }
    } )
  }

  // 行内操作（按钮样式）
  const renderActionButtons = ( record: T ) => {
    const id = ( record as unknown as Record<string, unknown> )[rowKey]
    const tools: React.ReactNode[] = []
    // 查看
    if ( viewRender ) {
      tools.push( viewRender( record ) )
    } else {
      tools.push(
        <BetaSchemaForm<T>
          key={`view-${String( id )}`}
          trigger={<Button type="link" icon={<EyeOutlined />} size="small">查看</Button>}
          layoutType="ModalForm"
          layout="horizontal"
          title="查看详情"
          width={formWidth}
          readonly
          initialValues={record}
          columns={getFormColumns( record )}
          submitter={false}
          modalProps={{ destroyOnClose: true, forceRender: true }}
        />
      )
    }
    // 编辑
    const canEdit = operations.update && ( !actionsVisibility?.edit || actionsVisibility.edit( record ) )
    if ( editRender && operations.update && canEdit ) {
      tools.push( editRender( record, () => actionRef.current?.reload() ) )
    } else if ( operations.update && canEdit ) {
      tools.push(
        <BetaSchemaForm<T>
          key={`edit-${String( id )}`}
          trigger={<Button type="link" icon={<EditOutlined />} size="small">编辑</Button>}
          layoutType="ModalForm"
          layout="horizontal"
          title="编辑"
          width={formWidth}
          initialValues={record}
          columns={getFormColumns( record )}
          onFinish={handleSubmit}
          modalProps={{ destroyOnClose: true, forceRender: true }}
        />
      )
    }
    // 删除
    const canDelete = operations.delete && ( !actionsVisibility?.delete || actionsVisibility.delete( record ) )
    if ( deleteRender && operations.delete && canDelete ) {
      tools.push( deleteRender( record, () => actionRef.current?.reload() ) )
    } else if ( operations.delete && canDelete ) {
      tools.push(
        <Button key="delete" type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete( record )}>删除</Button>
      )
    }
    if ( actionRender ) return actionRender( tools, record, actionRef )
    return tools
  }

  // 是否显示操作列
  const hasActions = actionsMode !== 'none' && ( operations.update || operations.delete || actionRender )

  // 操作列（菜单样式时，默认提供“编辑/删除”，可追加自定义项）
  const buildMenuItems = ( record: T ): OverflowItem[] => {
    const reload = () => actionRef.current?.reload()
    if ( actionMenuItemsRender ) return actionMenuItemsRender( record, reload )
    const defaults: OverflowItem[] = []
    const canEdit = operations.update && ( !actionsVisibility?.edit || actionsVisibility.edit( record ) )
    const canDelete = operations.delete && ( !actionsVisibility?.delete || actionsVisibility.delete( record ) )
    if ( operations.update && canEdit ) {
      defaults.push( { key: 'edit', label: '编辑', onClick: () => setEditRecord( record ) } )
    }
    if ( operations.delete && canDelete ) {
      defaults.push( { key: 'delete', label: '删除', danger: true, onClick: () => handleDelete( record ) } )
    }
    const extras = actionMenuItemsExtra ? ( actionMenuItemsExtra( record, reload ) || [] ) : []
    return [...extras, ...defaults]
  }

  const tableColumns: Array<ProColumns<T>> = [
    ...columns,
    ...( hasActions
      ? [
          {
            title: '操作',
            valueType: 'option' as const,
            fixed: 'right' as const,
            width: actionColumnWidth ?? 260,
            render: ( _: unknown, record: T ) => {
              if ( actionsVariant === 'menu' ) return <OverflowMenu items={buildMenuItems( record )} />
              return renderActionButtons( record )
            }
          } as ProColumns<T>
      ]
      : [] )
  ]

  // 从 columns 自动派生“简易筛选”字段
  const derivedSimpleSearchForm: ProFormColumnsType[] = React.useMemo( () => {
    if ( searchMode !== 'simple' ) return []
    const cols: ProFormColumnsType[] = []
    ;( columns || [] ).forEach( ( c ) => {
      const col = c as unknown as {
        dataIndex?: string | string[]
        key?: string
        search?: boolean
        valueType?: ProFormColumnsType['valueType']
        fieldProps?: unknown
        valueEnum?: unknown
        title?: React.ReactNode
      }
      const key = ( col.dataIndex ?? col.key ) as string | string[] | undefined
      if ( !key ) return
      const dataIndex = Array.isArray( key ) ? ( key as string[] ).join( '.' ) : String( key )
      if ( col.search === false ) return
      const title = ( col.title as React.ReactNode ) ?? dataIndex
      const valueType = ( col.valueType ?? 'text' ) as NonNullable<ProFormColumnsType['valueType']>
      const allowed = ['text', 'select', 'digit', 'date', 'dateRange', 'dateTime', 'dateTimeRange'] as const
      if ( !allowed.includes( valueType as typeof allowed[number] ) ) return
      const formItem: ProFormColumnsType = { dataIndex, title, valueType }
      if ( col.fieldProps ) ( formItem as unknown as { fieldProps?: unknown } ).fieldProps = col.fieldProps
      if ( col.valueEnum ) ( formItem as unknown as { valueEnum?: unknown } ).valueEnum = col.valueEnum as unknown
      cols.push( formItem )
    } )
    return cols
  }, [columns, searchMode] )

  // 工具栏：派生筛选 + 新建 + 页面自定义
  const renderToolBar = () => {
    const defaults: React.ReactNode[] = []
    if ( searchMode === 'simple' && derivedSimpleSearchForm.length > 0 ) {
      defaults.push(
        <BetaSchemaForm<Record<string, unknown>>
          key="filter"
          trigger={<Button>筛选</Button>}
          layoutType="ModalForm"
          layout="horizontal"
          title="筛选"
          width={520}
          initialValues={externalFiltersRef.current}
          columns={derivedSimpleSearchForm}
          onFinish={async ( values ) => {
            externalFiltersRef.current = values || {}
            try { // 触发表格请求
              // @ts-expect-error 宽松注入
              formRef.current?.setFieldsValue( values )
            } catch {}
            actionRef.current?.reload()
            return true
          }}
          modalProps={{ destroyOnClose: true, forceRender: true }}
        />
      )
    }
    const hasCustomToolbar = !!toolBarRender
    const createVisible = typeof actionsVisibility?.create === 'function'
      ? ( actionsVisibility?.create as ( () => boolean ) )()
      : ( actionsVisibility?.create ?? true )
    if ( operations.create && !hasCustomToolbar && createVisible ) {
      defaults.push(
        <BetaSchemaForm<T>
          key="add"
          trigger={<Button type="primary" icon={<PlusOutlined />}>新建</Button>}
          layoutType="ModalForm"
          layout="horizontal"
          title="新建"
          width={formWidth}
          initialValues={defaultFormValues}
          columns={getFormColumns()}
          onFinish={handleSubmit}
          modalProps={{ destroyOnClose: true, forceRender: true }}
        />
      )
    }
    const custom = toolBarRender ? toolBarRender( actionRef ) : []
    return [...defaults, ...( custom || [] )]
  }

  const requestWrapper: CrudOperations<T>['list'] = async ( params ) => {
    const merged = { ...( params || {} ), ...( externalFiltersRef.current || {} ) }
    return await operations.list( merged )
  }

  return (
    <div>
      <ProTable<T>
        headerTitle={title}
        actionRef={actionRef}
        formRef={formRef}
        columns={tableColumns}
        request={requestWrapper}
        rowKey={rowKey as string}
        search={searchMode === 'standard' ? { labelWidth: 'auto' } : false}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, showQuickJumper: true }}
        scroll={{ x: 'max-content' }}
        options={( () => {
          const optionsOverride = ( tableProps as Record<string, unknown> | undefined )?.options as Record<string, unknown> | undefined
          return { density: false, fullScreen: false, setting: false, reload: true, ...( optionsOverride || {} ) }
        } )()}
        toolBarRender={renderToolBar}
        {...tableProps}
      />
      {operations.update && editRecord && (
        <BetaSchemaForm<T>
          open={!!editRecord}
          onOpenChange={( open ) => { if ( !open ) setEditRecord( null ) }}
          title="编辑"
          layoutType="ModalForm"
          layout="horizontal"
          width={formWidth}
          initialValues={editRecord || undefined}
          columns={getFormColumns( editRecord || undefined )}
          onFinish={async ( values ) => {
            const ok = await handleSubmit( values )
            if ( ok ) setEditRecord( null )
            return ok
          }}
          modalProps={{ destroyOnClose: true, forceRender: true }}
        />
      )}
    </div>
  )
}

// 泛型 forwardRef 声明
export type { CrudOperations as CrudOperationsType }
const Forwarded = React.forwardRef( CrudTableInner ) as unknown
type CrudTableForward = <T extends object>( props: CrudTableProps<T> & { ref?: React.Ref<ActionType> } ) => React.ReactElement
const CrudTable = Forwarded as CrudTableForward
export default CrudTable
