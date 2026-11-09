import { useEffect } from 'react'

import { BoardingPass } from '@/components/BoardingPass'
import { Calculator } from '@/components/Calculator'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { usePrefs, useSaveStatus } from '@/state/stores-context'
import { applyTheme } from '@/theme'

const SAVE_STATUS_TEXT = {
  local: 'Salvo neste navegador',
  failed: 'Não consigo salvar neste navegador',
} as const

export default function App() {
  const { prefs, update } = usePrefs()
  const saveStatus = useSaveStatus()
  useEffect(() => applyTheme(prefs.theme), [prefs.theme])

  return (
    <div className="mx-auto grid max-w-[1180px] gap-4 px-4 pt-4 pb-14">
      <Header
        saveStatus={SAVE_STATUS_TEXT[saveStatus]}
        theme={prefs.theme}
        onThemeChange={(theme) => update({ theme })}
      />
      {/* Cartão e calculadora lado a lado a partir de 1.100 px; abaixo disso, empilhados (cartão primeiro). */}
      <main className="grid items-start gap-7 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <BoardingPass />
        <aside className="min-[1100px]:sticky min-[1100px]:top-3">
          <Calculator />
        </aside>
      </main>
      <Footer />
    </div>
  )
}
