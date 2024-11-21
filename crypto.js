class CryptoUtil {
  static async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static async verifyPassword(inputPassword, storedHash) {
    const inputHash = await this.hashPassword(inputPassword);
    return inputHash === storedHash;
  }
} 