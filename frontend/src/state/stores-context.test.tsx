import { act, fireEvent, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyTrip } from '@/domain/example'
import { PREFS_KEY } from '@/storage/stores'
import { createTestStores, renderApp } from '@/test/render'
import { blockedStorage, memoryStorage } from '@/test/storage'

import { StoresProvider, useTrip } from './stores-context'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.documentElement.removeAttribute('data-theme')
})

describe('estado da viagem', () => {
  it('editar tira a marca de exemplo e Começar do zero esvazia a viagem', () => {
    const stores = createTestStores()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoresProvider value={stores}>{children}</StoresProvider>
    )
    const { result } = renderHook(() => useTrip(), { wrapper })
    expect(result.current.trip.isExample).toBe(true)
    act(() => result.current.update({ people: 3 }))
    expect(result.current.trip.people).toBe(3)
    expect(result.current.trip.isExample).toBe(false)
    act(() => result.current.reset())
    expect(result.current.trip).toEqual(emptyTrip())
  })

  it('o cabeçalho diz onde a viagem fica salva', () => {
    renderApp({ storage: memoryStorage() })
    expect(screen.getByText('Salvo neste navegador')).toBeInTheDocument()
  })

  it('com o armazenamento bloqueado, o cabeçalho avisa', () => {
    renderApp({ storage: blockedStorage() })
    expect(screen.getByText('Não consigo salvar neste navegador')).toBeInTheDocument()
  })

  it('o tema escolhido é aplicado e fica salvo', () => {
    const storage = memoryStorage()
    renderApp({ storage })
    fireEvent.change(screen.getByRole('combobox', { name: 'Tema' }), { target: { value: 'dark' } })
    expect(document.documentElement.dataset.theme).toBe('dark')
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(JSON.parse(storage.get(PREFS_KEY)!).prefs.theme).toBe('dark')
  })
})
