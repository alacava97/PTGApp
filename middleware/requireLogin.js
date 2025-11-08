function requireLogin(req, res, next) {
  if (req.session.user.role != 'admin') {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.redirect('public/login.html');
  }

  next();
}

module.exports = { requireLogin };

