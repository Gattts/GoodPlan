const NO_BREAK_SPACE = String.fromCharCode(0xa0)

/** Troca o espaço fixo que o Intl põe em "R$ 10,00" por espaço comum, para comparar textos. */
export const plain = (text: string | null | undefined) => (text ?? '').replaceAll(NO_BREAK_SPACE, ' ')
