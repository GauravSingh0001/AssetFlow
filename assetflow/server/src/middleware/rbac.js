export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// Convenience middleware
export const adminOnly = requireRole('Admin');
export const managerUp = requireRole('Admin', 'AssetManager');
export const headUp = requireRole('Admin', 'AssetManager', 'DeptHead');
