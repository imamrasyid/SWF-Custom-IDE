import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function Input({
  label,
  className = '',
  id,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`px-3 py-2 bg-slate-950/60 border border-slate-900 focus:border-indigo-500/50 rounded-lg text-xs text-slate-200 placeholder-slate-600 outline-none transition-colors w-full font-sans ${className}`}
        {...props}
      />
    </div>
  )
}
