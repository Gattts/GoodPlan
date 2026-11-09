import { useId, useState } from 'react'

import { parseDecimal } from '@/domain/calc'

type DecimalFieldProps = {
  label: string
  value: number | null
  /** Só recebe números válidos; texto vazio chega como null. */
  onChange: (value: number | null) => void
  /** Ao sair com texto recusado, desfaz o que a digitação já aplicou; null: não havia número. Sem ela, usa o onChange. */
  onRevert?: (value: number | null) => void
  validate?: (value: number) => string | null
  placeholder?: string
  className?: string
  labelClassName?: string
  inputClassName?: string
  errorClassName?: string
}

const toText = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

/** Campo de número que aceita o jeito brasileiro ("80,50"), com o erro ligado ao campo para leitores de tela. */
export function DecimalField({
  label,
  value,
  onChange,
  onRevert,
  validate,
  placeholder,
  className,
  labelClassName,
  inputClassName,
  errorClassName,
}: DecimalFieldProps) {
  const id = useId()
  const errorId = `${id}-erro`
  const [text, setText] = useState(() => toText(value))
  const [error, setError] = useState<string | null>(null)
  const [shownValue, setShownValue] = useState(value)
  const [valueOnFocus, setValueOnFocus] = useState(value)

  // O valor mudou por fora (ex.: "Começar do zero" ou a cotação que chegou agora): o texto acompanha, a menos que já
  // represente o mesmo número, e é para esse valor que o campo volta se a pessoa sair com texto recusado.
  if (value !== shownValue) {
    setShownValue(value)
    if (parseDecimal(text) !== value) {
      setText(toText(value))
      setError(null)
      setValueOnFocus(value)
    }
  }

  const handleChange = (raw: string) => {
    setText(raw)
    if (raw.trim() === '') {
      setError(null)
      onChange(null)
      return
    }
    const parsed = parseDecimal(raw)
    const message = parsed === null ? 'Digite um número.' : (validate?.(parsed) ?? null)
    setError(message)
    if (parsed !== null && message === null) onChange(parsed)
  }

  // O if importa: um set com o mesmo valor fica na fila do React e, mais tarde, desfaz o que o render gravou acima.
  const handleFocus = () => {
    if (value !== valueOnFocus) setValueOnFocus(value)
  }

  // Digitando, os números válidos do caminho já valem ("150" passa por 1 e 15). Ao sair com texto recusado, tudo volta
  // ao que estava; campo vazio que não aceita vazio volta a mostrar o número que continua valendo.
  const handleBlur = () => {
    if (error !== null) {
      setError(null)
      setText(toText(valueOnFocus))
      if (value !== valueOnFocus) (onRevert ?? onChange)(valueOnFocus)
    } else if (text.trim() === '' && value !== null) {
      setText(toText(value))
    }
  }

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClassName}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(event) => handleChange(event.target.value)}
      />
      {error ? (
        <p id={errorId} className={errorClassName}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
