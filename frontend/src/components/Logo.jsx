import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

/**
 * Logo — PATINA brand mark
 *
 * @param {Object} props
 * @param {'sm' | 'md' | 'lg'} props.size - Logo size (default: 'md')
 * @param {string} props.role - Optional role badge ('candidate' | 'recruiter')
 * @param {boolean} props.asLink - Wrap in Link to home (default: true)
 * @param {string} props.to - Link destination (default: '/')
 * @param {string} props.className - Additional classes
 */
function Logo({
  size = 'md',
  role = null,
  asLink = true,
  to = '/',
  className = '',
}) {
  const sizes = {
    sm: {
      icon: 'w-7 h-7',
      iconStroke: 2,
      text: 'text-lg',
      badge: 'text-[10px] px-1.5 py-0.5',
    },
    md: {
      icon: 'w-8 h-8',
      iconStroke: 1.75,
      text: 'text-xl',
      badge: 'text-[11px] px-2 py-0.5',
    },
    lg: {
      icon: 'w-9 h-9',
      iconStroke: 1.75,
      text: 'text-2xl',
      badge: 'text-xs px-2 py-0.5',
    },
  };

  const s = sizes[size];

  const logoContent = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon */}
      <div className={`${s.icon} flex items-center justify-center bg-primary rounded-lg`}>
        <Shield className={`${s.icon === 'w-7 h-7' ? 'w-4 h-4' : 'w-[1.125rem] h-[1.125rem]'} text-primary-foreground`} strokeWidth={s.iconStroke} />
      </div>

      {/* Wordmark */}
      <span className={`font-heading font-extrabold tracking-tight text-foreground ${s.text}`}>
        PATINA
      </span>

      {/* Role Badge */}
      {role && (
        <span className={`${s.badge} rounded-full bg-secondary text-secondary-foreground font-medium capitalize`}>
          {role}
        </span>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link to={to} className="flex items-center no-underline">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}

export default Logo;
