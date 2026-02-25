export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResult {
  isAuthenticated: boolean;
  provider: string;
  user: AuthUser | null;
}

export interface AuthProvider {
  getAuthStatus(): AuthResult;
}

/**
 * MVP auth stub with explicit provider interface boundary.
 * TODO(auth): swap this implementation for real provider (e.g. Clerk/Auth0/Google Workspace SSO)
 * without changing route handlers/middleware call sites.
 */
export class SingleUserAuthStubProvider implements AuthProvider {
  constructor(
    private readonly enabled: boolean,
    private readonly user: AuthUser
  ) {}

  getAuthStatus(): AuthResult {
    if (!this.enabled) {
      return {
        isAuthenticated: false,
        provider: 'single-user-stub',
        user: null
      };
    }

    return {
      isAuthenticated: true,
      provider: 'single-user-stub',
      user: this.user
    };
  }
}
