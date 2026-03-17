import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/seo'

export const alt = 'TruckHelpNow AI truck diagnostic assistant'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'stretch',
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 55%, #064e3b 100%)',
          color: '#f8fafc',
          display: 'flex',
          height: '100%',
          justifyContent: 'space-between',
          padding: '56px 64px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            maxWidth: '760px',
          }}
        >
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: 18,
            }}
          >
            <div
              style={{
                alignItems: 'center',
                border: '2px solid rgba(52, 211, 153, 0.45)',
                borderRadius: 24,
                color: '#34d399',
                display: 'flex',
                fontSize: 32,
                fontWeight: 700,
                height: 72,
                justifyContent: 'center',
                width: 72,
              }}
            >
              TH
            </div>
            <div
              style={{
                color: '#cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                fontSize: 24,
                gap: 6,
              }}
            >
              <span>{siteConfig.name}</span>
              <span style={{ color: '#94a3b8', fontSize: 18 }}>
                Truck diagnostics and fault-code help
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div
              style={{
                color: '#a7f3d0',
                display: 'flex',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              AI truck diagnostic assistant
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 64,
                fontWeight: 700,
                letterSpacing: -2.4,
                lineHeight: 1.02,
              }}
            >
              Fault-code help, warning-light context, and safer next steps.
            </div>
            <div
              style={{
                color: '#cbd5e1',
                display: 'flex',
                fontSize: 28,
                lineHeight: 1.35,
              }}
            >
              Built for drivers, dispatch, and shop triage when a commercial truck needs fast, practical troubleshooting context.
            </div>
          </div>
        </div>

        <div
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: 34,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            padding: '28px 24px',
            width: 280,
          }}
        >
          {['SPN/FMI intake', 'Warning-light analysis', 'Roadside-safe guidance'].map((item) => (
            <div
              key={item}
              style={{
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                borderRadius: 999,
                color: '#e2e8f0',
                display: 'flex',
                fontSize: 22,
                justifyContent: 'center',
                padding: '14px 18px',
                textAlign: 'center',
                width: '100%',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
