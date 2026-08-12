// Central admin role/section mapping. Client-safe (no server imports).
// `admin` = super admin; sees everything and manages roles.
export type ManagementRole = "admin" | "moderator" | "finance" | "content" | "support";

export const MANAGEMENT_ROLES: ManagementRole[] = [
  "admin",
  "moderator",
  "finance",
  "content",
  "support",
];

export const ROLE_LABELS: Record<ManagementRole, string> = {
  admin: "Super Admin",
  moderator: "Moderator",
  finance: "Finance",
  content: "Content",
  support: "Support",
};

export const ROLE_DESCRIPTIONS: Record<ManagementRole, string> = {
  admin: "Full access to every admin feature, including managing other admins.",
  moderator: "Reviews reports, moderates products & bounties.",
  finance: "Payouts, system wallets, affiliates.",
  content: "Blog, courses, campaigns, categories, communications.",
  support: "User management & audit log for handling tickets.",
};

/** Map admin route path → roles that may view it. `admin` always allowed. */
export const SECTION_ACCESS: Record<string, ManagementRole[]> = {
  "/admin": ["admin", "moderator", "finance", "content", "support"],
  "/admin/users": ["admin", "support"],
  "/admin/sellers": ["admin", "moderator", "support"],
  "/admin/products": ["admin", "moderator", "content"],

  "/admin/campaigns": ["admin", "content"],
  "/admin/ad-inquiries": ["admin", "content"],
  "/admin/bounties": ["admin", "moderator", "finance"],
  "/admin/courses": ["admin", "content"],
  "/admin/blog": ["admin", "content"],
  "/admin/system-wallets": ["admin", "finance"],
  "/admin/payouts": ["admin", "finance"],
  "/admin/affiliates": ["admin", "finance"],
  "/admin/cashback-wallet": ["admin", "finance"],
  "/admin/disputes": ["admin", "moderator", "finance", "support"],
  "/admin/communications": ["admin", "content"],
  "/admin/categories": ["admin", "content"],
  "/admin/marketplace-controls": ["admin", "moderator", "content"],
  "/admin/circle-categories": ["admin", "content"],

  "/admin/tools": ["admin", "content"],
  "/admin/features": ["admin"],
  "/admin/audit": ["admin", "support"],
  "/admin/settings": ["admin"],
  "/admin/reports": ["admin", "moderator"],
  "/admin/management-users": ["admin"],
};

export function canAccessSection(path: string, roles: ManagementRole[]): boolean {
  if (roles.includes("admin")) return true;
  const allowed = SECTION_ACCESS[path];
  if (!allowed) return false;
  return roles.some((r) => allowed.includes(r));
}
