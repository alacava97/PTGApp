function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.redirect('public/login.html');
  }

  if (req.session.user.role != 'admin') {
    return res.redirect('public/login.html');
  }

  req.user = req.session.user;
  
  next();  
}

module.exports = { requireLogin };

