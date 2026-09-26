import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', paddingTop: '50px' }}>
      <h1 style={{ fontSize: '2.5rem', color: '#d97706' }}>Fun Bakery 🥐</h1>
      <p style={{ fontSize: '1.2rem', color: '#4b5563' }}>
        ระบบจัดการสั่งอาหารสำหรับร้านบุฟเฟต์
      </p>

      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
        <Link 
          href="/generate-qr" 
          style={{
            padding: '12px 24px',
            backgroundColor: '#2563eb',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
        >
          สร้าง QR Code โต๊ะ (/generate-qr)
        </Link>
        
        <Link 
          href="/kitchen" 
          style={{
            padding: '12px 24px',
            backgroundColor: '#059669',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
        >
          หน้าห้องครัว (/kitchen)
        </Link>
      </div>
    </main>
  )
}
