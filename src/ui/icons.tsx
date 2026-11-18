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

/** Google's "G", as its sign-in guidelines ask for on Google buttons. */
export function GoogleMark(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
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
