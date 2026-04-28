const DEFAULT_BACKEND_URL = "https://civicsense-backend-1.onrender.com";

const normalizeApiBaseUrl = (rawUrl) => {
  if (!rawUrl) {
    return DEFAULT_BACKEND_URL;
  }

  const trimmedUrl = rawUrl.trim().replace(/\/+$/, "");
  return trimmedUrl.replace(/\/api$/i, "");
};

export const API_BASE_URL = normalizeApiBaseUrl(process.env.REACT_APP_API_URL);
export const API_URL = `${API_BASE_URL}/api`;
