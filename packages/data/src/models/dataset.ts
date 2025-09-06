import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize'
import { type Datasource } from './datasource'

export enum FieldType {
  String = 'STRING',
  Integer = 'INTEGER',
  Float = 'FLOAT',
  Date = 'DATE',
  Boolean = 'BOOLEAN',
  Timestamp = 'TIMESTAMP'
}

export interface QueryParameter {
  name: string
  type: FieldType
  defaultValue?: unknown
  description?: string
}

export interface DatasetField {
  identifier: string // 唯一标识符，替代 key
  name: string
  expression: string
  type: FieldType
  isDimension?: boolean
  isMetric?: boolean
  description?: string
  indexable?: boolean
  // 可选：值到展示文案的映射
  valueMap?: Array<{ value: string | number | boolean | null, label: string }>
}

export interface DatasetAttributes {
  id: number
  name: string
  sourceId: number
  description?: string

  // 新增基础表相关字段
  baseTable: string // 基础表名，必填
  baseSchema?: string // 数据库schema，可选
  queryTemplate?: string // SQL查询模板，可选
  joins?: Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>

  fields: DatasetField[]
  parameters?: QueryParameter[]
  createdAt?: Date
  updatedAt?: Date
  orgId?: number
  ownerId?: number
  visibility?: 'private' | 'org' | 'public'
}

interface DatasetCreationAttributes extends Optional<DatasetAttributes, 'id' | 'createdAt' | 'updatedAt' | 'baseSchema' | 'queryTemplate'> {}

export class Dataset extends Model<DatasetAttributes, DatasetCreationAttributes> implements DatasetAttributes {
  public id!: number
  public name!: string
  public sourceId!: number
  public description!: string

  // 新增基础表相关属性
  public baseTable!: string
  public baseSchema!: string
  public queryTemplate!: string
  public joins!: Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>

  public fields!: DatasetField[]
  public parameters!: QueryParameter[]
  public createdBy!: string
  public updatedBy!: string
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  // 组织与权限相关字段
  public orgId?: number
  public ownerId?: number
  public visibility?: 'private' | 'org' | 'public'

  // 关联属性 - 这些是通过 include 查询时才会存在的
  public source?: Datasource

  // 获取唯一标识符的便捷方法
  public getUniqueIdentifier (): string {
    return `${this.name.replace( /\s+/g, '_' ).toLowerCase()}_${this.id.toString().substring( 0, 8 )}`
  }

  // 获取完整表名的便捷方法
  public getFullTableName (): string {
    return this.baseSchema ? `${this.baseSchema}.${this.baseTable}` : this.baseTable
  }

  // 生成基础SQL查询的便捷方法
  public generateBaseQuery ( selectedFields: string[], conditions: string[] = [] ): string {
    const template = this.queryTemplate || 'SELECT {fields} FROM {base_table} WHERE 1=1 {conditions}'

    let sql = template
    sql = sql.replace( '{fields}', selectedFields.join( ', ' ) )
    sql = sql.replace( '{base_table}', this.getFullTableName() )
    sql = sql.replace( '{conditions}', conditions.length > 0 ? ` AND ${conditions.join( ' AND ' )}` : '' )

    return sql
  }

  // 根据字段标识符获取字段表达式
  public getFieldExpression ( fieldIdentifier: string ): string | null {
    const field = this.fields.find( f => f.identifier === fieldIdentifier )
    return field ? field.expression : null
  }

  // 获取所有维度字段
  public getDimensionFields (): DatasetField[] {
    return this.fields.filter( field => field.isDimension )
  }

  // 获取所有指标字段
  public getMetricFields (): DatasetField[] {
    return this.fields.filter( field => field.isMetric )
  }

  // 验证字段标识符是否存在
  public hasField ( fieldIdentifier: string ): boolean {
    return this.fields.some( field => field.identifier === fieldIdentifier )
  }
}

