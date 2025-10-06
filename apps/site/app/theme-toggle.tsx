"use client"
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const d = localStorage.getItem('theme') === 'dark'
    setDark(d)
    document.documentElement.classList.toggle('dark', d)
  }, [])
  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }
  return (
    <button aria-label="Toggle dark mode" onClick={toggle} className="fixed bottom-5 right-5 rounded-full border bg-card p-3 shadow-soft">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

