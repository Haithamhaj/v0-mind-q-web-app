"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Play, FileText, CheckCircle2, Activity, Settings, Database, Brain } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Pipeline", href: "/pipeline", icon: Play },
  { name: "Phases", href: "/phases", icon: Activity },
  { name: "Results", href: "/results", icon: FileText },
  { name: "BI Intelligence", href: "/bi-intelligence", icon: Brain },
  { name: "SLA Compliance", href: "/sla", icon: CheckCircle2 },
  { name: "Data Sources", href: "/sources", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <h1 className="text-2xl font-bold text-foreground">
          Mind-<span className="text-primary">Q</span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="text-xs text-muted-foreground">
          <p className="font-semibold">Mind-Q V4</p>
          <p>Logistics Intelligence Platform</p>
        </div>
      </div>
    </div>
  )
}
