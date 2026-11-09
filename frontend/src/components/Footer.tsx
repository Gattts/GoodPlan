function Source({ href, children }: { href: string; children: string }) {
  return (
    <a
      className="text-link underline underline-offset-2 hover:decoration-2"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

export function Footer() {
  return (
    <footer className="grid max-w-[90ch] gap-1 text-[13px] text-muted">
      <p>
        Fontes dos dados: <Source href="https://frankfurter.dev">Frankfurter</Source> (cotações),{' '}
        <Source href="https://ourairports.com/data/">OurAirports</Source> (aeroportos) e{' '}
        <Source href="https://cldr.unicode.org">Unicode CLDR</Source> (nomes de países e moedas).
      </p>
      <p>Valores de referência. Confira as taxas com o seu banco ou cartão.</p>
    </footer>
  )
}
