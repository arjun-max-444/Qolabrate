const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export type GstinValidation = { valid: boolean; normalized: string; reason?: string }

export function normalizeGSTIN(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

export function validateGSTIN(value: string): GstinValidation {
  const normalized = normalizeGSTIN(value)
  if (!normalized) return { valid: false, normalized, reason: 'GSTIN is required for brand registration.' }
  if (normalized.length !== 15) return { valid: false, normalized, reason: 'GSTIN must contain exactly 15 characters.' }
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9][Z][A-Z0-9]$/.test(normalized)) {
    return { valid: false, normalized, reason: 'Use the expected GSTIN structure: 2-digit state, PAN, entity code, Z, and checksum.' }
  }
  const stateCode = Number(normalized.slice(0, 2))
  if (!((stateCode >= 1 && stateCode <= 38) || stateCode === 97 || stateCode === 99)) {
    return { valid: false, normalized, reason: 'GSTIN state code is not in the supported range.' }
  }
  let total = 0
  for (let index = 0; index < 14; index += 1) {
    const valueIndex = GSTIN_CHARSET.indexOf(normalized[index] ?? '')
    if (valueIndex < 0) return { valid: false, normalized, reason: 'GSTIN contains an unsupported character.' }
    const product = valueIndex * (index % 2 === 0 ? 1 : 2)
    total += Math.floor(product / 36) + (product % 36)
  }
  const expected = GSTIN_CHARSET[(36 - (total % 36)) % 36]
  if (normalized[14] !== expected) return { valid: false, normalized, reason: 'GSTIN checksum is invalid.' }
  return { valid: true, normalized }
}
