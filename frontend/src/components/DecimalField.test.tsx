import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DecimalField } from './DecimalField'

function Harness({ initial, acceptsEmpty }: { initial: number | null; acceptsEmpty: boolean }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DecimalField
        label="Campo"
        value={value}
        validate={(number) => (number <= 100 ? null : 'Alto demais.')}
        onChange={(next) => {
          if (next !== null || acceptsEmpty) setValue(next)
        }}
      />
      <span data-testid="salvo">{String(value)}</span>
    </>
  )
}

const noop = () => undefined
const field = () => screen.getByLabelText('Campo')
const saved = () => screen.getByTestId('salvo').textContent

describe('DecimalField', () => {
  it('não acusa erro no meio de "80,50", logo depois da vírgula', async () => {
    const user = userEvent.setup()
    render(<Harness initial={50} acceptsEmpty />)
    await user.clear(field())
    await user.type(field(), '80,')
    expect(field()).not.toHaveAccessibleDescription()
    await user.type(field(), '50')
    expect(saved()).toBe('80.5')
  })

  it('digitado até ficar inválido, mostra o erro e volta ao número de antes ao sair do campo', async () => {
    const user = userEvent.setup()
    render(<Harness initial={50} acceptsEmpty />)
    await user.clear(field())
    await user.type(field(), '150') // passa por 1 e 15, que são válidos
    expect(field()).toHaveAccessibleDescription('Alto demais.')
    await user.tab()
    expect(field()).toHaveValue('50')
    expect(field()).not.toHaveAccessibleDescription()
    expect(saved()).toBe('50')
  })

  it('campo que não aceita vazio volta a mostrar o número em vigor ao sair', async () => {
    const user = userEvent.setup()
    render(<Harness initial={50} acceptsEmpty={false} />)
    await user.clear(field())
    await user.tab()
    expect(field()).toHaveValue('50')
    expect(saved()).toBe('50')
  })

  it('sem valor ao entrar, texto recusado desfaz o número parcial pelo onRevert', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onRevert = vi.fn()
    function Field() {
      const [value, setValue] = useState<number | null>(null)
      return (
        <DecimalField
          label="Campo"
          value={value}
          onChange={(next) => {
            onChange(next)
            if (next !== null) setValue(next)
          }}
          onRevert={(next) => {
            onRevert(next)
            setValue(next)
          }}
        />
      )
    }
    render(<Field />)
    await user.type(field(), '6-')
    expect(field()).toHaveAccessibleDescription('Digite um número.')
    await user.tab()
    expect(field()).toHaveValue('')
    expect(onRevert).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('valor que chega de fora com o foco no campo passa a ser o valor a restaurar', async () => {
    const user = userEvent.setup()
    const onRevert = vi.fn()
    const view = (value: number | null) => (
      <DecimalField label="Campo" value={value} onChange={noop} onRevert={onRevert} />
    )
    const { rerender } = render(view(null))
    await user.click(field())
    rerender(view(6.1463))
    expect(field()).toHaveValue('6,1463')
    await user.clear(field())
    await user.type(field(), 'x')
    await user.tab()
    expect(field()).toHaveValue('6,1463')
    expect(onRevert).not.toHaveBeenCalled()
  })

  it('campo que aceita vazio continua vazio ao sair', async () => {
    const user = userEvent.setup()
    render(<Harness initial={50} acceptsEmpty />)
    await user.clear(field())
    await user.tab()
    expect(field()).toHaveValue('')
    expect(saved()).toBe('null')
  })
})
