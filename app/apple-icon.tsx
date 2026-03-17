import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            border: '6px solid rgba(52, 211, 153, 0.45)',
            borderRadius: 40,
            color: '#f8fafc',
            display: 'flex',
            fontSize: 72,
            fontWeight: 700,
            height: 132,
            justifyContent: 'center',
            width: 132,
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
