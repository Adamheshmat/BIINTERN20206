export interface ProductPermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: { userName: string; role: string; buid: string };
  permissions: ProductPermissions;
}
