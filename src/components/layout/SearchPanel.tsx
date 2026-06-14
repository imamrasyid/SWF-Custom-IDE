import { useState, useEffect, useMemo } from 'react'
import { Search, Loader2, ChevronDown, ChevronRight, CaseSensitive, WholeWord, Regex, Replace } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'

type SearchResult = {
  className: string
  lineNumber: number
  lineContent: string
}

type GroupedResults = {
  [className: string]: SearchResult[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export default function SearchPanel() {
  const swfPath = useAppStore((s) => s.swfPath)
  const openFileForEditing = useAppStore((s) => s.openFileForEditing)
  const triggerJumpToLine = useAppStore((s) => s.triggerJumpToLine)
  const { show } = useToast()

  const [query, setQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)

  const debouncedQuery = useDebounce(query, 300)

  // Group results by className
  const groupedResults = useMemo(() => {
    const groups: GroupedResults = {}
    for (const result of results) {
      if (!groups[result.className]) {
        groups[result.className] = []
      }
      groups[result.className].push(result)
    }
    return groups
  }, [results])

  const totalMatches = results.length
  const totalFiles = Object.keys(groupedResults).length

  // Perform search when debounced query or options change
  useEffect(() => {
    performSearch(debouncedQuery, caseSensitive, wholeWord, useRegex)
  }, [debouncedQuery, caseSensitive, wholeWord, useRegex])

  const performSearch = async (val: string, cs: boolean, ww: boolean, rx: boolean) => {
    if (!swfPath) return
    if (!val.trim()) {
      setResults([])
      setExpandedFiles(new Set())
      return
    }
    setIsSearching(true)
    try {
      const searchRes = await window.electronAPI.searchScripts(swfPath, val, {
        caseSensitive: cs,
        wholeWord: ww,
        useRegex: rx
      })
      setResults(searchRes)
      // Auto-expand all files when results come in
      const files = new Set(searchRes.map(r => r.className))
      setExpandedFiles(files)
    } catch (err) {
      console.error(err)
      show('Search failed', 'error')
    } finally {
      setIsSearching(false)
    }
  }

  const toggleFile = (className: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(className)) {
        next.delete(className)
      } else {
        next.add(className)
      }
      return next
    })
  }

  const handleResultClick = (className: string, lineNumber: number) => {
    openFileForEditing(className)
    // Small delay to ensure file is loaded, then jump to line
    setTimeout(() => {
      triggerJumpToLine(lineNumber)
    }, 100)
  }

  const handleReplaceAll = async () => {
    if (!swfPath || !query.trim() || results.length === 0) return
    
    const classNames = Array.from(new Set(results.map(r => r.className)))
    const totalOccurrences = results.length
    
    if (!confirm(`Replace all ${totalOccurrences} occurrence(s) of "${query}" with "${replaceQuery}" in ${classNames.length} file(s)?`)) {
      return
    }

    useAppStore.setState({ isLoading: true, loadingStatus: `Replacing ${totalOccurrences} occurrence(s) across ${classNames.length} file(s)...` })
    try {
      let successCount = 0
      let replaceCount = 0
      for (const className of classNames) {
        const code = await window.electronAPI.readScript(swfPath, className)
        const occurrences = code.split(query).length - 1
        if (occurrences > 0) {
          const updatedCode = code.replaceAll(query, replaceQuery)
          const success = await window.electronAPI.writeScript(swfPath, className, updatedCode)
          if (success) {
            successCount++
            replaceCount += occurrences
            useAppStore.getState().addLocalHistoryEntry(className, updatedCode)
          }
        }
      }

      show(`Replaced ${replaceCount} occurrence(s) in ${successCount} file(s).`, 'success')
      await useAppStore.getState().loadSwf(swfPath, true)
      performSearch(query, caseSensitive, wholeWord, useRegex)
    } catch (err: any) {
      console.error(err)
      show(`Replace failed: ${err.message || err}`, 'error')
    } finally {
      useAppStore.setState({ isLoading: false })
    }
  }

  return (
    <div className="explorer-panel flex flex-col h-full bg-[#0a0f1b] border-r border-slate-900/80">
      <div className="px-4 py-3 border-b border-slate-900/60 font-extrabold text-slate-200 text-xs tracking-wider bg-slate-950/20 uppercase select-none">
        SEARCH WORKSPACE
      </div>

      <div className="p-4 border-b border-slate-900/40 flex flex-col gap-2.5">
        {/* Search input with toggle replace button */}
        <div className="flex gap-2 items-start">
          {/* Toggle replace button - like VS Code */}
          <button
            onClick={() => setShowReplace(!showReplace)}
            className={`mt-1.5 p-1 rounded transition-all cursor-pointer shrink-0 ${
              showReplace 
                ? 'text-indigo-400 rotate-90' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={showReplace ? "Hide Replace" : "Show Replace"}
          >
            <ChevronRight size={14} />
          </button>
          
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Search input */}
            <div className="relative flex items-center bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 w-full">
              <Search size={13} className="text-slate-500 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search text in classes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none flex-1 min-w-0 w-full"
              />
              {/* Search options toggles */}
              <div className="flex items-center gap-1 shrink-0 ml-1.5 border-l border-slate-800 pl-1.5">
                <button
                  onClick={() => setCaseSensitive(!caseSensitive)}
                  className={`p-0.5 rounded hover:bg-slate-800 transition-colors ${caseSensitive ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-550'}`}
                  title="Match Case (Aa)"
                >
                  <CaseSensitive size={12} />
                </button>
                <button
                  onClick={() => setWholeWord(!wholeWord)}
                  className={`p-0.5 rounded hover:bg-slate-800 transition-colors ${wholeWord ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-550'}`}
                  title="Match Whole Word (\b)"
                >
                  <WholeWord size={12} />
                </button>
                <button
                  onClick={() => setUseRegex(!useRegex)}
                  className={`p-0.5 rounded hover:bg-slate-800 transition-colors ${useRegex ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-550'}`}
                  title="Use Regular Expression (.*)"
                >
                  <Regex size={12} />
                </button>
              </div>
            </div>

            {/* Replace input - only when expanded */}
            {showReplace && (
              <div className="relative flex items-center bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 w-full animate-slide-in-top">
                <span className="text-slate-600 mr-2 shrink-0 text-xs">→</span>
                <input
                  type="text"
                  placeholder="Replace with..."
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none flex-1 min-w-0 w-full"
                />
              </div>
            )}
          </div>
          
          {/* Replace All button - positioned on the right */}
          {showReplace && (
            <button
              onClick={handleReplaceAll}
              disabled={results.length === 0 || !query.trim()}
              className="mt-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-650 disabled:bg-slate-950/40 disabled:text-slate-600 disabled:cursor-not-allowed border border-indigo-500/20 text-slate-200 rounded-lg transition-all shrink-0 cursor-pointer relative"
              title={`Replace all ${results.length} occurrence(s)`}
            >
              <Replace size={14} />
              {results.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-indigo-500 text-white px-1 py-0 rounded-full font-bold">
                  {results.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Results header */}
      {query.trim() && !isSearching && (
        <div className="px-4 py-2 text-[10px] text-slate-500 border-b border-slate-900/40 bg-slate-950/20 select-none">
          {totalMatches > 0 ? (
            <span>
              <span className="text-slate-300 font-bold">{totalMatches}</span> results in{' '}
              <span className="text-slate-300 font-bold">{totalFiles}</span> file{totalFiles !== 1 ? 's' : ''}
            </span>
          ) : (
            <span>No results found</span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {isSearching ? (
          <div className="flex items-center justify-center p-8 gap-2 text-slate-500 text-xs">
            <Loader2 size={14} className="animate-spin text-indigo-400" />
            <span>Searching classes...</span>
          </div>
        ) : Object.keys(groupedResults).length === 0 ? (
          <div className="text-slate-600 text-xs p-8 text-center leading-relaxed select-none">
            {query.trim() 
              ? 'No results found.' 
              : 'Search for methods, variables, or definitions across all ActionScript classes in the SWF.'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {Object.entries(groupedResults).map(([className, matches]) => {
              const isExpanded = expandedFiles.has(className)
              const fileName = className.split('.').pop()
              const packageName = className.split('.').slice(0, -1).join('.')
              
              return (
                <div key={className}>
                  {/* File header - clickable to expand/collapse */}
                  <div
                    onClick={() => toggleFile(className)}
                    className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-900/60 rounded cursor-pointer select-none group"
                  >
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight size={12} className="text-slate-500 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200">
                      {fileName}.as
                    </span>
                    <span className="text-[9px] text-slate-600 truncate">
                      {packageName}
                    </span>
                    <span className="ml-auto text-[9px] text-slate-600 font-mono">
                      {matches.length}
                    </span>
                  </div>

                  {/* Matches inside file */}
                  {isExpanded && (
                    <div className="ml-4 space-y-0.5">
                      {matches.map((match, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleResultClick(className, match.lineNumber)}
                          className="flex items-start gap-2 px-2 py-1 hover:bg-slate-900/60 rounded cursor-pointer group"
                        >
                          <span className="text-[9px] text-slate-600 font-mono font-bold shrink-0 w-8 text-right">
                            :{match.lineNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono flex-1 truncate group-hover:text-slate-200">
                            {match.lineContent.trim()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
