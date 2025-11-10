#!/bin/bash

# Telegram cache'larni tozalash
# Ubuntu/Linux uchun

echo "🧹 Telegram cache'larni tozalash..."
echo ""

# Redis cache'larni tozalash
if command -v redis-cli &> /dev/null; then
    echo "⏹️  Redis cache'larni tozalash..."
    redis-cli FLUSHALL
    if [ $? -eq 0 ]; then
        echo "✅ Redis cache tozalandi"
    else
        echo "⚠️  Redis ishlamayapti yoki cache bo'sh"
    fi
else
    echo "⚠️  Redis o'rnatilmagan"
fi

# Telegram Bot state fayllarini tozalash (agar MemoryStorage ishlatilsa)
if [ -d "telegram_bot" ]; then
    echo "⏹️  Telegram Bot state fayllarini tozalash..."
    find telegram_bot -name "*.state" -type f -delete 2>/dev/null
    find telegram_bot -name "*.cache" -type f -delete 2>/dev/null
    echo "✅ Telegram Bot state fayllari tozalandi"
fi

# Log fayllarini tozalash (ixtiyoriy)
read -p "Log fayllarni ham tozalashni xohlaysizmi? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "logs" ]; then
        echo "⏹️  Log fayllarni tozalash..."
        rm -f logs/*.log 2>/dev/null
        echo "✅ Log fayllar tozalandi"
    fi
fi

echo ""
echo "✅ Telegram cache'lar tozalandi!"

