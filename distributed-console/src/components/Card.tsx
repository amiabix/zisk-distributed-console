import React from 'react';
import { COMPONENTS, COMPONENT_RADIUS, COMPONENT_SPACING, GLASS } from '../constants/designTokens';

interface CardProps {
  variant?: 'default' | 'elevated' | 'compact';
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  hover?: boolean;
}

export default function Card({
  variant = 'default',
  children,
  className = '',
  title,
  subtitle,
  header,
  footer,
  hover = false,
}: CardProps) {
  const variantStyles = COMPONENTS.card[variant];
  const glassStyle = variant === 'default' ? GLASS.base : variant === 'elevated' ? GLASS.strong : GLASS.weak;

  // Ensure variantStyles exists and has padding
  const padding = variantStyles?.padding || COMPONENT_SPACING.card.md;

  return (
    <div
      className={`
        glass 
        rounded-card 
        border border-gray-200
        transition-all duration-normal ease-in-out
        ${hover ? 'card-hover' : ''}
        ${className}
      `}
      style={{
        background: glassStyle?.background || '#ffffff',
        backdropFilter: glassStyle?.backdropFilter || 'none',
        border: glassStyle?.border || '1px solid #e8e4e0',
        boxShadow: glassStyle?.boxShadow || '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
        padding: padding,
        borderRadius: variantStyles?.borderRadius || COMPONENT_RADIUS.card,
      }}
    >
      {header && <div className="mb-4">{header}</div>}
      {title && (
        <h3 className="text-xl font-display font-bold text-gray-900 mb-2">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-sm text-gray-600 mb-4">
          {subtitle}
        </p>
      )}
      {children}
      {footer && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          {footer}
        </div>
      )}
    </div>
  );
}

