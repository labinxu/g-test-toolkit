#!/bin/bash
# diff_lines.sh - 逐行比较两个 CSV 文件

file1="$1"
file2="$2"

if [[ ! -f "$file1" || ! -f "$file2" ]]; then
    echo "用法: $0 file1.csv file2.csv"
    exit 1
fi

# 统计总行数
lines1=$(wc -l < "$file1")
lines2=$(wc -l < "$file2")

echo "file1: $lines1 行"
echo "file2: $lines2 行"

if (( lines1 != lines2 )); then
    echo "行数不同，文件内容不同！"
    exit 1
fi

# 逐行比较
different=false
for ((i=1; i<=lines1; i++)); do
    line1=$(sed -n "${i}p" "$file1")
    line2=$(sed -n "${i}p" "$file2")
    if [[ "$line1" != "$line2" ]]; then
        echo "第 $i 行不同："
        echo "  file1: $line1"
        echo "  file2: $line2"
        different=true
    fi
done

if ! $different; then
    echo "所有行完全相同！"
else
    echo "发现差异。"
fi
