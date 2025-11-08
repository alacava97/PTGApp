function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.redirect('/login.html');
  }

  next();
}

module.exports = { requireLogin };

