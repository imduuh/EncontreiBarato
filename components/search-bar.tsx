"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getSupportedLocationsByState, getSupportedStates } from "@/lib/regions"

interface SearchBarProps {
  onSearch: (params: { query: string; city: string; state: string; locationKey: string }) => void
  isLoading: boolean
}

const supportedStates = getSupportedStates()

function getDefaultState(): string {
  return supportedStates.includes("SP") ? "SP" : (supportedStates[0] || "")
}

function getDefaultCity(state: string): string {
  const locations = getSupportedLocationsByState(state)
  const bauruLocation = locations.find((location) => location.city === "Bauru")
  return bauruLocation?.city || locations[0]?.city || ""
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [state, setState] = useState(getDefaultState)
  const supportedLocations = useMemo(() => getSupportedLocationsByState(state), [state])
  const [city, setCity] = useState(() => getDefaultCity(getDefaultState()))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!supportedLocations.some((location) => location.city === city)) {
      setCity(getDefaultCity(state))
    }
  }, [city, state, supportedLocations])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedQuery = query.trim()
    const trimmedState = state.trim().toUpperCase()
    const selectedLocation =
      supportedLocations.find((location) => location.city === city) || supportedLocations[0]

    if (trimmedQuery.length >= 3 && selectedLocation && trimmedState.length === 2) {
      onSearch({
        query: trimmedQuery,
        city: selectedLocation.city,
        state: trimmedState,
        locationKey: selectedLocation.key,
      })
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-[1.9rem] border border-white/10 bg-slate-900/70 p-4 shadow-[0_28px_90px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar produto (ex: Nutella 650g)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-16 rounded-[1.35rem] border-white/10 bg-white/6 pl-14 text-base text-white placeholder:text-slate-400"
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_112px_auto]">
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={isLoading || supportedLocations.length === 0}
              className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-slate-900 pl-11 pr-10 text-sm text-white outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]"
              aria-label="Cidade"
            >
              {supportedLocations.map((location) => (
                <option
                  key={location.key}
                  value={location.city}
                  className="bg-slate-900 text-white"
                >
                  {location.city}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={isLoading || supportedStates.length === 0}
              className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-slate-900 px-4 pr-10 text-sm font-semibold text-white outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]"
              aria-label="Estado"
            >
              {supportedStates.map((uf) => (
                <option key={uf} value={uf} className="bg-slate-900 text-white">
                  {uf}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isLoading || query.trim().length < 3 || !city}
            className="h-12 rounded-2xl px-6 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_-18px_rgba(52,211,153,0.85)]"
          >
            {isLoading ? "Buscando..." : "Comparar preços"}
          </Button>
        </div>

        <p className="px-1 text-xs text-slate-400">
          {"Escolha sua cidade e o estado para consultar apenas os mercados compatíveis com a sua região."}
        </p>
      </div>
    </form>
  )
}
