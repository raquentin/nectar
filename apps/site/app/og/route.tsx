import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1220',
          color: '#fff',
          fontSize: 60,
          fontWeight: 700
        }}
      >
        Nectar
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  )
}

