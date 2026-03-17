import { ImageResponse } from 'next/og'

export const alt = 'TruckHelpNow truck fault-code help'

export const size = {
  width: 1600,
  height: 900,
}

export const contentType = 'image/png'

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 60%, #065f46 100%)',
          color: '#f8fafc',
          display: 'flex',
          gap: 42,
          height: '100%',
          justifyContent: 'space-between',
          padding: '72px 80px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              color: '#a7f3d0',
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
          >
            TruckHelpNow
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 82,
              fontWeight: 700,
              letterSpacing: -2.5,
              lineHeight: 1.02,
            }}
          >
            Truck fault-code help for drivers, dispatch, and shop triage.
          </div>
          <div
            style={{
              color: '#cbd5e1',
              display: 'flex',
              fontSize: 34,
              lineHeight: 1.35,
            }}
          >
            SPN/FMI guidance, warning-light context, and structured next steps for commercial truck troubleshooting.
          </div>
        </div>

        <div
          style={{
            alignItems: 'center',
            border: '2px solid rgba(52, 211, 153, 0.45)',
            borderRadius: 48,
            color: '#34d399',
            display: 'flex',
            fontSize: 110,
            fontWeight: 700,
            height: 240,
            justifyContent: 'center',
            width: 240,
          }}
        >
          TH
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
