#!/bin/bash
# 检查是否提供了足够的参数
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <input_stream> <rtmp_server> <stream_key>"
    exit 1
fi

INPUT_STREAM="$1"
RTMP_SERVER="$2"
STREAM_KEY="$3"

RTMP_URL="${RTMP_SERVER}/${STREAM_KEY}"
rm ffmpeg_log_*.txt
# 验证输入文件是否存在
if [ ! -f "$INPUT_STREAM" ]; then
    echo "Error: Input file $INPUT_STREAM does not exist"
    exit 1
fi

# 验证输入流是否有效并获取总时长
INPUT_DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$INPUT_STREAM" 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$INPUT_DURATION" ]; then
    echo "Error: Invalid input stream $INPUT_STREAM or unable to read duration"
    exit 1
fi
echo "Input file duration: $INPUT_DURATION seconds"

# 记录推流开始时间（Unix 时间戳，秒）
START_TIME=$(date +%s)

# 初始化重试计数器和比特率
RETRY_COUNT=0
MAX_RETRIES=0       # 0 表示无限重试，设置为正整数可限制重试次数
DEFAULT_BITRATE=800 # 默认视频比特率（kbps）
MIN_BITRATE=300     # 最小比特率（kbps）
BITRATE_STEP=200    # 每次降低的比特率步长（kbps）
BITRATE=$DEFAULT_BITRATE
LAST_DURATION=0 # 跟踪上一次推流的持续时间（秒）

# 函数：获取网络上传速度并计算合适的比特率
get_network_bitrate() {
    UPLOAD_SPEED=$(speedtest-cli --simple 2>/dev/null | grep Upload | awk '{print $2}')
    if [ -z "$UPLOAD_SPEED" ]; then
        echo "Warning: Failed to get upload speed, using default bitrate ${DEFAULT_BITRATE}k"
        BITRATE=$DEFAULT_BITRATE
    else
        BITRATE=$(echo "$UPLOAD_SPEED * 1000 * 0.8" | bc | cut -d. -f1)
        if [ $BITRATE -lt $MIN_BITRATE ]; then
            BITRATE=$MIN_BITRATE
        fi
        if [ $BITRATE -gt $DEFAULT_BITRATE ]; then
            BITRATE=$DEFAULT_BITRATE
        fi
        echo "Network upload speed: ${UPLOAD_SPEED} Mbps, setting bitrate to ${BITRATE}k"
    fi
}

# 函数：检查输入流是否可 seek
is_seekable() {
    ffprobe -v error -show_streams "$INPUT_STREAM" 2>/dev/null | grep -q "duration="
    return $?
}

# 检查 speedtest-cli 是否可用
command -v speedtest-cli >/dev/null 2>&1
if [ $? -eq 0 ]; then
    get_network_bitrate
else
    echo "Warning: speedtest-cli not found, using default bitrate ${DEFAULT_BITRATE}k"
    BITRATE=$DEFAULT_BITRATE
fi

# 检查输入流是否可 seek
if is_seekable; then
    echo "Input stream is seekable (e.g., file or VOD)."
    SEEKABLE=1
else
    echo "Input stream is non-seekable (e.g., live stream). Ignoring -ss."
    SEEKABLE=0
fi

