import React, { useMemo } from 'react'
import { Select, TimePicker, Input } from 'antd'
import dayjs from 'dayjs'

const { Option } = Select

const weekOptions = [
  { label: '周一', value: '1' },
  { label: '周二', value: '2' },
  { label: '周三', value: '3' },
  { label: '周四', value: '4' },
  { label: '周五', value: '5' },
  { label: '周六', value: '6' },
  { label: '周日', value: '0' }
]

const monthOptions = Array.from( { length: 28 }, ( _, i ) => ( { label: `${i + 1}号`, value: String( i + 1 ) } ) )

export interface CronPickerProps {
  value?: string
  onChange?: ( val: string ) => void
}

export const CronPicker: React.FC<CronPickerProps> = ( { value, onChange } ) => {
  // 解析cron表达式为各控件状态
  const parseValue = ( val?: string ) => {
    // 只支持标准5字段，否则一律custom
    if ( !val ) {
      return {
        mode: 'day' as const,
        time: dayjs( '08:00', 'HH:mm' ),
        week: '1',
        month: '1',
        custom: ''
      }
    }
    const arr = val.split( ' ' )
    if ( arr.length !== 5 ) {
      return {
        mode: 'custom' as const,
        time: dayjs( '08:00', 'HH:mm' ),
        week: '1',
        month: '1',
        custom: val
      }
    }
    // day: 0 8 * * *
    if ( /^\d+ \d+ \* \* \*$/.test( val ) ) {
      const arrDay = val.split( ' ' )
      return {
        mode: 'day' as const,
        time: dayjs( `${arrDay[1]}:${arrDay[0]}`, 'HH:mm' ),
        week: '1',
        month: '1',
        custom: ''
      }
    }
    // week: 0 8 * * 1
    if ( /^\d+ \d+ \* \* \d$/.test( val ) ) {
      const arrWeek = val.split( ' ' )
      return {
        mode: 'week' as const,
        time: dayjs( `${arrWeek[1]}:${arrWeek[0]}`, 'HH:mm' ),
        week: arrWeek[4],
        month: '1',
        custom: ''
      }
    }
    // month: 0 8 5 * *
    if ( /^\d+ \d+ \d+ \* \*$/.test( val ) ) {
      const arrMonth = val.split( ' ' )
      return {
        mode: 'month' as const,
        time: dayjs( `${arrMonth[1]}:${arrMonth[0]}`, 'HH:mm' ),
        week: '1',
        month: arrMonth[2],
        custom: ''
      }
    }
    // custom
    // 尝试从 custom 恢复 time 字段
    let customTime = dayjs( '08:00', 'HH:mm' )
    const arrCustom = val.split( ' ' )
    if ( arrCustom.length >= 2 && !isNaN( Number( arrCustom[1] ) ) && !isNaN( Number( arrCustom[0] ) ) ) {
      customTime = dayjs( `${arrCustom[1]}:${arrCustom[0]}`, 'HH:mm' )
    }
    return {
      mode: 'custom' as const,
      time: customTime,
      week: '1',
      month: '1',
      custom: val
    }
  }

  const [{ mode, time, week, month, custom }, setState] = React.useState( () => parseValue( value ) )

  // 仅外部 value 变化时才 parseValue，且 custom 只在外部 value 变化时才被覆盖
  React.useEffect( () => {
    setState( prev => {
      const parsed = parseValue( value )
      // 只有外部 value 变化且和当前 cron 不一致时才 parse
      if ( prev.mode === 'custom' && value === prev.custom ) {
        return prev
      }
      // 保留 custom 输入内容，除非外部 value 变化
      if ( parsed.mode === 'custom' ) {
        // 如果 custom 恢复时，time 字段和上次不同，则用 custom 的 time
        return { ...parsed, custom: value ?? '', time: parsed.time }
      }
      return parsed
    } )
  }, [value] )

  // 生成cron表达式
  const cron = useMemo( () => {
    const min = time.minute()
    const hour = time.hour()
    if ( mode === 'day' ) return `${min} ${hour} * * *`
    if ( mode === 'week' ) return `${min} ${hour} * * ${week}`
    if ( mode === 'month' ) return `${min} ${hour} ${month} * *`
    if ( mode === 'custom' ) return custom
    return ''
  }, [mode, time, week, month, custom] )

  React.useEffect( () => {
    onChange?.( cron )
  }, [cron] )

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Select style={{ width: 100 }} value={mode} onChange={val => {
        setState( s => {
          if ( val === 'custom' ) {
            // 切换到自定义时，保留当前 custom 内容
            return { ...s, mode: val, custom: s.custom }
          }
          // 切换到其他模式时，不重置 custom
          return { ...s, mode: val }
        } )
      }}>
        <Option value="day">每天</Option>
        <Option value="week">每周</Option>
        <Option value="month">每月</Option>
        <Option value="custom">自定义</Option>
      </Select>
      <TimePicker
        value={time}
        onChange={val => { if ( val ) setState( s => ( { ...s, time: val } ) ) }}
        format="HH:mm"
        minuteStep={1}
        style={{ width: 90 }}
        disabled={mode === 'custom'}
      />
      {mode === 'week' && (
        <Select style={{ width: 90 }} value={week} onChange={val => { setState( s => ( { ...s, week: val } ) ) }}>
          {weekOptions.map( opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option> )}
        </Select>
      )}
      {mode === 'month' && (
        <Select style={{ width: 90 }} value={month} onChange={val => { setState( s => ( { ...s, month: val } ) ) }}>
          {monthOptions.map( opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option> )}
        </Select>
      )}
      {mode === 'custom' && (
        <Input
          style={{ width: 180 }}
          value={custom}
          onChange={e => {
            const v = e.target.value
            setState( s => ( { ...s, custom: v } ) )
          }}
          placeholder="自定义cron表达式"
        />
      )}
    </div>
  )
}
