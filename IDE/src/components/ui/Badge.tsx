import React from 'react'

interface BadgeProps {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'default'
  children: React.ReactNode
  className?: string
}

export default function Badge({
  variant = 'default',
  children,
  className = ''
}: BadgeProps) {
  const baseStyle = 'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono'
  
  const variants = {
    info: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border border-red-500/20',
    default: 'bg-slate-800 text-slate-400 border border-slate-700/60'
  }

  return (
    <span className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
