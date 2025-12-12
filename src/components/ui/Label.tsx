import { forwardRef, type LabelHTMLAttributes } from 'react';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/**
 * Simple label component for form fields
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', children, ...props }, ref) => {
    const baseStyles = 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

    return (
      <label ref={ref} className={`${baseStyles} ${className}`} {...props}>
        {children}
      </label>
    );
  }
);

Label.displayName = 'Label';
