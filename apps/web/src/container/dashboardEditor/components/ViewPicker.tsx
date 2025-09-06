import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, Modal, Input, List, Empty, Spin, Button, Space, Select } from 'antd'
import { PlusOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons'
import { viewApi } from '@lumina/api'

type ViewItem = import('@lumina/types').View

export interface ViewPickerProps {
  mode: 'drawer' | 'modal'
  open: boolean
  title?: string
  onClose: () => void
  onConfirm: (viewId: number) => void
  actionText?: string // 自定义动作按钮文案，例如 “添加到画布”/“替换”
}

// 通用视图选择器：支持 Drawer（添加）与 Modal（替换）两种呈现
export const ViewPicker: React.FC<ViewPickerProps> = ({ mode, open, title, onClose, onConfirm, actionText }) => {
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [views, setViews] = useState<ViewItem[]>([])
  const [selected, setSelected] = useState<number | undefined>(undefined)
  const fetchRef = useRef(0)

  // 一次性加载全部（分页拉全量）
  const loadAll = useCallback(async (q: string) => {
    fetchRef.current += 1
    const id = fetchRef.current
    setLoading(true)
    try {
      const all: ViewItem[] = []
      let page = 1
      const pageSize = 200
      // 保护：最多翻 200 页防止异常
      for (let i = 0; i < 200; i++) {
        const res = await viewApi.list({ page, pageSize, name: q || undefined }) as { list: ViewItem[] }
        if (id !== fetchRef.current) return
        const list = res?.list || []
        all.push(...list)
        if (list.length < pageSize) break
        page += 1
      }
      if (id === fetchRef.current) setViews(all)
    } finally {
      if (id === fetchRef.current) setLoading(false)
    }
  }, [])

  // 防抖后的搜索触发函数（减少请求频率）
  const debouncedSearch = useMemo(() => {
    let timer: number | undefined
    return (q: string) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        setKeyword(q)
        setViews([])
        loadAll(q).catch(console.error)
      }, 250)
    }
  }, [loadAll])

  // 仅依赖 open，避免因 load 的引用变化（由内部 setState 触发）导致 effect 重复执行从而产生持续请求
  useEffect(() => {
    if (open) {
      // 打开时重置查询条件与结果，确保列表是最新的
      setKeyword('')
      setViews([])
      setSelected(undefined)
      loadAll('')
        .catch(console.error)
    }
  }, [open])

  const content = (() => {
    if (mode === 'drawer') {
      return (
        <>
          <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
            <Input
              allowClear
              placeholder="搜索视图名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => loadAll(keyword).catch(console.error)}
            />
            <Button type="primary" onClick={() => loadAll(keyword).catch(console.error)}>搜索</Button>
          </Space.Compact>
          {loading && views.length === 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 160 }}>
              <Spin />
            </div>
          )}
          {!loading && views.length === 0 && (
            <Empty description={keyword ? '无匹配视图' : '暂无视图'} />
          )}
          {!loading && views.length > 0 && (
            <List
              style={{ maxHeight: 'unset', overflow: 'visible' }}
              dataSource={views}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  actions={[
                    <Button
                      key="action"
                      type="link"
                      icon={actionText === '替换' ? <SwapOutlined /> : <PlusOutlined />}
                      onClick={() => onConfirm(Number(item.id))}
                    >
                      {actionText || '添加到画布'}
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={<span style={{ cursor: 'pointer' }} onDoubleClick={() => onConfirm(Number(item.id))}>{item.name}</span>}
                    description={item.description || '—'}
                  />
                </List.Item>
              )}
            />
          )}
        </>
      )
    }
    // modal 模式：使用下拉搜索 + 确认按钮
    return (
      <Select
        showSearch
        allowClear
        placeholder="搜索视图名称或ID"
        filterOption={false}
        notFoundContent={loading ? <Spin size="small" /> : null}
        onSearch={(q) => { debouncedSearch(q) }}
        onFocus={() => { loadAll('').catch(console.error) }}
        options={views.map(v => ({ label: `${v.name}（ID:${v.id}）`, value: Number(v.id) }))}
        value={selected}
        onChange={(v) => setSelected(v)}
        style={{ width: '100%' }}
      />
    )
  })()

  if (mode === 'drawer') {
    return (
      <Drawer className="view-picker-drawer" title={title || '选择视图'} placement="right" width={420} open={open} onClose={onClose} destroyOnClose bodyStyle={{ paddingBottom: 16 }}>
        {content}
      </Drawer>
    )
  }

  return (
    <Modal
      title={title || '选择视图'}
      open={open}
      onCancel={onClose}
      okButtonProps={{ disabled: typeof selected !== 'number' }}
      onOk={() => { if (typeof selected === 'number') onConfirm(selected) }}
      destroyOnClose
    >
      {content}
    </Modal>
  )
}

export default ViewPicker
