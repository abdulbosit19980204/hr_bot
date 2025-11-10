# HR Bot - Servislarni Qayta Ishga Tushirish va Cache Tozalash

## 📋 Tarkib

1. [Ubuntu/Linux uchun](#ubuntu-linux-uchun)
2. [Windows uchun](#windows-uchun)
3. [Telegram Cache Tozalash](#telegram-cache-tozalash)

---

## 🐧 Ubuntu/Linux uchun

### Barcha servislarni qayta ishga tushirish:

```bash
./restart_all.sh
```

Yoki:

```bash
bash restart_all.sh
```

### Telegram cache'larni tozalash:

```bash
./clear_telegram_cache.sh
```

Yoki:

```bash
bash clear_telegram_cache.sh
```

### Scriptlar huquqlarini berish (bir marta):

```bash
chmod +x restart_all.sh
chmod +x clear_telegram_cache.sh
```

---

## 🪟 Windows uchun

### PowerShell orqali:

#### Barcha servislarni qayta ishga tushirish:

```powershell
.\restart_all.ps1
```

Agar execution policy muammosi bo'lsa:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\restart_all.ps1
```

#### Telegram cache'larni tozalash:

```powershell
.\clear_telegram_cache.ps1
```

### CMD orqali:

#### Barcha servislarni qayta ishga tushirish:

```cmd
restart_all.bat
```

#### Telegram cache'larni tozalash:

```cmd
clear_telegram_cache.bat
```

---

## 🧹 Telegram Cache Tozalash

### Nima tozalanadi:

1. **Redis cache** - Agar Redis ishlatilsa, barcha cache'lar tozalanadi
2. **Telegram Bot state fayllari** - `.state` va `.cache` fayllari o'chiriladi
3. **Log fayllar** (ixtiyoriy) - Log fayllarni ham tozalash mumkin

### Qachon ishlatish kerak:

- Bot xatoliklar yuzaga kelganda
- State muammolari bo'lganda
- Cache muammolari bo'lganda
- Botni to'liq qayta ishga tushirish kerak bo'lganda

---

## 📊 Scriptlar nima qiladi:

### `restart_all.sh` / `restart_all.ps1` / `restart_all.bat`:

1. **Barcha servislarni to'xtatish:**
   - Backend (Django) - port 8000
   - WebApp (Vite) - port 5173
   - Dashboard (Vite) - port 3000
   - Telegram Bot

2. **Cache'larni tozalash:**
   - Redis cache (agar ishlatilsa)

3. **Barcha servislarni qayta ishga tushirish:**
   - Backend (Django)
   - WebApp (Vite)
   - Dashboard (Vite)
   - Telegram Bot

4. **Natijalarni ko'rsatish:**
   - Har bir servisning holati
   - Log fayllar joylashuvi

### `clear_telegram_cache.sh` / `clear_telegram_cache.ps1` / `clear_telegram_cache.bat`:

1. **Redis cache tozalash**
2. **Telegram Bot state fayllarini tozalash**
3. **Log fayllarni tozalash** (ixtiyoriy)

---

## ⚠️ Eslatmalar:

1. **Log fayllar** `logs/` papkasida saqlanadi
2. **Process ID'lar** `logs/*.pid` fayllarida saqlanadi
3. **Redis** o'rnatilmagan bo'lsa, xatolik ko'rsatilmaydi
4. **Virtual environment** avtomatik aktivlashtiriladi

---

## 🔧 Muammolarni Hal Qilish:

### Ubuntu/Linux:

- **Permission denied**: `chmod +x script_name.sh`
- **Port band**: Script avtomatik to'xtatadi va qayta ishga tushiradi

### Windows:

- **Execution policy muammosi**: 
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- **Port band**: Script avtomatik to'xtatadi va qayta ishga tushiradi

---

## 📝 Log Fayllar:

- `logs/backend.log` - Backend loglari
- `logs/webapp.log` - WebApp loglari
- `logs/dashboard.log` - Dashboard loglari
- `logs/telegram_bot.log` - Telegram Bot loglari

---

## 🎯 Tez Ishga Tushirish:

### Ubuntu/Linux:
```bash
./restart_all.sh
```

### Windows PowerShell:
```powershell
.\restart_all.ps1
```

### Windows CMD:
```cmd
restart_all.bat
```

---

## ✅ Tugadi!

Barcha servislar qayta ishga tushirildi va cache'lar tozalandi!

