import { useId } from 'react';

const COLORS = [
  { name: 'Coral', color: '#dc826b' },
  { name: 'Lavender', color: '#9981c8' },
  { name: 'Mint', color: '#66a994' },
  { name: 'Honey', color: '#dbb24f' },
  { name: 'Blue', color: '#659fc9' },
  { name: 'Rose', color: '#c979a0' },
  { name: 'Olive', color: '#9ca657' },
];

export function liquidColor(index: number): { name: string; color: string } {
  return (
    COLORS[index] ?? {
      name: `Color ${index + 1}`,
      color: `hsl(${(index * 137.508) % 360} 52% ${44 + (index % 3) * 9}%)`,
    }
  );
}

export function Tube({ liquid, amount = liquid.length }: { liquid: number[]; amount?: number }) {
  const id = useId();
  return (
    <svg className="water-glass" viewBox="0 0 72 194" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d="M14 24H58V155Q58 177 36 177Q14 177 14 155Z" />
        </clipPath>
        <linearGradient id={`${id}-glass`}>
          <stop stopColor="#ffffff" stopOpacity=".8" />
          <stop offset=".5" stopColor="#d0e1df" stopOpacity=".12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".7" />
        </linearGradient>
      </defs>
      <path
        d="M10 16V155Q10 183 36 183Q62 183 62 155V16"
        fill={`url(#${id}-glass)`}
        stroke="#9badaa"
        strokeWidth="2"
      />
      <g clipPath={`url(#${id})`}>
        {liquid.map((color, index) => (
          <g key={index}>
            <rect
              x="14"
              y={177 - Math.min(index + 1, amount) * 34}
              width="44"
              height={amount > index ? Math.min(1, amount - index) * 34 + 0.5 : 0}
              fill={liquidColor(color).color}
            />
          </g>
        ))}
      </g>
      <path d="M19 31V151" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
      {[49, 83, 117, 151].map((y) => (
        <path key={y} d={`M56 ${y}h5`} stroke="#718e8a" strokeOpacity=".6" />
      ))}
      <rect
        x="7"
        y="12"
        width="58"
        height="8"
        rx="4"
        fill="#f6faf7"
        stroke="#9badaa"
        strokeWidth="2"
      />
    </svg>
  );
}
