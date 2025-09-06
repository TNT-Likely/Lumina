// src/components/ChartBuilder/constants/index.tsx
import type { AggregationType } from '../types'
export { CHART_TYPES } from '../../../components/charting/constants'

export const AGGREGATION_TYPES: AggregationType[] = [
  { key: 'sum', name: '求和', applicable: ['INTEGER', 'FLOAT'] },
  { key: 'count', name: '计数', applicable: ['STRING', 'INTEGER', 'FLOAT', 'DATE', 'BOOLEAN'] },
  { key: 'count_distinct', name: '去重计数', applicable: ['STRING', 'INTEGER', 'FLOAT', 'DATE'] },
  { key: 'avg', name: '平均值', applicable: ['INTEGER', 'FLOAT'] },
  { key: 'max', name: '最大值', applicable: ['INTEGER', 'FLOAT', 'DATE'] },
  { key: 'min', name: '最小值', applicable: ['INTEGER', 'FLOAT', 'DATE'] }
]
