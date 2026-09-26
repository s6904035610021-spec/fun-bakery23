'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

export default function KitchenPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // 1. ดึงข้อมูลออเดอร์เริ่มต้น ( status: 'received' หรือ 'cooking' )
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['received', 'cooking'])
        .order('created_at', { ascending: true }) // เรียงจากเก่าไปใหม่ (ออเดอร์เข้ามาก่อนอยู่ด้านหน้า)

      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      console.error('Error fetching kitchen orders:', err)
      setErrorMessage('ไม่สามารถโหลดรายการออเดอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    // 2. ตั้งค่า Supabase Realtime Subscription ฟังการเปลี่ยนแปลงในตาราง orders
    const channel = supabase
      .channel('kitchen-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload

          if (eventType === 'INSERT') {
            // ถ้ารับออเดอร์ใหม่เข้ามา
            if (['received', 'cooking'].includes(newRecord.status)) {
              setOrders((prevOrders) => {
                // ป้องกันการใส่ข้อมูลซ้ำ
                if (prevOrders.some((o) => o.id === newRecord.id)) return prevOrders
                return [...prevOrders, newRecord]
              })
            }
          } else if (eventType === 'UPDATE') {
            // ถ้ามีการเปลี่ยน status
            if (['received', 'cooking'].includes(newRecord.status)) {
              // ถ้ายังอยู่ในสถานะที่ต้องทำ ให้ update ข้อมูลใน state
              setOrders((prevOrders) =>
                prevOrders.map((o) => (o.id === newRecord.id ? newRecord : o))
              )
            } else {
              // ถ้าเปลี่ยน status เป็น 'served' หรืออื่น ๆ ให้ลบออกจากการ์ดหน้าจอทันที
              setOrders((prevOrders) => prevOrders.filter((o) => o.id === newRecord.id ? false : true))
            }
          } else if (eventType === 'DELETE') {
            setOrders((prevOrders) => prevOrders.filter((o) => o.id !== oldRecord.id))
          }
        }
      )
      .subscribe()

    // ยกเลิก Subscription เมื่อ unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // เปลี่ยนสถานะออเดอร์ ( 'cooking' หรือ 'served' )
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      // Optimistic UI Update - ปรับการแสดงผลหน้าจอก่อนเพื่อความรวดเร็ว
      if (newStatus === 'served') {
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        )
      }

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) {
        throw error
      }
    } catch (err) {
      console.error('Error updating status:', err)
      alert('ไม่สามารถอัปเดตสถานะได้ โปรดลองอีกครั้ง')
      // ดึงข้อมูลใหม่หากเกิดข้อผิดพลาด
      fetchOrders()
    }
  }

  // แปลงเวลา created_at เป็นรูปแบบอ่านง่าย (HH:mm น.)
  const formatTime = (timeString) => {
    if (!timeString) return ''
    const date = new Date(timeString)
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
  }

  return (
    <div style={styles.pageWrapper}>
      {/* ส่วนหัวจอห้องครัว */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/" style={styles.backLink}>← หน้าหลัก</Link>
          <h1 style={styles.title}>👨‍🍳 จอแสดงรายการอาหาร (ห้องครัว)</h1>
        </div>
        <div style={styles.statusBadge}>
          🟢 Realtime Active ({orders.length} ออเดอร์)
        </div>
      </header>

      {errorMessage && <div style={styles.errorBox}>⚠️ {errorMessage}</div>}

      {loading ? (
        <div style={styles.loadingBox}>กำลังโหลดข้อมูลรายการอาหาร...</div>
      ) : orders.length === 0 ? (
        <div style={styles.emptyBox}>
          <div style={{ fontSize: '4rem', marginBottom: '10px' }}>✨</div>
          <p style={{ fontSize: '1.8rem', color: '#6b7280', margin: 0 }}>ไม่มีออเดอร์ค้างในขณะนี้</p>
        </div>
      ) : (
        /* แสดงการ์ดออเดอร์แบบ Grid */
        <div style={styles.gridContainer}>
          {orders.map((order) => {
            const isCooking = order.status === 'cooking'
            return (
              <div
                key={order.id}
                style={{
                  ...styles.orderCard,
                  backgroundColor: isCooking ? '#fffbe1' : '#ffffff',
                  borderColor: isCooking ? '#f59e0b' : '#e5e7eb',
                }}
              >
                {/* Header การ์ด: เลขโต๊ะ + เวลา */}
                <div
                  style={{
                    ...styles.cardHeader,
                    backgroundColor: isCooking ? '#fef3c7' : '#f3f4f6',
                  }}
                >
                  <span style={styles.tableBadge}>โต๊ะ {order.table_number}</span>
                  <span style={styles.timeText}>⏰ {formatTime(order.created_at)}</span>
                </div>

                {/* รายการอาหาร */}
                <div style={styles.itemsList}>
                  {Array.isArray(order.items) &&
                    order.items.map((item, idx) => (
                      <div key={idx} style={styles.itemRow}>
                        <span style={styles.itemName}>{item.name}</span>
                        <span style={styles.itemQty}>x{item.quantity}</span>
                      </div>
                    ))}
                </div>

                {/* แถบสถานะ + ปุ่มกด */}
                <div style={styles.cardFooter}>
                  {order.status === 'received' ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'cooking')}
                      style={styles.startBtn}
                    >
                      🔥 เริ่มทำ
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'served')}
                      style={styles.servedBtn}
                    >
                      ✅ จัดเสิร์ฟแล้ว
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Inline Styles ออกแบบเน้นตัวหนังสือใหญ่ คอนทราสต์สูง อ่านง่ายในครัว
const styles = {
  pageWrapper: {
    minHeight: '100vh',
    backgroundColor: '#111827',
    color: '#ffffff',
    padding: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #374151',
  },
  backLink: {
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  title: {
    fontSize: '2rem',
    margin: 0,
    color: '#f9fafb',
  },
  statusBadge: {
    backgroundColor: '#065f46',
    color: '#a7f3d0',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: '#991b1b',
    color: '#fecaca',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '1.2rem',
  },
  loadingBox: {
    textAlign: 'center',
    fontSize: '1.8rem',
    color: '#9ca3af',
    marginTop: '80px',
  },
  emptyBox: {
    textAlign: 'center',
    padding: '100px 20px',
    backgroundColor: '#1f2937',
    borderRadius: '16px',
    marginTop: '20px',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
    alignItems: 'start',
  },
  orderCard: {
    borderRadius: '16px',
    border: '4px solid',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  },
  cardHeader: {
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e7eb',
  },
  tableBadge: {
    fontSize: '2.2rem',
    fontWeight: '900',
    color: '#111827',
  },
  timeText: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#4b5563',
  },
  itemsList: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flexGrow: 1,
    minHeight: '120px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px dashed #d1d5db',
    paddingBottom: '8px',
  },
  itemName: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#111827',
  },
  itemQty: {
    fontSize: '1.8rem',
    fontWeight: '900',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: '2px 10px',
    borderRadius: '8px',
  },
  cardFooter: {
    padding: '16px 20px',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  startBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#d97706',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  servedBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
}
