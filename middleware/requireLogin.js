function requireLogin(req, res, next) {
  console.log(req.session.user);
  if (!req.session.user) {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.redirect('public/login.html');
  }

  next();
}

module.exports = { requireLogin };

