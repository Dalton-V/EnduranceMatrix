import { useEffect, useState } from 'react'
import { createProgressStore, STORAGE_KEY } from './progressStorage.js'

export function useSkillProgress() {
  const [store] = useState(() => createProgressStore(() => window.localStorage))
  const [snapshot, setSnapshot] = useState(() => store.load())
  useEffect(() => {
    const refresh = event => {
      if (event.key === null || event.key === STORAGE_KEY) setSnapshot(store.load())
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [store])
  const changeProgress = (change, options) => setSnapshot(store.update(change, options))
  return { ...snapshot, changeProgress }
}
