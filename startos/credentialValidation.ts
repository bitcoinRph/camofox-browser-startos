export const requireAsciiCredential = (
  value: unknown,
  length: number,
  label: string,
): string => {
  const pattern = new RegExp(`^[A-Za-z0-9]{${length}}$`)
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(
      `${label} must be exactly ${length} ASCII letters or numbers`,
    )
  }
  return value
}
