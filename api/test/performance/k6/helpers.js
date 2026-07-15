export function forwardedIp() {
  return `203.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export function jsonHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Forwarded-For': forwardedIp(),
  };
}

export function parseJson(response) {
  try {
    return response.json();
  }
  catch {
    return {};
  }
}
