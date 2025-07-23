#!/bin/bash

echo "🔍 Starting SafeLoop Care Error Monitor..."
echo "Press Ctrl+C to stop monitoring"
echo "=================================="

# Monitor iOS Simulator logs for SafeLoopCare
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "SafeLoopCare"' --style syslog | while read line; do
    # Check for errors, crashes, and React Native issues
    if echo "$line" | grep -iE "(error|exception|crash|failed|unimplemented|warning)" | grep -v "SecTrustReportNetworkingAnalytics"; then
        echo "🚨 $(date '+%H:%M:%S') - $line"
    fi
done