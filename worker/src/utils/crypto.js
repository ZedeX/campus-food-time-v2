// Crypto utilities for password encryption (reversible, per user decision)
// Uses Web Crypto API available in Cloudflare Workers

// Simple XOR-based reversible encryption with base64 encoding
// Note: This is NOT secure for production, but per user decision, passwords are stored reversibly
// For production, use AES-GCM with a proper key from environment variable

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

// XOR cipher with key (simple reversible encryption)
function xorEncrypt(text, key) {
  const textBytes = ENCODER.encode(text);
  const keyBytes = ENCODER.encode(key);
  const result = new Uint8Array(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    result[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  // Convert to base64
  return btoa(String.fromCharCode(...result));
}

function xorDecrypt(encrypted, key) {
  // Convert from base64
  const bytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const keyBytes = ENCODER.encode(key);
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return DECODER.decode(result);
}

// Encrypt password
export function encryptPassword(password, secret) {
  return xorEncrypt(password, secret);
}

// Decrypt password
export function decryptPassword(encrypted, secret) {
  try {
    return xorDecrypt(encrypted, secret);
  } catch {
    return null;
  }
}

// Verify password
export function verifyPassword(password, encrypted, secret) {
  const decrypted = decryptPassword(encrypted, secret);
  return decrypted === password;
}

// Generate session token (UUID v4)
export function generateToken() {
  return crypto.randomUUID();
}

// Generate user ID
export function generateUserId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Hash for cache keys (simple)
export function hashKey(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
