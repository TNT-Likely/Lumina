import React from 'react'
import { Modal, Form } from 'antd'

export interface ModalFormProps<T extends Record<string, unknown> = Record<string, unknown>> {
  open: boolean
  title: React.ReactNode
  initialValues?: Partial<T>
  onCancel?: () => void
  onFinish?: ( values: T ) => Promise<void> | void
  submitText?: string
  children?: React.ReactNode
}

const ModalForm = <T extends Record<string, unknown>, >( { open, title, initialValues, onCancel, onFinish, submitText = '确定', children }: ModalFormProps<T> ) => {
  const [form] = Form.useForm<T>()
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={async () => {
        const values = await form.validateFields()
        await onFinish?.( values as T )
      }}
      okText={submitText}
    >
      <Form<T> form={form} layout="vertical" initialValues={initialValues}>
        {children}
      </Form>
    </Modal>
  )
}

export default ModalForm
