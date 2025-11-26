from mitmproxy import http  # type: ignore
import json
import time


def response(flow: http.HTTPFlow) -> None:  # type: ignore[name-defined]
  """
  mitmdump addon hook: called for each HTTP response.
  Prints a single-line JSON summary to stdout so that the Node backend
  can parse it easily.
  """
  try:
    req = flow.request
    resp = flow.response

    # Basic URL pieces
    scheme = (req.scheme or "http") if hasattr(req, "scheme") else "http"
    host = ""
    try:
      host = req.headers.get("Host", "")
    except Exception:
      host = ""
    path = req.path or "/" if hasattr(req, "path") else "/"
    url = f"{scheme}://{host}{path}" if host else path

    # Timing (timestamps are seconds since epoch)
    started = getattr(req, "timestamp_start", None) or getattr(flow, "timestamp_start", None)
    duration_ms = None
    if resp is not None:
      end = getattr(resp, "timestamp_end", None) or getattr(flow, "timestamp_end", None)
      if isinstance(started, (int, float)) and isinstance(end, (int, float)):
        duration_ms = max(0, int(round((end - started) * 1000)))

    started_at = None
    if isinstance(started, (int, float)):
      try:
        started_at = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(started))
      except Exception:
        started_at = None

    content_type = None
    if resp is not None:
      try:
        content_type = resp.headers.get("Content-Type", None)
      except Exception:
        content_type = None

    data = {
      "id": flow.id,
      "method": (req.method or "").upper() if hasattr(req, "method") else "",
      "url": url,
      "statusCode": resp.status_code if resp is not None else None,
      "contentType": content_type,
      "startedAt": started_at,
      "durationMs": duration_ms,
    }
    print(json.dumps(data), flush=True)
  except Exception:
    # Best-effort only; ignore per-flow errors.
    return

