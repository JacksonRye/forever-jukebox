
interface CompassMotifProps {
  size?: number;
  className?: string;
}

export function CompassMotif({ size = 260, className = "" }: CompassMotifProps) {
  const center = size / 2;
  const radius = size * 0.42;
  const rayInner = 18;
  const rayOuter = 44;
  const rayWidth = 5;

  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div
      className={`gs-compass-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        {/* Hairline Outer Bounding Box */}
        <rect
          x={center - radius}
          y={center - radius}
          width={radius * 2}
          height={radius * 2}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Concentric Hairline Reference Rings */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.8}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />
        <circle
          cx={center}
          cy={center}
          r={radius * 0.35}
          stroke="rgba(255, 255, 255, 0.07)"
          strokeWidth="1"
        />

        {/* 8 Cardinal & Intercardinal Hairline Axis Vectors */}
        {angles.map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = center - Math.cos(rad) * (radius * 1.3);
          const y1 = center - Math.sin(rad) * (radius * 1.3);
          const x2 = center + Math.cos(rad) * (radius * 1.3);
          const y2 = center + Math.sin(rad) * (radius * 1.3);
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="1"
            />
          );
        })}

        {/* Center Void Aperture Ring */}
        <circle
          cx={center}
          cy={center}
          r="12"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
          fill="none"
        />

        {/* 8 Radiating Solid Pills (The Compass Starburst Motif) */}
        {angles.map((angle) => {
          return (
            <g
              key={`ray-${angle}`}
              transform={`rotate(${angle} ${center} ${center})`}
            >
              <rect
                x={center - rayWidth / 2}
                y={center - rayOuter}
                width={rayWidth}
                height={rayOuter - rayInner}
                rx={rayWidth / 2}
                fill="#FFFFFF"
                opacity="0.95"
              />
            </g>
          );
        })}

        {/* Precision Corner Crosshairs */}
        {[
          [center - radius, center - radius],
          [center + radius, center - radius],
          [center - radius, center + radius],
          [center + radius, center + radius],
        ].map(([cx, cy], i) => (
          <g key={`cross-${i}`}>
            <line
              x1={cx - 6}
              y1={cy}
              x2={cx + 6}
              y2={cy}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1"
            />
            <line
              x1={cx}
              y1={cy - 6}
              x2={cx}
              y2={cy + 6}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
