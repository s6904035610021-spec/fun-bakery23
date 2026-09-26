'use client'

import { use, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function OrderPage({ params }) {
  // Unwrap params ตามข้อกำหนด Next.js App Router เวอร์ชันล่าสุด
  const resolvedParams = use(params)
  const rawTableNumber = resolvedParams?.tableNumber
  const tableNum = parseInt(rawTableNumber, 10)

  // สถานะ Session & การโหลด
  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionClosed, setSessionClosed] = useState(false)

  // เมนูอาหาร
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)

  // ตะกร้าสินค้า: [{ id, name, quantity }]
  const [cart, setCart] = useState([])

  // สถานะการส่งออเดอร์ & Modal เรียกเก็บเงิน
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderSuccessMessage, setOrderSuccessMessage] = useState('')
  const [showBillingModal, setShowBillingModal] = useState(false)
  const [closingSession, setClosingSession] = useState(false)

  // 1. ดึงข้อมูล Session
  useEffect(() => {
    if (!tableNum || isNaN(tableNum)) {
      setLoadingSession(false)
      return
    }

    async function fetchSession() {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('table_number', tableNum)
          .eq('status', 'open')
          .maybeSingle()

        if (error) throw error
        setSession(data)
      } catch (err) {
        console.error('Error fetching session:', err)
      } finally {
        setLoadingSession(false)
      }
    }

    fetchSession()
  }, [tableNum])

  // 2. ดึงหมวดหมู่และรายการอาหารเมื่อพบ Session
  useEffect(() => {
    if (!session) return

    async function fetchMenu() {
      try {
        const [catRes, itemRes] = await Promise.all([
          supabase.from('menu_categories').select('*').order('sort_order', { ascending: true }),
          supabase.from('menu_items').select('*')
        ])

        if (catRes.error) throw catRes.error
        if (itemRes.error) throw itemRes.error

        setCategories(catRes.data || [])
        setMenuItems(itemRes.data || [])

        if (catRes.data && catRes.data.length > 0) {
          setSelectedCategoryId(catRes.data[0].id)
        }
      } catch (err) {
        console.error('Error fetching menu:', err)
      }
    }

    fetchMenu()
  }, [session])

  // ฟังก์ชันเพิ่มสินค้าลงตะกร้า (จำกัดจำนวน 1-5 ชิ้นต่อรายการ)
  const handleAddToCart = (item) => {
    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.id === item.id)
      if (existing) {
        if (existing.quantity >= 5) {
          alert('สามารถสั่งรายการนี้ได้สูงสุด 5 จานต่อครั้ง')
          return prevCart
        }
        return prevCart.map((ci) =>
          ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prevCart, { id: item.id, name: item.name, quantity: 1 }]
    })
  }

  // ฟังก์ชันปรับจำนวนในตะกร้า
  const handleUpdateQuantity = (itemId, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((ci) => {
          if (ci.id === itemId) {
            const newQty = ci.quantity + delta
            if (newQty > 5) {
              alert('สามารถสั่งรายการนี้ได้สูงสุด 5 จานต่อครั้ง')
              return ci
            }
            return newQty > 0 ? { ...ci, quantity: newQty } : null
          }
          return ci
        })
        .filter(Boolean)
    )
  }

  // จำนวนรายการรวมทั้งหมดในตะกร้า
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  // 3. ส่งออเดอร์ลง Supabase
  const handleSubmitOrder = async () => {
    if (cart.length === 0) return
    if (totalCartItems > 10) {
      alert('สามารถสั่งอาหารได้สูงสุด 10 รายการต่อการส่ง 1 ครั้ง')
      return
    }

    setSubmittingOrder(true)
    try {
      const orderItems = cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
      }))

      const { error } = await supabase.from('orders').insert([
        {
          session_id: session.id,
          table_number: tableNum,
          items: orderItems,
          status: 'received',
        },
      ])

      if (error) throw error

      setCart([])
      setOrderSuccessMessage('✓ ส่งออเดอร์เรียบร้อยแล้ว ห้องครัวกำลังเตรียมอาหารให้คุณ')
      setTimeout(() => setOrderSuccessMessage(''), 4000)
    } catch (err) {
      console.error('Error submitting order:', err)
      alert('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmittingOrder(false)
    }
  }

  // 4. เช็คบิลและปิด Session
  const handleConfirmPay = async () => {
    setClosingSession(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id)

      if (error) throw error

      setShowBillingModal(false)
      setSessionClosed(true)
    } catch (err) {
      console.error('Error closing session:', err)
      alert('ไม่สามารถทำรายการปิดโต๊ะได้ กรุณาเรียกพนักงาน')
    } finally {
      setClosingSession(false)
    }
  }

  // ---------------- UI Render Steps ----------------

  if (loadingSession) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '16px', color: '#6b7280', fontSize: '1.1rem' }}>กำลังโหลดข้อมูลโต๊ะ...</p>
      </div>
    )
  }

  // กรณีโต๊ะถูกปิดแล้วหลังชำระเงิน
  if (sessionClosed) {
    return (
      <div style={styles.centerContainer}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
        <h1 style={{ color: '#059669', fontSize: '1.8rem', marginBottom: '8px' }}>ขอบคุณที่ใช้บริการ</h1>
        <p style={{ color: '#4b5563', fontSize: '1.1rem', textAlign: 'center' }}>
          หวังว่าคุณจะประทับใจกับมื้ออาหารที่ Fun Bakery ครับ
        </p>
      </div>
    )
  }

  // กรณีไม่พบ Session หรือ Session ปิดไปแล้ว
  if (!session) {
    return (
      <div style={styles.centerContainer}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🚫</div>
        <h2 style={{ color: '#dc2626', fontSize: '1.5rem', textAlign: 'center', margin: '0 0 8px 0' }}>
          โต๊ะนี้ยังไม่เปิดใช้งาน
        </h2>
        <p style={{ color: '#4b5563', fontSize: '1.1rem', textAlign: 'center' }}>
          กรุณาแจ้งพนักงานหน้าร้านเพื่อทำการเปิดโต๊ะ
        </p>
      </div>
    )
  }

  // คำนวณราคาบุฟเฟต์ (ผู้ใหญ่ 289.- / เด็ก 145.-)
  const adultPrice = (session.adult_count || 0) * 289
  const childPrice = (session.child_count || 0) * 145
  const totalPrice = adultPrice + childPrice

  const filteredMenuItems = menuItems.filter((i) => i.category_id === selectedCategoryId)

  return (
    <div style={styles.mobileWrapper}>
      {/* ส่วนหัวหน้าจอ */}
      <header style={styles.header}>
        <div>
          <span style={styles.shopName}>Fun Bakery 🥐</span>
          <h1 style={styles.tableTitle}>โต๊ะ {tableNum}</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowBillingModal(true)}
          style={styles.payHeaderBtn}
        >
          💳 เรียกเก็บเงิน
        </button>
      </header>

      {/* ข้อความแจ้งเตือนเมื่อสั่งสำเร็จ */}
      {orderSuccessMessage && (
        <div style={styles.successBanner}>
          {orderSuccessMessage}
        </div>
      )}

      {/* แถบหมวดหมู่เมนู (Horizontal Scroll) */}
      <nav style={styles.categoryBar}>
        {categories.map((cat) => {
          const isActive = cat.id === selectedCategoryId
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              style={{
                ...styles.categoryTab,
                backgroundColor: isActive ? '#d97706' : '#f3f4f6',
                color: isActive ? '#ffffff' : '#374151',
                fontWeight: isActive ? 'bold' : 'normal',
              }}
            >
              {cat.name}
            </button>
          )
        })}
      </nav>

      {/* รายการเมนูอาหาร */}
      <main style={styles.menuContainer}>
        {filteredMenuItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
            ไม่มีรายการอาหารในหมวดหมู่นี้
          </p>
        ) : (
          filteredMenuItems.map((item) => {
            const inCart = cart.find((ci) => ci.id === item.id)
            return (
              <div key={item.id} style={styles.menuCard}>
                <div style={styles.menuInfo}>
                  <span style={styles.menuName}>{item.name}</span>
                </div>
                <div style={styles.actionArea}>
                  {inCart ? (
                    <div style={styles.qtyControl}>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        style={styles.qtyBtn}
                      >
                        -
                      </button>
                      <span style={styles.qtyText}>{inCart.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        style={styles.qtyBtn}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      style={styles.addBtn}
                    >
                      + เพิ่ม
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </main>

      {/* ตะกร้าสินค้าลอยด้านล่าง (Bottom Floating Cart) */}
      {cart.length > 0 && (
        <div style={styles.floatingCart}>
          <div style={styles.cartSummary}>
            <span style={styles.cartCountBadge}>{totalCartItems} รายการ</span>
            <span style={styles.cartLimitNote}>(สูงสุด 10 รายการ/ครั้ง)</span>
          </div>

          <button
            type="button"
            onClick={handleSubmitOrder}
            disabled={submittingOrder || totalCartItems > 10}
            style={{
              ...styles.submitOrderBtn,
              opacity: submittingOrder || totalCartItems > 10 ? 0.6 : 1,
            }}
          >
            {submittingOrder ? 'กำลังส่ง...' : 'ส่งออเดอร์ 🚀'}
          </button>
        </div>
      )}

      {/* Modal หน้าต่างยืนยันเรียกเก็บเงิน */}
      {showBillingModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ margin: '0 0 12px 0', color: '#1f2937', fontSize: '1.4rem' }}>
              สรุปรายการชำระเงิน
            </h2>
            <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '0.95rem' }}>
              โต๊ะ {tableNum}
            </p>

            <div style={styles.billDetails}>
              <div style={styles.billRow}>
                <span>ผู้ใหญ่ ({session.adult_count} คน × 289.-)</span>
                <span>{adultPrice.toLocaleString()} บาท</span>
              </div>
              <div style={styles.billRow}>
                <span>เด็ก ({session.child_count} คน × 145.-)</span>
                <span>{childPrice.toLocaleString()} บาท</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />
              <div style={{ ...styles.billRow, fontSize: '1.2rem', fontWeight: 'bold', color: '#d97706' }}>
                <span>ยอดรวมทั้งสิ้น</span>
                <span>{totalPrice.toLocaleString()} บาท</span>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setShowBillingModal(false)}
                disabled={closingSession}
                style={styles.cancelModalBtn}
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={handleConfirmPay}
                disabled={closingSession}
                style={styles.confirmPayBtn}
              >
                {closingSession ? 'กำลังชำระ...' : 'ยืนยันชำระเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline Styles ดีไซน์ Mobile-First ให้ใช้งานง่ายผ่านสมาร์ตโฟน
const styles = {
  mobileWrapper: {
    maxWidth: '480px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    paddingBottom: '110px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box',
  },
  centerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    padding: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #d97706',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  shopName: {
    fontSize: '0.85rem',
    color: '#d97706',
    fontWeight: 'bold',
  },
  tableTitle: {
    fontSize: '1.4rem',
    margin: 0,
    color: '#111827',
  },
  payHeaderBtn: {
    padding: '8px 14px',
    backgroundColor: '#fef3c7',
    color: '#b45309',
    border: '1px solid #fcd34d',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  successBanner: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '12px 16px',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    textAlign: 'center',
    borderBottom: '1px solid #bbf7d0',
  },
  categoryBar: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    overflowX: 'auto',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    WebkitOverflowScrolling: 'touch',
  },
  categoryTab: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    fontSize: '0.95rem',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  menuContainer: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  menuCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #f3f4f6',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  menuInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  menuName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#1f2937',
  },
  actionArea: {
    display: 'flex',
    alignItems: 'center',
  },
  addBtn: {
    padding: '8px 18px',
    backgroundColor: '#d97706',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    padding: '2px',
  },
  qtyBtn: {
    width: '32px',
    height: '32px',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#374151',
    cursor: 'pointer',
  },
  qtyText: {
    padding: '0 12px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#111827',
  },
  floatingCart: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '480px',
    backgroundColor: '#ffffff',
    padding: '12px 16px',
    borderTop: '1px solid #e5e7eb',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    zIndex: 20,
  },
  cartSummary: {
    display: 'flex',
    flexDirection: 'column',
  },
  cartCountBadge: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#111827',
  },
  cartLimitNote: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  submitOrderBtn: {
    padding: '12px 24px',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    width: '100%',
    maxWidth: '380px',
  },
  billDetails: {
    backgroundColor: '#f9fafb',
    padding: '14px',
    borderRadius: '10px',
    marginBottom: '20px',
  },
  billRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    color: '#374151',
    fontSize: '1rem',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
  },
  cancelModalBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#e5e7eb',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  confirmPayBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
}
