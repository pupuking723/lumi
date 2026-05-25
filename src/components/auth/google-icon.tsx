import type { SVGProps } from "react";

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <g clipPath="url(#google-icon-a)">
        <path
          fill="#FBBC05"
          d="M5.018 12c0-.762.13-1.493.36-2.178L1.34 6.802A11.5 11.5 0 0 0 .11 12c0 1.868.442 3.63 1.228 5.194l4.036-3.025A6.8 6.8 0 0 1 5.018 12"
        />
        <path
          fill="#EA4335"
          d="M12.27 5.3c1.69 0 3.217.586 4.417 1.546l3.491-3.413C18.051 1.62 15.324.5 12.27.5 7.528.5 3.452 3.155 1.5 7.035l4.04 3.02C6.47 7.289 9.122 5.3 12.27 5.3"
        />
        <path
          fill="#34A853"
          d="M12.11 18.933c-3.149 0-5.801-1.989-6.732-4.755l-4.038 3.02c1.951 3.88 6.027 6.535 10.77 6.535 2.926 0 5.72-1.017 7.818-2.924l-3.834-2.902c-1.081.667-2.443 1.026-3.985 1.026"
        />
        <path
          fill="#4285F4"
          d="M23.564 12c0-.693-.11-1.44-.273-2.133H12.109V14.4h6.436c-.321 1.546-1.197 2.734-2.45 3.507l3.833 2.902c2.203-2.002 3.636-4.984 3.636-8.809"
        />
      </g>
      <defs>
        <clipPath id="google-icon-a">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}
