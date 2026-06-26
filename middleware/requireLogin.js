function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/admin')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.redirect('/public/login.html');
  }

  if (req.session.user.role != 'admin') {
    return res.redirect('/public/login.html');
  }

  req.user = req.session.user;
  
  next();  
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return denyAccess(req, res);
  }

  if (req.session.user.role !== 'admin' || !req.session.user.special_permission) {
    return denyAccess(req, res);
  }

  req.user = req.session.user;
  next();
}

function denyAccess(req, res) {
  if (req.originalUrl.startsWith('/admin')) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.redirect('/public/oops.html');
}

module.exports = { requireLogin, requireAdmin };