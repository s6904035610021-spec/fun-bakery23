export const metadata = {
  title: 'Fun Bakery - Buffet Ordering System',
  description: 'ระบบสั่งอาหารสำหรับร้านบุฟเฟต์ Fun Bakery',
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
        {children}
      </body>
    </html>
  )
}
