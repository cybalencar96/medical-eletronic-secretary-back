/**
 * User role enumeration for role-based access control
 */
export enum UserRole {
  DOCTOR = 'doctor',
  SECRETARY = 'secretary',
}

/**
 * User entity interface representing authenticated users
 */
export interface User {
  userId: string;
  username: string;
  password: string; // bcrypt-hashed password
  role: UserRole;
}

/**
 * JWT payload structure embedded in tokens
 */
export interface JWTPayload {
  userId: string;
  username: string;
  role: UserRole;
}

/**
 * Login request body schema
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Login response structure
 */
export interface LoginResponse {
  success: true;
  data: {
    token: string;
    user: {
      userId: string;
      username: string;
      role: UserRole;
    };
  };
}
