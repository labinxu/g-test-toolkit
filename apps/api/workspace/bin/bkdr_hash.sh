#!/bin/bash

# BKDR Hash 计算脚本 (Bash 版本)
# 用法: ./bkdr_hash.sh user_id cdate
# 例如: ./bkdr_hash.sh "user123" 1234567890

calculate_bkdr_hash() {
    local input_string="$1"
    local hash_val=0
    local seed=10
    local i
    
    # 遍历字符串中的每个字符
    for (( i=0; i<${#input_string}; i++ )); do
        # 获取字符的 ASCII 值
        char="${input_string:$i:1}"
        ascii_val=$(printf "%d" "'$char")
        
        # 计算哈希值: hash_val = (hash_val * seed) + ord(c)
        hash_val=$((hash_val * seed + ascii_val))
    done
    
    # 应用掩码: hash_val & 0x7FFFFFFFFFFFFFFF
    # 在 bash 中，我们使用 Python 来处理大整数运算
    python3 -c "print($hash_val & 0x7FFFFFFFFFFFFFFF)"
}

main() {
    local user_id
    local cdate
    local input_string
    
    # 检查参数数量
    if [ $# -ne 2 ]; then
        echo "错误: 需要提供两个参数" >&2
        echo "用法: $0 user_id cdate" >&2
        echo "例如: $0 \"user123\" 1234567890" >&2
        exit 1
    fi
    
    user_id="$1"
    cdate="$2"
    
    # 检查参数是否为空
    if [ -z "$user_id" ] || [ -z "$cdate" ]; then
        echo "错误: user_id 和 cdate 都不能为空" >&2
        exit 1
    fi
    
    # 检查 cdate 是否为数字
    if ! [[ "$cdate" =~ ^[0-9]+$ ]]; then
        echo "错误: cdate 必须是数字" >&2
        exit 1
    fi
    
    # 按照 f'{user_id}{cdate % 10}' 的方式拼接
    cdate_mod=$((cdate % 10))
    input_string="${user_id}${cdate_mod}"
    
    hash_value=$(calculate_bkdr_hash "$input_string")
    echo "用户ID: $user_id"
    echo "创建时间: $cdate"
    echo "拼接字符串: $input_string (${user_id} + ${cdate} % 10 = ${user_id} + ${cdate_mod})"
    echo "BKDR 哈希值: $hash_value"
    
    table_num=$((hash_value % 200))
    printf "分表编号：%03d\n" $table_num
}

main "$@"
