import Link from 'next/link'

export default function GenerateQRPage() {
  return (
    <main>
      <h1>สร้าง QR Code สำหรับโต๊ะอาหาร</h1>
      <p>หน้านี้ใช้สำหรับพนักงานในการสร้าง Session และ QR Code</p>
      <Link href="/">← กลับหน้าหลัก</Link>
    </main>
  )
}
