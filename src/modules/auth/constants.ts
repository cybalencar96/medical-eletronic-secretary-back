import { User, UserRole } from '../../shared/types/auth.types';

/**
 * Hardcoded user list for MVP authentication.
 *
 * Passwords are pre-hashed using bcrypt with 10 salt rounds.
 * In production, users would be stored in a database.
 *
 * Default credentials:
 * - Doctor: username="doctor", password="doctor123"
 * - Secretary: username="secretary", password="secretary123"
 *
 * IMPORTANT: These are development credentials and should be changed
 * before deploying to production.
 */
export const HARDCODED_USERS: User[] = [
  {
    userId: '550e8400-e29b-41d4-a716-446655440001',
    username: 'doctor',
    // Bcrypt hash of "doctor123" (10 rounds)
    password: '$2b$10$zTbNZbnSXCqNEx7baGLRo.ucTklnLxLQJi77/OE83hsLw.CiLO2xC',
    role: UserRole.DOCTOR,
  },
  {
    userId: '550e8400-e29b-41d4-a716-446655440002',
    username: 'secretary',
    // Bcrypt hash of "secretary123" (10 rounds)
    password: '$2b$10$YkYyVeWMCD5wIWqodrh9mOXJ2CW8teGL6UamRUitMxu3JF1kTfp0y',
    role: UserRole.SECRETARY,
  },
];
