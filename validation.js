const MAX_PASSWORD_LENGTH = 30;
const MAX_PASSCODE_LENGTH = 6;

class ValidationUtil {
  static validatePassword(password, confirmPassword) {
    if (!password || !confirmPassword) {
      throw new Error('Please fill in all fields');
    }
    
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new Error(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
    }
  }

  static validatePasscode(passcode) {
    if (!passcode) {
      throw new Error('Please enter a passcode');
    }
    
    if (!/^\d+$/.test(passcode)) {
      throw new Error('Passcode must contain only digits');
    }

    if (passcode.length > MAX_PASSCODE_LENGTH) {
      throw new Error(`Passcode cannot exceed ${MAX_PASSCODE_LENGTH} digits`);
    }
  }
}

window.ValidationUtil = ValidationUtil; 