while true; do
    # 计算缓冲区大小（通常为比特率的 2 倍）
    BUFSIZE=$((BITRATE * 2))

    # 验证 LAST_DURATION 是否为有效数字
    if ! echo "$LAST_DURATION" | grep -qE '^[0-9]+(\.[0-9]+)?$'; then
        echo "Warning: Invalid LAST_DURATION ($LAST_DURATION), resetting to 0"
        LAST_DURATION=0
    fi

    # 检查是否已接近输入文件总时长
    if [ $SEEKABLE -eq 1 ] && [ $(echo "$LAST_DURATION >= $INPUT_DURATION" | bc) -eq 1 ]; then
        echo "Reached or exceeded input file duration ($INPUT_DURATION seconds). Stopping."
        break
    fi
    LOG_FILE="ffmpeg_log_${RETRY_COUNT}.txt"

    # 构建 FFmpeg 命令
    FFMPEG_CMD="ffmpeg -loglevel verbose -re"
    if [ $SEEKABLE -eq 1 ] && [ $(echo "$LAST_DURATION > 0" | bc) -eq 1 ]; then
        FFMPEG_CMD="$FFMPEG_CMD -ss $LAST_DURATION"
    fi
    FFMPEG_CMD="$FFMPEG_CMD -i \"$INPUT_STREAM\" \
    -copyts \
    -c:v libx264 -preset veryfast -b:v \"${BITRATE}k\" -maxrate \"${BITRATE}k\" -bufsize \"${BUFSIZE}k\" -r 25 -s 1280x720 \
    -c:a aac -ar 44100 -b:a 96k \
    -f flv \
    -reconnect 1 -reconnect_streamed 1 -reconnect_at_eof 1 -reconnect_delay_max 120 -rtmp_buffer 3000 \
    \"$RTMP_URL\""

    # 打印推流信息和 FFmpeg 命令
    echo "Starting FFmpeg push to $RTMP_URL with bitrate ${BITRATE}k, bufsize ${BUFSIZE}k, resume from ${LAST_DURATION}s (Retry $RETRY_COUNT)..."
    echo "FFmpeg command: $FFMPEG_CMD"
    # 执行 FFmpeg 推流，保存日志
    eval "$FFMPEG_CMD" 2>"$LOG_FILE"

    # 检查 FFmpeg 返回值
    FFMPEG_EXIT_CODE=$?
    if [ $FFMPEG_EXIT_CODE -eq 0 ]; then
        echo "Stream successfully pushed to $RTMP_URL with bitrate ${BITRATE}k"
        rm -rf ffmpeg_log_*.txt
        break # 推流成功，退出循环
    else
        echo "FFmpeg failed (error code: $FFMPEG_EXIT_CODE), retrying in 5 seconds..."
        # 尝试从 FFmpeg 日志中提取已处理的持续时间
        NEW_DURATION=$(grep "time=" "$LOG_FILE" | tail -1 | sed -E 's/.*time=([0-9:.]+).*/\1/' | awk -F: '{if (NF==3) print ($1*3600)+($2*60)+$3; else if (NF==2) print ($1*60)+$2; else print $1}' 2>/dev/null)
        if [ -n "$NEW_DURATION" ] && echo "$NEW_DURATION" | grep -qE '^[0-9]+(\.[0-9]+)?$'; then
            # 如果使用了 -ss，则 NEW_DURATION 是相对时间，需加上 LAST_DURATION
            if [ $SEEKABLE -eq 1 ] && [ $(echo "$LAST_DURATION > 0" | bc 2>/dev/null) -eq 1 ]; then
                LAST_DURATION=$(echo "$LAST_DURATION + $NEW_DURATION" | bc 2>/dev/null)
            else
                LAST_DURATION="$NEW_DURATION"
            fi
            echo "Updated LAST_DURATION to ${LAST_DURATION}s"
        else
            echo "Warning: Could not parse valid duration from log, keeping LAST_DURATION at ${LAST_DURATION}s"
        fi
        echo "New DURATION: $NEW_DURATION Last processed duration: ${LAST_DURATION}s"

        # 降低比特率
        BITRATE=$((BITRATE - BITRATE_STEP))
        if [ $BITRATE -lt $MIN_BITRATE ]; then
            BITRATE=$MIN_BITRATE
            echo "Reached minimum bitrate (${MIN_BITRATE}k). Continuing with minimum bitrate."
        fi

        # 检查是否已推流完整文件
        if [ $SEEKABLE -eq 1 ] && [ -n "$LAST_DURATION" ] && [ $(echo "$LAST_DURATION >= $INPUT_DURATION" | bc 2>/dev/null) -eq 1 ]; then
            echo "Reached or exceeded input file duration ($INPUT_DURATION seconds). Stream completed."
            break
        fi

        # 增加重试计数
        RETRY_COUNT=$((RETRY_COUNT + 1))

        # 如果设置了最大重试次数，检查是否达到上限
        if [ $MAX_RETRIES -ne 0 ] && [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "Reached maximum retry limit ($MAX_RETRIES). Exiting."
            exit 1
        fi

        # 每 5 次重试重新检查网络速度
        if [ $((RETRY_COUNT % 3)) -eq 0 ]; then
            if command -v speedtest-cli >/dev/null 2>&1; then
                get_network_bitrate
            fi
        fi

        sleep 5 # 等待 5 秒后重试
    fi
done

# 清理临时日志文件
rm -f ffmpeg_log*.txt
