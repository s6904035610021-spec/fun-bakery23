'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function GenerateQRPage() {
  // ฟอร์ม Input
  const [tableNumber, setTableNumber] = useState('')
  const [adultCount, setAdultCount] = useState(1)
  const [childCount, setChildCount] = useState(0)

  // สถานะการทำงาน
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // สถานะเมื่อเจอ Session ค้าง
  const [existingSession, setExistingSession] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // สถานะเมื่อเปิดโต๊ะใหม่สำเร็จ
  const [createdSession, setCreatedSession] = useState(null)
  const [originUrl, setOriginUrl] = useState('')
  const [copied, setCopied] = useState(false)

  // ดึง Origin (Domain/Port) ปัจจุบันเมื่อโหลด client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin)
    }
  }, [])

  // คำนวณระยะเวลาเป็นนาทีจาก created_at
  const getMinutesElapsed = (createdAt) => {
    if (!createdAt) return 0
    const created = new Date(createdAt)
    const now = new Date()
    const diffMs = now - created
    return Math.floor(diffMs / (1000 * 60))
  }

  // 1. กดปุ่มเปิดโต๊ะ
  const handleOpenTable = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setExistingSession(null)
    setCreatedSession(null)

    const tableNum = parseInt(tableNumber, 10)
    const adult = parseInt(adultCount, 10)
    const child = parseInt(childCount, 10)

    if (isNaN(tableNum) || tableNum <= 0) {
      setErrorMessage('กรุณาระบุเลขโต๊ะให้ถูกต้อง')
      return
    }

    setLoading(true)

    try {
      // 2. เช็คว่ามี session ที่ status = 'open' ของโต๊ะนี้อยู่แล้วหรือไม่
      const { data: openSessions, error: checkError } = await supabase
        .from('sessions')
        .select('*')
        .eq('table_number', tableNum)
        .eq('status', 'open')

      if (checkError) throw checkError

      // ถ้ามี Session เปิดค้างอยู่
      if (openSessions && openSessions.length > 0) {
        setExistingSession(openSessions[0])
        setLoading(false)
        return
      }

      // ถ้าไม่มี ให้ Insert แถวใหม่ลงตาราง sessions
      const { data: newSession, error: insertError } = await supabase
        .from('sessions')
        .insert([
          {
            table_number: tableNum,
            adult_count: adult,
            child_count: child,
            status: 'open',
          },
        ])
        .select()
        .single()

      if (insertError) throw insertError

      // สร้างสำเร็จ
      setCreatedSession(newSession)
    } catch (err) {
      console.error(err)
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  // 3. กดปิดโต๊ะเดิม
  const handleCloseExistingSession = async () => {
    if (!existingSession) return
    setLoading(true)
    setErrorMessage('')

    try {
      // update status = 'closed' เช็คเงื่อนไขป้องกันการกดซ้ำด้วย
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existingSession.id)
        .eq('status', 'open')

      if (updateError) throw updateError

      // ปิดสำเร็จ -> ปิดกล่องยืนยัน, เอากล่องเตือนออก, พนักงานกดเปิดโต๊ะใหม่ได้เลย
      setShowConfirmModal(false)
      setExistingSession(null)
      alert(`ปิด Session เดิมของโต๊ะ ${existingSession.table_number} เรียบร้อยแล้ว`)
    } catch (err) {
      console.error(err)
      setErrorMessage('ไม่สามารถปิด Session เดิมได้ โปรดลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  // 4. ล้างฟอร์มเพื่อเปิดโต๊ะใหม่
  const handleResetForm = () => {
    setTableNumber('')
    setAdultCount(1)
    setChildCount(0)
    setCreatedSession(null)
    setExistingSession(null)
    setErrorMessage('')
    setCopied(false)
  }

  // คัดลอกลิงก์
  const targetUrl = createdSession
    ? `${originUrl}/order/${createdSession.table_number}`
    : ''

  const handleCopyLink = () => {
    if (!targetUrl) return
    navigator.clipboard.writeText(targetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={styles.container}>
      {/* ส่วนหัว */}
      <header style={styles.header}>
        <Link href="/" style={styles.backLink}>← กลับหน้าหลัก</Link>
        <h1 style={styles.title}>เปิดโต๊ะ & สร้าง QR Code สั่งอาหาร</h1>
      </header>

      {/* ข้อความแสดง Error ทั่วไป */}
      {errorMessage && (
        <div style={styles.errorBanner}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* ----------------- กรณีที่ 1: แสดง QR Code เมื่อสร้างสำเร็จ ----------------- */}
      {createdSession ? (
        <div style={styles.qrCard}>
          <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px' }}>
            ✓ เปิดโต๊ะสำเร็จแล้ว
          </div>

          <p style={styles.summaryText}>
            โต๊ะ {createdSession.table_number} · ผู้ใหญ่ {createdSession.adult_count} · เด็ก {createdSession.child_count}
          </p>

          <div style={styles.qrBox}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`}
              alt={`QR Code สำหรับโต๊ะ ${createdSession.table_number}`}
              style={{ width: '260px', height: '260px', display: 'block', margin: '0 auto' }}
            />
          </div>

          <div style={styles.urlBox}>
            <span style={styles.urlText}>{targetUrl}</span>
            <button type="button" onClick={handleCopyLink} style={styles.copyBtn}>
              {copied ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
            </button>
          </div>

          <button type="button" onClick={handleResetForm} style={styles.resetBtn}>
            + เปิดโต๊ะใหม่
          </button>
        </div>
      ) : (
        /* ----------------- กรณีที่ 2: ฟอร์มปกติ & กล่องเตือน Session ค้าง ----------------- */
        <div style={styles.card}>
          {/* กล่องเตือนภัยเมื่อมี Session เปิดค้างอยู่ */}
          {existingSession && (
            <div style={styles.warningBox}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#991b1b' }}>
                ⚠️ โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#7f1d1d' }}>
                โต๊ะ {existingSession.table_number} มีการเปิด Session ค้างอยู่ กรุณาปิดออเดอร์เดิมก่อนเปิดใหม่
              </p>
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                style={styles.closeOldBtn}
              >
                ปิดออเดอร์เดิม
              </button>
            </div>
          )}

          <form onSubmit={handleOpenTable} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>หมายเลขโต๊ะ:</label>
              <input
                type="number"
                min="1"
                required
                placeholder="ระบุเลขโต๊ะ เช่น 7"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldRow}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>ผู้ใหญ่ (คน):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adultCount}
                  onChange={(e) => setAdultCount(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={styles.label}>เด็ก (คน):</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={childCount}
                  onChange={(e) => setChildCount(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'กำลังประมวลผล...' : 'เปิดโต๊ะ'}
            </button>
          </form>
        </div>
      )}

      {/* ----------------- Modal ยืนยันการปิดโต๊ะเดิม ----------------- */}
      {showConfirmModal && existingSession && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ margin: '0 0 16px 0', color: '#b91c1c', fontSize: '1.4rem' }}>
              ยืนยันการปิดโต๊ะเดิม
            </h2>

            <div style={styles.modalDetail}>
              <p><strong>เลขโต๊ะ:</strong> โต๊ะ {existingSession.table_number}</p>
              <p><strong>จำนวนลูกค้าเดิม:</strong> ผู้ใหญ่ {existingSession.adult_count} คน · เด็ก {existingSession.child_count} คน</p>
              <p style={{ color: '#c2410c', fontWeight: 'bold' }}>
                ⏱️ เปิดมาแล้ว {getMinutesElapsed(existingSession.created_at)} นาที
              </p>
            </div>

            <p style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '20px' }}>
              คุณแน่ใจหรือไม่ว่าต้องการปิด Session เดิมของโต๊ะนี้?
            </p>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                style={styles.cancelBtn}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleCloseExistingSession}
                disabled={loading}
                style={styles.confirmBtn}
              >
                {loading ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline Styles ดีไซน์ตัวหนังสือใหญ่ เรียบง่าย เหมาะสำหรับงานหน้าร้าน
const styles = {
  container: {
    maxWidth: '520px',
    margin: '0 auto',
    padding: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    marginBottom: '20px',
  },
  backLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  title: {
    fontSize: '1.6rem',
    margin: '10px 0 0 0',
    color: '#1f2937',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid #fecaca',
    fontSize: '1rem',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
  },
  warningBox: {
    backgroundColor: '#fff7ed',
    border: '2px solid #fdba74',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  closeOldBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.05rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldRow: {
    display: 'flex',
    gap: '16px',
  },
  label: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '14px',
    fontSize: '1.2rem',
    borderRadius: '8px',
    border: '2px solid #d1d5db',
    boxSizing: 'border-box',
    outline: 'none',
  },
  submitBtn: {
    padding: '16px',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1.3rem',
    fontWeight: 'bold',
    marginTop: '10px',
  },
  qrCard: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
    textAlign: 'center',
  },
  summaryText: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: '#111827',
    margin: '0 0 20px 0',
  },
  qrBox: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    marginBottom: '20px',
  },
  urlBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#f3f4f6',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '24px',
  },
  urlText: {
    fontSize: '1rem',
    color: '#2563eb',
    wordBreak: 'break-all',
    fontWeight: '500',
  },
  copyBtn: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  resetBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4b5563',
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
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '16px',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
  },
  modalDetail: {
    backgroundColor: '#fef2f2',
    padding: '14px',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid #fecaca',
    fontSize: '1.05rem',
    lineHeight: '1.6',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#e5e7eb',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  confirmBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
}
