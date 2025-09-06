import { type ThemeConfig } from 'antd'

const antdToken: ThemeConfig = {
  token: {
    // 主色
    colorPrimary: '#4F8CFF', // 使用logo中的蓝紫色
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',

    // 圆角
    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusLG: 12,

    // 字体
    fontSize: 14,
    fontSizeLG: 16,
    fontFamily: '"Inter", "Helvetica Neue", sans-serif',

    // 阴影（更柔和）
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    boxShadowSecondary: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',

    // 高度
    controlHeight: 36,
    controlHeightLG: 40,
    controlHeightSM: 32
  },
  components: {
    Button: {
      // 按钮专属配置
      fontWeight: 500,
      borderRadius: 12,
      controlOutline: '0', // 移除聚焦边框
      defaultShadow: 'none',
      primaryShadow: 'none',
      linkHoverBg: 'transparent'
    },
    Card: {
      borderRadius: 16,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    },
    Input: {
      borderRadius: 12,
      controlOutline: '0'
    },
    Table: {
      borderRadius: 16
    }
  }
}

export default antdToken
