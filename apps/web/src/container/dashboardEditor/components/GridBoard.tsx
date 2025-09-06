import React from 'react'
import GridLayout, { type Layout } from 'react-grid-layout'

export interface GridBoardProps {
  layout: Layout[]
  cols: number
  rowHeight: number
  width: number
  margin: [number, number]
  containerPadding: [number, number]
  autoSize?: boolean
  verticalCompact?: boolean
  preventCollision?: boolean
  isDraggable?: boolean
  isResizable?: boolean
  resizeHandles?: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'>
  transformScale?: number
  onLayoutChange?: (layout: Layout[]) => void
  innerRef?: React.Ref<HTMLDivElement>
  children: React.ReactNode
  showTofuGrid?: boolean
  tofuGridColor?: string
  tofuGridSize?: number
}

export const GridBoard: React.FC<GridBoardProps> = ({
  layout,
  cols,
  rowHeight,
  width,
  margin,
  containerPadding,
  autoSize = true,
  verticalCompact = true,
  preventCollision = false,
  isDraggable = true,
  isResizable = true,
  resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
  transformScale = 1,
  onLayoutChange,
  innerRef,
  children,
  showTofuGrid = true,
  // 作为小方块描边颜色（更贴近截图中的 #E5EAF3）
  tofuGridColor = '#E5EAF3',
  tofuGridSize = 8
}) => {
  // 依据 react-grid-layout 的列宽计算（考虑 margin 和 containerPadding），确保背景与网格对齐
  const safeCols = Math.max(1, cols)
  const [marginX, marginY] = margin
  const padX = containerPadding[0]
  const padY = containerPadding[1]
  const colWidth = Math.max(1, (width - padX * 2 - marginX * (safeCols - 1)) / safeCols)
  // 每个“格子”的总宽高 = 单元格宽/高 + 间距
  const tileW = colWidth + marginX
  const tileH = rowHeight + marginY

  // 使用更细腻的“小网格”背景：以 tofuGridSize 为单位的细网格线，避免大格子视觉
  let bg: React.CSSProperties | undefined
  if (showTofuGrid) {
    const color = tofuGridColor
    const size = Math.max(2, tofuGridSize || 8)
    bg = {
      // backgroundImage: `
      //   linear-gradient(${color} 1px, transparent 1px),
      //   linear-gradient(90deg, ${color} 1px, transparent 1px)
      // `,
      // backgroundSize: `${size}px ${size}px`,
      // backgroundRepeat: 'repeat',
      // // 与容器内边距对齐，避免网格与内容错位
      // backgroundPosition: `${padX}px ${padY}px`
    }
  }

  return (
    <GridLayout
      className="layout"
      layout={layout}
      cols={cols}
      rowHeight={rowHeight}
      width={width}
      margin={margin}
      containerPadding={containerPadding}
      autoSize={autoSize}
      verticalCompact={verticalCompact}
      preventCollision={preventCollision}
      isDraggable={isDraggable}
      isResizable={isResizable}
      resizeHandles={resizeHandles}
      useCSSTransforms
      isBounded={false}
      transformScale={transformScale}
      onLayoutChange={onLayoutChange}
      innerRef={innerRef}
      style={bg}
    >
      {children}
    </GridLayout>
  )
}

export default GridBoard
