"use client"

import { useState, useRef } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SearchBarProps {
  onSearch: (query: string) => void
  isLoading: boolean
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length >= 2) {
      onSearch(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 w-full max-w-2xl">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar produto (ex: arroz emporio sao joao)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11 text-base"
          disabled={isLoading}
          autoFocus
        />
      </div>
      <Button type="submit" size="lg" disabled={isLoading || query.trim().length < 2}>
        {isLoading ? "Buscando..." : "Comparar"}
      </Button>
    </form>
  )
}
