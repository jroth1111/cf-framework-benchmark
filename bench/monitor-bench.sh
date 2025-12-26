#!/bin/bash
LOG="benchmark-full.log"
PID="22513"
LAST_LINE_COUNT=0

echo "📊 Monitoring benchmark (PID: $PID)..."
echo "=========================================="

while ps -p $PID > /dev/null 2>&1; do
    CURRENT_LINE_COUNT=$(wc -l < "$LOG" 2>/dev/null || echo 0)
    
    if [ "$CURRENT_LINE_COUNT" -gt "$LAST_LINE_COUNT" ]; then
        echo "📝 [$(date '+%H:%M:%S')] Progress update ($(tail -5 "$LOG" 2>/dev/null | grep -E "▶|✓|Profile|Framework|home|stays|blog|chart" | tail -1))" 2>/dev/null || true
        LAST_LINE_COUNT=$CURRENT_LINE_COUNT
    fi
    
    # Check if benchmark is complete
    if grep -q "✓ All benchmarks complete" "$LOG" 2>/dev/null; then
        echo ""
        echo "✅ Benchmark completed!"
        tail -20 "$LOG"
        exit 0
    fi
    
    sleep 30
done

echo ""
echo "⚠️  Benchmark process stopped (PID: $PID no longer running)"
echo ""
echo "📊 Last 30 lines of log:"
echo "=========================================="
tail -30 "$LOG"
