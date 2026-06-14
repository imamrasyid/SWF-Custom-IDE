import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyle = 'inline-flex items-center justify-center font-sans font-semibold rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer'
  
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]',
    secondary: 'bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 border border-slate-800/80 hover:border-slate-700/80',
    danger: 'bg-red-650 hover:bg-red-550 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    ghost: 'hover:bg-slate-900/40 text-slate-400 hover:text-slate-200'
  }

  const sizes = {
    sm: 'text-[10px] px-2.5 py-1 gap-1',
    md: 'text-[11px] px-4 py-2 gap-1.5',
    lg: 'text-xs px-6 py-3 gap-2'
  }

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
