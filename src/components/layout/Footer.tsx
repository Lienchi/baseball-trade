import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-scoreboard/10 bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="text-xs text-dugout">
          <p className="font-bold text-scoreboard">本質球迷交易所 BEN2 FAN EXCHANGE</p>
          <p className="mt-1">球迷自營交易平台，不經手金流，交易風險請自行評估</p>
        </div>
        <nav className="flex items-center gap-4 text-xs">
          <Link href="/terms" className="font-medium text-dugout hover:text-scoreboard hover:underline">
            網站規定
          </Link>
          <Link href="/terms" className="font-medium text-dugout hover:text-scoreboard hover:underline">
            免責聲明
          </Link>
        </nav>
      </div>
    </footer>
  )
}
