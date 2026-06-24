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
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.session.user.role !== 'admin' || !req.session.user.special_permission) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = req.session.user;

  next();
}

module.exports = { requireLogin, requireAdmin };