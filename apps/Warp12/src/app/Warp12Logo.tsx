import { FC } from 'react';

export interface Warp12LogoProps {
  width?: number;
  className?: string;
  warpColor?: string;
  numberColor?: string;
  taglineColor?: string;
  marginLeft?: string;
}

export const Warp12Logo: FC<Warp12LogoProps> = ({
  width,
  className,
  marginLeft = '-12px',
  warpColor = '#38bdf8',
  numberColor = '#ffffff',
  taglineColor = '#e2e8f0',
}) => {
  return (
    <svg
      style={{ marginLeft }} 
      id="Layer_1"
      data-name="Layer 1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 531.41 111.65"
      width={width}
      className={className}
    >
      <defs>
        <style>{`
          .cls-1 {
            font-family: 'Federation', Federation, sans-serif;
            font-size: 72px;
            fill: ${numberColor};
          }

          .cls-2 {
            font-family: 'FederationWide', FederationWide, sans-serif;
            font-size: 72px;
            fill: ${warpColor};
          }

          .cls-3 {
            font-family: 'Nova Light', Federation, sans-serif;
            font-size: 42px;
            fill: ${taglineColor};
          }
        `}</style>
      </defs>
      <text className="cls-2" transform="translate(17.16 60.98)"><tspan x="0" y="0">Warp</tspan></text>
      <text className="cls-1" transform="translate(383.22 60.98)"><tspan x="0" y="0">12</tspan></text>
      <text className="cls-3" transform="translate(345.15 97.29)"><tspan x="0" y="0">Mexican Train Dominoes</tspan></text>
    </svg>
  );
};
