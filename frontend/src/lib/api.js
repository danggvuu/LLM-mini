export function getErrorMessage(error, fallback = 'Không thể hoàn tất thao tác. Vui lòng thử lại.') {
  const detail = error?.response?.data?.detail ?? error?.detail ?? error?.message;
  if (Array.isArray(detail)) return detail.map(item => item.msg || String(item)).join('; ');
  return typeof detail === 'string' && detail.trim() ? detail : fallback;
}

export async function requestJson(url, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, { ...options, headers });
  const invalidJson = Symbol('invalidJson');
  const data = await response.json().catch(() => invalidJson);
  if (!response.ok) {
    const error = new Error(getErrorMessage(data, `Yêu cầu thất bại (${response.status}). Vui lòng thử lại.`));
    error.status = response.status;
    throw error;
  }
  if (data === invalidJson && response.status !== 204) {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng tải lại trang.');
  }
  return data === invalidJson ? null : data;
}

export async function* readSSE(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(getErrorMessage(data, `Không thể kết nối (${response.status}).`));
  }
  if (!response.body) throw new Error('Trình duyệt không hỗ trợ phản hồi trực tiếp.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop();
      if (done && buffer.trim()) frames.push(buffer);
      for (const frame of frames) {
        const data = frame.split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (!data || data === '[DONE]') continue;
        yield JSON.parse(data);
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
