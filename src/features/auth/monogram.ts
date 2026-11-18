/** First letter of the name, for the square monogram. */
export function monogram(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?';
}