export const initDatasetModel = ( sequelize: Sequelize ): void => {
  Dataset.init( {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 255]
      }
    },
    sourceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'source_id',
      references: {
        model: 'datasources',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // 新增基础表相关字段
    baseTable: {
      type: DataTypes.STRING( 100 ),
      allowNull: false,
      field: 'base_table',
      validate: {
        notEmpty: true,
        len: [1, 100],
        // 验证表名格式（字母、数字、下划线）
        is: /^[a-zA-Z][a-zA-Z0-9_]*$/
      }
    },
    baseSchema: {
      type: DataTypes.STRING( 100 ),
      allowNull: true,
      field: 'base_schema',
      validate: {
        len: [0, 100],
        // 验证schema名格式（如果不为空）
        isSchemaFormat ( value: string ) {
          if ( value && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test( value ) ) {
            throw new Error( 'Schema name must contain only letters, numbers, and underscores' )
          }
        }
      }
    },
    queryTemplate: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'query_template',
      defaultValue: 'SELECT {fields} FROM {base_table} WHERE 1=1 {conditions}',
      validate: {
        // 验证查询模板包含必要的占位符
        hasRequiredPlaceholders ( value: string ) {
          if ( value && ( !value.includes( '{fields}' ) || !value.includes( '{base_table}' ) ) ) {
            throw new Error( 'Query template must contain {fields} and {base_table} placeholders' )
          }
        }
      }
    },

    joins: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isArrayOfJoins ( value: unknown ) {
          if ( !value ) return
          if ( !Array.isArray( value ) ) throw new Error( 'Joins must be an array' )
          for ( const j of value ) {
            const join = j as { table?: string, type?: string, on?: Array<{ left?: string, right?: string }> }
            if ( !join.table ) throw new Error( 'Join.table is required' )
            if ( !join.type || !['INNER', 'LEFT', 'RIGHT', 'FULL'].includes( join.type ) ) throw new Error( 'Join.type invalid' )
            if ( !Array.isArray( join.on ) || join.on.length === 0 ) throw new Error( 'Join.on must be a non-empty array' )
            for ( const c of join.on ) {
              if ( !c.left || !c.right ) throw new Error( 'Join condition requires left and right' )
            }
          }
        }
      }
    },

    fields: {
      type: DataTypes.JSON,
      allowNull: false,
      validate: {
        isArrayOfFields ( value: unknown ) {
          if ( !Array.isArray( value ) ) {
            throw new Error( 'Fields must be an array' )
          }
          if ( value.length === 0 ) {
            throw new Error( 'At least one field must be defined' )
          }

          const identifiers = new Set()
          value.forEach( ( field: unknown, index: number ) => {
            const f = field as Partial<DatasetField>
            // 检查必需字段
            if ( !f?.identifier || !f?.name || !f?.expression || !f?.type ) {
              throw new Error( `Field at index ${index} is incomplete` )
            }

            // 检查标识符唯一性
            if ( identifiers.has( f.identifier ) ) {
              throw new Error( `Duplicate field identifier: ${f.identifier}` )
            }
            identifiers.add( f.identifier )

            // 验证字段类型
            if ( !Object.values( FieldType ).includes( f.type as FieldType ) ) {
              throw new Error( `Invalid field type: ${String( f.type )}` )
            }

            // 验证标识符格式
            if ( !/^[a-zA-Z][a-zA-Z0-9_]*$/.test( f.identifier as string ) ) {
              throw new Error( `Invalid field identifier format: ${String( f.identifier )}` )
            }

            // 校验可选的 valueMap
            if ( f.valueMap !== undefined ) {
              if ( !Array.isArray( f.valueMap ) ) {
                throw new Error( `Field ${f.identifier} valueMap must be an array` )
              }
              for ( const item of f.valueMap ) {
                const it = item as { value?: unknown, label?: unknown }
                if ( !Object.prototype.hasOwnProperty.call( it, 'value' ) ) {
                  throw new Error( `Field ${f.identifier} valueMap item missing 'value'` )
                }
                if ( typeof it.label !== 'string' ) {
                  throw new Error( `Field ${f.identifier} valueMap item.label must be string` )
                }
              }
            }
          } )
        }
      }
    },
    parameters: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isArrayOfParams ( value: unknown ) {
          if ( !Array.isArray( value ) ) return

          const paramNames = new Set()
          value.forEach( ( param: unknown, index: number ) => {
            const p = param as Partial<QueryParameter>
            if ( !p?.name || !p?.type ) {
              throw new Error( `Parameter at index ${index} is incomplete` )
            }

            // 检查参数名唯一性
            if ( paramNames.has( p.name ) ) {
              throw new Error( `Duplicate parameter name: ${p.name}` )
            }
            paramNames.add( p.name )

            // 验证参数类型
            if ( !Object.values( FieldType ).includes( p.type as FieldType ) ) {
              throw new Error( `Invalid parameter type: ${String( p.type )}` )
            }
          } )
        }
      }
    },
    orgId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'org_id'
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'owner_id'
    },
    visibility: {
      type: DataTypes.ENUM( 'private', 'org', 'public' ),
      allowNull: true,
      defaultValue: 'org'
    }
  }, {
    sequelize,
    modelName: 'dataset',
    tableName: 'datasets',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['source_id'] },
      { fields: ['base_table'] }, // 新增基础表索引
      { fields: ['base_schema', 'base_table'] }, // 新增复合索引
      { fields: ['created_at'] },
      { fields: ['updated_at'] },
      { fields: ['org_id'] },
      { fields: ['owner_id'] },
      { fields: ['visibility'] }
    ]
  } )
}
