import React from 'react';
import { COMPONENTS, ANIMATIONS, COMPONENT_RADIUS } from '../constants/designTokens';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  className = '',
  onClick,
  icon,
  type = 'button',
}: ButtonProps) {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const baseClasses = `
    flex items-center justify-center gap-2 
    font-display font-semibold 
    rounded-button
    transition-all duration-normal ease-in-out
    disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeStyles[size]}
  `;

  const variantClasses = {
    primary: 'glass-green text-white glow-green hover:glass-strong hover:scale-105',
    secondary: 'glass text-gray-700 border border-gray-200 hover:glass-strong',
    accent: 'glass-yellow text-neutral-950 glow-yellow hover:glass-strong hover:scale-105',
    danger: 'glass-red text-white glow-red hover:glass-strong',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${className}
      `}
      style={{
        borderRadius: COMPONENT_RADIUS.button,
      }}
    >
      {loading && (
        <div className="animate-spin">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}
      {icon && !loading && icon}
      {children}
    </button>
  );
}

