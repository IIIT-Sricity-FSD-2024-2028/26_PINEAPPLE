import { Injectable, Logger } from '@nestjs/common';
import { AuthStrategy } from './auth-strategy.interface';
import { JwtStrategy } from './jwt.strategy';
import { FirebaseStrategy } from './firebase.strategy';
import { LegacyHeaderStrategy } from './legacy-header.strategy';

@Injectable()
export class AuthStrategyResolver {
  private readonly logger = new Logger(AuthStrategyResolver.name);

  constructor(
    private readonly jwtStrategy: JwtStrategy,
    private readonly firebaseStrategy: FirebaseStrategy,
    private readonly legacyStrategy: LegacyHeaderStrategy,
  ) {}

  getStrategy(): AuthStrategy {
    const mode = this.getMode();
    if (mode === 'legacy') return this.legacyStrategy;
    if (mode === 'firebase') return this.firebaseStrategy;
    return this.jwtStrategy;
  }

  getMode(): 'jwt' | 'firebase' | 'legacy' {
    const rawMode = (process.env.AUTH_MODE || 'jwt').trim().toLowerCase();
    if (rawMode === 'legacy' || rawMode === 'firebase') return rawMode;
    return 'jwt';
  }
}
