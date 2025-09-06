// src/components/ChartBuilder/components/DraggableField.tsx
import React from 'react'
import { Tag } from 'antd'
import { DragOutlined } from '@ant-design/icons'
import { useDrag } from 'react-dnd'
import type { DatasetField } from '@lumina/types'
import { getFieldTagColor } from '../../../constants/fieldColors'

interface DraggableFieldProps {
  field: DatasetField
}

const DraggableField: React.FC<DraggableFieldProps> = ({ field }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'field',
    item: { field },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  })

  return (
    <div
      ref={drag}
      className={`draggable-field ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="field-content single-row">
        <DragOutlined className="drag-icon" />
        <span className="field-name">{field.name}</span>
        <span className="field-spacer" />
        <Tag color={getFieldTagColor(field.type)}>{field.type}</Tag>
      </div>
    </div>
  )
}

export default DraggableField
