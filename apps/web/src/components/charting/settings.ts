import type { SettingItem } from './types'

// 与 ChartConfig.settings 对齐的 schema，用于构建器和渲染器参考
export const COMMON_SETTINGS: SettingItem[] = [
  { key: 'title', label: '标题', type: 'input', defaultValue: '', placeholder: '请输入图表标题' },
  {
    key: 'colorScheme',
    label: '主题',
    type: 'select',
    options: [
      { value: 'default', label: '默认' },
      { value: 'business', label: '商务' },
      { value: 'fresh', label: '清新' },
      { value: 'elegant', label: '优雅' }
    ],
    defaultValue: 'default'
  },
  { key: 'limit', label: '条数', type: 'number', defaultValue: 100, min: 1, max: 10000 },
  { key: 'showLegend', label: '图例', type: 'switch', defaultValue: true },
  { key: 'showDataLabels', label: '数据标签', type: 'switch', defaultValue: false },
  { key: 'showGridLines', label: '网格线', type: 'switch', defaultValue: true }
]

export const SPECIFIC_SETTINGS: Record<string, SettingItem[]> = {
  bar: [
    { key: 'stacked', label: '堆叠', type: 'switch', defaultValue: false },
    {
      key: 'orientation',
      label: '方向',
      type: 'select',
      defaultValue: 'vertical',
      options: [
        { value: 'vertical', label: '垂直' },
        { value: 'horizontal', label: '水平' }
      ]
    }
  ],
  line: [
    { key: 'smooth', label: '平滑', type: 'switch', defaultValue: true }
  ],
  area: [
    { key: 'stacked', label: '堆叠', type: 'switch', defaultValue: false },
    { key: 'smooth', label: '平滑', type: 'switch', defaultValue: true }
  ],
  pie: [
    { key: 'donut', label: '环形', type: 'switch', defaultValue: false },
    {
      key: 'labelPosition',
      label: '标签',
      type: 'select',
      defaultValue: 'outside',
      options: [
        { value: 'inside', label: '内部' },
        { value: 'outside', label: '外部' }
      ]
    }
  ],
  scatter: [
    { key: 'symbolSize', label: '标记大小', type: 'number', defaultValue: 10, min: 1, max: 50 }
  ],
  // 非 ECharts 卡片类
  kpi: [
    { key: 'valuePrefix', label: '前缀', type: 'input', defaultValue: '' },
    { key: 'valueSuffix', label: '后缀', type: 'input', defaultValue: '' },
    { key: 'decimals', label: '小数位', type: 'number', defaultValue: 0, min: 0, max: 6 },
    { key: 'emptyPlaceholder', label: '空值显示', type: 'input', defaultValue: '-' }
  ],
  progress: [
    {
      key: 'variant',
      label: '样式',
      type: 'select',
      defaultValue: 'line',
      options: [
        { value: 'line', label: '线形' },
        { value: 'circle', label: '圆形' },
        { value: 'dashboard', label: '仪表盘' }
      ]
    },
    { key: 'valueSuffix', label: '后缀', type: 'input', defaultValue: '%' },
    { key: 'maxValue', label: '最大值', type: 'number', defaultValue: 100, min: 1, max: 100000 },
    { key: 'decimals', label: '小数位', type: 'number', defaultValue: 0, min: 0, max: 6 },
    { key: 'emptyPlaceholder', label: '空值显示', type: 'input', defaultValue: '-' }
  ],
  table: [
    { key: 'pageSize', label: '每页条数', type: 'number', defaultValue: 50, min: 5, max: 500 }
  ]
}

export const getSettingsForChartType = (chartType: string): SettingItem[] => {
  // 数值卡：仅自身配置
  if (chartType === 'kpi') {
    return SPECIFIC_SETTINGS.kpi || []
  }
  // 进度条/表格：保留“标题”并叠加自身配置，去掉不适用的通用项
  if (chartType === 'progress' || chartType === 'table') {
    const titleOnly = COMMON_SETTINGS.filter(item => item.key === 'title')
    return [...titleOnly, ...(SPECIFIC_SETTINGS[chartType] || [])]
  }
  const base = [...COMMON_SETTINGS, ...(SPECIFIC_SETTINGS[chartType] || [])]
  // 饼图不适用网格线，隐藏该选项
  if (chartType === 'pie') {
    return base.filter(item => item.key !== 'showGridLines')
  }
  return base
}
