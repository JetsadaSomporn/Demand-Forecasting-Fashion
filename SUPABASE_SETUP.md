# Supabase Magic Link Setup Guide

## ปัญหาที่พบ
Error: "Login failed: invalid request: both auth code and code verifier should be non-empty"

## สาเหตุ
- Magic link ใช้ OTP flow (token_hash) ไม่ใช่ PKCE flow (code + code_verifier)
- Redirect URL ไม่ตรงกับที่ตั้งค่าใน Supabase Dashboard

## วิธีแก้ไข

### 1. ตั้งค่า Redirect URLs ใน Supabase Dashboard

ไปที่ **Supabase Dashboard** → **Authentication** → **URL Configuration**

เพิ่ม URLs เหล่านี้ใน **Redirect URLs**:
```
http://localhost:3000/auth/callback
https://yourdomain.com/auth/callback
```

### 2. ตั้งค่า Site URL

ตั้ง **Site URL** เป็น:
```
http://localhost:3000
```
(หรือ production URL ของคุณ)

### 3. Email Templates (Optional)

ไปที่ **Authentication** → **Email Templates** → **Magic Link**

ตรวจสอบว่า template มี `{{ .ConfirmationURL }}` ที่ถูกต้อง:

```html
<h2>Magic Link</h2>
<p>Click the link below to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Log in</a></p>
```

### 4. Auth Flow ที่ถูกต้อง

✅ **Magic Link Flow** (OTP):
1. User กรอก email
2. Supabase ส่ง magic link พร้อม `token_hash`
3. User คลิกลิงก์ → redirect มา `/auth/callback?token_hash=xxx&type=magiclink`
4. App ใช้ `verifyOtp()` กับ `token_hash`
5. Session created ✓

❌ **PKCE Flow** (OAuth):
- ต้องมี `code` และ `code_verifier`
- ไม่ใช้กับ Magic Link

## การทดสอบ

1. เปิด browser console (F12)
2. ไปที่ `/login` และส่ง magic link
3. เช็คว่าลิงก์ในอีเมลมี `token_hash` parameter
4. คลิกลิงก์และดู console logs:
   ```
   [Callback] Verifying OTP with token_hash (magic link flow)...
   [Callback] OTP verification successful: session created
   ```

## หากยังมีปัญหา

ตรวจสอบ:
1. ✅ NEXT_PUBLIC_SUPABASE_URL ถูกต้อง
2. ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY ถูกต้อง
3. ✅ Redirect URL ตรงกับใน Dashboard
4. ✅ Email template ไม่ได้แก้ไข URL
5. ✅ ไม่มี ad blocker หรือ tracking blocker บล็อก Supabase

## Changes Made

### `/components/LoginForm.tsx`
- เพิ่ม `data: {}` เพื่อให้แน่ใจว่าใช้ OTP flow

### `/app/auth/callback/page.tsx`
- เปลี่ยน priority: `token_hash` (magic link) → `access_token` → `code` (PKCE)
- ลบ PKCE error fallback ที่ซับซ้อน
- เพิ่ม debug logging ที่ชัดเจน

## Test Locally

```bash
npm run dev
# ไปที่ http://localhost:3000/login
# ส่ง magic link และเช็ค console
```

---

## ✅ Checklist การตั้งค่าสำหรับ localhost:3000

### Supabase Dashboard Settings:

1. **Authentication → URL Configuration**
   - [x] Site URL: `http://localhost:3000`
   - [x] Redirect URLs: `http://localhost:3000/auth/callback`
   - [x] กด "Save changes" ✓

2. **Environment Variables (.env.local)**
   - [x] NEXT_PUBLIC_SUPABASE_URL
   - [x] NEXT_PUBLIC_SUPABASE_ANON_KEY
   - [x] SUPABASE_SERVICE_ROLE_KEY

3. **Code Changes**
   - [x] LoginForm.tsx อัพเดตแล้ว
   - [x] auth/callback/page.tsx แก้ไข priority แล้ว

### ขั้นตอนทดสอบ:

1. **เปิด Browser และไปที่:** `http://localhost:3000/login`

2. **เปิด Developer Console** (กด F12 หรือ Cmd+Option+I)

3. **กรอกอีเมลและกด "Send magic link"**

4. **เช็คในอีเมล** → คลิก magic link

5. **ดู Console Logs ควรเห็น:**
   ```
   [Callback] URL params: { token_hash: "xxx", type: "magiclink" }
   [Callback] Verifying OTP with token_hash (magic link flow)...
   [Callback] OTP verification successful: session created
   [Callback] Final session check: session exists
   [Callback] Redirecting to: /
   ```

6. **ผลลัพธ์ที่คาดหวัง:**
   - ✅ Redirect ไปหน้า Home (/)
   - ✅ เห็นชื่อผู้ใช้ในเมนู
   - ✅ ไม่มี error message

### หากเจอปัญหา:

❌ **"Login failed: invalid request"**
→ เช็คว่ากด "Save changes" ใน Supabase Dashboard แล้ว

❌ **"Missing verification code"**
→ เช็ค URL ในอีเมลว่ามี `token_hash` parameter

❌ **"Session was not created"**
→ เช็ค NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local

❌ **Redirect loop**
→ Clear browser cookies และลองใหม่
