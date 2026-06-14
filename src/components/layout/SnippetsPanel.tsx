import { useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { X, Plus, Trash2, Edit3, Save, Code, Search } from 'lucide-react'
import type { CodeSnippet } from '../../stores/slices/snippets-slice'

interface SnippetsPanelProps {
  onClose: () => void
  onSelect?: (snippet: CodeSnippet) => void
}

export default function SnippetsPanel({ onClose, onSelect }: SnippetsPanelProps) {
  const snippets = useAppStore((s) => s.snippets)
  const addSnippet = useAppStore((s) => s.addSnippet)
  const removeSnippet = useAppStore((s) => s.removeSnippet)
  const updateSnippet = useAppStore((s) => s.updateSnippet)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    prefix: '',
    body: '',
    description: '',
    language: 'actionscript'
  })

  const filteredSnippets = snippets.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.prefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSave = () => {
    if (editingId) {
      updateSnippet(editingId, formData)
      setEditingId(null)
    } else {
      addSnippet(formData)
    }
    setShowNewForm(false)
    setFormData({ name: '', prefix: '', body: '', description: '', language: 'actionscript' })
  }

  const handleEdit = (snippet: CodeSnippet) => {
    setEditingId(snippet.id)
    setFormData({
      name: snippet.name,
      prefix: snippet.prefix,
      body: snippet.body,
      description: snippet.description,
      language: snippet.language
    })
    setShowNewForm(true)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-slide-up backdrop-blur-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Code size={20} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">Code Snippets</h3>
              <p className="text-xs text-slate-400 mt-0.5">{snippets.length} snippets available</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-900 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {/* Snippets List */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {filteredSnippets.map((snippet) => (
            <div
              key={snippet.id}
              className="flex items-start gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-900/60 hover:border-slate-800/80 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200">{snippet.name}</span>
                  <span className="text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 px-1.5 py-0.5 rounded font-mono">
                    {snippet.prefix}
                  </span>
                  {snippet.isBuiltIn && (
                    <span className="text-[9px] bg-slate-800/50 text-slate-500 px-1.5 py-0.5 rounded">
                      Built-in
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{snippet.description}</p>
                <pre className="mt-2 text-[10px] text-slate-400 bg-slate-900/50 rounded-lg p-2 overflow-x-auto font-mono max-h-20">
                  {snippet.body.slice(0, 150)}{snippet.body.length > 150 ? '...' : ''}
                </pre>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {onSelect && (
                  <button
                    onClick={() => onSelect(snippet)}
                    className="p-1.5 text-emerald-400 hover:bg-emerald-950/40 rounded-lg transition-colors"
                    title="Insert Snippet"
                  >
                    <Plus size={12} />
                  </button>
                )}
                <button
                  onClick={() => handleEdit(snippet)}
                  className="p-1.5 text-indigo-400 hover:bg-indigo-950/40 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit3 size={12} />
                </button>
                {!snippet.isBuiltIn && (
                  <button
                    onClick={() => removeSnippet(snippet.id)}
                    className="p-1.5 text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* New/Edit Form */}
        {showNewForm && (
          <div className="border-t border-slate-900 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {editingId ? 'Edit Snippet' : 'New Snippet'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
              <input
                type="text"
                placeholder="Prefix (trigger)"
                value={formData.prefix}
                onChange={(e) => setFormData(prev => ({ ...prev, prefix: e.target.value }))}
                className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <input
              type="text"
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
            <textarea
              placeholder="Snippet body (use ${1:tabstop} for cursors)"
              value={formData.body}
              onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
              rows={5}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 font-mono resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewForm(false)
                  setEditingId(null)
                  setFormData({ name: '', prefix: '', body: '', description: '', language: 'actionscript' })
                }}
                className="btn btn-secondary px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.prefix || !formData.body}
                className="btn btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                <Save size={12} />
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Add Button */}
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="btn btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
          >
            <Plus size={12} />
            New Snippet
          </button>
        )}
      </div>
    </div>
  )
}
