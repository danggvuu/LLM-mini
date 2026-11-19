"""URL validation for server-side fetches initiated by notebook requests."""

from ipaddress import ip_address
import socket
from urllib.parse import urlsplit


def validate_public_http_url(url: str) -> str:
    """Allow public HTTP(S) destinations only; reject local/private networks."""
    try:
        parsed = urlsplit(url)
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
            raise ValueError("URL phải là địa chỉ HTTP hoặc HTTPS hợp lệ.")
        if parsed.username or parsed.password:
            raise ValueError("URL không được chứa thông tin đăng nhập.")

        hostname = parsed.hostname.rstrip(".").lower()
        if hostname == "localhost" or hostname.endswith((".localhost", ".local", ".internal")):
            raise ValueError("Không cho phép truy cập máy chủ hoặc mạng nội bộ.")

        try:
            addresses = [ip_address(hostname)]
        except ValueError:
            try:
                resolved = socket.getaddrinfo(
                    hostname,
                    parsed.port or (443 if parsed.scheme.lower() == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            except OSError as exc:
                raise ValueError("Không phân giải được hostname của URL.") from exc
            addresses = [ip_address(item[4][0].split("%")[0]) for item in resolved]

        if not addresses or any(not address.is_global for address in addresses):
            raise ValueError("Không cho phép truy cập địa chỉ IP nội bộ hoặc không công khai.")
        return url
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("URL không hợp lệ.") from exc
