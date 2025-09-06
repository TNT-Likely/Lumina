// 统一字段类型配色配置（左侧字段列表与 Chips 共用）
export type FieldTypeKey = 'STRING' | 'INTEGER' | 'FLOAT' | 'DATE' | 'BOOLEAN'

type ColorDef = { tag: 'blue' | 'green' | 'orange' | 'purple' | 'default', text: string }

export const FIELD_TYPE_COLORS: Record<FieldTypeKey, ColorDef> = {
  STRING: { tag: 'blue', text: '#1677ff' },
  INTEGER: { tag: 'green', text: '#52c41a' },
  FLOAT: { tag: 'green', text: '#52c41a' },
  DATE: { tag: 'orange', text: '#faad14' },
  BOOLEAN: { tag: 'purple', text: '#722ed1' }
}

export const getFieldTagColor = (type: string): ColorDef['tag'] => {
  switch (type) {
  case 'STRING': return FIELD_TYPE_COLORS.STRING.tag
  case 'INTEGER': return FIELD_TYPE_COLORS.INTEGER.tag
  case 'FLOAT': return FIELD_TYPE_COLORS.FLOAT.tag
  case 'DATE': return FIELD_TYPE_COLORS.DATE.tag
  case 'BOOLEAN': return FIELD_TYPE_COLORS.BOOLEAN.tag
  default: return 'default'
  }
}

export const getFieldTextColor = (type: string): string => {
  switch (type) {
  case 'STRING': return FIELD_TYPE_COLORS.STRING.text
  case 'INTEGER': return FIELD_TYPE_COLORS.INTEGER.text
  case 'FLOAT': return FIELD_TYPE_COLORS.FLOAT.text
  case 'DATE': return FIELD_TYPE_COLORS.DATE.text
  case 'BOOLEAN': return FIELD_TYPE_COLORS.BOOLEAN.text
  default: return '#1f2937'
  }
}
