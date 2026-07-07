// Advisory "collected today" state: a lightweight localStorage map
// (dailyLog[itemId] = ISO date). Purely cosmetic progress-keeping — it never
// alters computed material counts; real numbers only ever come from sync.

import { useState } from 'react'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../../state/storage'

const todayISO = () => new Date().toISOString().slice(0, 10)

export function useDailyLog() {
  const [log, setLog] = useState<Record<number, string>>(() =>
    loadJSON<Record<number, string>>(STORAGE_KEYS.dailyLog, {}),
  )
  const collectedToday = (itemId: number) => log[itemId] === todayISO()
  const toggle = (itemId: number) => {
    setLog((prev) => {
      const next = { ...prev }
      if (next[itemId] === todayISO()) delete next[itemId]
      else next[itemId] = todayISO()
      saveJSON(STORAGE_KEYS.dailyLog, next)
      return next
    })
  }
  return { collectedToday, toggle }
}
