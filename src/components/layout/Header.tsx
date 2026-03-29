import { Link } from "react-router-dom"
import { ScanLine } from "lucide-react"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link to="/" className="flex items-center space-x-2">
          <ScanLine className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg text-text-primary tracking-tight">마마스캔</span>
        </Link>
      </div>
    </header>
  )
}
