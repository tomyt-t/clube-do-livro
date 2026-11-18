import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** Line icons drawn for this site: square caps and joins, like the components. */
function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function OpenBookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.6C10.2 5.3 7.9 4.7 4 4.7v13.1c3.9 0 6.2.6 8 1.9 1.8-1.3 4.1-1.9 8-1.9V4.7c-3.9 0-6.2.6-8 1.9Z" />
      <path d="M12 6.6v13.1" />
    </Icon>
  );
}

export function BallotIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 12.5V4.2h7v8.3" />
      <path d="m10.2 8.3 1.3 1.3 2.3-2.5" />
      <path d="M4 12.5h16v7.3H4Z" />
    </Icon>
  );
}

export function ShelfIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4.6h3v14.6H5Z" />
      <path d="M9.6 6.6h3v12.6h-3Z" />
      <path d="m14.4 7.4 2.9-.8 3.2 12-2.9.8Z" />
      <path d="M3 19.4h18" />
    </Icon>
  );
}
