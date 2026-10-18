export const Piece = ({ type, color }: { type: string; color: string }) => {
  const shapes: Record<string, React.ReactNode> = {
    p: (
      <>
        <circle cx="24" cy="13" r="6" />
        <path d="M20 19h8l-2 7 6 9H16l6-9z" />
      </>
    ),
    r: (
      <>
        <path d="M13 9h6v5h5V9h5v5h6V9h1v12l-6 4 2 11H16l2-11-5-4z" />
        <path d="M17 20h14" />
      </>
    ),
    n: (
      <>
        <path d="m16 35 2-9-6-1 2-9 7-5 2-6 5 6c9 3 10 12 6 24z" />
        <path d="m15 22 10-4-4 10" />
        <circle
          cx="24"
          cy="15"
          r="1"
          fill={color === "w" ? "#423b2f" : "#fff8e7"}
          stroke="none"
        />
      </>
    ),
    b: (
      <>
        <path d="M24 5c-2 5-9 8-9 14 0 4 4 7 9 7s9-3 9-7c0-6-7-9-9-14z" />
        <path d="m24 11 4 7M20 26l-4 10h16l-4-10" />
      </>
    ),
    q: (
      <>
        <path d="m12 16 5 7 7-11 7 11 5-7-5 19H17z" />
        <circle cx="11" cy="13" r="3" />
        <circle cx="24" cy="9" r="3" />
        <circle cx="37" cy="13" r="3" />
        <path d="M17 29h14" />
      </>
    ),
    k: (
      <>
        <path d="M24 4v10m-5-6h10" fill="none" />
        <path d="M24 17c-9-8-16 1-9 9l3 9h12l3-9c7-8 0-17-9-9z" />
        <path d="M17 28h14" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      fill={color === "w" ? "#fff9e9" : "#403c32"}
      stroke={color === "w" ? "#514b3b" : "#29281f"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[type]}
      <path d="M15 36h18l3 5H12z" />
    </svg>
  );
};
